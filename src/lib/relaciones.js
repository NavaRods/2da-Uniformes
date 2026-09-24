import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar, vigilarEscritura } from "./estadoFirestore";
import { cambioInventario, refInventario } from "./inventario";
import { claveVariante } from "./relacionPagos";

// Relaciones de pagos validadas: un documento por Unidad y día,
// relaciones/{unidad~fecha}. Se crea cuando quien vende toca "Validar entrega
// del dinero" en la Relación del día: guarda ese día tal como quedó (totales,
// piezas por producto y talla, mensualidades) y sirve de lista para ir
// marcando las piezas que el proveedor entrega (parcial o total). Lo que se
// recibe pasa a "Uniformidad disponible" (lib/inventario.js).

export const idRelacion = (unidad, fecha) => `${encodeURIComponent(unidad)}~${fecha}`;
const refRelacion = (unidad, fecha) => doc(db, "relaciones", idRelacion(unidad, fecha));

// Piezas de la relación con lo que ya se recibió de cada una. Si el día se
// vuelve a validar (llegaron pagos nuevos), lo recibido antes se conserva.
export function fusionarPiezas(general, previas = []) {
  const recibidoAntes = new Map(previas.map((p) => [claveVariante(p), Number(p.recibido) || 0]));
  const piezas = general.map((g) => ({
    productoNombre: g.productoNombre || "",
    talla: g.talla || "",
    color: g.color || "",
    cantidad: g.cantidad,
    total: g.total,
    recibido: recibidoAntes.get(claveVariante(g)) || 0,
  }));
  // Una pieza que ya se recibió no se pierde aunque el pago se haya quitado.
  const vigentes = new Set(piezas.map(claveVariante));
  for (const p of previas) {
    if (!vigentes.has(claveVariante(p)) && Number(p.recibido) > 0) {
      piezas.push({ ...p, cantidad: Number(p.recibido), total: Number(p.total) || 0 });
    }
  }
  return piezas;
}

// Cuántas piezas se esperan y cuántas ya llegaron. estado: sin-piezas |
// pendiente | parcial | completo.
export function estadoRecepcion(piezas = []) {
  const esperadas = piezas.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  const recibidas = piezas.reduce(
    (s, p) => s + Math.min(Number(p.recibido) || 0, Number(p.cantidad) || 0),
    0
  );
  const estado =
    esperadas === 0 ? "sin-piezas" : recibidas === 0 ? "pendiente" : recibidas >= esperadas ? "completo" : "parcial";
  return { esperadas, recibidas, faltan: esperadas - recibidas, estado };
}

export const faltaDeLaPieza = (p) => Math.max((Number(p.cantidad) || 0) - (Number(p.recibido) || 0), 0);

// ¿La relación guardada ya no coincide con lo cobrado ese día? (llegaron pagos
// después de validar).
export const relacionDesactualizada = (relacion, resumen) =>
  !!relacion &&
  (Number(relacion.total) !== resumen.total ||
    estadoRecepcion(relacion.piezas).esperadas !== resumen.general.reduce((s, g) => s + g.cantidad, 0));

export function validarRelacionDia({ unidad, fecha, resumen, quien, previa }) {
  if (!unidad) throw new Error("Elige una Unidad para validar la relación.");
  return vigilarEscritura(
    setDoc(refRelacion(unidad, fecha), {
      unidad,
      fecha,
      total: resumen.total,
      totalUniformes: resumen.totalUniformes,
      totalMensualidades: resumen.totalMensualidades,
      mesesCobrados: resumen.mesesCobrados,
      piezas: fusionarPiezas(resumen.general, previa?.piezas),
      mensualidades: resumen.mensualidades.map((m) => ({
        nombre: m.nombre,
        monto: m.monto,
        meses: m.meses,
      })),
      entregadoPor: quien || "",
      entregadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })
  );
}

// Marca piezas recibidas del proveedor: `cantidades` es un Map índice de pieza
// → cuántas llegaron. En el mismo lote se suman a "Uniformidad disponible".
export function recibirDeRelacion(relacion, cantidades) {
  const piezas = relacion.piezas.map((p) => ({ ...p }));
  const lote = writeBatch(db);
  let alguna = false;
  for (const [indice, valor] of cantidades) {
    const n = Math.trunc(Number(valor));
    const pieza = piezas[indice];
    if (!pieza || !(n > 0)) continue;
    const falta = faltaDeLaPieza(pieza);
    if (n > falta) {
      throw new Error(
        falta > 0
          ? `Solo faltan ${falta} de esta pieza; no puedes recibir más de las que se pidieron.`
          : "Ya se recibió todo lo de esta pieza."
      );
    }
    pieza.recibido = (Number(pieza.recibido) || 0) + n;
    lote.set(refInventario(relacion.unidad, pieza), cambioInventario(relacion.unidad, pieza, n), {
      merge: true,
    });
    alguna = true;
  }
  if (!alguna) throw new Error("Indica cuántas piezas recibiste.");
  lote.update(refRelacion(relacion.unidad, relacion.fecha), { piezas, actualizadoEn: serverTimestamp() });
  return vigilarEscritura(lote.commit());
}

// La relación de un día (null si aún no se valida).
export function listenRelacion(unidad, fecha, callback, onError) {
  return onSnapshot(
    refRelacion(unidad, fecha),
    (snap) => callback(snap.exists() ? snap.data() : null),
    vigilar(onError)
  );
}

// Todas las relaciones validadas (de una Unidad, o de todas si `unidad` va
// vacía), la más reciente primero.
export function listenRelaciones(unidad, callback, onError) {
  const filtros = unidad ? [where("unidad", "==", unidad)] : [];
  return onSnapshot(
    query(collection(db, "relaciones"), ...filtros),
    (snap) =>
      callback(
        snap.docs
          .map((d) => d.data())
          .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
      ),
    vigilar(onError)
  );
}
