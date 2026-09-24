import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  linkWhatsapp,
  mensajeComprobante,
  mensajeEntrega,
  mensajeCambioPendiente,
  mensajeCambioResuelto,
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
    total: 1345,
    movimientos: 6,
    general: [
      { productoNombre: "Camisa Blanca", talla: "14 - 16", color: "", cantidad: 8, total: 680 },
      { productoNombre: "Camisa Blanca", talla: "M A", color: "", cantidad: 3, total: 255 },
      { productoNombre: "Fajilla", talla: "Ch", color: "", cantidad: 1, total: 170 },
    ],
    mensualidades: [
      {
        nombre: "Juan Carlos Sevilla Hernández",
        monto: 240,
        meses: ["Oct 2025", "Nov 2025", "Dic 2025", "Ene 2026"],
      },
    ],
  };

  it("tiene exactamente el formato pedido", () => {
    const msg = mensajeRelacionDia({ fechaEtiqueta: "sábado, 19 de septiembre de 2026", resumen });
    expect(msg).toBe(
      [
        "Relación de pagos",
        "Sábado, 19 de septiembre de 2026",
        "",
        "Detalles (Uniformidad):",
        "",
        "1. ($680) Camisa Blanca (14 - 16) - Piezas 8",
        "2. ($255) Camisa Blanca (M A) - Piezas 3",
        "3. ($170) Fajilla (Ch) - Piezas 1",
        "",
        "Detalles (Mensualidades):",
        "",
        "1. ($240) Juan Carlos Sevilla Hernández -> Oct 2025, Nov 2025, Dic 2025, Ene 2026",
        "",
        "Total: $1.345",
      ].join("\n")
    );
  });

  it("incluye el color cuando la pieza lo tiene y omite las secciones vacías", () => {
    const msg = mensajeRelacionDia({
      fechaEtiqueta: "hoy",
      resumen: {
        total: 90,
        movimientos: 1,
        general: [{ productoNombre: "Playera", talla: "M", color: "Negra", cantidad: 2, total: 90 }],
        mensualidades: [],
      },
    });
    expect(msg).toContain("1. ($90) Playera Negra (M) - Piezas 2");
    expect(msg).not.toContain("Mensualidades");
    expect(msg.endsWith("Total: $90")).toBe(true);
  });

  it("piezas sin talla salen sin paréntesis", () => {
    const msg = mensajeRelacionDia({
      fechaEtiqueta: "hoy",
      resumen: {
        total: 40,
        movimientos: 1,
        general: [{ productoNombre: "Corbata", talla: "", color: "", cantidad: 1, total: 40 }],
        mensualidades: [],
      },
    });
    expect(msg).toContain("1. ($40) Corbata - Piezas 1");
  });

  it("sin movimientos avisa que no hubo pagos", () => {
    const msg = mensajeRelacionDia({
      fechaEtiqueta: "hoy",
      resumen: { total: 0, movimientos: 0, general: [], mensualidades: [] },
    });
    expect(msg).toBe("Relación de pagos\nHoy\n\nSin pagos registrados este día.");
  });
});

describe("mensajes de cambio de talla/color", () => {
  it("al pedir un cambio menciona la pieza nueva y el motivo", () => {
    const m = mensajeCambioPendiente({
      nombre: "Ana",
      articulo: "Pantalón — talla 30",
      pendiente: true,
      motivo: "Talla equivocada",
      nueva: "Pantalón — talla 32",
    });
    expect(m).toContain("Pantalón — talla 30");
    expect(m).toContain('por "Pantalón — talla 32"');
    expect(m).toContain("Talla equivocada");
  });

  it("sin pieza nueva conserva el mensaje anterior", () => {
    const m = mensajeCambioPendiente({ nombre: "Ana", articulo: "Gorra", pendiente: true });
    expect(m).toContain("CAMBIO PENDIENTE");
    expect(m).not.toContain(" por ");
  });

  it("al resolver con entrega dice qué se entregó y quién", () => {
    const m = mensajeCambioResuelto({
      nombre: "Ana",
      anterior: "Playera — talla M",
      nueva: "Playera — talla G",
      entregada: true,
      quienEntrego: "Luis",
    });
    expect(m).toContain("se te entregó");
    expect(m).toContain("Playera — talla G");
    expect(m).toContain("Entregó: Luis");
  });

  it("al resolver sin entregar aún no promete entrega", () => {
    const m = mensajeCambioResuelto({
      nombre: "Ana",
      anterior: "A",
      nueva: "B",
      entregada: false,
    });
    expect(m).toContain("ajustado");
    expect(m).not.toContain("Entregó:");
  });
});
