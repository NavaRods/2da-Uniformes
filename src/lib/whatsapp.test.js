import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  linkWhatsapp,
  mensajeComprobante,
  mensajeEntrega,
  mensajeCambioPendiente,
  normalizarTelefono,
  telefonoValido,
  mensajeRelacionDia,
} from "./whatsapp";

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

describe("normalizarTelefono", () => {
  it("agrega el código de México a números de 10 dígitos", () => {
    expect(normalizarTelefono("(55) 1234-5678")).toBe("525512345678");
  });

  it("respeta un número que ya trae código de país", () => {
    expect(normalizarTelefono("+52 55 1234 5678")).toBe("525512345678");
    expect(normalizarTelefono("+1 415 555 0132")).toBe("14155550132");
  });

  it("convierte el formato antiguo 521 y quita el prefijo 00", () => {
    expect(normalizarTelefono("5215512345678")).toBe("525512345678");
    expect(normalizarTelefono("0052 55 1234 5678")).toBe("525512345678");
  });

  it("valida longitud", () => {
    expect(telefonoValido("525512345678")).toBe(true);
    expect(telefonoValido("12345")).toBe(false);
    expect(telefonoValido("")).toBe(false);
    expect(telefonoValido(undefined)).toBe(false);
  });
});

describe("mensajeRelacionDia", () => {
  const resumen = {
    total: 530,
    movimientos: 2,
    totalUniformes: 50,
    totalMensualidades: 480,
    mesesCobrados: 8,
  };
  const filas = [
    { elementoNombre: "Ana", concepto: "Playera — talla M", monto: 50, etiqueta: "Abono", horaLocal: "10:30" },
    { elementoNombre: "Luis", concepto: "Mensualidad — Ene 2026", monto: 480, etiqueta: "Mensualidad", horaLocal: "09:00" },
  ];

  it("incluye fecha, totales por tipo y el detalle numerado", () => {
    const msg = mensajeRelacionDia({ fechaEtiqueta: "sábado, 19 de septiembre de 2026", filas, resumen });
    expect(msg).toContain("*Relación de pagos*");
    expect(msg).toContain("sábado, 19 de septiembre de 2026");
    expect(msg).toContain("Total del día: $530 (2 movimientos)");
    expect(msg).toContain("• Uniformes: $50");
    expect(msg).toContain("• Mensualidades: $480 (8 meses)");
    expect(msg).toContain("1. Ana — Playera — talla M — $50 (Abono) · 10:30");
    expect(msg).toContain("2. Luis — Mensualidad — Ene 2026 — $480 (Mensualidad) · 09:00");
  });

  it("sin movimientos avisa que no hubo pagos", () => {
    const msg = mensajeRelacionDia({ fechaEtiqueta: "hoy", filas: [], resumen });
    expect(msg).toContain("Sin pagos registrados este día.");
  });

  it("recorta el detalle cuando hay demasiados movimientos", () => {
    const muchas = Array.from({ length: 45 }, (_, i) => ({
      elementoNombre: `E${i}`, concepto: "X", monto: 1, etiqueta: "Abono", horaLocal: "",
    }));
    const msg = mensajeRelacionDia({ fechaEtiqueta: "hoy", filas: muchas, resumen: { ...resumen, movimientos: 45 } });
    expect(msg).toContain("… y 5 movimientos más");
    expect(msg).not.toContain("41. E40");
  });
});
