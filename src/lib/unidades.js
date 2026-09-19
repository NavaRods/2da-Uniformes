import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const unidadesRef = collection(db, "unidades");

export function listenUnidades(callback) {
  const q = query(unidadesRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function crearUnidad(nombre) {
  return addDoc(unidadesRef, {
    nombre: nombre.trim(),
    creadoEn: serverTimestamp(),
  });
}

export async function eliminarUnidad(unidadId) {
  return deleteDoc(doc(db, "unidades", unidadId));
}
