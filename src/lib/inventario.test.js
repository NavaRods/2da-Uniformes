import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks de Firestore ---
const increment = vi.fn((n) => ({ __op: "increment", value: n }));
const serverTimestamp = vi.fn(() => "SERVER_TIMESTAMP");
const setDoc = vi.fn(async () => {});
const onSnapshot = vi.fn(() => () => {});
const collection = vi.fn((...args) => ({ __type: "collection", path: args.slice(1) }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((...args) => ({ __type: "query", args }));
const where = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  doc: (...args) => doc(...args),
  increment: (...args) => increment(...args),
  onSnapshot: (...args) => onSnapshot(...args),
  query: (...args) => query(...args),
  serverTimestamp: (...args) => serverTimestamp(...args),
  setDoc: (...args) => setDoc(...args),
  where: (...args) => where(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

const { recibirUniforme, fijarInventario, idInventario, existenciasPorVariante, recibidoPorProducto } =
  await import("./inventario");

const variante = { productoNombre: "Gorra", talla: "5", color: "" };

beforeEach(() => {
  setDoc.mockClear();
});

describe("recibirUniforme", () => {
  it("suma las piezas recibidas por increment, en la Unidad y variante correctas", async () => {
    await recibirUniforme("1a", variante, 3);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, datos, opciones] = setDoc.mock.calls[0];
    expect(ref.path).toEqual(["inventario", idInventario("1a", variante)]);
    expect(datos.cantidad).toEqual({ __op: "increment", value: 3 });
    expect(opciones).toEqual({ merge: true });
  });

  it("rechaza cantidades vacías, en cero o negativas", () => {
    expect(() => recibirUniforme("1a", variante, "")).toThrow();
    expect(() => recibirUniforme("1a", variante, 0)).toThrow();
    expect(() => recibirUniforme("1a", variante, -2)).toThrow();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("con maxFalta, no deja recibir más piezas de las que aún faltan", async () => {
    // Deben 4, ya hay 0 recibidas: no se aceptan 100.
    expect(() => recibirUniforme("1a", variante, 100, 4)).toThrow(/no puedes recibir más/);
    expect(setDoc).not.toHaveBeenCalled();
    // Exactamente lo que falta sí se acepta.
    await recibirUniforme("1a", variante, 4, 4);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it("con maxFalta en 0 (ya está todo recibido), rechaza cualquier cantidad", () => {
    expect(() => recibirUniforme("1a", variante, 1, 0)).toThrow(/ya está recibido/i);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe("fijarInventario", () => {
  it("guarda la cantidad exacta", async () => {
    await fijarInventario("1a", variante, 7);
    const [, datos] = setDoc.mock.calls[0];
    expect(datos.cantidad).toBe(7);
  });

  it("rechaza cantidades negativas", () => {
    expect(() => fijarInventario("1a", variante, -1)).toThrow();
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe("existenciasPorVariante y recibidoPorProducto", () => {
  const inventario = [
    { id: "a", unidad: "1a", productoNombre: "Gorra", talla: "5", color: "", cantidad: 2 },
    { id: "b", unidad: "2a", productoNombre: "Gorra", talla: "5", color: "", cantidad: 1 },
    { id: "c", unidad: "1a", productoNombre: "Gorra", talla: "10", color: "", cantidad: 0 },
  ];

  it("suma existencias de la misma variante entre Unidades", () => {
    const mapa = existenciasPorVariante(inventario);
    expect(mapa.get("Gorra|5|")).toBe(3);
  });

  it("agrupa por producto y omite variantes en cero", () => {
    const productos = recibidoPorProducto(inventario);
    expect(productos).toHaveLength(1);
    expect(productos[0].piezas).toBe(3);
    expect(productos[0].variantes).toHaveLength(2);
  });
});
