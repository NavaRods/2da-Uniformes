import { etiquetaMes } from "./cuotas";

// Lógica pura de la Relación de pagos (sin Firebase): convierte pagos de
// uniformes y de mensualidades en filas comparables y arma los totales.

export function filaDeAbono(abono, pedido, elementoNombre) {
  return {
    id: `abono-${abono.id}`,
    tipo: "uniforme",
    pedidoId: abono.pedidoId,
    elementoId: abono.elementoId,
    elementoNombre: elementoNombre || "?",
    concepto: pedido ? pedido.articulo : "?",
    productoNombre: pedido ? pedido.productoNombre || pedido.articulo : "?",
    talla: pedido?.talla || "",
    color: pedido?.color || "",
    monto: Number(abono.monto) || 0,
    etiqueta: pedido && pedido.saldoPendiente <= 0 ? "Liquidado" : "Abono",
    horaLocal: abono.horaLocal || "",
    quienRecibio: abono.quienRecibio || "",
  };
}

export function filaDeCuota(cuota, elementoNombre) {
  const meses = cuota.meses || [];
  return {
    id: `cuota-${cuota.id}`,
    tipo: "mensualidad",
    elementoId: cuota.elementoId,
    elementoNombre: elementoNombre || "?",
    concepto: `Mensualidad — ${meses.map(etiquetaMes).join(", ")}`,
    meses,
    cantidadMeses: meses.length,
    monto: Number(cuota.total) || 0,
    etiqueta: "Mensualidad",
    horaLocal: cuota.horaLocal || "",
    quienRecibio: cuota.quienRecibio || "",
  };
}

// Más recientes primero dentro del mismo día.
export function ordenarPorHora(filas) {
  return [...filas].sort((a, b) => (a.horaLocal < b.horaLocal ? 1 : a.horaLocal > b.horaLocal ? -1 : 0));
}

export function resumenDia(filas) {
  const uniformes = filas.filter((f) => f.tipo === "uniforme");
  const mensualidades = filas.filter((f) => f.tipo === "mensualidad");
  const suma = (lista) => lista.reduce((s, f) => s + f.monto, 0);

  // Relación General: piezas por producto/talla/color. Una pieza es un pedido,
  // así que dos abonos al mismo pedido el mismo día cuentan una sola pieza,
  // aunque sí suman su dinero.
  const porPieza = {};
  for (const f of uniformes) {
    const clave = [f.productoNombre, f.talla, f.color].filter(Boolean).join(" — ");
    porPieza[clave] ??= {
      pieza: clave,
      productoNombre: f.productoNombre,
      talla: f.talla,
      color: f.color,
      pedidos: new Set(),
      total: 0,
    };
    porPieza[clave].pedidos.add(f.pedidoId ?? f.id);
    porPieza[clave].total += f.monto;
  }
  const general = Object.values(porPieza)
    .map(({ pedidos, ...resto }) => ({ ...resto, cantidad: pedidos.size }))
    .sort((a, b) => b.total - a.total);

  // Mensualidades: una entrada por elemento (si pagó varias veces el mismo
  // día se juntan), con sus meses en orden cronológico.
  const porElemento = {};
  for (const f of mensualidades) {
    porElemento[f.elementoId] ??= { nombre: f.elementoNombre, monto: 0, meses: new Set() };
    porElemento[f.elementoId].monto += f.monto;
    f.meses.forEach((m) => porElemento[f.elementoId].meses.add(m));
  }
  const detalleMensualidades = Object.values(porElemento)
    .map((e) => ({
      nombre: e.nombre,
      monto: e.monto,
      meses: [...e.meses].sort().map(etiquetaMes),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    total: suma(filas),
    movimientos: filas.length,
    totalUniformes: suma(uniformes),
    totalMensualidades: suma(mensualidades),
    mesesCobrados: mensualidades.reduce((s, f) => s + f.cantidadMeses, 0),
    general,
    mensualidades: detalleMensualidades,
  };
}

// Suma o resta días a una fecha yyyy-mm-dd (en hora local, sin saltos por UTC).
export function moverDia(yyyyMmDd, dias) {
  const [a, m, d] = yyyyMmDd.split("-").map(Number);
  const fecha = new Date(a, m - 1, d + dias);
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

export function etiquetaDia(yyyyMmDd) {
  const [a, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
