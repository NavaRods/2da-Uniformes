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
} from "firebase/firestore";
import { db } from "../firebase";

const elementosRef = collection(db, "elementos");

// Sin `unidad`, trae todos los elementos (Admin). Con `unidad`, solo los de
// esa Unidad (Operador).
export function listenElementos(callback, unidad) {
  const clausulas = unidad ? [where("unidad", "==", unidad)] : [];
  const q = query(elementosRef, ...clausulas, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
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
