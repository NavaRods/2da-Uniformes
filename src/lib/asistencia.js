import {
  doc,
  writeBatch,
  deleteField,
  onSnapshot,
  collectionGroup,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar, vigilarEscritura } from "./estadoFirestore";

// Un doc por día y Unidad: asistencias/{fecha}/porUnidad/{unidad}, con
// { unidad, fecha, estados: { elementoId: estado, ... } }. Separado así (en
// vez de un doc plano por día con cualquier elementoId como clave) para
// poder proteger la escritura por Unidad a nivel de regla de Firestore.
function diaUnidadRef(fecha, unidad) {
  return doc(db, "asistencias", fecha, "porUnidad", unidad);
}

export function listenAsistenciaDia(fecha, unidad, callback) {
  if (!unidad) {
    callback({});
    return () => {};
  }
  return onSnapshot(diaUnidadRef(fecha, unidad), (snap) => {
    callback(snap.exists() ? snap.data().estados || {} : {});
  }, vigilar());
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

// Meses cerrados ya consultados en esta sesión: no cambian salvo que alguien
// edite un día pasado desde esta pestaña, y en ese caso se descartan.
const mesesCerrados = new Map();

export async function marcarAsistencia(fecha, elemento, estado) {
  mesesCerrados.delete(`${elemento.unidad}|${fecha.slice(0, 7)}`);
  const batch = writeBatch(db);
  batch.set(
    diaUnidadRef(fecha, elemento.unidad),
    { unidad: elemento.unidad, fecha, estados: { [elemento.id]: estado } },
    { merge: true }
  );
  if (estado === "baja") {
    batch.update(doc(db, "elementos", elemento.id), { fechaBaja: fecha });
  } else if (elemento.fechaBaja && elemento.fechaBaja <= fecha) {
    // Se marcó otro estado en/después de la baja: se reactiva al elemento.
    batch.update(doc(db, "elementos", elemento.id), { fechaBaja: deleteField() });
  }
  await vigilarEscritura(batch.commit());
}

// Lista de asistencia de un mes completo (yyyy-mm) de una Unidad, generada a
// demanda. Devuelve { "2026-08-01": { elementoId: estado, ... }, ... }
export async function obtenerAsistenciasMes(yyyyMm, unidad) {
  if (!unidad) return {};
  const clave = `${unidad}|${yyyyMm}`;
  const cerrado = yyyyMm < fechaLocal().slice(0, 7);
  if (cerrado && mesesCerrados.has(clave)) return mesesCerrados.get(clave);
  const ref = collectionGroup(db, "porUnidad");
  const q = query(
    ref,
    where("unidad", "==", unidad),
    where("fecha", ">=", `${yyyyMm}-01`),
    where("fecha", "<=", `${yyyyMm}-31`)
  );
  const snap = await getDocs(q);
  const resultado = {};
  snap.forEach((d) => {
    resultado[d.data().fecha] = d.data().estados || {};
  });
  if (cerrado) mesesCerrados.set(clave, resultado);
  return resultado;
}
