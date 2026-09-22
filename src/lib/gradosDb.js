import {
  collection,
  doc,
  getDocs,
  getCountFromServer,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { GRADOS_PREDETERMINADOS } from "./grados";
import { escribirConVersion } from "./versiones";
import { marcaActualizacion } from "./elementos";

const gradosRef = collection(db, "grados");

// En los componentes usa useGrados() de lib/fuentes.js: lee de la caché
// mientras no cambie su versión y añade el respaldo de los predeterminados.
// Por eso toda escritura aquí pasa por escribirConVersion.
export const consultaGrados = () => gradosRef;

export async function sembrarGradosPredeterminados() {
  await escribirConVersion("grados", (lote) => {
    for (const g of GRADOS_PREDETERMINADOS) {
      lote.set(doc(gradosRef), { ...g, creadoEn: serverTimestamp() });
    }
  });
}

export async function crearGrado({ nombre, categoria, rango }) {
  return escribirConVersion("grados", (lote) => {
    const ref = doc(gradosRef);
    lote.set(ref, { nombre: nombre.trim(), categoria, rango, creadoEn: serverTimestamp() });
    return ref;
  });
}

// Cambia la categoría de un grado o lo renombra. Si se renombra, los
// elementos que tenían el nombre viejo se actualizan para no quedar sin grado.
export async function editarGrado(grado, { nombre, categoria }) {
  const nuevoNombre = nombre.trim();
  await escribirConVersion("grados", (lote) => {
    lote.update(doc(db, "grados", grado.id), { nombre: nuevoNombre, categoria });
  });
  if (nuevoNombre === grado.nombre) return;

  const afectados = await getDocs(
    query(collection(db, "elementos"), where("gradoMilitar", "==", grado.nombre))
  );
  // Firestore admite hasta 500 escrituras por batch.
  for (let i = 0; i < afectados.docs.length; i += 400) {
    const batch = writeBatch(db);
    afectados.docs
      .slice(i, i + 400)
      .forEach((d) => batch.update(d.ref, { gradoMilitar: nuevoNombre, ...marcaActualizacion() }));
    await batch.commit();
  }
}

// Intercambia el rango de dos grados vecinos (subir/bajar en la jerarquía).
export async function intercambiarRango(a, b) {
  await escribirConVersion("grados", (lote) => {
    lote.update(doc(db, "grados", a.id), { rango: b.rango });
    lote.update(doc(db, "grados", b.id), { rango: a.rango });
  });
}

export async function eliminarGrado(gradoId) {
  return escribirConVersion("grados", (lote) => {
    lote.delete(doc(db, "grados", gradoId));
  });
}

// Cuántos documentos de una colección tienen `campo == valor`, sin
// descargarlos (1 lectura por cada 1,000). Sirve para no borrar un grado o
// una Unidad que todavía usan elementos o usuarios.
export async function contarDocs(coleccion, campo, valor) {
  const snap = await getCountFromServer(query(collection(db, coleccion), where(campo, "==", valor)));
  return snap.data().count;
}
