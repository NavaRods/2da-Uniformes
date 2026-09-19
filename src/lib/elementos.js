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

const elementosRef = collection(db, "elementos");

export function listenElementos(callback) {
  const q = query(elementosRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function crearElemento(datos) {
  return addDoc(elementosRef, {
    unidad: datos.unidad || "2da Unidad",
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
