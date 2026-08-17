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

export function listenPedidosDeCliente(clienteId, callback) {
  const ref = collection(db, "clientes", clienteId, "pedidos");
  const q = query(ref, orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function crearPedido(clienteId, { articulo, precioTotal }) {
  const ref = collection(db, "clientes", clienteId, "pedidos");
  return addDoc(ref, {
    articulo,
    precioTotal: Number(precioTotal),
    saldoPendiente: Number(precioTotal),
    entregado: false,
    creadoEn: serverTimestamp(),
  });
}

export async function marcarEntregado(clienteId, pedidoId, entregado) {
  return updateDoc(doc(db, "clientes", clienteId, "pedidos", pedidoId), {
    entregado,
    fechaEntrega: entregado ? serverTimestamp() : null,
  });
}

export function listenAbonosDePedido(clienteId, pedidoId, callback) {
  const ref = collection(
    db,
    "clientes",
    clienteId,
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
  clienteId,
  pedidoId,
  { monto, quienRecibio }
) {
  const abonosRef = collection(
    db,
    "clientes",
    clienteId,
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

  const pedidoRef = doc(db, "clientes", clienteId, "pedidos", pedidoId);
  await updateDoc(pedidoRef, {
    saldoPendiente: increment(-Number(monto)),
  });
}

// Todos los pagos (abonos) del día, para la "Relación de pagos".
// collectionGroup permite consultar todos los subcollections "abonos" sin
// importar bajo qué cliente/pedido estén.
export function listenAbonosDelDia(fechaLocal, callback) {
  const ref = collectionGroup(db, "abonos");
  const q = query(ref, where("fechaLocal", "==", fechaLocal));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        pedidoId: d.ref.parent.parent.id,
        clienteId: d.ref.parent.parent.parent.parent.id,
        ...d.data(),
      }))
    );
  });
}
