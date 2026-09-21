import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar } from "./estadoFirestore";

const unidadesRef = collection(db, "unidades");

// "2a" antes que "10a" (orden numérico, no alfabético).
export function compararUnidades(a, b) {
  return a.nombre.localeCompare(b.nombre, "es", { numeric: true });
}

export function listenUnidades(callback) {
  const q = query(unidadesRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(compararUnidades));
  }, vigilar());
}

// Misma Unidad aunque cambien mayúsculas o espacios ("1A" = "1a ").
export function existeUnidad(unidades, nombre) {
  const buscada = nombre.trim().toLowerCase();
  return unidades.some((u) => u.nombre.trim().toLowerCase() === buscada);
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

// Quita varias Unidades de la lista de una sola vez. No toca elementos ni
// usuarios: siguen guardados con el nombre de su Unidad.
export async function eliminarUnidades(unidadIds) {
  for (let i = 0; i < unidadIds.length; i += 400) {
    const lote = writeBatch(db);
    unidadIds.slice(i, i + 400).forEach((id) => lote.delete(doc(db, "unidades", id)));
    await lote.commit();
  }
}

// Cuántos elementos y usuarios usan cada Unidad, para avisar antes de quitarla.
export function usoDeUnidades(unidades, elementos, usuarios) {
  const uso = {};
  for (const u of unidades) uso[u.nombre] = { elementos: 0, usuarios: 0 };
  for (const e of elementos) if (uso[e.unidad]) uso[e.unidad].elementos += 1;
  for (const u of usuarios) if (uso[u.unidad]) uso[u.unidad].usuarios += 1;
  return uso;
}
