import { describe, it, expect, vi, beforeEach } from "vitest";

const lote = { delete: vi.fn(), commit: vi.fn(async () => {}) };
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __type: "collection" })),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: (...args) => doc(...args),
  onSnapshot: vi.fn(),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  serverTimestamp: () => "SERVER_TIMESTAMP",
  writeBatch: () => lote,
}));
vi.mock("../firebase", () => ({ db: {} }));

const { compararUnidades, existeUnidad, eliminarUnidades, usoDeUnidades } = await import("./unidades");

beforeEach(() => {
  lote.delete.mockClear();
  lote.commit.mockClear();
});

describe("orden y duplicados", () => {
  it("se ordenan numéricamente: 2a antes que 10a", () => {
    const orden = ["10a", "2a", "1a", "19a"].map((nombre) => ({ nombre })).sort(compararUnidades);
    expect(orden.map((u) => u.nombre)).toEqual(["1a", "2a", "10a", "19a"]);
  });

  it("detecta una Unidad repetida sin importar mayúsculas ni espacios", () => {
    const unidades = [{ nombre: "1a" }, { nombre: "10a" }];
    expect(existeUnidad(unidades, " 1A ")).toBe(true);
    expect(existeUnidad(unidades, "2a")).toBe(false);
  });
});

describe("eliminarUnidades", () => {
  it("borra todas las Unidades pedidas en un solo lote", async () => {
    await eliminarUnidades(["a", "b", "c"]);
    expect(lote.delete).toHaveBeenCalledTimes(3);
    expect(lote.delete).toHaveBeenCalledWith({ __type: "doc", path: ["unidades", "b"] });
    expect(lote.commit).toHaveBeenCalledTimes(1);
  });

  it("parte en varios lotes cuando son muchas", async () => {
    await eliminarUnidades(Array.from({ length: 900 }, (_, i) => `u${i}`));
    expect(lote.commit).toHaveBeenCalledTimes(3);
  });

  it("sin Unidades no escribe nada", async () => {
    await eliminarUnidades([]);
    expect(lote.commit).not.toHaveBeenCalled();
  });
});

describe("usoDeUnidades", () => {
  it("cuenta elementos y usuarios por Unidad", () => {
    const uso = usoDeUnidades(
      [{ nombre: "1a" }, { nombre: "2a" }],
      [{ unidad: "1a" }, { unidad: "1a" }, { unidad: "2a" }, { unidad: "otra" }],
      [{ unidad: "2a" }, { unidad: null }]
    );
    expect(uso).toEqual({
      "1a": { elementos: 2, usuarios: 0 },
      "2a": { elementos: 1, usuarios: 1 },
    });
  });
});
