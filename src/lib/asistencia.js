import {
  doc,
  writeBatch,
  deleteField,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar, vigilarEscritura } from "./estadoFirestore";
import { marcaActualizacion } from "./elementos";

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
    batch.update(doc(db, "elementos", elemento.id), { fechaBaja: fecha, ...marcaActualizacion() });
  } else if (elemento.fechaBaja && elemento.fechaBaja <= fecha) {
    // Se marcó otro estado en/después de la baja: se reactiva al elemento.
    batch.update(doc(db, "elementos", elemento.id), {
      fechaBaja: deleteField(),
      ...marcaActualizacion(),
    });
  }
  await vigilarEscritura(batch.commit());
}

// Da de baja a un elemento: queda con estado "baja" ese día y sale de las
// listas posteriores. No se borra nada; puede reactivarse.
export async function darDeBaja(elemento, fecha = fechaLocal()) {
  return marcarAsistencia(fecha, elemento, "baja");
}

// Reactiva a un elemento dado de baja: quita su fechaBaja y el estado "baja"
// que quedó marcado ese día.
export async function reactivarElemento(elemento) {
  mesesCerrados.delete(`${elemento.unidad}|${(elemento.fechaBaja || "").slice(0, 7)}`);
  const batch = writeBatch(db);
  batch.update(doc(db, "elementos", elemento.id), {
    fechaBaja: deleteField(),
    ...marcaActualizacion(),
  });
  if (elemento.fechaBaja) {
    batch.set(
      diaUnidadRef(elemento.fechaBaja, elemento.unidad),
      {
        unidad: elemento.unidad,
        fecha: elemento.fechaBaja,
        estados: { [elemento.id]: deleteField() },
      },
      { merge: true }
    );
  }
  await batch.commit();
}

// Los domingos de un mes (yyyy-mm) como fechas yyyy-mm-dd. El reporte de
// asistencia solo lleva estos días.
export function domingosDelMes(yyyyMm) {
  const [anio, mes] = yyyyMm.split("-").map(Number);
  const dias = new Date(anio, mes, 0).getDate();
  const domingos = [];
  for (let d = 1; d <= dias; d++) {
    if (new Date(anio, mes - 1, d).getDay() === 0) domingos.push(fechaLocal(new Date(anio, mes - 1, d)));
  }
  return domingos;
}

// Asistencia de varios días de una Unidad. Devuelve { "2026-09-06": { elementoId: estado }, ... }
// Se leen los documentos por fecha (no una consulta de grupo), así solo hace falta
// el permiso de lectura de cada día de la Unidad.
export async function obtenerAsistenciasDias(fechas, unidad) {
  if (!unidad) return {};
  // Los meses ya cerrados no cambian: se guardan en memoria para no volver a leerlos.
  const mes = fechas[0]?.slice(0, 7);
  if (!mes) return {};
  const clave = `${unidad}|${mes}`;
  const cerrado = mes < fechaLocal().slice(0, 7);
  if (cerrado && mesesCerrados.has(clave)) return mesesCerrados.get(clave);
  const snaps = await Promise.all(fechas.map((f) => getDoc(diaUnidadRef(f, unidad))));
  const resultado = {};
  snaps.forEach((snap, i) => {
    resultado[fechas[i]] = snap.exists() ? snap.data().estados || {} : {};
  });
  if (cerrado) mesesCerrados.set(clave, resultado);
  return resultado;
}
