import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "nuevo-id" }));
const updateDoc = vi.fn(async () => {});
const serverTimestamp = vi.fn(() => "SERVER_TIMESTAMP");
const collection = vi.fn(() => ({ __type: "collection" }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((...args) => args);
const where = vi.fn((...args) => ({ __type: "where", args }));
const orderBy = vi.fn((...args) => ({ __type: "orderBy", args }));
const onSnapshot = vi.fn();

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
}));

vi.mock("../firebase", () => ({ db: {} }));

const { crearElemento, actualizarElemento, listenElementos, estaActivo } = await import(
  "./elementos"
);

beforeEach(() => {
  addDoc.mockClear();
  updateDoc.mockClear();
  query.mockClear();
  where.mockClear();
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
  it("pasa los cambios directo a Firestore", async () => {
    await actualizarElemento("el1", { nombre: "Nuevo nombre" });
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos).toEqual({ nombre: "Nuevo nombre" });
  });
});

describe("listenElementos", () => {
  it("sin unidad, consulta sin filtro (Admin ve todo)", () => {
    listenElementos(() => {});
    expect(where).not.toHaveBeenCalled();
  });

  it("con unidad, filtra por ese campo (Operador)", () => {
    listenElementos(() => {}, "3ra Unidad");
    expect(where).toHaveBeenCalledWith("unidad", "==", "3ra Unidad");
  });
});
