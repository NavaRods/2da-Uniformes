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
    // De quiénes son las piezas (para saber a quién le toca cada una).
    elementos: (g.elementos || []).map((e) => ({
      elementoId: e.elementoId || "",
      pedidoId: e.pedidoId || "",
      nombre: e.nombre || "",
    })),
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
      // Abonos del día: piezas que aún no se terminan de pagar (no se cuentan
      // como piezas hasta que se liquidan), con de quién es cada uno.
      abonos: (resumen.abonos || []).map((a) => ({
        elementoId: a.elementoId || "",
        pedidoId: a.pedidoId || "",
        nombre: a.nombre || "",
        productoNombre: a.productoNombre || "",
        talla: a.talla || "",
        color: a.color || "",
        monto: a.monto,
        saldo: a.saldo ?? null,
      })),
      totalAbonos: resumen.totalAbonos || 0,
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

// "2026-09-06" → "6/09/2026".
export const fechaCorta = (yyyyMmDd) => {
  const [a, m, d] = String(yyyyMmDd).split("-");
  return `${Number(d)}/${m}/${a}`;
};

const porTallaYColor = (a, b) =>
  (a.talla || "").localeCompare(b.talla || "", "es", { numeric: true }) ||
  (a.color || "").localeCompare(b.color || "", "es");

// Las piezas de todas las relaciones juntas, por producto y talla, pero sin
// perder de qué día viene cada una. `modo`: "sin-recibir" (lo que falta que
// entregue el proveedor) o "recibido" (lo que ya llegó). Cada variante lleva
// su total y una entrada por fecha en que se pagaron ("Botas talla 4 — se
// pagaron el 6/09/2026"), de la más antigua a la más reciente.
export function agruparPorPieza(relaciones, modo) {
  const productos = new Map();
  for (const relacion of relaciones || []) {
    relacion.piezas.forEach((pieza, indice) => {
      const cantidad =
        modo === "recibido"
          ? Math.min(Number(pieza.recibido) || 0, Number(pieza.cantidad) || 0)
          : faltaDeLaPieza(pieza);
      if (!(cantidad > 0)) return;
      const nombre = pieza.productoNombre || "?";
      if (!productos.has(nombre)) productos.set(nombre, { producto: nombre, total: 0, variantes: new Map() });
      const producto = productos.get(nombre);
      const clave = `${relacion.unidad}|${pieza.talla}|${pieza.color}`;
      if (!producto.variantes.has(clave)) {
        producto.variantes.set(clave, {
          clave,
          unidad: relacion.unidad,
          productoNombre: nombre,
          talla: pieza.talla || "",
          color: pieza.color || "",
          total: 0,
          fechas: [],
        });
      }
      const variante = producto.variantes.get(clave);
      variante.fechas.push({ fecha: relacion.fecha, cantidad, falta: faltaDeLaPieza(pieza), indice, relacion, elementos: pieza.elementos || [] });
      variante.total += cantidad;
      producto.total += cantidad;
    });
  }
  return [...productos.values()]
    .map((p) => ({
      ...p,
      variantes: [...p.variantes.values()]
        .map((v) => ({ ...v, fechas: v.fechas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)) }))
        .sort(porTallaYColor),
    }))
    .sort((a, b) => a.producto.localeCompare(b.producto, "es"));
}

// Abonos acumulados por pieza de cada elemento, de todas las relaciones
// validadas: cada uno con sus pagos por fecha, lo abonado en total, lo que
// resta y, si ya se terminó de pagar, el día en que se liquidó (la pieza
// entonces aparece en Sin recibir / Recibido). Primero los que aún deben.
export function agruparAbonos(relaciones) {
  const liquidadas = new Map(); // pedidoId → fecha en que se liquidó
  for (const r of relaciones || []) {
    for (const p of r.piezas || []) {
      for (const e of p.elementos || []) {
        if (e.pedidoId && (!liquidadas.has(e.pedidoId) || r.fecha > liquidadas.get(e.pedidoId))) {
          liquidadas.set(e.pedidoId, r.fecha);
        }
      }
    }
  }
  const porPedido = new Map();
  for (const r of relaciones || []) {
    for (const a of r.abonos || []) {
      const id = a.pedidoId || `${a.elementoId}|${a.productoNombre}|${a.talla}|${a.color}`;
      if (!porPedido.has(id)) {
        porPedido.set(id, {
          id,
          unidad: r.unidad,
          nombre: a.nombre,
          elementoId: a.elementoId,
          productoNombre: a.productoNombre,
          talla: a.talla,
          color: a.color,
          pagos: [],
          total: 0,
          saldo: null,
          ultimaFecha: "",
        });
      }
      const g = porPedido.get(id);
      g.pagos.push({ fecha: r.fecha, monto: a.monto });
      g.total += a.monto;
      if (r.fecha >= g.ultimaFecha) {
        g.ultimaFecha = r.fecha;
        g.saldo = a.saldo;
      }
    }
  }
  return [...porPedido.values()]
    .map((g) => ({
      ...g,
      pagos: g.pagos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)),
      liquidadaEl: liquidadas.get(g.id) && liquidadas.get(g.id) >= g.pagos[0]?.fecha ? liquidadas.get(g.id) : null,
    }))
    .sort(
      (a, b) =>
        Number(!!a.liquidadaEl) - Number(!!b.liquidadaEl) ||
        (a.nombre || "").localeCompare(b.nombre || "", "es")
    );
}

// A las piezas de Sin recibir les suma los abonos que aún no se liquidan, por
// producto, talla y color: así lo que se va abonando se ve ahí mismo, con sus
// fechas, aunque la pieza todavía no cuente (ni se pueda recibir) hasta
// liquidarse. Crea el producto o la talla si solo tiene abonos.
export function conAbonosPendientes(grupos, relaciones) {
  const pendientes = agruparAbonos(relaciones).filter((a) => !a.liquidadaEl);
  const productos = new Map(
    grupos.map((p) => [p.producto, { ...p, variantes: p.variantes.map((v) => ({ ...v, abonos: [] })) }])
  );
  for (const a of pendientes) {
    const nombre = a.productoNombre || "?";
    if (!productos.has(nombre)) productos.set(nombre, { producto: nombre, total: 0, variantes: [] });
    const producto = productos.get(nombre);
    const clave = `${a.unidad}|${a.talla || ""}|${a.color || ""}`;
    let variante = producto.variantes.find((v) => v.clave === clave);
    if (!variante) {
      variante = {
        clave,
        unidad: a.unidad,
        productoNombre: nombre,
        talla: a.talla || "",
        color: a.color || "",
        total: 0,
        fechas: [],
        abonos: [],
      };
      producto.variantes.push(variante);
      producto.variantes.sort(porTallaYColor);
    }
    variante.abonos.push(a);
  }
  return [...productos.values()].sort((a, b) => a.producto.localeCompare(b.producto, "es"));
}
