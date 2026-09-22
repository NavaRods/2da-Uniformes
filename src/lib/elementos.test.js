import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "nuevo-id" }));
const updateDoc = vi.fn(async () => {});
const serverTimestamp = vi.fn(() => "SERVER_TIMESTAMP");
const collection = vi.fn(() => ({ __type: "collection" }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((...args) => args);
const where = vi.fn((...args) => ({ __type: "where", args }));
const orderBy = vi.fn((...args) => ({ __type: "orderBy", args }));
// Listeners abiertos: { consulta, opciones, alCambiar, alFallar }.
let listeners = [];
const onSnapshot = vi.fn((consulta, ...resto) => {
  const opciones = typeof resto[0] === "object" ? resto.shift() : undefined;
  const [alCambiar, alFallar] = resto;
  listeners.push({ consulta, opciones, alCambiar, alFallar });
  return vi.fn();
});
const getDocsFromCache = vi.fn();
const Timestamp = { fromMillis: (ms) => ({ __ts: ms }) };

// localStorage en memoria (las pruebas corren en Node).
const almacen = new Map();
vi.stubGlobal("localStorage", {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
});

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  addDoc: (...args) => addDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  doc: (...args) => doc(...args),
  onSnapshot: (...args) => onSnapshot(...args),
  query: (...args) => query(...args),
  where: (...args) => where(...args),
  orderBy: (...args) => orderBy(...args),
  serverTimestamp: (...args) => serverTimestamp(...args),
  getDocsFromCache: (...args) => getDocsFromCache(...args),
  getCountFromServer: vi.fn(),
  Timestamp,
}));

vi.mock("../firebase", () => ({ db: {} }));

const { crearElemento, actualizarElemento, listenElementos, estaActivo, SINCRONIA_COMPLETA_MS } =
  await import("./elementos");
const { guardarMarca, leerMarca } = await import("./memoriaLocal");

beforeEach(() => {
  addDoc.mockClear();
  updateDoc.mockClear();
  query.mockClear();
  where.mockClear();
  onSnapshot.mockClear();
  getDocsFromCache.mockReset();
  listeners = [];
  almacen.clear();
});

describe("crearElemento", () => {
  it("guarda la unidad recibida y aplica el grupo por defecto", async () => {
    await crearElemento({ nombre: "Juan Pérez", unidad: "3ra Unidad" });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.nombre).toBe("Juan Pérez");
    expect(datos.unidad).toBe("3ra Unidad");
    expect(datos.grupo).toBe("Varonil");
    expect(datos).not.toHaveProperty("documentacionEntregada");
    expect(datos.telefonos).toEqual([]);
  });

  it("filtra teléfonos vacíos", async () => {
    await crearElemento({ nombre: "Ana", telefonos: ["555", "", "666"] });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.telefonos).toEqual(["555", "666"]);
  });
});

describe("crearElemento: campos nuevos", () => {
  it("guarda grado militar, número de orden y antecedentes", async () => {
    await crearElemento({
      nombre: "Juan Pérez",
      unidad: "2da Unidad",
      gradoMilitar: "Cadete",
      numeroOrden: "V0218001",
      antecedentes: "Sí",
      antecedentesDetalle: "Cadetes de la Marina",
      practicaDeporte: "Sí",
      deporte: "Fútbol",
    });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos).toMatchObject({
      gradoMilitar: "Cadete",
      numeroOrden: "V0218001",
      antecedentes: "Sí",
      antecedentesDetalle: "Cadetes de la Marina",
      practicaDeporte: "Sí",
      deporte: "Fútbol",
    });
  });

  it("el número de orden y los antecedentes son opcionales", async () => {
    await crearElemento({ nombre: "Ana", unidad: "U" });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.numeroOrden).toBe("");
    expect(datos.antecedentes).toBe("");
  });
});

describe("estaActivo", () => {
  it("un elemento con fechaBaja no está activo", () => {
    expect(estaActivo({ nombre: "A" })).toBe(true);
    expect(estaActivo({ nombre: "A", fechaBaja: "2026-09-10" })).toBe(false);
  });
});

describe("actualizarElemento", () => {
  it("pasa los cambios a Firestore con la hora de actualización", async () => {
    await actualizarElemento("el1", { nombre: "Nuevo nombre" });
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos).toEqual({ nombre: "Nuevo nombre", actualizadoEn: "SERVER_TIMESTAMP" });
  });
});

describe("crearElemento: hora de actualización", () => {
  it("un elemento nuevo nace con actualizadoEn (para la sincronización por cambios)", async () => {
    await crearElemento({ nombre: "Ana", unidad: "3ra Unidad" });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.actualizadoEn).toBe("SERVER_TIMESTAMP");
  });
});

// Documento falso de Firestore.
const docFalso = (id, datos, pendiente = false) => ({
  id,
  data: () => datos,
  get: (campo) => datos[campo],
  metadata: { hasPendingWrites: pendiente },
});
const esperar = () => new Promise((r) => setTimeout(r, 0));
const delServidor = () => listeners.find((l) => l.opciones?.source !== "cache");
const deCache = () => listeners.find((l) => l.opciones?.source === "cache");
const filtroCambios = () => where.mock.calls.find(([campo]) => campo === "actualizadoEn");

describe("listenElementos: sincronización por cambios", () => {
  it("la primera vez descarga la Unidad completa y guarda la marca", async () => {
    const recibido = vi.fn();
    listenElementos(recibido, "U1");
    await esperar();

    expect(where).toHaveBeenCalledWith("unidad", "==", "U1");
    expect(filtroCambios()).toBeUndefined();
    expect(deCache()).toBeDefined();

    // La caché no se muestra antes de la primera respuesta del servidor.
    deCache().alCambiar({ docs: [docFalso("b", { nombre: "Beto" })] });
    expect(recibido).not.toHaveBeenCalled();

    const t = { toMillis: () => 5000 };
    delServidor().alCambiar({
      metadata: { fromCache: false },
      size: 2,
      docs: [docFalso("a", { actualizadoEn: t }), docFalso("b", {})],
    });
    expect(recibido).toHaveBeenCalledWith([{ id: "b", nombre: "Beto" }]);
    const marca = leerMarca("elementos:U1");
    expect(marca.desde).toBe(5000);
    expect(marca.n).toBe(2);
  });

  it("con marca vigente y caché completa, solo pide los cambios desde la marca", async () => {
    guardarMarca("elementos:U1", { desde: 10 * 60 * 1000, n: 2, completa: Date.now() });
    getDocsFromCache.mockResolvedValue({ size: 2 });
    const recibido = vi.fn();
    listenElementos(recibido, "U1");
    await esperar();

    const [, op, valor] = filtroCambios();
    expect(op).toBe(">=");
    // Con un margen de 2 minutos antes de la marca.
    expect(valor).toEqual({ __ts: 8 * 60 * 1000 });

    // La lista sale de la caché en cuanto llega (0 lecturas), ordenada por nombre.
    deCache().alCambiar({
      docs: [docFalso("z", { nombre: "Zoe" }), docFalso("a", { nombre: "Ana" })],
    });
    expect(recibido).toHaveBeenLastCalledWith([
      { id: "a", nombre: "Ana" },
      { id: "z", nombre: "Zoe" },
    ]);
  });

  it("si la caché perdió elementos, vuelve a descargar completo", async () => {
    guardarMarca("elementos:U1", { desde: 1000, n: 40, completa: Date.now() });
    getDocsFromCache.mockResolvedValue({ size: 3 });
    listenElementos(() => {}, "U1");
    await esperar();
    expect(filtroCambios()).toBeUndefined();
  });

  it("cada SINCRONIA_COMPLETA_MS vuelve a descargar completo", async () => {
    guardarMarca("elementos:U1", {
      desde: 1000,
      n: 2,
      completa: Date.now() - SINCRONIA_COMPLETA_MS - 1,
    });
    getDocsFromCache.mockResolvedValue({ size: 2 });
    listenElementos(() => {}, "U1");
    await esperar();
    expect(filtroCambios()).toBeUndefined();
  });

  it("los cambios aún no confirmados no mueven la marca", async () => {
    guardarMarca("elementos:U1", { desde: 1000, n: 1, completa: Date.now() });
    getDocsFromCache.mockResolvedValue({ size: 1 });
    listenElementos(() => {}, "U1");
    await esperar();
    delServidor().alCambiar({
      metadata: { fromCache: false },
      docs: [
        docFalso("a", { actualizadoEn: { toMillis: () => 3000 } }),
        docFalso("b", { actualizadoEn: { toMillis: () => 9000 } }, true),
      ],
    });
    expect(leerMarca("elementos:U1").desde).toBe(3000);
  });
});
