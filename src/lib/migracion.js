import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { normalizarEstado } from "./asistencia";

// Migración única, para datos creados antes de la separación por Unidad:
//  1. Pedidos, abonos y cuotas sin "unidad" (o con una distinta a la de su
//     elemento, p. ej. tras renombrar una Unidad) reciben la de su elemento
//     (las consultas de la Relación de pagos filtran por ese campo).
//  2. La asistencia en formato anterior (un doc plano por día con todos los
//     elementos) pasa a un doc por día y Unidad.
// Es idempotente: se puede correr de nuevo sin duplicar ni pisar nada.

// Convierte un doc de asistencia anterior { elementoId: estado } en
// { unidad: { unidad, fecha, estados } }. Los elementos que ya no existen o
// no tienen Unidad se cuentan en `sinUnidad` y no se migran.
export function agruparAsistenciaAnterior(fecha, datos, unidadPorElemento) {
  const porUnidad = {};
  let sinUnidad = 0;
  for (const [elementoId, valor] of Object.entries(datos)) {
    const unidad = unidadPorElemento.get(elementoId);
    if (!unidad) {
      sinUnidad += 1;
      continue;
    }
    porUnidad[unidad] ??= { unidad, fecha, estados: {} };
    porUnidad[unidad].estados[elementoId] = normalizarEstado(valor);
  }
  return { porUnidad, sinUnidad };
}

// Junta escrituras en lotes (Firestore admite 500 por lote).
function crearLotes() {
  let lote = writeBatch(db);
  let pendientes = 0;
  return {
    async agregar(accion) {
      accion(lote);
      pendientes += 1;
      if (pendientes >= 400) {
        await lote.commit();
        lote = writeBatch(db);
        pendientes = 0;
      }
    },
    async cerrar() {
      if (pendientes > 0) await lote.commit();
    },
  };
}

export async function migrarDatosAnteriores() {
  const resumen = { pedidos: 0, abonos: 0, cuotas: 0, asistencias: 0, omitidos: 0 };
  const lotes = crearLotes();

  const elementos = await getDocs(collection(db, "elementos"));
  const unidadPorElemento = new Map();
  elementos.forEach((e) => unidadPorElemento.set(e.id, e.data().unidad));

  for (const [elementoId, unidad] of unidadPorElemento) {
    if (!unidad) continue;
    const base = ["elementos", elementoId];

    const pedidos = await getDocs(collection(db, ...base, "pedidos"));
    for (const pedido of pedidos.docs) {
      if (pedido.data().unidad !== unidad) {
        await lotes.agregar((l) => l.update(pedido.ref, { unidad, actualizadoEn: serverTimestamp() }));
        resumen.pedidos += 1;
      }
      const abonos = await getDocs(collection(db, ...base, "pedidos", pedido.id, "abonos"));
      for (const abono of abonos.docs) {
        if (abono.data().unidad !== unidad) {
          await lotes.agregar((l) => l.update(abono.ref, { unidad }));
          resumen.abonos += 1;
        }
      }
    }

    const cuotas = await getDocs(collection(db, ...base, "cuotas"));
    for (const cuota of cuotas.docs) {
      if (cuota.data().unidad !== unidad) {
        await lotes.agregar((l) => l.update(cuota.ref, { unidad }));
        resumen.cuotas += 1;
      }
    }
  }
  await lotes.cerrar();

  // Asistencia anterior: los docs planos son los únicos que existen a este
  // nivel (los de formato nuevo viven en la subcolección "porUnidad").
  const anteriores = await getDocs(collection(db, "asistencias"));
  for (const dia of anteriores.docs) {
    const { porUnidad, sinUnidad } = agruparAsistenciaAnterior(dia.id, dia.data(), unidadPorElemento);
    for (const datos of Object.values(porUnidad)) {
      await lotes.agregar((l) =>
        l.set(doc(db, "asistencias", dia.id, "porUnidad", datos.unidad), datos, { merge: true })
      );
    }
    resumen.asistencias += 1;
    if (sinUnidad > 0) {
      // No se borra el original si algo quedó sin migrar: nada se pierde.
      resumen.omitidos += sinUnidad;
    } else {
      await lotes.agregar((l) => l.delete(dia.ref));
    }
  }
  await lotes.cerrar();

  return resumen;
}
