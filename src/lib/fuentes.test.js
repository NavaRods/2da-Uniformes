import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getDocsFromCache = vi.fn(async () => ({ desde: "cache" }));
const cargarConVersion = vi.fn(async () => ({ desde: "version" }));

vi.mock("firebase/firestore", () => ({
  getDocsFromCache: (...args) => getDocsFromCache(...args),
}));
vi.mock("./elementos", () => ({ listenElementos: vi.fn() }));
vi.mock("../firebase", () => ({ db: {} }));
vi.mock("./pedidos", async () => {
  // sinBorrados es lógica pura: se usa la real.
  const { sinBorrados } = await vi.importActual("./pedidos");
  return { listenPedidosDeUnidad: vi.fn(), listenBajasPedidos: vi.fn(), sinBorrados };
});
vi.mock("./catalogo", () => ({ consultaCatalogo: vi.fn() }));
vi.mock("./unidades", () => ({ consultaUnidades: vi.fn(), compararUnidades: vi.fn() }));
vi.mock("./gradosDb", () => ({ consultaGrados: vi.fn() }));
vi.mock("./usuarios", () => ({ consultaUsuarios: vi.fn() }));
vi.mock("./configuracion", () => ({ listenConfiguracion: vi.fn() }));
vi.mock("./versiones", () => ({
  cargarConVersion: (...args) => cargarConVersion(...args),
  claveVersion: (valor) => valor?.ms ?? 0,
  listenVersiones: vi.fn(),
}));
vi.mock("react", () => ({ useSyncExternalStore: vi.fn(), useMemo: vi.fn() }));

const { crearFuente, escucharVersionada, juntarFuentes, escucharPedidosVigentes } = await import(
  "./fuentes"
);

function fuenteFalsa() {
  const cerrar = vi.fn();
  let emitir;
  const escuchar = vi.fn((cb) => {
    emitir = cb;
    return cerrar;
  });
  return { escuchar, cerrar, emitir: (d) => emitir(d) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("crearFuente", () => {
  it("varios suscriptores comparten un solo listener", () => {
    const f = fuenteFalsa();
    const fuente = crearFuente(f.escuchar, 1000);
    fuente.suscribir(() => {});
    fuente.suscribir(() => {});
    expect(f.escuchar).toHaveBeenCalledTimes(1);
  });

  it("entrega los datos a todos y avisa del cambio", () => {
    const f = fuenteFalsa();
    const fuente = crearFuente(f.escuchar, 1000);
    const a = vi.fn();
    const b = vi.fn();
    fuente.suscribir(a);
    fuente.suscribir(b);
    f.emitir([{ id: "1" }]);
    expect(fuente.leer()).toEqual([{ id: "1" }]);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it("al salir el último cierra el listener solo tras el periodo de gracia", () => {
    const f = fuenteFalsa();
    const fuente = crearFuente(f.escuchar, 1000);
    const salir = fuente.suscribir(() => {});
    salir();
    vi.advanceTimersByTime(999);
    expect(f.cerrar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(f.cerrar).toHaveBeenCalledTimes(1);
  });

  it("volver a entrar dentro de la gracia reutiliza el listener y sus datos", () => {
    const f = fuenteFalsa();
    const fuente = crearFuente(f.escuchar, 1000);
    const salir = fuente.suscribir(() => {});
    f.emitir([{ id: "1" }]);
    salir();
    vi.advanceTimersByTime(500);
    fuente.suscribir(() => {});
    vi.advanceTimersByTime(5000);
    expect(f.escuchar).toHaveBeenCalledTimes(1);
    expect(f.cerrar).not.toHaveBeenCalled();
    expect(fuente.leer()).toEqual([{ id: "1" }]);
  });

  it("detener cierra el listener y vacía los datos", () => {
    const f = fuenteFalsa();
    const fuente = crearFuente(f.escuchar, 1000);
    fuente.suscribir(() => {});
    f.emitir([{ id: "1" }]);
    fuente.detener();
    expect(f.cerrar).toHaveBeenCalledTimes(1);
    expect(fuente.leer()).toEqual([]);
  });
});

describe("escucharVersionada", () => {
  // Fuente de versiones falsa: `emitir` simula un cambio en meta/versiones.
  function preparar() {
    const versiones = fuenteFalsa();
    const fuenteVersiones = crearFuente(versiones.escuchar, 1000);
    const consulta = vi.fn(() => "CONSULTA");
    const recibido = vi.fn();
    const cerrar = escucharVersionada(
      "catalogo",
      consulta,
      (snap) => snap.desde,
      fuenteVersiones
    )(recibido);
    return { emitir: versiones.emitir, recibido, cerrar };
  }
  const esperar = () => Promise.resolve().then(() => Promise.resolve());

  beforeEach(() => {
    getDocsFromCache.mockClear();
    cargarConVersion.mockClear();
  });

  it("no carga nada hasta conocer las versiones", () => {
    preparar();
    expect(cargarConVersion).not.toHaveBeenCalled();
  });

  it("carga según la versión y entrega los datos convertidos", async () => {
    const { emitir, recibido } = preparar();
    emitir({ datos: { catalogo: { ms: 7 } }, pendiente: false });
    await esperar();
    expect(cargarConVersion).toHaveBeenCalledWith("catalogo", "CONSULTA", 7, { propio: false });
    expect(recibido).toHaveBeenCalledWith("version");
  });

  it("si cambia otra colección, esta no se vuelve a cargar", async () => {
    const { emitir } = preparar();
    emitir({ datos: { catalogo: { ms: 7 } }, pendiente: false });
    emitir({ datos: { catalogo: { ms: 7 }, grados: { ms: 9 } }, pendiente: false });
    await esperar();
    expect(cargarConVersion).toHaveBeenCalledTimes(1);
  });

  it("un cambio propio se muestra de la caché y, al confirmarse, no se descarga", async () => {
    const { emitir, recibido } = preparar();
    emitir({ datos: { catalogo: { ms: 7 } }, pendiente: false });
    await esperar();

    // Pendiente de confirmar: la versión de esta colección llega en null.
    emitir({ datos: { catalogo: null }, pendiente: true });
    await esperar();
    expect(getDocsFromCache).toHaveBeenCalledWith("CONSULTA");
    expect(recibido).toHaveBeenLastCalledWith("cache");

    emitir({ datos: { catalogo: { ms: 8 } }, pendiente: false });
    await esperar();
    expect(cargarConVersion).toHaveBeenLastCalledWith("catalogo", "CONSULTA", 8, { propio: true });
  });

  it("un cambio pendiente de otra colección no afecta a esta", async () => {
    const { emitir } = preparar();
    emitir({ datos: { catalogo: { ms: 7 } }, pendiente: false });
    emitir({ datos: { catalogo: { ms: 7 }, grados: null }, pendiente: true });
    await esperar();
    expect(getDocsFromCache).not.toHaveBeenCalled();
  });
});

describe("juntarFuentes", () => {
  it("es null hasta que cargan todas y luego une sus listas", () => {
    const a = fuenteFalsa();
    const b = fuenteFalsa();
    const junta = juntarFuentes([crearFuente(a.escuchar, 1000), crearFuente(b.escuchar, 1000)]);
    junta.suscribir(() => {});
    a.emitir([1, 2]);
    expect(junta.leer()).toBeNull();
    b.emitir([3]);
    expect(junta.leer()).toEqual([1, 2, 3]);
  });

  it("devuelve la misma lista mientras nada cambie (y una nueva si algo cambia)", () => {
    const a = fuenteFalsa();
    const junta = juntarFuentes([crearFuente(a.escuchar, 1000)]);
    junta.suscribir(() => {});
    a.emitir([1]);
    const primera = junta.leer();
    expect(junta.leer()).toBe(primera);
    a.emitir([1, 2]);
    expect(junta.leer()).not.toBe(primera);
  });

  it("sin fuentes es una lista vacía estable", () => {
    const junta = juntarFuentes([]);
    expect(junta.leer()).toEqual([]);
    expect(junta.leer()).toBe(junta.leer());
  });
});

describe("escucharPedidosVigentes", () => {
  it("espera pedidos y bajas, y quita los pedidos borrados", () => {
    let darPedidos;
    let darBajas;
    const recibido = vi.fn();
    escucharPedidosVigentes("U1", recibido, {
      pedidos: (cb) => ((darPedidos = cb), () => {}),
      bajas: (cb) => ((darBajas = cb), () => {}),
    });
    darPedidos([
      { id: "p1", elementoId: "e1" },
      { id: "p2", elementoId: "e1" },
    ]);
    expect(recibido).not.toHaveBeenCalled();
    darBajas([{ id: "e1_p1", en: { toMillis: () => 5 } }]);
    expect(recibido).toHaveBeenLastCalledWith([{ id: "p2", elementoId: "e1" }]);
  });
});
