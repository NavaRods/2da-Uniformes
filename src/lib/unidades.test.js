import { describe, it, expect, vi, beforeEach } from "vitest";

const lote = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
const getDocs = vi.fn();
const doc = vi.fn(() => ({ __type: "doc-nuevo" }));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, nombre) => ({ __type: "collection", nombre })),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: (...args) => doc(...args),
  getDocs: (...args) => getDocs(...args),
  onSnapshot: vi.fn(),
  query: vi.fn((ref) => ref),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => "SERVER_TIMESTAMP",
  writeBatch: () => lote,
}));
vi.mock("../firebase", () => ({ db: {} }));

const { cargarUnidadesIniciales, compararUnidades, UNIDADES_INICIALES } = await import("./unidades");

const docsDeUnidades = (nombres) => ({ docs: nombres.map((nombre) => ({ data: () => ({ nombre }) })) });
const elementos = (n) => ({
  forEach: (fn) => Array.from({ length: n }, (_, i) => fn({ ref: `el${i}` })),
});

beforeEach(() => {
  lote.set.mockClear();
  lote.update.mockClear();
  lote.commit.mockClear();
  getDocs.mockReset();
});

describe("lista de Unidades", () => {
  it("son las 15 que existen, sin la 5a, 6a, 9a ni 16a", () => {
    expect(UNIDADES_INICIALES).toHaveLength(15);
    for (const faltante of ["5a", "6a", "9a", "16a"]) {
      expect(UNIDADES_INICIALES).not.toContain(faltante);
    }
    expect(new Set(UNIDADES_INICIALES).size).toBe(15);
  });

  it("se ordenan numéricamente: 2a antes que 10a", () => {
    const orden = ["10a", "2a", "1a", "19a"].map((nombre) => ({ nombre })).sort(compararUnidades);
    expect(orden.map((u) => u.nombre)).toEqual(["1a", "2a", "10a", "19a"]);
  });
});

describe("cargarUnidadesIniciales", () => {
  it("crea las 15 cuando no hay ninguna y pasa los elementos de 2da Unidad a 2a", async () => {
    getDocs.mockResolvedValueOnce(docsDeUnidades([])).mockResolvedValueOnce(elementos(3));
    const r = await cargarUnidadesIniciales();
    expect(r).toEqual({ creadas: 15, yaExistian: 0, renombrados: 3 });
    expect(lote.set).toHaveBeenCalledTimes(15);
    expect(lote.update).toHaveBeenCalledTimes(3);
    expect(lote.update).toHaveBeenCalledWith("el0", { unidad: "2a" });
    expect(lote.commit).toHaveBeenCalledTimes(1);
  });

  it("solo crea las que faltan", async () => {
    getDocs
      .mockResolvedValueOnce(docsDeUnidades(["1a", "2a", "3a"]))
      .mockResolvedValueOnce(elementos(0));
    const r = await cargarUnidadesIniciales();
    expect(r).toMatchObject({ creadas: 12, yaExistian: 3, renombrados: 0 });
    expect(lote.set).toHaveBeenCalledTimes(12);
    const nombres = lote.set.mock.calls.map(([, datos]) => datos.nombre);
    expect(nombres).not.toContain("1a");
  });

  it("repetirla con todo ya cargado no escribe nada", async () => {
    getDocs
      .mockResolvedValueOnce(docsDeUnidades(UNIDADES_INICIALES))
      .mockResolvedValueOnce(elementos(0));
    const r = await cargarUnidadesIniciales();
    expect(r).toEqual({ creadas: 0, yaExistian: 15, renombrados: 0 });
    expect(lote.commit).not.toHaveBeenCalled();
  });

  it("parte en varios lotes cuando hay muchos elementos", async () => {
    getDocs.mockResolvedValueOnce(docsDeUnidades([])).mockResolvedValueOnce(elementos(900));
    await cargarUnidadesIniciales();
    expect(lote.commit).toHaveBeenCalledTimes(3); // 915 operaciones en lotes de 400
  });
});
