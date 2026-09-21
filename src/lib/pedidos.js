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
  getDoc,
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
  { articulo, precioTotal, productoNombre, talla, color, cantidad }
) {
  const ref = collection(db, "elementos", elementoId, "pedidos");
  return addDoc(ref, {
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
//
// El abono y el nuevo saldo se guardan en un solo batch (todo o nada). Las
// reglas de Firestore exigen esa pareja: un abono sin el descuento exacto en
// el saldo (o un saldo que baja sin abono) se rechaza. Por eso el saldo se
// calcula aquí (saldo actual - monto) y no con increment(), y el pedido guarda
// el ID del abono en "ultimoAbonoId" para que las reglas puedan enlazarlos.
export async function registrarAbono(
  elementoId,
  pedidoId,
  { monto, quienRecibio }
) {
  const importe = Number(monto);
  if (!(importe > 0)) throw new Error("El abono debe ser mayor a $0.");

  const pedidoRef = doc(db, "elementos", elementoId, "pedidos", pedidoId);
  const pedido = await getDoc(pedidoRef);
  const saldoActual = pedido.data().saldoPendiente;

  const abonoRef = doc(collection(pedidoRef, "abonos"));
  const batch = writeBatch(db);
  batch.set(abonoRef, {
    monto: importe,
    quienRecibio: quienRecibio || "",
    fecha: serverTimestamp(),
    fechaLocal: fechaLocalISO(),
    horaLocal: horaLocalHHMM(),
  });
  batch.update(pedidoRef, {
    saldoPendiente: saldoActual - importe,
    ultimoAbonoId: abonoRef.id,
  });
  await batch.commit();
}

// Todos los pagos (abonos) del día, para la "Relación de pagos" (detalle por
// elemento) y la "Relación de pagos General" (agregada, sin datos del
// elemento). collectionGroup permite consultar todos los subcollections
// "abonos" sin importar bajo qué elemento/pedido estén.
export function listenAbonosDelDia(fechaLocal, callback, onError) {
  const ref = collectionGroup(db, "abonos");
  const q = query(ref, where("fechaLocal", "==", fechaLocal));
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
export function listenCambiosPendientes(callback, onError) {
  const ref = collectionGroup(db, "pedidos");
  const q = query(ref, where("cambioPendiente", "==", true));
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
