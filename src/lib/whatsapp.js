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
