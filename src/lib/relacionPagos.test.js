import { describe, it, expect } from "vitest";
import {
  filaDeAbono,
  filaDeCuota,
  filaDePedido,
  pedidoDeAbono,
  ordenarPorHora,
  resumenDia,
  uniformidadPorEntregar,
  resumenUniformidad,
  claveVariante,
  relacionPorElemento,
  resumenRelacion,
  porcentajePagado,
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

  it("separa los abonos: la pieza solo cuenta cuando se liquida, y dice de quién es", () => {
    const f = (id, pedidoId, nombre, monto, etiqueta, saldo) => ({
      id, pedidoId, elementoId: `e-${nombre}`, elementoNombre: nombre, tipo: "uniforme",
      productoNombre: "Botas", talla: "7", color: "", monto, etiqueta, saldo,
    });
    const r = resumenDia([
      f("1", "p1", "Ana", 100, "Abono", 150),
      f("2", "p2", "Luis", 250, "Liquidado", 0),
      f("3", "p3", "Eva", 50, "Abono", 200),
      f("4", "p3", "Eva", 30, "Abono", 170),
    ]);
    expect(r.general).toHaveLength(1);
    expect(r.general[0]).toMatchObject({ cantidad: 1, total: 250 });
    expect(r.general[0].elementos.map((e) => e.nombre)).toEqual(["Luis"]);
    expect(r.abonos.map((a) => [a.nombre, a.monto, a.saldo])).toEqual([
      ["Ana", 100, 150],
      ["Eva", 80, 170],
    ]);
    expect(r.totalAbonos).toBe(180);
    expect(r.total).toBe(430);
  });

  it("un abono del mismo día en que se liquida la pieza sigue contando como abono", () => {
    const f = (id, monto, etiqueta, saldo) => ({
      id, pedidoId: "p1", elementoId: "e1", elementoNombre: "Ana", tipo: "uniforme",
      productoNombre: "Botas", talla: "7", color: "", monto, etiqueta, saldo,
    });
    const r = resumenDia([f("1", 100, "Abono", 150), f("2", 150, "Liquidado", 0)]);
    expect(r.abonos.map((a) => [a.nombre, a.monto])).toEqual([["Ana", 100]]);
    expect(r.general[0]).toMatchObject({ cantidad: 1, total: 150 });
    expect(r.total).toBe(250);
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

describe("uniformidad por entregar", () => {
  const pieza = (id, productoNombre, talla, { saldo = 0, entregado = false, color = "" } = {}) =>
    filaDePedido({
      id, elementoId: "e", productoNombre, articulo: productoNombre, talla, color,
      precioTotal: 100, saldoPendiente: saldo, entregado,
    });
  const filas = [
    pieza("1", "Gorra", "5"),
    pieza("2", "Gorra", "5", { saldo: 40 }),
    pieza("3", "Gorra", "10"),
    pieza("4", "Botas", "2"),
    pieza("5", "Botas", "2", { entregado: true }),
    pieza("6", "Playera", "M", { color: "Blanca" }),
  ];

  it("suma las piezas sin entregar por producto y talla (sin las ya entregadas)", () => {
    const productos = uniformidadPorEntregar(filas);
    expect(productos.map((p) => [p.producto, p.piezas])).toEqual([
      ["Botas", 1],
      ["Gorra", 3],
      ["Playera", 1],
    ]);
    const gorra = productos.find((p) => p.producto === "Gorra");
    // Tallas en orden numérico: 5 antes que 10.
    expect(gorra.variantes.map((v) => [v.talla, v.piezas, v.pagadas, v.conSaldo])).toEqual([
      ["5", 2, 1, 1],
      ["10", 1, 1, 0],
    ]);
    expect(productos.find((p) => p.producto === "Playera").variantes[0].color).toBe("Blanca");
  });

  it("resume el total de piezas, pagadas y con saldo", () => {
    expect(resumenUniformidad(uniformidadPorEntregar(filas))).toEqual({
      piezas: 5,
      pagadas: 4,
      conSaldo: 1,
      recibido: 0,
      faltaRecibir: 5,
      productos: 3,
    });
  });

  it("cruza lo que se debe con Uniformidad disponible (sin pasar de lo que se debe)", () => {
    const existencias = new Map([
      [claveVariante({ productoNombre: "Gorra", talla: "5" }), 1],
      [claveVariante({ productoNombre: "Gorra", talla: "10" }), 7],
    ]);
    const gorra = uniformidadPorEntregar(filas, existencias).find((p) => p.producto === "Gorra");
    expect(gorra.variantes.map((v) => [v.talla, v.recibido, v.faltaRecibir])).toEqual([
      ["5", 1, 1],
      ["10", 1, 0],
    ]);
    expect([gorra.recibido, gorra.faltaRecibir]).toEqual([2, 1]);
  });

  it("sin piezas pendientes da una lista vacía", () => {
    expect(uniformidadPorEntregar([pieza("1", "Gorra", "5", { entregado: true })])).toEqual([]);
    expect(resumenUniformidad([])).toMatchObject({ piezas: 0 });
  });

  it("porcentaje pagado", () => {
    expect(porcentajePagado({ pagado: 60, precioTotal: 100 })).toBe(60);
    expect(porcentajePagado({ pagado: 0, precioTotal: 0 })).toBe(100);
  });
});

describe("relacionPorElemento", () => {
  const ts = (ms) => ({ toMillis: () => ms });
  const elementos = [
    { id: "e1", nombre: "Beto" },
    { id: "e2", nombre: "Ana" },
    { id: "e3", nombre: "Carla" },
    { id: "e4", nombre: "Dani" },
    { id: "e5", nombre: "Eli", fechaBaja: "2026-09-01" },
  ];
  const filas = [
    { id: "a", elementoId: "e1", precioTotal: 300, saldoPendiente: 100, entregado: true, creadoEn: ts(1) },
    { id: "b", elementoId: "e1", precioTotal: 50, saldoPendiente: 0, entregado: false, creadoEn: ts(2), cambioPendiente: true },
    { id: "c", elementoId: "e2", precioTotal: 200, saldoPendiente: 0, entregado: false },
    { id: "d", elementoId: "e3", precioTotal: 90, saldoPendiente: 0, entregado: true },
    { id: "e", elementoId: "e9", elementoNombre: "Otro", precioTotal: 10, saldoPendiente: 10, entregado: true },
  ].map(filaDePedido);
  const grupos = relacionPorElemento(elementos, filas);
  const de = (id) => grupos.find((g) => g.elementoId === id);

  it("junta los pedidos de cada elemento con lo pagado, lo que debe y lo sin entregar", () => {
    expect(de("e1")).toMatchObject({
      elementoNombre: "Beto",
      piezas: 2,
      valorTotal: 350,
      pagado: 250,
      porCobrar: 100,
      sinEntregar: 1,
      cambios: 1,
      estado: "debe",
    });
    // Del pedido más nuevo al más viejo.
    expect(de("e1").pedidos.map((f) => f.pedidoId)).toEqual(["b", "a"]);
  });

  it("clasifica: debe, falta entregar, al corriente y sin uniformes", () => {
    expect(de("e2").estado).toBe("sin-entregar");
    expect(de("e3").estado).toBe("al-corriente");
    expect(de("e4").estado).toBe("sin-pedidos");
  });

  it("una baja sin pedidos no aparece; un pedido de un elemento desconocido sí", () => {
    expect(de("e5")).toBeUndefined();
    expect(de("e9")).toMatchObject({ elementoNombre: "Otro", porCobrar: 10 });
  });

  it("ordena por nombre", () => {
    expect(grupos.map((g) => g.elementoNombre)).toEqual(["Ana", "Beto", "Carla", "Dani", "Otro"]);
  });

  it("resume cuántos deben, a cuántos les falta entregar, etc.", () => {
    expect(resumenRelacion(grupos)).toMatchObject({
      elementos: 5,
      deben: 2,
      faltaEntregar: 2,
      alCorriente: 1,
      sinPedidos: 1,
      porCobrar: 110,
      piezasSinEntregar: 2,
    });
  });
});

describe("identificador de cada fila", () => {
  it("abonos o mensualidades con el mismo ID en distintos pedidos no chocan", () => {
    const a1 = filaDeAbono({ id: "a1", elementoId: "e1", pedidoId: "p1", monto: 10 }, null, "Ana");
    const a2 = filaDeAbono({ id: "a1", elementoId: "e2", pedidoId: "p1", monto: 10 }, null, "Luis");
    const c1 = filaDeCuota({ id: "c1", elementoId: "e1", meses: ["2026-09"], total: 60 }, "Ana");
    const c2 = filaDeCuota({ id: "c1", elementoId: "e2", meses: ["2026-09"], total: 60 }, "Luis");
    expect(a1.id).not.toBe(a2.id);
    expect(c1.id).not.toBe(c2.id);
  });
});

describe("cambio pendiente", () => {
  const conCambio = filaDePedido({
    id: "1", elementoId: "e", productoNombre: "Playera", articulo: "Playera — Blanca — talla M",
    talla: "M", color: "Blanca", precioTotal: 180, saldoPendiente: 0, entregado: true,
    cambioPendiente: true, cambioTalla: "G", cambioColor: "Blanca",
  });

  it("la pieza nueva cuenta como pendiente aunque la anterior ya se entregó", () => {
    expect(conCambio.faltaEntregar).toBe(true);
    expect(conCambio.pendiente).toBe(true);
    expect(conCambio.tallaEntrega).toBe("G");
    // La fila conserva la talla original para mostrar el "de M a G".
    expect(conCambio.talla).toBe("M");
  });

  it("en Pendientes se suma en la talla NUEVA y se marca como cambio", () => {
    const [playera] = uniformidadPorEntregar([conCambio]);
    expect(playera.variantes).toHaveLength(1);
    expect(playera.variantes[0]).toMatchObject({ talla: "G", piezas: 1, cambios: 1 });
  });

  it("sin cambio pendiente la talla de entrega es la del pedido", () => {
    const f = filaDePedido({ id: "2", elementoId: "e", productoNombre: "Gorra", talla: "5", precioTotal: 1, saldoPendiente: 0 });
    expect(f.tallaEntrega).toBe("5");
    expect(f.cambioPendiente).toBe(false);
  });
});
