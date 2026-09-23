import { describe, it, expect } from "vitest";
import {
  filaDeAbono,
  filaDeCuota,
  filaDePedido,
  pedidoDeAbono,
  ordenarPorHora,
  resumenDia,
  resumenPendientes,
  pendientesPorElemento,
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
    { id: "a1", pedidoId: "p1", tipo: "uniforme", productoNombre: "Playera", talla: "M", color: "Negra", monto: 100 },
    { id: "a2", pedidoId: "p1", tipo: "uniforme", productoNombre: "Playera", talla: "M", color: "Negra", monto: 50 },
    { id: "a3", pedidoId: "p2", tipo: "uniforme", productoNombre: "Playera", talla: "M", color: "Negra", monto: 30 },
    { id: "a4", pedidoId: "p3", tipo: "uniforme", productoNombre: "Corbata", talla: "", color: "", monto: 40 },
    { id: "c1", tipo: "mensualidad", elementoId: "e1", elementoNombre: "Luis", meses: ["2026-02"], cantidadMeses: 1, monto: 60 },
    { id: "c2", tipo: "mensualidad", elementoId: "e1", elementoNombre: "Luis", meses: ["2026-01", "2026-03"], cantidadMeses: 2, monto: 120 },
    { id: "c3", tipo: "mensualidad", elementoId: "e2", elementoNombre: "Ana", meses: ["2025-12"], cantidadMeses: 1, monto: 60 },
  ];

  it("separa totales de uniformes y mensualidades", () => {
    expect(resumenDia(filas)).toMatchObject({
      total: 460,
      movimientos: 7,
      totalUniformes: 220,
      totalMensualidades: 240,
      mesesCobrados: 4,
    });
  });

  it("cuenta piezas por pedido, no por abono, y ordena por monto", () => {
    const { general } = resumenDia(filas);
    expect(general.map((g) => [g.pieza, g.cantidad, g.total])).toEqual([
      ["Playera — M — Negra", 2, 180], // dos abonos al pedido p1 = 1 pieza, más p2
      ["Corbata", 1, 40],
    ]);
    expect(general[0]).toMatchObject({ productoNombre: "Playera", talla: "M", color: "Negra" });
  });

  it("junta las mensualidades por elemento con sus meses en orden cronológico", () => {
    expect(resumenDia(filas).mensualidades).toEqual([
      { nombre: "Ana", monto: 60, meses: ["Dic 2025"] },
      { nombre: "Luis", monto: 180, meses: ["Ene 2026", "Feb 2026", "Mar 2026"] },
    ]);
  });

  it("un día sin movimientos da ceros", () => {
    expect(resumenDia([])).toMatchObject({
      total: 0,
      movimientos: 0,
      general: [],
      mensualidades: [],
    });
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

describe("pedidoDeAbono", () => {
  it("usa los datos copiados en el abono, sin leer el pedido", () => {
    const p = pedidoDeAbono({ articulo: "Gorra", productoNombre: "Gorra", talla: "3", color: "", saldoTras: 0 });
    expect(p).toMatchObject({ articulo: "Gorra", saldoPendiente: 0 });
    const f = filaDeAbono({ id: "a", elementoId: "e", monto: 5 }, p, "Ana");
    expect(f.etiqueta).toBe("Liquidado");
  });

  it("un abono antiguo (sin datos copiados) devuelve null", () => {
    expect(pedidoDeAbono({ id: "a", monto: 5 })).toBeNull();
  });
});

describe("filaDePedido", () => {
  it("calcula lo pagado y marca deuda y falta de entrega", () => {
    const f = filaDePedido({
      id: "p1",
      elementoId: "e1",
      articulo: "Playera — M",
      precioTotal: 300,
      saldoPendiente: 120,
      entregado: false,
    });
    expect(f).toMatchObject({
      id: "e1/p1",
      pagado: 180,
      saldoPendiente: 120,
      liquidado: false,
      debeDinero: true,
      faltaEntregar: true,
    });
  });

  it("un pedido liquidado y entregado no queda con deuda", () => {
    const f = filaDePedido({
      id: "p2",
      elementoId: "e1",
      articulo: "Gorra",
      precioTotal: 50,
      saldoPendiente: 0,
      entregado: true,
    });
    expect(f).toMatchObject({
      pagado: 50,
      saldoPendiente: 0,
      liquidado: true,
      debeDinero: false,
      faltaEntregar: false,
    });
  });

  it("un saldo negativo (pago de más) no sube el pagado arriba del precio", () => {
    const f = filaDePedido({
      id: "p3",
      elementoId: "e1",
      articulo: "Corbata",
      precioTotal: 40,
      saldoPendiente: -10,
      entregado: true,
    });
    expect(f.pagado).toBe(40);
    expect(f.saldoPendiente).toBe(0);
    expect(f.liquidado).toBe(true);
  });
});

describe("resumenPendientes y pendientesPorElemento", () => {
  const filas = [
    filaDePedido({
      id: "p1", elementoId: "e1", elementoNombre: "Ana",
      articulo: "Playera", precioTotal: 300, saldoPendiente: 120, entregado: false,
    }),
    filaDePedido({
      id: "p2", elementoId: "e1", elementoNombre: "Ana",
      articulo: "Gorra", precioTotal: 50, saldoPendiente: 0, entregado: true,
    }),
    filaDePedido({
      id: "p3", elementoId: "e2", elementoNombre: "Luis",
      articulo: "Pantalón", precioTotal: 200, saldoPendiente: 200, entregado: false,
    }),
  ];

  it("suma lo por cobrar, lo pagado y cuenta deudas y entregas", () => {
    expect(resumenPendientes(filas)).toMatchObject({
      pedidos: 3,
      elementos: 2,
      porCobrar: 320,
      pagado: 230,
      valorTotal: 550,
      conDeuda: 2,
      sinEntregar: 2,
    });
  });

  it("agrupa por elemento y ordena primero a quien más debe", () => {
    const grupos = pendientesPorElemento(filas);
    expect(grupos.map((g) => g.elementoId)).toEqual(["e2", "e1"]);
    expect(grupos[1]).toMatchObject({
      elementoNombre: "Ana",
      porCobrar: 120,
      pagado: 230,
      valorTotal: 350,
      conDeuda: 1,
      sinEntregar: 1,
    });
    expect(grupos[1].pedidos).toHaveLength(2);
  });

  it("una lista vacía da ceros y ningún grupo", () => {
    expect(resumenPendientes([])).toMatchObject({ pedidos: 0, porCobrar: 0, conDeuda: 0 });
    expect(pendientesPorElemento([])).toEqual([]);
  });
});
