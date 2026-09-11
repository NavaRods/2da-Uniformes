import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { linkWhatsapp, mensajeComprobante, mensajeEntrega, mensajeCambioPendiente } from "./whatsapp";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T10:30:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("linkWhatsapp", () => {
  it("limpia el teléfono a solo dígitos y codifica el mensaje", () => {
    const link = linkWhatsapp("(55) 1234-5678", "Hola ¿cómo estás?");
    expect(link).toBe(
      "https://wa.me/5512345678?text=" + encodeURIComponent("Hola ¿cómo estás?")
    );
  });

  it("no truena si no hay teléfono", () => {
    expect(linkWhatsapp(undefined, "hola")).toBe("https://wa.me/?text=hola");
  });
});

describe("mensajeComprobante", () => {
  it("marca LIQUIDADO cuando el saldo pendiente llega a 0 o menos", () => {
    const msg = mensajeComprobante({
      nombre: "Juan",
      articulo: "Pantalón",
      monto: 350,
      saldoPendiente: 0,
      quienRecibio: "Carlos",
    });
    expect(msg).toContain("LIQUIDADO");
    expect(msg).toContain("Carlos");
    expect(msg).toContain("$350");
  });

  it("muestra el saldo pendiente cuando es un abono parcial", () => {
    const msg = mensajeComprobante({
      nombre: "Juan",
      articulo: "Pantalón",
      monto: 100,
      saldoPendiente: 250,
      quienRecibio: "Carlos",
    });
    expect(msg).toContain("saldo pendiente de $250");
    expect(msg).not.toContain("LIQUIDADO");
  });
});

describe("mensajeEntrega", () => {
  it("avisa de la entrega con quién entregó", () => {
    const msg = mensajeEntrega({
      nombre: "Ana",
      articulo: "Camisola",
      entregado: true,
      quienEntrego: "Carlos",
    });
    expect(msg).toContain("Se te entregó");
    expect(msg).toContain("Entregó: Carlos");
  });

  it("avisa de la cancelación de entrega", () => {
    const msg = mensajeEntrega({
      nombre: "Ana",
      articulo: "Camisola",
      entregado: false,
      quienEntrego: "Carlos",
    });
    expect(msg).toContain("Se canceló la entrega");
  });
});

describe("mensajeCambioPendiente", () => {
  it("incluye el motivo cuando se marca como pendiente", () => {
    const msg = mensajeCambioPendiente({
      nombre: "Luis",
      articulo: "Botas",
      pendiente: true,
      motivo: "Talla equivocada",
    });
    expect(msg).toContain("CAMBIO PENDIENTE");
    expect(msg).toContain("Talla equivocada");
  });

  it("avisa que quedó resuelto cuando pendiente es false", () => {
    const msg = mensajeCambioPendiente({
      nombre: "Luis",
      articulo: "Botas",
      pendiente: false,
    });
    expect(msg).toContain("ya no tiene cambio pendiente");
  });
});
