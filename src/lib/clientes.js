import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const clientesRef = collection(db, "clientes");

export function listenClientes(callback) {
  const q = query(clientesRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function crearCliente({ nombre, edad, telefono, notas }) {
  return addDoc(clientesRef, {
    nombre,
    edad: edad || null,
    telefono: telefono || "",
    notas: notas || "",
    documentacionEntregada: false,
    creadoEn: serverTimestamp(),
  });
}

export async function actualizarCliente(clienteId, cambios) {
  return updateDoc(doc(db, "clientes", clienteId), cambios);
}

export async function marcarDocumentacion(clienteId, entregada) {
  return updateDoc(doc(db, "clientes", clienteId), {
    documentacionEntregada: entregada,
  });
}
