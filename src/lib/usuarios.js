import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export const ROLES = ["admin", "operador"];

// El correo es el ID del documento: así se puede dar de alta a alguien antes
// de su primer inicio de sesión (igual que la lista de correos de antes).
export function normalizarCorreo(correo) {
  return (correo || "").trim().toLowerCase();
}

const usuariosRef = collection(db, "usuarios");

export function listenUsuarios(callback) {
  const q = query(usuariosRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function listenUsuario(correo, callback, onError) {
  return onSnapshot(
    doc(db, "usuarios", normalizarCorreo(correo)),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export async function crearUsuario({ correo, nombre, rol, unidad, grado }) {
  return setDoc(doc(db, "usuarios", normalizarCorreo(correo)), {
    nombre: nombre || "",
    rol,
    unidad: rol === "admin" ? null : unidad,
    grado: grado || "",
    activo: true,
    creadoEn: serverTimestamp(),
  });
}

export async function editarUsuario(correo, { nombre, rol, unidad, grado }) {
  return updateDoc(doc(db, "usuarios", normalizarCorreo(correo)), {
    nombre: nombre || "",
    rol,
    unidad: rol === "admin" ? null : unidad,
    grado: grado || "",
  });
}

// Suspende o restaura el acceso sin borrar la cuenta (conserva su historial
// de quién registró qué). Mientras activo sea false, las reglas de Firestore
// le niegan el acceso aunque el documento siga existiendo.
export async function cambiarActivo(correo, activo) {
  return updateDoc(doc(db, "usuarios", normalizarCorreo(correo)), { activo });
}

export async function eliminarUsuario(correo) {
  return deleteDoc(doc(db, "usuarios", normalizarCorreo(correo)));
}
