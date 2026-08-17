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
} from "firebase/firestore";
import { db } from "../firebase";

export function listenPedidosDeElemento(elementoId, callback) {
  const ref = collection(db, "elementos", elementoId, "pedidos");
  const q = query(ref, orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function crearPedido(elementoId, { articulo, precioTotal }) {
  const ref = collection(db, "elementos", elementoId, "pedidos");
  return addDoc(ref, {
    articulo,
    precioTotal: Number(precioTotal),
    saldoPendiente: Number(precioTotal),
    entregado: false,
    creadoEn: serverTimestamp(),
  });
}

export async function marcarEntregado(elementoId, pedidoId, entregado) {
  return updateDoc(doc(db, "elementos", elementoId, "pedidos", pedidoId), {
    entregado,
    fechaEntrega: entregado ? serverTimestamp() : null,
  });
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

export async function registrarAbono(
  elementoId,
  pedidoId,
  { monto, quienRecibio }
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
    monto: Number(monto),
    quienRecibio: quienRecibio || "",
    fecha: serverTimestamp(),
    fechaLocal: new Date().toISOString().slice(0, 10),
  });

  const pedidoRef = doc(db, "elementos", elementoId, "pedidos", pedidoId);
  await updateDoc(pedidoRef, {
    saldoPendiente: increment(-Number(monto)),
  });
}

// Todos los pagos (abonos) del día, para la "Relación de pagos".
// collectionGroup permite consultar todos los subcollections "abonos" sin
// importar bajo qué elemento/pedido estén.
export function listenAbonosDelDia(fechaLocal, callback) {
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
  });
}
