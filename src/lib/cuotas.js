import {
  collection,
  collectionGroup,
  where,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { fechaLocal } from "./asistencia";
import { horaLocalHHMM } from "./format";

// Precio sugerido por mes. Solo es el valor inicial del campo: se puede
// cambiar en cada cobro y ese cambio nunca se guarda como nuevo predeterminado.
export const MENSUALIDAD_DEFAULT = 60;

export const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

// "2026-09" -> "Sep 2026"
export function etiquetaMes(yyyyMm) {
  const [anio, mes] = yyyyMm.split("-");
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

export function claveMes(anio, indiceMes) {
  return `${anio}-${String(indiceMes + 1).padStart(2, "0")}`;
}

// Conjunto de meses (yyyy-mm) que ya tienen mensualidad pagada.
export function mesesPagados(cuotas) {
  const pagados = new Set();
  for (const c of cuotas) {
    if (c.tipo === "mensualidad") c.meses?.forEach((m) => pagados.add(m));
  }
  return pagados;
}

// { "2026-09": 60, ... } con lo que se pagó por cada mes.
export function pagosPorMes(cuotas) {
  const pagos = {};
  for (const c of cuotas) {
    if (c.tipo !== "mensualidad") continue;
    for (const m of c.meses || []) pagos[m] = c.montoPorMes;
  }
  return pagos;
}

// Datos para la tarjeta de resumen del perfil.
export function resumenCuotas(cuotas, anio) {
  const pagos = pagosPorMes(cuotas);
  const meses = Object.keys(pagos).sort();
  const delAnio = meses.filter((m) => m.startsWith(`${anio}-`));
  return {
    mesesAnio: delAnio.length,
    totalAnio: delAnio.reduce((suma, m) => suma + pagos[m], 0),
    ultimoMes: meses.length ? meses[meses.length - 1] : null,
  };
}

export function listenCuotas(elementoId, callback) {
  const q = query(collection(db, "elementos", elementoId, "cuotas"), orderBy("fecha", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Todas las mensualidades cobradas en un día (de cualquier elemento), para la
// Relación de pagos.
export function listenCuotasDelDia(fecha, callback) {
  const q = query(collectionGroup(db, "cuotas"), where("fechaLocal", "==", fecha));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        elementoId: d.ref.parent.parent.id,
        ...d.data(),
      }))
    );
  });
}

export async function registrarMensualidad(elementoId, { meses, montoPorMes, quienRecibio }) {
  const ordenados = [...meses].sort();
  const monto = Number(montoPorMes);
  return addDoc(collection(db, "elementos", elementoId, "cuotas"), {
    tipo: "mensualidad",
    meses: ordenados,
    montoPorMes: monto,
    total: monto * ordenados.length,
    quienRecibio: quienRecibio || "",
    fecha: serverTimestamp(),
    fechaLocal: fechaLocal(),
    horaLocal: horaLocalHHMM(),
  });
}

export async function eliminarCuota(elementoId, cuotaId) {
  return deleteDoc(doc(db, "elementos", elementoId, "cuotas", cuotaId));
}
