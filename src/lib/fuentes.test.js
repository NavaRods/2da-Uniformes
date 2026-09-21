import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./elementos", () => ({ listenElementos: vi.fn() }));
vi.mock("./catalogo", () => ({ listenCatalogo: vi.fn() }));
vi.mock("./unidades", () => ({ listenUnidades: vi.fn() }));
vi.mock("react", () => ({ useSyncExternalStore: vi.fn() }));

const { crearFuente } = await import("./fuentes");

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
