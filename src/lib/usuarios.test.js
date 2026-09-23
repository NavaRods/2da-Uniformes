import { describe, it, expect, vi, beforeEach } from "vitest";

// Las escrituras pasan por escribirConVersion: se simula con un lote falso.
const lote = { set: vi.fn(), update: vi.fn(), delete: vi.fn() };
const escribirConVersion = vi.fn(async (coleccion, escribir) => escribir(lote));
vi.mock("./versiones", () => ({
  escribirConVersion: (...args) => escribirConVersion(...args),
}));
const serverTimestamp = vi.fn(() => "SERVER_TIMESTAMP");
const collection = vi.fn(() => ({ __type: "collection" }));
const doc = vi.fn((...args) => ({ __type: "doc", path: args.slice(1) }));
const query = vi.fn((ref) => ref);
const orderBy = vi.fn();
const onSnapshot = vi.fn();
const getDoc = vi.fn(async () => ({ exists: () => false }));

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  getDoc: (...args) => getDoc(...args),
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
  lote.set.mockClear();
  lote.update.mockClear();
  escribirConVersion.mockClear();
  doc.mockClear();
  getDoc.mockClear();
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
    await crearUsuario({ correo: " Ana@Club.com ", nombre: "Ana", rol: "responsable", unidad: "2da Unidad" });
    const [, , correoUsado] = doc.mock.calls[0];
    expect(correoUsado).toBe("ana@club.com");
  });

  it("fuerza unidad a null cuando el rol es admin", async () => {
    await crearUsuario({ correo: "admin@club.com", nombre: "Admin", rol: "admin", unidad: "2da Unidad" });
    const [, datos] = lote.set.mock.calls[0];
    expect(datos.unidad).toBeNull();
  });

  it("conserva la unidad cuando el rol es responsable", async () => {
    await crearUsuario({ correo: "op@club.com", nombre: "Op", rol: "responsable", unidad: "3ra Unidad" });
    const [, datos] = lote.set.mock.calls[0];
    expect(datos.unidad).toBe("3ra Unidad");
  });

  it("arranca activo y con el grado recibido", async () => {
    await crearUsuario({ correo: "op@club.com", nombre: "Op", rol: "responsable", unidad: "3ra Unidad", grado: "Capitán" });
    const [, datos] = lote.set.mock.calls[0];
    expect(datos.activo).toBe(true);
    expect(datos.grado).toBe("Capitán");
  });
});

describe("editarUsuario", () => {
  it("fuerza unidad a null cuando el rol pasa a admin", async () => {
    await editarUsuario("op@club.com", { nombre: "Op", rol: "admin", unidad: "3ra Unidad" });
    const [, datos] = lote.update.mock.calls[0];
    expect(datos.unidad).toBeNull();
  });
});

describe("cambiarActivo", () => {
  it("actualiza solo el campo activo", async () => {
    await cambiarActivo("op@club.com", false);
    const [, datos] = lote.update.mock.calls[0];
    expect(datos).toEqual({ activo: false });
  });
});

describe("crearUsuario con un correo que ya existe", () => {
  it("no pisa al usuario existente y avisa con un código propio", async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true });
    await expect(
      crearUsuario({ correo: "Ana@x.com", nombre: "Ana", rol: "responsable", unidad: "U1" })
    ).rejects.toMatchObject({ code: "ya-existe" });
    expect(lote.set).not.toHaveBeenCalled();
  });
});

describe("versión de usuarios", () => {
  it("cada escritura actualiza la versión de la colección usuarios", async () => {
    await crearUsuario({ correo: "op@club.com", nombre: "Op", rol: "responsable", unidad: "U1" });
    await editarUsuario("op@club.com", { nombre: "Op", rol: "responsable", unidad: "U1" });
    await cambiarActivo("op@club.com", false);
    expect(escribirConVersion.mock.calls.map(([coleccion]) => coleccion)).toEqual([
      "usuarios",
      "usuarios",
      "usuarios",
    ]);
  });
});
