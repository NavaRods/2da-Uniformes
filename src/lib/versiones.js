import {
  doc,
  getDocs,
  getDocsFromCache,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { leerMarca, guardarMarca } from "./memoriaLocal";
import { reportarError, vigilar, vigilarEscritura } from "./estadoFirestore";

// Catálogo, grados, Unidades y usuarios casi nunca cambian y solo los edita un
// Admin. En lugar de escucharlos (y pagar una lectura por documento en cada
// sesión), un solo documento `meta/versiones` guarda la hora del último cambio
// de cada colección. Si no cambió desde la última descarga, la colección se lee
// de la caché del dispositivo: 0 lecturas. Toda escritura en esas colecciones
// actualiza su versión en el mismo lote (las reglas de Firestore lo exigen).
export const COLECCIONES_VERSIONADAS = ["catalogo", "grados", "unidades", "usuarios"];

// Aunque la versión no cambie, pasado este tiempo se vuelve a descargar: cubre
// cambios hechos a mano desde la consola de Firebase (que no tocan la versión).
export const VIGENCIA_MS = 3 * 24 * 60 * 60 * 1000;

const versionesRef = () => doc(db, "meta", "versiones");

export function marcarCambio(lote, coleccion) {
  marcarCambios(lote, [coleccion]);
}

// Varias colecciones en una sola escritura del documento de versiones.
export function marcarCambios(lote, colecciones) {
  if (colecciones.length === 0) return;
  const cambios = Object.fromEntries(colecciones.map((c) => [c, serverTimestamp()]));
  lote.set(versionesRef(), cambios, { merge: true });
}

// Escribe en una colección versionada: `escribir(lote)` agrega sus cambios al
// lote y aquí se suma el cambio de versión, todo en una sola escritura atómica.
export async function escribirConVersion(coleccion, escribir) {
  const lote = writeBatch(db);
  const resultado = escribir(lote);
  marcarCambio(lote, coleccion);
  await vigilarEscritura(lote.commit());
  return resultado;
}

// `datos[coleccion]` es null mientras un cambio hecho en este dispositivo no
// llega al servidor (serverTimestamp pendiente) y undefined si nunca cambió.
export function listenVersiones(callback) {
  return onSnapshot(
    versionesRef(),
    (snap) =>
      callback({
        datos: snap.exists() ? snap.data({ serverTimestamps: "none" }) : {},
        pendiente: snap.metadata.hasPendingWrites,
      }),
    // Sin versiones (p. ej. sin conexión y sin caché) se trata como si nunca
    // hubieran cambiado: cada colección decide con su propia marca.
    vigilar(() => callback({ datos: {}, pendiente: false }))
  );
}

export function claveVersion(valor) {
  return typeof valor?.toMillis === "function" ? valor.toMillis() : 0;
}

// Lee una colección versionada: de la caché si la marca local dice que está
// completa y en la versión actual; si no, del servidor (y guarda la marca).
// `propio` = el cambio de versión lo hizo este dispositivo, así que su caché ya
// tiene los datos nuevos (se aplicaron al escribir) y no hay que descargarlos.
export async function cargarConVersion(coleccion, consulta, version, { propio = false } = {}) {
  const clave = `version:${coleccion}`;
  const marca = leerMarca(clave);
  const vigente = marca && marca.v === version && Date.now() - marca.t < VIGENCIA_MS;

  if (marca && (vigente || propio)) {
    try {
      const snap = await getDocsFromCache(consulta);
      if (propio) {
        guardarMarca(clave, { v: version, n: snap.size, t: marca.t });
        return snap;
      }
      // Si la caché perdió documentos (el navegador la limpió), no sirve.
      if (snap.size === marca.n) return snap;
    } catch {
      // Sin caché: se lee del servidor.
    }
  }

  try {
    const snap = await getDocs(consulta);
    if (!snap.metadata.fromCache) guardarMarca(clave, { v: version, n: snap.size, t: Date.now() });
    return snap;
  } catch (error) {
    reportarError(error);
    return getDocsFromCache(consulta);
  }
}
