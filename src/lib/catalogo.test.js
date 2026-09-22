import { describe, it, expect, vi, beforeEach } from "vitest";

const arrayUnion = vi.fn((...v) => ({ __op: "arrayUnion", value: v }));
const getDocs = vi.fn();
const collection = vi.fn(() => ({ __type: "collection" }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((ref) => ref);
const orderBy = vi.fn();

// escribirConVersion (lib/versiones.js) junta todo en un lote y le suma la
// versión: aquí se simula con un lote falso.
const lote = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const escribirConVersion = vi.fn(async (coleccion, escribir) => escribir(lote));
vi.mock("./versiones", () => ({
  escribirConVersion: (...args) => escribirConVersion(...args),
}));

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  doc: (...args) => doc(...args),
  query: (...args) => query(...args),
  orderBy: (...args) => orderBy(...args),
  arrayUnion: (...args) => arrayUnion(...args),
  getDocs: (...args) => getDocs(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

const {
  guardarCambiosCatalogo,
  eliminarProducto,
  vaciarCatalogo,
  requiereTalla,
  TALLA_TIPO,
} = await import("./catalogo");

beforeEach(() => {
  arrayUnion.mockClear();
  getDocs.mockClear();
  lote.set.mockClear();
  lote.update.mockClear();
  lote.delete.mockClear();
  escribirConVersion.mockClear();
});

describe("guardarCambiosCatalogo", () => {
  it("un producto nuevo usa valores por defecto cuando faltan tallas/colores", async () => {
    await guardarCambiosCatalogo([
      {
        tipo: "nuevo",
        datos: { nombre: "Corbata", grupo: "Varonil", precio: "40", tallaTipo: TALLA_TIPO.NINGUNA },
      },
    ]);
    const [, datos] = lote.set.mock.calls[0];
    expect(datos.precio).toBe(40);
    expect(datos.tallas).toEqual([]);
    expect(datos.colores).toEqual([]);
  });

  it("las tallas nuevas usan arrayUnion para no duplicar las existentes", async () => {
    await guardarCambiosCatalogo([
      { productoId: "prod1", precioNuevo: null, tallasNuevas: ["XL", "XXL"] },
    ]);
    expect(arrayUnion).toHaveBeenCalledWith("XL", "XXL");
    const [, datos] = lote.update.mock.calls[0];
    expect(datos.tallas).toEqual({ __op: "arrayUnion", value: ["XL", "XXL"] });
  });

  it("guarda todos los cambios en una sola escritura (un solo cambio de versión)", async () => {
    await guardarCambiosCatalogo([
      { tipo: "nuevo", datos: { nombre: "Gorra", precio: 100, tallaTipo: TALLA_TIPO.NINGUNA } },
      { productoId: "prod1", precioNuevo: 380, tallasNuevas: ["46"] },
      { productoId: "prod2", precioNuevo: 90, tallasNuevas: [] },
    ]);
    expect(escribirConVersion).toHaveBeenCalledTimes(1);
    expect(escribirConVersion).toHaveBeenCalledWith("catalogo", expect.any(Function));
    expect(lote.set).toHaveBeenCalledTimes(1);
    expect(lote.update).toHaveBeenCalledTimes(3);
  });

  it("sin cambios no escribe nada", async () => {
    await guardarCambiosCatalogo([]);
    expect(escribirConVersion).not.toHaveBeenCalled();
  });
});

describe("eliminarProducto", () => {
  it("borra el documento del producto indicado y actualiza la versión", async () => {
    await eliminarProducto("prod1");
    expect(lote.delete).toHaveBeenCalledTimes(1);
    expect(escribirConVersion).toHaveBeenCalledWith("catalogo", expect.any(Function));
  });
});

describe("vaciarCatalogo", () => {
  it("no hace nada si el catálogo ya está vacío", async () => {
    getDocs.mockResolvedValueOnce({ empty: true, docs: [], size: 0 });
    const borrados = await vaciarCatalogo();
    expect(borrados).toBe(0);
    expect(escribirConVersion).not.toHaveBeenCalled();
  });

  it("borra todos los productos existentes en un solo batch", async () => {
    const docsFalsos = [{ ref: "ref1" }, { ref: "ref2" }, { ref: "ref3" }];
    getDocs.mockResolvedValueOnce({
      empty: false,
      docs: docsFalsos,
      size: docsFalsos.length,
    });

    const borrados = await vaciarCatalogo();

    expect(escribirConVersion).toHaveBeenCalledTimes(1);
    expect(lote.delete).toHaveBeenCalledTimes(3);
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
