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
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((ref) => ref);
const orderBy = vi.fn();
const where = vi.fn();
const onSnapshot = vi.fn();
const getDocs = vi.fn(async () => ({ docs: [] }));
const batch = { delete: vi.fn(), set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
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
  getDocs: (...args) => getDocs(...args),
  writeBatch: () => batch,
}));

vi.mock("../firebase", () => ({ db: {} }));

const {
  crearPedido,
  marcarEntregado,
  marcarCambioPendiente,
  registrarAbono,
  eliminarPedido,
} = await import("./pedidos");

beforeEach(() => {
  addDoc.mockClear();
  updateDoc.mockClear();
  increment.mockClear();
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
    increment.mockClear();
  });

  it("crea el abono y descuenta el saldo con increment negativo, en un solo batch", async () => {
    await registrarAbono("el1", "ped1", { monto: "100", quienRecibio: "Carlos" });

    expect(batch.set).toHaveBeenCalledTimes(1);
    const [, abono] = batch.set.mock.calls[0];
    expect(abono.monto).toBe(100);
    expect(abono.quienRecibio).toBe("Carlos");
    expect(typeof abono.fechaLocal).toBe("string");
    expect(typeof abono.horaLocal).toBe("string");

    expect(batch.update).toHaveBeenCalledTimes(1);
    const [, cambios] = batch.update.mock.calls[0];
    expect(increment).toHaveBeenCalledWith(-100);
    expect(cambios.saldoPendiente).toEqual({ __op: "increment", value: -100 });
    expect(batch.commit).toHaveBeenCalledTimes(1);
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

  it("varios abonos seguidos siguen descontando del mismo pedido", async () => {
    await registrarAbono("el1", "ped1", { monto: "50", quienRecibio: "A" });
    await registrarAbono("el1", "ped1", { monto: "75", quienRecibio: "B" });

    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(increment).toHaveBeenNthCalledWith(1, -50);
    expect(increment).toHaveBeenNthCalledWith(2, -75);
  });
});

describe("eliminarPedido", () => {
  it("borra el pedido y todos sus abonos en un solo batch", async () => {
    batch.delete.mockClear();
    batch.commit.mockClear();
    getDocs.mockResolvedValueOnce({ docs: [{ ref: "a1" }, { ref: "a2" }] });
    await eliminarPedido("el1", "p1");
    expect(batch.delete).toHaveBeenCalledWith("a1");
    expect(batch.delete).toHaveBeenCalledWith("a2");
    expect(batch.delete).toHaveBeenCalledWith({
      __type: "doc",
      path: ["elementos", "el1", "pedidos", "p1"],
    });
    expect(batch.delete).toHaveBeenCalledTimes(3);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
