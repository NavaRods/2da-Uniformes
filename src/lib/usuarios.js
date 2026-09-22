import {
  collection,
  getDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar } from "./estadoFirestore";
import { escribirConVersion } from "./versiones";

export const ROLES = ["admin", "operador"];

// El correo es el ID del documento: así se puede dar de alta a alguien antes
// de su primer inicio de sesión (igual que la lista de correos de antes).
export function normalizarCorreo(correo) {
  return (correo || "").trim().toLowerCase();
}

const usuariosRef = collection(db, "usuarios");

// La lista completa (pantalla de Usuarios, solo Admin) se lee con
// useUsuarios() de lib/fuentes.js, de la caché mientras no cambie su versión;
// por eso las escrituras pasan por escribirConVersion. El perfil propio sí se
// escucha en vivo (listenUsuario): así un cambio de rol o una suspensión
// aplica de inmediato.
export const consultaUsuarios = () => query(usuariosRef, orderBy("nombre"));

export function listenUsuario(correo, callback, onError) {
  return onSnapshot(
    doc(db, "usuarios", normalizarCorreo(correo)),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    vigilar(onError)
  );
}

export async function crearUsuario({ correo, nombre, rol, unidad, grado }) {
  const ref = doc(db, "usuarios", normalizarCorreo(correo));
  // setDoc pisaría a un usuario existente (rol, Unidad, etc.) sin avisar.
  if ((await getDoc(ref)).exists()) {
    throw Object.assign(new Error("El correo ya tiene acceso"), { code: "ya-existe" });
  }
  return escribirConVersion("usuarios", (lote) => {
    lote.set(ref, {
      nombre: nombre || "",
      rol,
      unidad: rol === "admin" ? null : unidad,
      grado: grado || "",
      activo: true,
      creadoEn: serverTimestamp(),
    });
  });
}

export async function editarUsuario(correo, { nombre, rol, unidad, grado }) {
  return escribirConVersion("usuarios", (lote) => {
    lote.update(doc(db, "usuarios", normalizarCorreo(correo)), {
      nombre: nombre || "",
      rol,
      unidad: rol === "admin" ? null : unidad,
      grado: grado || "",
    });
  });
}

// Suspende o restaura el acceso sin borrar la cuenta (conserva su historial
// de quién registró qué). Mientras activo sea false, las reglas de Firestore
// le niegan el acceso aunque el documento siga existiendo.
export async function cambiarActivo(correo, activo) {
  return escribirConVersion("usuarios", (lote) => {
    lote.update(doc(db, "usuarios", normalizarCorreo(correo)), { activo });
  });
}

export async function eliminarUsuario(correo) {
  return escribirConVersion("usuarios", (lote) => {
    lote.delete(doc(db, "usuarios", normalizarCorreo(correo)));
  });
}
