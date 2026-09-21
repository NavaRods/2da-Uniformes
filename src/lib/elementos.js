import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar } from "./estadoFirestore";

const elementosRef = collection(db, "elementos");

// Sin `unidad`, trae todos los elementos (Admin). Con `unidad`, solo los de
// esa Unidad (Operador).
export function listenElementos(callback, unidad) {
  const clausulas = unidad ? [where("unidad", "==", unidad)] : [];
  const q = query(elementosRef, ...clausulas, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, vigilar());
}

// Cuántos elementos tiene cada Unidad, sin descargarlos: una consulta de
// conteo cuesta 1 lectura por cada 1,000 elementos (mínimo 1) en lugar de una
// por elemento. Si alguna falla queda en null (desconocido), no en 0.
export async function contarElementosPorUnidad(nombres) {
  const conteos = await Promise.all(
    nombres.map(async (nombre) => {
      try {
        const snap = await getCountFromServer(query(elementosRef, where("unidad", "==", nombre)));
        return [nombre, snap.data().count];
      } catch {
        return [nombre, null];
      }
    })
  );
  return Object.fromEntries(conteos);
}

export async function crearElemento(datos) {
  return addDoc(elementosRef, {
    unidad: datos.unidad,
    grupo: datos.grupo || "Varonil",
    nombre: datos.nombre,
    edad: datos.edad || null,
    telefonos: datos.telefonos?.filter(Boolean) || [],
    direccion: datos.direccion || "",
    fechaNacimiento: datos.fechaNacimiento || "",
    escuela: datos.escuela || "",
    turno: datos.turno || "",
    gradoEscolar: datos.gradoEscolar || "",
    tutor: datos.tutor || "",
    comoSeEntero: datos.comoSeEntero || "",
    seguroSocial: datos.seguroSocial || "",
    alergias: datos.alergias || "",
    pagaMensualidad: !!datos.pagaMensualidad,
    pagaInscripcion: !!datos.pagaInscripcion,
    creadoEn: serverTimestamp(),
  });
}

export async function actualizarElemento(elementoId, cambios) {
  return updateDoc(doc(db, "elementos", elementoId), cambios);
}
