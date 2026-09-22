import { describe, it, expect, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const getDocsFromCache = vi.fn();
const lote = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...args) => ({ path: args.slice(1).join("/") })),
  getDocs: (...args) => getDocs(...args),
  getDocsFromCache: (...args) => getDocsFromCache(...args),
  onSnapshot: vi.fn(),
  serverTimestamp: () => "SERVER_TIMESTAMP",
  writeBatch: () => lote,
}));
vi.mock("../firebase", () => ({ db: {} }));

// localStorage en memoria (las pruebas corren en Node).
const almacen = new Map();
vi.stubGlobal("localStorage", {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
});

const { cargarConVersion, escribirConVersion, claveVersion, VIGENCIA_MS } = await import(
  "./versiones"
);
const { guardarMarca, leerMarca } = await import("./memoriaLocal");

const delServidor = (size) => ({ size, metadata: { fromCache: false } });

beforeEach(() => {
  almacen.clear();
  getDocs.mockReset();
  getDocsFromCache.mockReset();
  lote.set.mockClear();
  lote.update.mockClear();
  lote.commit.mockClear();
});

describe("cargarConVersion", () => {
  it("sin marca, descarga del servidor y la guarda", async () => {
    getDocs.mockResolvedValue(delServidor(19));
    await cargarConVersion("catalogo", "Q", 5);
    expect(getDocs).toHaveBeenCalledWith("Q");
    expect(leerMarca("version:catalogo")).toMatchObject({ v: 5, n: 19 });
  });

  it("misma versión y caché completa: lee de la caché (0 lecturas)", async () => {
    guardarMarca("version:catalogo", { v: 5, n: 19, t: Date.now() });
    const enCache = { size: 19 };
    getDocsFromCache.mockResolvedValue(enCache);
    expect(await cargarConVersion("catalogo", "Q", 5)).toBe(enCache);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("si cambió la versión, descarga del servidor", async () => {
    guardarMarca("version:catalogo", { v: 5, n: 19, t: Date.now() });
    getDocs.mockResolvedValue(delServidor(20));
    await cargarConVersion("catalogo", "Q", 6);
    expect(getDocsFromCache).not.toHaveBeenCalled();
    expect(leerMarca("version:catalogo")).toMatchObject({ v: 6, n: 20 });
  });

  it("si la caché perdió documentos, descarga del servidor", async () => {
    guardarMarca("version:catalogo", { v: 5, n: 19, t: Date.now() });
    getDocsFromCache.mockResolvedValue({ size: 4 });
    getDocs.mockResolvedValue(delServidor(19));
    await cargarConVersion("catalogo", "Q", 5);
    expect(getDocs).toHaveBeenCalled();
  });

  it("pasada la vigencia, descarga aunque la versión no cambie", async () => {
    guardarMarca("version:catalogo", { v: 5, n: 19, t: Date.now() - VIGENCIA_MS - 1 });
    getDocs.mockResolvedValue(delServidor(19));
    await cargarConVersion("catalogo", "Q", 5);
    expect(getDocs).toHaveBeenCalled();
  });

  it("un cambio propio se toma de la caché sin descargar", async () => {
    const antes = Date.now() - 1000;
    guardarMarca("version:catalogo", { v: 5, n: 19, t: antes });
    getDocsFromCache.mockResolvedValue({ size: 20 });
    await cargarConVersion("catalogo", "Q", 6, { propio: true });
    expect(getDocs).not.toHaveBeenCalled();
    // Conserva la hora de la última descarga completa (la vigencia no se alarga).
    expect(leerMarca("version:catalogo")).toEqual({ v: 6, n: 20, t: antes });
  });

  it("una respuesta que salió de la caché (sin conexión) no guarda marca", async () => {
    getDocs.mockResolvedValue({ size: 3, metadata: { fromCache: true } });
    await cargarConVersion("catalogo", "Q", 5);
    expect(leerMarca("version:catalogo")).toBeNull();
  });

  it("si el servidor falla, usa lo que haya en caché", async () => {
    getDocs.mockRejectedValue(Object.assign(new Error("cuota"), { code: "resource-exhausted" }));
    const enCache = { size: 2 };
    getDocsFromCache.mockResolvedValue(enCache);
    expect(await cargarConVersion("catalogo", "Q", 5)).toBe(enCache);
  });
});

describe("escribirConVersion", () => {
  it("suma el cambio de versión al mismo lote y lo confirma", async () => {
    await escribirConVersion("grados", (l) => l.update("REF", { rango: 2 }));
    expect(lote.update).toHaveBeenCalledWith("REF", { rango: 2 });
    expect(lote.set).toHaveBeenCalledWith(
      { path: "meta/versiones" },
      { grados: "SERVER_TIMESTAMP" },
      { merge: true }
    );
    expect(lote.commit).toHaveBeenCalledTimes(1);
  });
});

describe("claveVersion", () => {
  it("usa los milisegundos del Timestamp, o 0 si no hay", () => {
    expect(claveVersion({ toMillis: () => 123 })).toBe(123);
    expect(claveVersion(undefined)).toBe(0);
  });
});
