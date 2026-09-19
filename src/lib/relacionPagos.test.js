import { describe, it, expect } from "vitest";
import {
  filaDeAbono,
  filaDeCuota,
  ordenarPorHora,
  resumenDia,
  moverDia,
} from "./relacionPagos";

const pedido = {
  articulo: "Playera — Negra — talla M",
  productoNombre: "Playera",
  talla: "M",
  color: "Negra",
  saldoPendiente: 0,
};

describe("filas", () => {
  it("un abono de pedido saldado sale como Liquidado", () => {
    const f = filaDeAbono({ id: "a1", elementoId: "e1", monto: 100, horaLocal: "10:00" }, pedido, "Ana");
    expect(f).toMatchObject({
      tipo: "uniforme",
      elementoNombre: "Ana",
      productoNombre: "Playera",
      monto: 100,
      etiqueta: "Liquidado",
    });
  });

  it("un abono con saldo pendiente sale como Abono", () => {
    const f = filaDeAbono({ id: "a1", monto: 50 }, { ...pedido, saldoPendiente: 50 }, "Ana");
    expect(f.etiqueta).toBe("Abono");
  });

  it("si el pedido ya no existe no truena", () => {
    const f = filaDeAbono({ id: "a1", monto: 50 }, null, undefined);
    expect(f).toMatchObject({ elementoNombre: "?", concepto: "?", etiqueta: "Abono" });
  });

  it("una cuota lista los meses y cuenta cuántos son", () => {
    const f = filaDeCuota(
      { id: "c1", elementoId: "e1", meses: ["2026-01", "2026-02"], total: 120, horaLocal: "11:00" },
      "Luis"
    );
    expect(f).toMatchObject({
      tipo: "mensualidad",
      concepto: "Mensualidad — Ene 2026, Feb 2026",
      cantidadMeses: 2,
      monto: 120,
    });
  });
});

describe("resumenDia", () => {
  const filas = [
    { tipo: "uniforme", productoNombre: "Playera", talla: "M", color: "Negra", monto: 100 },
    { tipo: "uniforme", productoNombre: "Playera", talla: "M", color: "Negra", monto: 50 },
    { tipo: "uniforme", productoNombre: "Corbata", talla: "", color: "", monto: 40 },
    { tipo: "mensualidad", cantidadMeses: 3, monto: 180 },
  ];

  it("separa totales de uniformes y mensualidades", () => {
    expect(resumenDia(filas)).toMatchObject({
      total: 370,
      movimientos: 4,
      totalUniformes: 190,
      totalMensualidades: 180,
      mesesCobrados: 3,
    });
  });

  it("agrupa los uniformes por pieza, talla y color", () => {
    const { general } = resumenDia(filas);
    expect(general).toContainEqual({ pieza: "Playera — M — Negra", cantidad: 2, total: 150 });
    expect(general).toContainEqual({ pieza: "Corbata", cantidad: 1, total: 40 });
    expect(general).toHaveLength(2);
  });

  it("un día sin movimientos da ceros", () => {
    expect(resumenDia([])).toMatchObject({ total: 0, movimientos: 0, general: [] });
  });
});

describe("utilidades", () => {
  it("ordena las filas de la más reciente a la más antigua", () => {
    const r = ordenarPorHora([{ horaLocal: "09:00" }, { horaLocal: "17:30" }, { horaLocal: "12:00" }]);
    expect(r.map((f) => f.horaLocal)).toEqual(["17:30", "12:00", "09:00"]);
  });

  it("mueve días cruzando mes y año", () => {
    expect(moverDia("2026-09-30", 1)).toBe("2026-10-01");
    expect(moverDia("2026-01-01", -1)).toBe("2025-12-31");
  });
});
