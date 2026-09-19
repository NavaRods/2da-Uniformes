import { etiquetaMes } from "./cuotas";

// Lógica pura de la Relación de pagos (sin Firebase): convierte pagos de
// uniformes y de mensualidades en filas comparables y arma los totales.

export function filaDeAbono(abono, pedido, elementoNombre) {
  return {
    id: `abono-${abono.id}`,
    tipo: "uniforme",
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

  // Relación General: solo piezas, tallas y montos (sin datos del elemento).
  const porPieza = {};
  for (const f of uniformes) {
    const clave = [f.productoNombre, f.talla, f.color].filter(Boolean).join(" — ");
    porPieza[clave] ??= { pieza: clave, cantidad: 0, total: 0 };
    porPieza[clave].cantidad += 1;
    porPieza[clave].total += f.monto;
  }

  return {
    total: suma(filas),
    movimientos: filas.length,
    totalUniformes: suma(uniformes),
    totalMensualidades: suma(mensualidades),
    mesesCobrados: mensualidades.reduce((s, f) => s + f.cantidadMeses, 0),
    general: Object.values(porPieza),
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
