import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "nuevo-id" }));
const updateDoc = vi.fn(async () => {});
const serverTimestamp = vi.fn(() => "SERVER_TIMESTAMP");
const collection = vi.fn(() => ({ __type: "collection" }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((ref) => ref);
const orderBy = vi.fn();
const onSnapshot = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  addDoc: (...args) => addDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  doc: (...args) => doc(...args),
  onSnapshot: (...args) => onSnapshot(...args),
  query: (...args) => query(...args),
  orderBy: (...args) => orderBy(...args),
  serverTimestamp: (...args) => serverTimestamp(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

const { crearElemento, marcarDocumentacion, actualizarElemento } = await import(
  "./elementos"
);

beforeEach(() => {
  addDoc.mockClear();
  updateDoc.mockClear();
});

describe("crearElemento", () => {
  it("aplica valores por defecto (unidad, grupo, documentación) cuando no se envían", async () => {
    await crearElemento({ nombre: "Juan Pérez" });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.nombre).toBe("Juan Pérez");
    expect(datos.unidad).toBe("2da Unidad");
    expect(datos.grupo).toBe("Varonil");
    expect(datos.documentacionEntregada).toBe(false);
    expect(datos.telefonos).toEqual([]);
  });

  it("filtra teléfonos vacíos", async () => {
    await crearElemento({ nombre: "Ana", telefonos: ["555", "", "666"] });
    const [, datos] = addDoc.mock.calls[0];
    expect(datos.telefonos).toEqual(["555", "666"]);
  });
});

describe("marcarDocumentacion", () => {
  it("actualiza solo el campo documentacionEntregada", async () => {
    await marcarDocumentacion("el1", true);
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos).toEqual({ documentacionEntregada: true });
  });
});

describe("actualizarElemento", () => {
  it("pasa los cambios directo a Firestore", async () => {
    await actualizarElemento("el1", { nombre: "Nuevo nombre" });
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos).toEqual({ nombre: "Nuevo nombre" });
  });
});
