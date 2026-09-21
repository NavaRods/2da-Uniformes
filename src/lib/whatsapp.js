import { fechaHoraActual, formatoMoneda } from "./format";
import { CATEGORIAS } from "./grados";

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

// Pesos con punto como separador de miles ($1.345), como se lee en el mensaje.
function pesos(monto) {
  const n = Number(monto) || 0;
  const texto = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
  const [entero, decimales] = texto.split(",");
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${conPuntos}${decimales ? "," + decimales : ""}`;
}

function piezas(n) {
  return `${n} ${n === 1 ? "pieza" : "piezas"}`;
}

// "Playera Negra (M)": producto, color si lo hay y talla entre paréntesis.
function nombrePieza({ productoNombre, color, talla }) {
  return `${productoNombre}${color ? ` ${color}` : ""}${talla ? ` (${talla})` : ""}`;
}

// Relación de pagos del día para mandar por WhatsApp. `resumen` viene de
// resumenDia() en lib/relacionPagos.js.
export function mensajeRelacionDia({ fechaEtiqueta, resumen }) {
  const fecha = fechaEtiqueta.charAt(0).toUpperCase() + fechaEtiqueta.slice(1);
  const partes = [`Relación de pagos\n${fecha}`];

  if (resumen.movimientos === 0) {
    partes.push("Sin pagos registrados este día.");
    return partes.join("\n\n");
  }

  if (resumen.general.length > 0) {
    const lineas = resumen.general.map(
      (g, i) => `${i + 1}. (${pesos(g.total)}) ${nombrePieza(g)} -> ${piezas(g.cantidad)}`
    );
    partes.push(`Detalles (Uniformidad):\n\n${lineas.join("\n")}`);
  }

  if (resumen.mensualidades.length > 0) {
    const lineas = resumen.mensualidades.map(
      (m, i) => `${i + 1}. (${pesos(m.monto)}) ${m.nombre} -> ${m.meses.join(", ")}`
    );
    partes.push(`Detalles (Mensualidades):\n\n${lineas.join("\n")}`);
  }

  partes.push(`Total: ${pesos(resumen.total)}`);
  return partes.join("\n\n");
}

// Estado de Fuerza del día para mandar por WhatsApp. `fuerza` viene de
// estadoDeFuerza() en lib/grados.js.
export function mensajeEstadoFuerza({ unidad, fechaEtiqueta, fuerza, novedades }) {
  const fecha = fechaEtiqueta.charAt(0).toUpperCase() + fechaEtiqueta.slice(1);
  const bloque = (titulo, cuenta) => {
    const lineas = CATEGORIAS.map((c) => `${c}: ${cuenta[c]}`);
    if (cuenta.sinGrado > 0) lineas.push(`Sin grado: ${cuenta.sinGrado}`);
    return `${titulo}\n${lineas.join("\n")}\nTotal ${titulo.toLowerCase()}: ${cuenta.total}`;
  };
  const partes = [
    `ESTADO DE FUERZA\nUnidad: ${unidad}\n${fecha}`,
    bloque("VARONIL", fuerza.Varonil),
    bloque("FEMENINO", fuerza.Femenino),
    `TOTAL GENERAL: ${fuerza.totalGeneral}`,
  ];
  if (novedades?.trim()) partes.push(`Novedades:\n${novedades.trim()}`);
  return partes.join("\n\n");
}
