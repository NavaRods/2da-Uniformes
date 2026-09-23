import { describe, it, expect, vi, beforeEach } from "vitest";

// Timestamp falso con la misma forma que el de Firestore.
class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
}

const lotes = [];
const writeBatch = vi.fn(() => {
  const lote = { escrituras: [], set: vi.fn((ref, datos) => lote.escrituras.push([ref.path, datos])) };
  lote.commit = vi.fn(async () => {});
  lotes.push(lote);
  return lote;
});
const getDocsFromServer = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (_db, nombre) => ({ nombre }),
  collectionGroup: (_db, nombre) => ({ nombre, grupo: true }),
  doc: (_db, ...ruta) => ({ path: ruta.join("/") }),
  getDoc: vi.fn(),
  getDocsFromServer: (...args) => getDocsFromServer(...args),
  serverTimestamp: () => "SERVER_TIMESTAMP",
  setDoc: vi.fn(),
  Timestamp,
  writeBatch: (...args) => writeBatch(...args),
}));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("./versiones", () => ({
  COLECCIONES_VERSIONADAS: ["catalogo", "grados", "unidades", "usuarios"],
  marcarCambios: (lote, colecciones) => {
    if (colecciones.length) lote.set({ path: "meta/versiones" }, { colecciones });
  },
}));
vi.mock("./usuarios", () => ({ normalizarCorreo: (c) => c.trim().toLowerCase() }));

const { aJSON, desdeJSON, reunirDatos, crearArchivo, abrirRespaldo, leerEncabezado, restaurar, TAMANO_LOTE } =
  await import("./respaldo");

beforeEach(() => {
  lotes.length = 0;
  writeBatch.mockClear();
  getDocsFromServer.mockReset();
});

describe("aJSON / desdeJSON", () => {
  it("las fechas de Firestore sobreviven al JSON, también anidadas", () => {
    const original = {
      creadoEn: new Timestamp(1700000000, 5),
      lista: [new Timestamp(1, 2), "x"],
      mapa: { a: null, b: { c: new Timestamp(3, 4) } },
      n: 60,
    };
    const vuelta = desdeJSON(JSON.parse(JSON.stringify(aJSON(original))));
    expect(vuelta).toEqual(original);
    expect(vuelta.creadoEn).toBeInstanceOf(Timestamp);
  });
});

describe("reunirDatos", () => {
  it("lee todas las partes del servidor y guarda la ruta completa de cada documento", async () => {
    getDocsFromServer.mockImplementation(async ({ nombre }) => ({
      size: 1,
      docs: [{ ref: { path: `${nombre}/x` }, data: () => ({ nombre }) }],
    }));
    const { registros, conteo } = await reunirDatos();
    const partes = Object.keys(conteo);
    expect(partes).toEqual([
      "unidades", "grados", "catalogo", "configuracion", "usuarios",
      "elementos", "pedidos", "abonos", "cuotas", "asistencias",
    ]);
    // Pedidos, abonos, cuotas y asistencias se leen como grupos de colección.
    const grupos = getDocsFromServer.mock.calls.filter(([c]) => c.grupo).map(([c]) => c.nombre);
    expect(grupos).toEqual(["pedidos", "abonos", "cuotas", "porUnidad"]);
    expect(registros).toHaveLength(10);
  });
});

describe("archivo de respaldo", () => {
  const datos = {
    registros: [{ parte: "elementos", ruta: "elementos/e1", datos: { nombre: "Ana" } }],
    conteo: { elementos: 1 },
  };

  it("se abre con la contraseña y deja visibles solo fecha, autor y conteos", async () => {
    const texto = await crearArchivo(datos, { contrasena: "clave", por: "admin@x.mx", iteraciones: 1000 });
    expect(texto).not.toContain("Ana");
    const encabezado = leerEncabezado(texto);
    expect(encabezado).toMatchObject({ por: "admin@x.mx", conteo: { elementos: 1 } });
    const abierto = await abrirRespaldo(texto, "clave");
    expect(abierto.registros).toEqual(datos.registros);
  });

  it("rechaza un archivo que no es un respaldo de la app", () => {
    expect(() => leerEncabezado('{"hola":1}')).toThrow();
    expect(() => leerEncabezado("no es json")).toThrow();
  });
});

describe("restaurar", () => {
  const reg = (parte, ruta, datos = {}) => ({ parte, ruta, datos });

  it("reescribe cada documento y marca la restauración en cada lote", async () => {
    await restaurar(
      {
        registros: [
          reg("pedidos", "elementos/e1/pedidos/p1", { saldoPendiente: 50 }),
          reg("elementos", "elementos/e1", { nombre: "Ana", creadoEn: { __ts: [10, 0] } }),
        ],
      },
      { por: "Admin@X.mx", nombre: "r.json" }
    );
    const [lote] = lotes;
    const rutas = lote.escrituras.map(([ruta]) => ruta);
    // Primero los elementos y después sus pedidos.
    expect(rutas.slice(0, 2)).toEqual(["elementos/e1", "elementos/e1/pedidos/p1"]);
    const elemento = lote.escrituras[0][1];
    expect(elemento.actualizadoEn).toBe("SERVER_TIMESTAMP");
    expect(elemento.creadoEn).toBeInstanceOf(Timestamp);
    expect(lote.escrituras.at(-1)).toEqual([
      "meta/restauracion",
      { en: "SERVER_TIMESTAMP", por: "admin@x.mx", respaldo: "r.json" },
    ]);
    expect(lote.commit).toHaveBeenCalled();
  });

  it("no toca el usuario de quien restaura (no puede quitarse el acceso)", async () => {
    const hechos = await restaurar(
      { registros: [reg("usuarios", "usuarios/admin@x.mx"), reg("usuarios", "usuarios/ana@x.mx")] },
      { por: "admin@x.mx", nombre: "" }
    );
    expect(hechos).toBe(1);
    expect(lotes[0].escrituras.map(([r]) => r)).not.toContain("usuarios/admin@x.mx");
  });

  it("actualiza la versión de las colecciones versionadas que restaura", async () => {
    await restaurar(
      { registros: [reg("catalogo", "catalogo/c1"), reg("elementos", "elementos/e1")] },
      { por: "a@x.mx", nombre: "" }
    );
    expect(lotes[0].escrituras).toContainEqual(["meta/versiones", { colecciones: ["catalogo"] }]);
  });

  it("parte en lotes y avisa el avance", async () => {
    const registros = Array.from({ length: TAMANO_LOTE + 5 }, (_, i) => reg("elementos", `elementos/e${i}`));
    const avance = vi.fn();
    await restaurar({ registros }, { por: "a@x.mx", nombre: "", alAvanzar: avance });
    expect(lotes).toHaveLength(2);
    expect(avance).toHaveBeenLastCalledWith(TAMANO_LOTE + 5, TAMANO_LOTE + 5);
  });
});
