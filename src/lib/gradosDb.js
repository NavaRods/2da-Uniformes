import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { GRADOS_PREDETERMINADOS, ordenarGrados } from "./grados";

const gradosRef = collection(db, "grados");

// `callback` recibe la lista de la colección (vacía si aún no se ha cargado
// ninguno). Usa useGrados() en los componentes para tener el respaldo de los
// grados predeterminados.
export function listenGrados(callback) {
  return onSnapshot(gradosRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Lista de grados lista para usar: los de Firestore o, si no hay, los
// predeterminados. Ordenada de mayor a menor jerarquía.
export function useGrados() {
  const [grados, setGrados] = useState([]);
  useEffect(() => listenGrados(setGrados), []);
  return ordenarGrados(grados.length > 0 ? grados : GRADOS_PREDETERMINADOS);
}

export async function sembrarGradosPredeterminados() {
  const batch = writeBatch(db);
  for (const g of GRADOS_PREDETERMINADOS) {
    batch.set(doc(gradosRef), { ...g, creadoEn: serverTimestamp() });
  }
  await batch.commit();
}

export async function crearGrado({ nombre, categoria, rango }) {
  return addDoc(gradosRef, { nombre: nombre.trim(), categoria, rango, creadoEn: serverTimestamp() });
}

// Cambia la categoría de un grado o lo renombra. Si se renombra, los
// elementos que tenían el nombre viejo se actualizan para no quedar sin grado.
export async function editarGrado(grado, { nombre, categoria }) {
  const nuevoNombre = nombre.trim();
  await updateDoc(doc(db, "grados", grado.id), { nombre: nuevoNombre, categoria });
  if (nuevoNombre === grado.nombre) return;

  const afectados = await getDocs(
    query(collection(db, "elementos"), where("gradoMilitar", "==", grado.nombre))
  );
  // Firestore admite hasta 500 escrituras por batch.
  for (let i = 0; i < afectados.docs.length; i += 400) {
    const batch = writeBatch(db);
    afectados.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { gradoMilitar: nuevoNombre }));
    await batch.commit();
  }
}

// Intercambia el rango de dos grados vecinos (subir/bajar en la jerarquía).
export async function intercambiarRango(a, b) {
  const batch = writeBatch(db);
  batch.update(doc(db, "grados", a.id), { rango: b.rango });
  batch.update(doc(db, "grados", b.id), { rango: a.rango });
  await batch.commit();
}

export async function eliminarGrado(gradoId) {
  return deleteDoc(doc(db, "grados", gradoId));
}

// Cuántos documentos de una colección tienen `campo == valor`. Sirve para no
// borrar un grado o una Unidad que todavía usan elementos o usuarios.
export async function contarDocs(coleccion, campo, valor) {
  const snap = await getDocs(query(collection(db, coleccion), where(campo, "==", valor)));
  return snap.size;
}
