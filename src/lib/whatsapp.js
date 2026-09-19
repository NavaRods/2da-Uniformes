import { fechaHoraActual, formatoMoneda } from "./format";

export function linkWhatsapp(telefono, mensaje) {
  const numero = (telefono || "").replace(/\D/g, "");
  const texto = encodeURIComponent(mensaje);
  return `https://wa.me/${numero}?text=${texto}`;
}

// Cada movimiento de un pedido (abono, liquidación, entrega, cambio
// pendiente) genera exactamente uno de estos mensajes, todos con el mismo
// formato de detalles: pieza, monto/estado, quién lo hizo y fecha/hora.
export function mensajeComprobante({ nombre, articulo, monto, saldoPendiente, quienRecibio }) {
  const { fecha, hora } = fechaHoraActual();
  const estado =
    saldoPendiente <= 0
      ? "Tu uniforme quedó LIQUIDADO. ¡Gracias!"
      : `Te queda un saldo pendiente de ${formatoMoneda(saldoPendiente)}.`;
  return (
    `Hola ${nombre}, se registró tu pago de ${formatoMoneda(monto)} por "${articulo}". ${estado}\n` +
    `Recibió: ${quienRecibio || "—"}\n` +
    `Fecha y hora: ${fecha} ${hora}`
  );
}

export function mensajeEntrega({ nombre, articulo, entregado, quienEntrego }) {
  const { fecha, hora } = fechaHoraActual();
  const estado = entregado
    ? `Se te entregó: "${articulo}".`
    : `Se canceló la entrega de: "${articulo}".`;
  return (
    `Hola ${nombre}, ${estado}\n` +
    `Entregó: ${quienEntrego || "—"}\n` +
    `Fecha y hora: ${fecha} ${hora}`
  );
}

export function mensajeCambioPendiente({ nombre, articulo, pendiente, motivo }) {
  const { fecha, hora } = fechaHoraActual();
  const estado = pendiente
    ? `Tu pieza "${articulo}" quedó marcada como CAMBIO PENDIENTE.${
        motivo ? ` Motivo: ${motivo}.` : ""
      }`
    : `Tu pieza "${articulo}" ya no tiene cambio pendiente, quedó resuelta.`;
  return `Hola ${nombre}, ${estado}\nFecha y hora: ${fecha} ${hora}`;
}

// Deja un número listo para wa.me: solo dígitos y con código de país. Un
// número de 10 dígitos se toma como mexicano (52); el formato antiguo de
// celular "521..." se convierte a "52...".
export function normalizarTelefono(telefono, codigoPais = "52") {
  let digitos = String(telefono ?? "").replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 10) return codigoPais + digitos;
  if (digitos.length === 13 && digitos.startsWith("521")) return "52" + digitos.slice(3);
  return digitos;
}

export function telefonoValido(numeroNormalizado) {
  return /^\d{11,15}$/.test(numeroNormalizado ?? "");
}

const MAX_LINEAS_DETALLE = 40;

// Resumen del día para mandarlo por WhatsApp desde la Relación de pagos.
// `filas` son los movimientos ya armados (ver lib/relacionPagos.js).
export function mensajeRelacionDia({ fechaEtiqueta, filas, resumen }) {
  const encabezado = `*Relación de pagos*\n${fechaEtiqueta}`;
  if (filas.length === 0) return `${encabezado}\n\nSin pagos registrados este día.`;

  const meses = resumen.mesesCobrados
    ? ` (${resumen.mesesCobrados} ${resumen.mesesCobrados === 1 ? "mes" : "meses"})`
    : "";
  const lineas = filas.slice(0, MAX_LINEAS_DETALLE).map(
    (f, i) =>
      `${i + 1}. ${f.elementoNombre} — ${f.concepto} — ${formatoMoneda(f.monto)} (${f.etiqueta})` +
      (f.horaLocal ? ` · ${f.horaLocal}` : "")
  );
  if (filas.length > MAX_LINEAS_DETALLE) {
    lineas.push(`… y ${filas.length - MAX_LINEAS_DETALLE} movimientos más`);
  }

  return (
    `${encabezado}\n\n` +
    `Total del día: ${formatoMoneda(resumen.total)} (${resumen.movimientos} ` +
    `${resumen.movimientos === 1 ? "movimiento" : "movimientos"})\n` +
    `• Uniformes: ${formatoMoneda(resumen.totalUniformes)}\n` +
    `• Mensualidades: ${formatoMoneda(resumen.totalMensualidades)}${meses}\n\n` +
    `Detalle:\n${lineas.join("\n")}`
  );
}
