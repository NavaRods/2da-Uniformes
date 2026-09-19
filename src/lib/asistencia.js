import {
  doc,
  writeBatch,
  deleteField,
  onSnapshot,
  collection,
  query,
  where,
  documentId,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

export function listenAsistenciaDia(fecha, callback) {
  const ref = doc(db, "asistencias", fecha);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
}

export const ESTADOS = [
  ["asistencia", "Asistencia", "A"],
  ["falta", "Falta", "F"],
  ["justificada", "Falta justificada", "FJ"],
  ["baja", "Baja", "B"],
];

// Fecha local (yyyy-mm-dd). toISOString usaría UTC y de noche daría el día siguiente.
export function fechaLocal(d = new Date()) {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Los registros viejos guardaban true/false en lugar de un estado.
export function normalizarEstado(valor) {
  if (valor === true) return "asistencia";
  if (valor === false) return "falta";
  return valor || "";
}

// Un elemento dado de baja deja de aparecer en las listas posteriores a su
// fecha de baja, pero sigue apareciendo ese día y en los anteriores.
export function estaDeBaja(elemento, fecha) {
  return !!elemento.fechaBaja && elemento.fechaBaja <= fecha;
}

export function visibleEnLista(elemento, fecha) {
  return !elemento.fechaBaja || elemento.fechaBaja >= fecha;
}

export async function marcarAsistencia(fecha, elemento, estado) {
  const batch = writeBatch(db);
  batch.set(doc(db, "asistencias", fecha), { [elemento.id]: estado }, { merge: true });
  if (estado === "baja") {
    batch.update(doc(db, "elementos", elemento.id), { fechaBaja: fecha });
  } else if (elemento.fechaBaja && elemento.fechaBaja <= fecha) {
    // Se marcó otro estado en/después de la baja: se reactiva al elemento.
    batch.update(doc(db, "elementos", elemento.id), { fechaBaja: deleteField() });
  }
  await batch.commit();
}

// Lista de asistencia de un mes completo (yyyy-mm), generada a demanda.
// Devuelve { "2026-08-01": { elementoId: true, ... }, ... }
export async function obtenerAsistenciasMes(yyyyMm) {
  const ref = collection(db, "asistencias");
  const q = query(
    ref,
    where(documentId(), ">=", `${yyyyMm}-01`),
    where(documentId(), "<=", `${yyyyMm}-31`)
  );
  const snap = await getDocs(q);
  const resultado = {};
  snap.forEach((d) => {
    resultado[d.id] = d.data();
  });
  return resultado;
}
