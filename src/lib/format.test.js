import { describe, it, expect } from "vitest";
import { formatoMoneda, fechaLocalISO, horaLocalHHMM } from "./format";

describe("formatoMoneda", () => {
  it("formatea números como moneda con separador de miles", () => {
    expect(formatoMoneda(1000)).toBe("$1,000");
  });

  it("trata valores vacíos o inválidos como 0", () => {
    expect(formatoMoneda(undefined)).toBe("$0");
    expect(formatoMoneda("")).toBe("$0");
  });
});

describe("fechaLocalISO / horaLocalHHMM", () => {
  it("devuelven fecha en formato YYYY-MM-DD y hora en HH:MM", () => {
    const fecha = new Date("2026-03-05T14:07:00");
    expect(fechaLocalISO(fecha)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(horaLocalHHMM(fecha)).toMatch(/^\d{2}:\d{2}$/);
  });
});
