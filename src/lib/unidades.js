import {
  collection,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { escribirConVersion } from "./versiones";

const unidadesRef = collection(db, "unidades");

// "2a" antes que "10a" (orden numérico, no alfabético).
export function compararUnidades(a, b) {
  return a.nombre.localeCompare(b.nombre, "es", { numeric: true });
}

// Se leen con useUnidades() de lib/fuentes.js (de la caché mientras no cambie
// su versión); por eso las escrituras pasan por escribirConVersion.
export const consultaUnidades = () => query(unidadesRef, orderBy("nombre"));

// Misma Unidad aunque cambien mayúsculas o espacios ("1A" = "1a ").
export function existeUnidad(unidades, nombre) {
  const buscada = nombre.trim().toLowerCase();
  return unidades.some((u) => u.nombre.trim().toLowerCase() === buscada);
}

export async function crearUnidad(nombre) {
  return escribirConVersion("unidades", (lote) => {
    const ref = doc(unidadesRef);
    lote.set(ref, { nombre: nombre.trim(), creadoEn: serverTimestamp() });
    return ref;
  });
}

export async function eliminarUnidad(unidadId) {
  return escribirConVersion("unidades", (lote) => {
    lote.delete(doc(db, "unidades", unidadId));
  });
}

// Quita varias Unidades de la lista de una sola vez. No toca elementos ni
// usuarios: siguen guardados con el nombre de su Unidad.
export async function eliminarUnidades(unidadIds) {
  for (let i = 0; i < unidadIds.length; i += 400) {
    await escribirConVersion("unidades", (lote) => {
      unidadIds.slice(i, i + 400).forEach((id) => lote.delete(doc(db, "unidades", id)));
    });
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
