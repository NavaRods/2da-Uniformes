import { describe, it, expect, vi } from "vitest";
import { esErrorDeCuota, vigilar, vigilarEscritura, limpiarCuotaAgotada, reportarError } from "./estadoFirestore";

vi.mock("react", () => ({ useSyncExternalStore: vi.fn() }));

describe("estadoFirestore", () => {
  it("reconoce el error de cuota agotada y solo ese", () => {
    expect(esErrorDeCuota({ code: "resource-exhausted" })).toBe(true);
    expect(esErrorDeCuota({ code: "permission-denied" })).toBe(false);
    expect(esErrorDeCuota(null)).toBe(false);
  });

  it("vigilar llama al manejador original con el mismo error", () => {
    const original = vi.fn();
    const error = { code: "permission-denied" };
    vigilar(original)(error);
    expect(original).toHaveBeenCalledWith(error);
  });

  it("vigilar sin manejador original no falla", () => {
    expect(() => vigilar()({ code: "resource-exhausted" })).not.toThrow();
    limpiarCuotaAgotada();
  });

  it("vigilarEscritura deja pasar el resultado y vuelve a lanzar el error", async () => {
    await expect(vigilarEscritura(Promise.resolve(5))).resolves.toBe(5);
    const error = { code: "resource-exhausted" };
    await expect(vigilarEscritura(Promise.reject(error))).rejects.toBe(error);
    limpiarCuotaAgotada();
  });

  it("reportarError ignora errores que no son de cuota", () => {
    expect(() => reportarError({ code: "unavailable" })).not.toThrow();
  });
});
