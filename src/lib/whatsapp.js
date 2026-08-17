export function linkWhatsapp(telefono, mensaje) {
  const numero = (telefono || "").replace(/\D/g, "");
  const texto = encodeURIComponent(mensaje);
  return `https://wa.me/${numero}?text=${texto}`;
}

export function mensajeComprobante({ nombre, articulo, monto, saldoPendiente }) {
  const estado =
    saldoPendiente <= 0
      ? "Tu uniforme quedó LIQUIDADO. ¡Gracias!"
      : `Te queda un saldo pendiente de $${saldoPendiente}.`;
  return `Hola ${nombre}, se registró tu pago de $${monto} por "${articulo}". ${estado}`;
}
