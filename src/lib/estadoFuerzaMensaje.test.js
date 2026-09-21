import { describe, it, expect } from "vitest";
import { mensajeEstadoFuerza } from "./whatsapp";

const cuenta = (extra) => ({
  Jefes: 0,
  Oficiales: 0,
  Clases: 0,
  Cadetes: 0,
  Tropas: 0,
  Reclutas: 0,
  sinGrado: 0,
  total: 0,
  ...extra,
});

const fuerza = {
  Varonil: cuenta({ Clases: 2, Cadetes: 4, Reclutas: 3, total: 9 }),
  Femenino: cuenta({ Clases: 3, Cadetes: 1, Tropas: 2, Reclutas: 3, total: 9 }),
  totalGeneral: 18,
};

describe("mensajeEstadoFuerza", () => {
  it("lleva el conteo por categoría, los totales y la novedad", () => {
    const texto = mensajeEstadoFuerza({
      unidad: "2da Unidad",
      fechaEtiqueta: "lunes, 21 de septiembre de 2026",
      fuerza,
      novedades: "  Un elemento con permiso  ",
    });
    expect(texto).toContain("ESTADO DE FUERZA");
    expect(texto).toContain("2da Unidad");
    expect(texto).toContain("Lunes, 21 de septiembre de 2026");
    expect(texto).toContain(
      "VARONIL\nJefes: 0\nOficiales: 0\nClases: 2\nCadetes: 4\nTropas: 0\nReclutas: 3\nTotal varonil: 9"
    );
    expect(texto).toContain(
      "FEMENINO\nJefes: 0\nOficiales: 0\nClases: 3\nCadetes: 1\nTropas: 2\nReclutas: 3\nTotal femenino: 9"
    );
    expect(texto).toContain("TOTAL GENERAL: 18");
    expect(texto).toContain("Novedades:\nUn elemento con permiso");
  });

  it("sin novedades no agrega la sección", () => {
    const texto = mensajeEstadoFuerza({ unidad: "U", fechaEtiqueta: "lunes", fuerza, novedades: "  " });
    expect(texto).not.toContain("Novedades");
  });

  it("avisa de los elementos sin grado para que el total cuadre", () => {
    const conSinGrado = { ...fuerza, Varonil: cuenta({ sinGrado: 1, total: 1 }), totalGeneral: 10 };
    const texto = mensajeEstadoFuerza({ unidad: "U", fechaEtiqueta: "lunes", fuerza: conSinGrado });
    expect(texto).toContain("Sin grado: 1");
  });
});
