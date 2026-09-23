import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks de Firestore ---
// No hablamos con Firebase real: solo verificamos que las funciones de
// lib/pedidos.js arman los documentos correctos y llaman a las funciones
// correctas del SDK con los datos correctos.
const addDoc = vi.fn(async () => ({ id: "nuevo-id" }));
const updateDoc = vi.fn(async () => {});
const increment = vi.fn((n) => ({ __op: "increment", value: n }));
const serverTimestamp = vi.fn(() => "SERVER_TIMESTAMP");
const collection = vi.fn((...args) => ({ __type: "collection", path: args.slice(1) }));
// `id` no es enumerable para que las comparaciones de rutas en los tests
// sigan viendo solo { __type, path }.
const conId = (ref, id) => Object.defineProperty(ref, "id", { value: id });
const doc = vi.fn((...args) =>
  // doc(collectionRef) sin ID genera uno nuevo, como el SDK real.
  args.length === 1
    ? conId({ __type: "doc", path: [...args[0].path, "abono-nuevo"] }, "abono-nuevo")
    : conId({ __type: "doc", path: args.slice(1) }, args[args.length - 1])
);
const query = vi.fn((...args) => ({ __type: "query", args }));
const orderBy = vi.fn();
const where = vi.fn();
const onSnapshot = vi.fn(() => () => {});
const getDocs = vi.fn(async () => ({ docs: [] }));
const batch = {
  delete: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn(async () => {}),
};
// Saldo que "devuelve" Firestore al leer el pedido antes de abonar.
let saldoEnFirestore = 500;
const getDoc = vi.fn(async () => ({ data: () => ({ saldoPendiente: saldoEnFirestore }) }));
const collectionGroup = vi.fn((_db, name) => ({ __type: "collectionGroup", name }));

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  collectionGroup: (...args) => collectionGroup(...args),
  addDoc: (...args) => addDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  doc: (...args) => doc(...args),
  onSnapshot: (...args) => onSnapshot(...args),
  query: (...args) => query(...args),
  orderBy: (...args) => orderBy(...args),
  serverTimestamp: (...args) => serverTimestamp(...args),
  increment: (...args) => increment(...args),
  where: (...args) => where(...args),
  getDoc: (...args) => getDoc(...args),
  getDocs: (...args) => getDocs(...args),
  writeBatch: () => batch,
}));

vi.mock("../firebase", () => ({ db: {} }));

// La sincronización por cambios se prueba en elementos.test.js; aquí solo
// importa con qué configuración se pide.
const escucharPorCambios = vi.fn(() => () => {});
vi.mock("./sincronia", () => ({
  escucharPorCambios: (...args) => escucharPorCambios(...args),
}));

const {
  crearPedido,
  marcarEntregado,
  marcarCambioPendiente,
  registrarAbono,
  eliminarPedido,
  listenPedidosDeUnidad,
  sinBorrados,
} = await import("./pedidos");

beforeEach(() => {
  addDoc.mockClear();
  updateDoc.mockClear();
  increment.mockClear();
  onSnapshot.mockClear();
  where.mockClear();
  query.mockClear();
});

describe("crearPedido", () => {
  it("arranca con saldoPendiente igual al precio total y sin entregar", async () => {
    await crearPedido("el1", {
      articulo: "Pantalón — talla 10",
      precioTotal: "350",
      productoNombre: "Pantalón",
      talla: "10",
      color: "",
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.precioTotal).toBe(350);
    expect(datos.saldoPendiente).toBe(350);
    expect(datos.entregado).toBe(false);
    expect(datos.cambioPendiente).toBe(false);
    expect(datos.cantidad).toBe(1); // default cuando no se especifica
  });
});

describe("marcarEntregado", () => {
  it("al entregar, guarda quién entregó y la fecha", async () => {
    await marcarEntregado("el1", "ped1", true, "Carlos");
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos.entregado).toBe(true);
    expect(datos.quienEntrego).toBe("Carlos");
    expect(datos.fechaEntrega).toBe("SERVER_TIMESTAMP");
  });

  it("al desmarcar la entrega, limpia quién entregó y la fecha", async () => {
    await marcarEntregado("el1", "ped1", false, "Carlos");
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos.entregado).toBe(false);
    expect(datos.quienEntrego).toBe("");
    expect(datos.fechaEntrega).toBeNull();
  });
});

describe("marcarCambioPendiente", () => {
  it("guarda el motivo y la fecha al marcar un cambio pendiente", async () => {
    await marcarCambioPendiente("el1", "ped1", true, "Talla equivocada");
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos.cambioPendiente).toBe(true);
    expect(datos.motivoCambio).toBe("Talla equivocada");
    expect(datos.fechaCambioSolicitado).toBe("SERVER_TIMESTAMP");
  });

  it("limpia el motivo y la fecha al resolver el cambio", async () => {
    await marcarCambioPendiente("el1", "ped1", false, "");
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos.cambioPendiente).toBe(false);
    expect(datos.motivoCambio).toBe("");
    expect(datos.fechaCambioSolicitado).toBeNull();
  });
});

describe("registrarAbono", () => {
  beforeEach(() => {
    batch.set.mockClear();
    batch.update.mockClear();
    batch.commit.mockClear();
    getDoc.mockClear();
    saldoEnFirestore = 500;
  });

  it("guarda el abono y el nuevo saldo en un solo batch, enlazados por ultimoAbonoId", async () => {
    await registrarAbono("el1", "ped1", { monto: "100", quienRecibio: "Carlos", unidad: "2a" });

    // Todo o nada: nada se escribe fuera del batch
    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);

    const [abonoRef, abono] = batch.set.mock.calls[0];
    expect(abono.monto).toBe(100);
    expect(abono.unidad).toBe("2a");
    expect(abono.quienRecibio).toBe("Carlos");
    expect(typeof abono.fechaLocal).toBe("string");
    expect(typeof abono.horaLocal).toBe("string");

    // Saldo calculado (500 - 100), no increment(): las reglas exigen el valor exacto
    const [, cambios] = batch.update.mock.calls[0];
    expect(cambios.saldoPendiente).toBe(400);
    expect(cambios.ultimoAbonoId).toBe(abonoRef.id);
  });

  it("usa el saldo que ya conoce quien llama, sin volver a leer el pedido", async () => {
    await registrarAbono("el1", "ped1", {
      monto: 100,
      pedido: { articulo: "Playera", saldoPendiente: 250 },
    });
    expect(getDoc).not.toHaveBeenCalled();
    expect(batch.update.mock.calls[0][1].saldoPendiente).toBe(150);
  });

  it("copia el nombre del elemento y los datos del pedido al abono", async () => {
    await registrarAbono("el1", "ped1", {
      monto: 100,
      elementoNombre: "Ana",
      pedido: { articulo: "Playera — Negra", productoNombre: "Playera", talla: "M", color: "Negra", saldoPendiente: 250 },
    });
    const [, abono] = batch.set.mock.calls[0];
    expect(abono).toMatchObject({
      elementoNombre: "Ana",
      articulo: "Playera — Negra",
      productoNombre: "Playera",
      talla: "M",
      color: "Negra",
      saldoTras: 150,
    });
  });

  it("sin datos para copiar no agrega campos extra", async () => {
    await registrarAbono("el1", "ped1", { monto: 10 });
    const [, abono] = batch.set.mock.calls[0];
    expect(abono).not.toHaveProperty("articulo");
    expect(abono).not.toHaveProperty("elementoNombre");
  });

  it("varios abonos seguidos descuentan del saldo vigente en cada lectura", async () => {
    await registrarAbono("el1", "ped1", { monto: "50", quienRecibio: "A" });
    saldoEnFirestore = 450;
    await registrarAbono("el1", "ped1", { monto: "75", quienRecibio: "B" });

    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.update.mock.calls[0][1].saldoPendiente).toBe(450);
    expect(batch.update.mock.calls[1][1].saldoPendiente).toBe(375);
  });

  it("rechaza un monto de 0 o negativo sin escribir nada", async () => {
    await expect(registrarAbono("el1", "ped1", { monto: "0" })).rejects.toThrow();
    await expect(registrarAbono("el1", "ped1", { monto: "-20" })).rejects.toThrow();
    expect(batch.commit).not.toHaveBeenCalled();
  });
});

describe("eliminarPedido", () => {
  it("borra el pedido y sus abonos y deja su baja, todo en un solo batch", async () => {
    batch.delete.mockClear();
    batch.set.mockClear();
    batch.commit.mockClear();
    getDocs.mockResolvedValueOnce({ docs: [{ ref: "a1" }, { ref: "a2" }] });
    await eliminarPedido("el1", "p1", "2da Unidad");
    expect(batch.delete).toHaveBeenCalledWith("a1");
    expect(batch.delete).toHaveBeenCalledWith("a2");
    expect(batch.delete).toHaveBeenCalledWith({
      __type: "doc",
      path: ["elementos", "el1", "pedidos", "p1"],
    });
    expect(batch.delete).toHaveBeenCalledTimes(3);
    expect(batch.set).toHaveBeenCalledWith(
      { __type: "doc", path: ["bajasPedidos", "el1_p1"] },
      { unidad: "2da Unidad", elementoId: "el1", pedidoId: "p1", en: "SERVER_TIMESTAMP" }
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

describe("actualizadoEn (sincronización por cambios)", () => {
  it("toda escritura en un pedido lleva la hora del servidor", async () => {
    await crearPedido("el1", { articulo: "Gorra", precioTotal: 100, unidad: "U" });
    expect(addDoc.mock.calls.at(-1)[1].actualizadoEn).toBe("SERVER_TIMESTAMP");
    await marcarEntregado("el1", "p1", true, "Ana");
    expect(updateDoc.mock.calls.at(-1)[1].actualizadoEn).toBe("SERVER_TIMESTAMP");
    await marcarCambioPendiente("el1", "p1", true, "Talla");
    expect(updateDoc.mock.calls.at(-1)[1].actualizadoEn).toBe("SERVER_TIMESTAMP");
    batch.update.mockClear();
    await registrarAbono("el1", "p1", { monto: 10, pedido: { saldoPendiente: 100 } });
    expect(batch.update.mock.calls[0][1].actualizadoEn).toBe("SERVER_TIMESTAMP");
  });
});

describe("listenPedidosDeUnidad", () => {
  it("sincroniza por cambios los pedidos de esa Unidad y anota su elemento", () => {
    escucharPorCambios.mockClear();
    listenPedidosDeUnidad(() => {}, "2da Unidad");
    const [config] = escucharPorCambios.mock.calls[0];
    expect(config.clave).toBe("pedidos:2da Unidad");
    expect(collectionGroup).toHaveBeenCalledWith({}, "pedidos");
    expect(where).toHaveBeenCalledWith("unidad", "==", "2da Unidad");
    const convertido = config.convertir({
      id: "p1",
      ref: { parent: { parent: { id: "el9" } } },
      data: () => ({ articulo: "Gorra" }),
    });
    expect(convertido).toEqual({ id: "p1", elementoId: "el9", articulo: "Gorra" });
  });
});

describe("sinBorrados", () => {
  const ts = (ms) => ({ toMillis: () => ms });
  const pedido = (id, actualizadoEn) => ({ id, elementoId: "e1", actualizadoEn });

  it("quita los pedidos con baja", () => {
    const pedidos = [pedido("p1", ts(100)), pedido("p2", ts(100))];
    const bajas = [{ id: "e1_p1", en: ts(200) }];
    expect(sinBorrados(pedidos, bajas).map((p) => p.id)).toEqual(["p2"]);
  });

  it("un pedido reescrito después de su baja (p. ej. restaurado) vuelve a contar", () => {
    const bajas = [{ id: "e1_p1", en: ts(200) }];
    expect(sinBorrados([pedido("p1", ts(300))], bajas)).toHaveLength(1);
  });

  it("un pedido antiguo sin actualizadoEn con baja también se quita", () => {
    expect(sinBorrados([pedido("p1", undefined)], [{ id: "e1_p1", en: ts(1) }])).toEqual([]);
  });
});
