import {
  doc,
  setDoc,
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

export async function marcarAsistencia(fecha, elementoId, presente) {
  const ref = doc(db, "asistencias", fecha);
  await setDoc(ref, { [elementoId]: presente }, { merge: true });
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
