import { describe, it, expect, vi, beforeEach } from "vitest";

const setDoc = vi.fn(async () => {});
const updateDoc = vi.fn(async () => {});
const serverTimestamp = vi.fn(() => "SERVER_TIMESTAMP");
const collection = vi.fn(() => ({ __type: "collection" }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((ref) => ref);
const orderBy = vi.fn();
const onSnapshot = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  setDoc: (...args) => setDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  deleteDoc: vi.fn(),
  doc: (...args) => doc(...args),
  onSnapshot: (...args) => onSnapshot(...args),
  query: (...args) => query(...args),
  orderBy: (...args) => orderBy(...args),
  serverTimestamp: (...args) => serverTimestamp(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

const { normalizarCorreo, crearUsuario, editarUsuario, cambiarActivo } = await import(
  "./usuarios"
);

beforeEach(() => {
  setDoc.mockClear();
  updateDoc.mockClear();
  doc.mockClear();
});

describe("normalizarCorreo", () => {
  it("recorta espacios y pasa a minúsculas", () => {
    expect(normalizarCorreo("  Carlos@Ejemplo.com ")).toBe("carlos@ejemplo.com");
  });

  it("acepta valores vacíos sin tronar", () => {
    expect(normalizarCorreo(undefined)).toBe("");
  });
});

describe("crearUsuario", () => {
  it("usa el correo normalizado como ID del documento", async () => {
    await crearUsuario({ correo: " Ana@Club.com ", nombre: "Ana", rol: "operador", unidad: "2da Unidad" });
    const [, , correoUsado] = doc.mock.calls[0];
    expect(correoUsado).toBe("ana@club.com");
  });

  it("fuerza unidad a null cuando el rol es admin", async () => {
    await crearUsuario({ correo: "admin@club.com", nombre: "Admin", rol: "admin", unidad: "2da Unidad" });
    const [, datos] = setDoc.mock.calls[0];
    expect(datos.unidad).toBeNull();
  });

  it("conserva la unidad cuando el rol es operador", async () => {
    await crearUsuario({ correo: "op@club.com", nombre: "Op", rol: "operador", unidad: "3ra Unidad" });
    const [, datos] = setDoc.mock.calls[0];
    expect(datos.unidad).toBe("3ra Unidad");
  });

  it("arranca activo y con el grado recibido", async () => {
    await crearUsuario({ correo: "op@club.com", nombre: "Op", rol: "operador", unidad: "3ra Unidad", grado: "Capitán" });
    const [, datos] = setDoc.mock.calls[0];
    expect(datos.activo).toBe(true);
    expect(datos.grado).toBe("Capitán");
  });
});

describe("editarUsuario", () => {
  it("fuerza unidad a null cuando el rol pasa a admin", async () => {
    await editarUsuario("op@club.com", { nombre: "Op", rol: "admin", unidad: "3ra Unidad" });
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos.unidad).toBeNull();
  });
});

describe("cambiarActivo", () => {
  it("actualiza solo el campo activo", async () => {
    await cambiarActivo("op@club.com", false);
    const [, datos] = updateDoc.mock.calls[0];
    expect(datos).toEqual({ activo: false });
  });
});
