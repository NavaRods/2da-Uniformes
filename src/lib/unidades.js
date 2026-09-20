import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

const unidadesRef = collection(db, "unidades");

// Unidades que existen (no hay la 5a, 6a, 9a ni 16a).
export const UNIDADES_INICIALES = [
  "1a", "2a", "3a", "4a", "7a", "8a", "10a", "11a",
  "12a", "13a", "14a", "15a", "17a", "18a", "19a",
];

// Nombres anteriores que ahora tienen otro nombre en la lista. Los elementos
// guardados con el nombre viejo se pasan al nuevo para que no queden huérfanos.
export const RENOMBRES = { "2da Unidad": "2a" };

// "2a" antes que "10a" (orden numérico, no alfabético).
export function compararUnidades(a, b) {
  return a.nombre.localeCompare(b.nombre, "es", { numeric: true });
}

export function listenUnidades(callback) {
  const q = query(unidadesRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(compararUnidades));
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

// Crea las Unidades de la lista que aún no existen y pasa los elementos de un
// nombre anterior al nuevo. Se puede repetir sin duplicar nada.
export async function cargarUnidadesIniciales() {
  const existentes = new Set((await getDocs(unidadesRef)).docs.map((d) => d.data().nombre));
  const faltantes = UNIDADES_INICIALES.filter((n) => !existentes.has(n));

  const operaciones = faltantes.map(
    (nombre) => (lote) => lote.set(doc(unidadesRef), { nombre, creadoEn: serverTimestamp() })
  );

  let renombrados = 0;
  for (const [desde, hacia] of Object.entries(RENOMBRES)) {
    const snap = await getDocs(query(collection(db, "elementos"), where("unidad", "==", desde)));
    snap.forEach((d) => {
      operaciones.push((lote) => lote.update(d.ref, { unidad: hacia }));
      renombrados += 1;
    });
  }

  // Firestore admite 500 operaciones por lote.
  for (let i = 0; i < operaciones.length; i += 400) {
    const lote = writeBatch(db);
    operaciones.slice(i, i + 400).forEach((op) => op(lote));
    await lote.commit();
  }

  return { creadas: faltantes.length, yaExistian: UNIDADES_INICIALES.length - faltantes.length, renombrados };
}
