import {
  collection,
  collectionGroup,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { fechaLocalISO, horaLocalHHMM } from "./format";

export function listenPedidosDeElemento(elementoId, callback) {
  const ref = collection(db, "elementos", elementoId, "pedidos");
  const q = query(ref, orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// datos estructurados de la pieza (productoNombre, talla, color, cantidad)
// se guardan aparte de "articulo" (el texto ya armado para mostrar) para que
// la Relación de Pagos General pueda agrupar por pieza/talla sin tener que
// leer el nombre del elemento.
export async function crearPedido(
  elementoId,
  { articulo, precioTotal, productoNombre, talla, color, cantidad, unidad }
) {
  const ref = collection(db, "elementos", elementoId, "pedidos");
  return addDoc(ref, {
    unidad,
    articulo,
    productoNombre: productoNombre || articulo,
    talla: talla || "",
    color: color || "",
    cantidad: Number(cantidad) || 1,
    precioTotal: Number(precioTotal),
    saldoPendiente: Number(precioTotal),
    entregado: false,
    fechaEntrega: null,
    quienEntrego: "",
    cambioPendiente: false,
    motivoCambio: "",
    fechaCambioSolicitado: null,
    creadoEn: serverTimestamp(),
  });
}

// Al entregar (o desmarcar) una pieza se deja constancia de quién la entregó
// y cuándo, para que el aviso de WhatsApp y la Relación de Pagos tengan el
// detalle completo del movimiento.
export async function marcarEntregado(elementoId, pedidoId, entregado, quienEntrego) {
  return updateDoc(doc(db, "elementos", elementoId, "pedidos", pedidoId), {
    entregado,
    fechaEntrega: entregado ? serverTimestamp() : null,
    quienEntrego: entregado ? quienEntrego || "" : "",
  });
}

// Marca (o resuelve) que una pieza necesita cambio (talla/color equivocado,
// defecto, etc). Mientras cambioPendiente sea true, la pieza queda marcada
// en el perfil del elemento y en la Relación de Pagos hasta que se resuelva.
export async function marcarCambioPendiente(
  elementoId,
  pedidoId,
  pendiente,
  motivo
) {
  return updateDoc(doc(db, "elementos", elementoId, "pedidos", pedidoId), {
    cambioPendiente: pendiente,
    motivoCambio: pendiente ? motivo || "" : "",
    fechaCambioSolicitado: pendiente ? serverTimestamp() : null,
  });
}

// Elimina un pedido junto con sus abonos (Firestore no borra las
// subcolecciones solas; si quedaran, seguirían apareciendo en la Relación de
// pagos como cobros de un pedido que ya no existe).
export async function eliminarPedido(elementoId, pedidoId) {
  const abonosRef = collection(db, "elementos", elementoId, "pedidos", pedidoId, "abonos");
  const abonos = await getDocs(abonosRef);
  const batch = writeBatch(db);
  abonos.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "elementos", elementoId, "pedidos", pedidoId));
  await batch.commit();
}

export function listenAbonosDePedido(elementoId, pedidoId, callback) {
  const ref = collection(
    db,
    "elementos",
    elementoId,
    "pedidos",
    pedidoId,
    "abonos"
  );
  const q = query(ref, orderBy("fecha", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Registra un abono (pago parcial o liquidación). El saldo del pedido se va
// descontando con cada abono hasta llegar a 0 (o menos), momento en el que
// el pedido queda "liquidado" — esto se sigue evaluando en cada pantalla a
// partir de saldoPendiente, nunca hay que "cerrar" el pedido a mano.
export async function registrarAbono(
  elementoId,
  pedidoId,
  { monto, quienRecibio, unidad }
) {
  const abonosRef = collection(
    db,
    "elementos",
    elementoId,
    "pedidos",
    pedidoId,
    "abonos"
  );
  await addDoc(abonosRef, {
    unidad,
    monto: Number(monto),
    quienRecibio: quienRecibio || "",
    fecha: serverTimestamp(),
    fechaLocal: fechaLocalISO(),
    horaLocal: horaLocalHHMM(),
  });

  const pedidoRef = doc(db, "elementos", elementoId, "pedidos", pedidoId);
  await updateDoc(pedidoRef, {
    saldoPendiente: increment(-Number(monto)),
  });
}

// Todos los pagos (abonos) del día, para la "Relación de pagos" (detalle por
// elemento) y la "Relación de pagos General" (agregada, sin datos del
// elemento). collectionGroup permite consultar todos los subcollections
// "abonos" sin importar bajo qué elemento/pedido estén.
// Con `unidad` (Operador) solo trae los de esa Unidad; sin ella (Admin), todos.
export function listenAbonosDelDia(fechaLocal, callback, onError, unidad) {
  const ref = collectionGroup(db, "abonos");
  const filtros = unidad ? [where("unidad", "==", unidad)] : [];
  const q = query(ref, ...filtros, where("fechaLocal", "==", fechaLocal));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        pedidoId: d.ref.parent.parent.id,
        elementoId: d.ref.parent.parent.parent.parent.id,
        ...d.data(),
      }))
    );
  }, onError);
}

// Todos los pedidos con un cambio de pieza pendiente (sin importar el día),
// para que no se pierdan de vista hasta que se resuelvan.
export function listenCambiosPendientes(callback, onError, unidad) {
  const ref = collectionGroup(db, "pedidos");
  const filtros = unidad ? [where("unidad", "==", unidad)] : [];
  const q = query(ref, ...filtros, where("cambioPendiente", "==", true));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        elementoId: d.ref.parent.parent.id,
        ...d.data(),
      }))
    );
  }, onError);
}
