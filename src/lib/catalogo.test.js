import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "nuevo-id" }));
const updateDoc = vi.fn(async () => {});
const deleteDoc = vi.fn(async () => {});
const arrayUnion = vi.fn((v) => ({ __op: "arrayUnion", value: v }));
const getDocs = vi.fn();
const collection = vi.fn(() => ({ __type: "collection" }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((ref) => ref);
const orderBy = vi.fn();
const onSnapshot = vi.fn();

const batchDelete = vi.fn();
const batchCommit = vi.fn(async () => {});
const writeBatch = vi.fn(() => ({ delete: batchDelete, commit: batchCommit }));

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  addDoc: (...args) => addDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  deleteDoc: (...args) => deleteDoc(...args),
  doc: (...args) => doc(...args),
  onSnapshot: (...args) => onSnapshot(...args),
  query: (...args) => query(...args),
  orderBy: (...args) => orderBy(...args),
  arrayUnion: (...args) => arrayUnion(...args),
  getDocs: (...args) => getDocs(...args),
  writeBatch: (...args) => writeBatch(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

const {
  crearProducto,
  agregarTalla,
  eliminarProducto,
  vaciarCatalogo,
  requiereTalla,
  TALLA_TIPO,
} = await import("./catalogo");

beforeEach(() => {
  addDoc.mockClear();
  updateDoc.mockClear();
  deleteDoc.mockClear();
  arrayUnion.mockClear();
  getDocs.mockClear();
  batchDelete.mockClear();
  batchCommit.mockClear();
  writeBatch.mockClear();
});

describe("crearProducto", () => {
  it("usa valores por defecto cuando faltan tallas/colores", async () => {
    await crearProducto({
      nombre: "Corbata",
      grupo: "Varonil",
      precio: "40",
      tallaTipo: TALLA_TIPO.NINGUNA,
    });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.precio).toBe(40);
    expect(datos.tallas).toEqual([]);
    expect(datos.colores).toEqual([]);
  });
});

describe("agregarTalla", () => {
  it("usa arrayUnion para no duplicar tallas existentes", async () => {
    await agregarTalla("prod1", "XL");
    expect(arrayUnion).toHaveBeenCalledWith("XL");
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos.tallas).toEqual({ __op: "arrayUnion", value: "XL" });
  });
});

describe("eliminarProducto", () => {
  it("borra el documento del producto indicado", async () => {
    await eliminarProducto("prod1");
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe("vaciarCatalogo", () => {
  it("no hace nada si el catálogo ya está vacío", async () => {
    getDocs.mockResolvedValueOnce({ empty: true, docs: [], size: 0 });
    const borrados = await vaciarCatalogo();
    expect(borrados).toBe(0);
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it("borra todos los productos existentes en un solo batch", async () => {
    const docsFalsos = [{ ref: "ref1" }, { ref: "ref2" }, { ref: "ref3" }];
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: docsFalsos,
      size: docsFalsos.length,
    });

    const borrados = await vaciarCatalogo();

    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(batchDelete).toHaveBeenCalledTimes(3);
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(borrados).toBe(3);
  });
});

describe("requiereTalla", () => {
  it("es obligatoria en productos a la medida", () => {
    expect(requiereTalla({ tallaTipo: TALLA_TIPO.LIBRE })).toBe(true);
  });

  it("es obligatoria en productos de lista con opciones", () => {
    expect(requiereTalla({ tallaTipo: TALLA_TIPO.LISTA, tallas: ["M"] })).toBe(true);
  });

  it("no lo es sin talla, ni con lista vacía, ni sin producto", () => {
    expect(requiereTalla({ tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] })).toBe(false);
    expect(requiereTalla({ tallaTipo: TALLA_TIPO.LISTA, tallas: [] })).toBe(false);
    expect(requiereTalla(undefined)).toBe(false);
  });
});
