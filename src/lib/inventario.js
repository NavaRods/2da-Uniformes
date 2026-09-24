import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar, vigilarEscritura } from "./estadoFirestore";
import { claveVariante } from "./relacionPagos";

// "Uniformidad disponible": las piezas que ya llegaron (del proveedor) y están
// guardadas esperando a entregarse. Un documento por Unidad, producto, talla
// y color: inventario/{id} con { unidad, productoNombre, talla, color,
// cantidad }. Se suma al recibir (Relación de pagos → General) y se descuenta al marcar
// un pedido como entregado.


// ID del documento: sin "/" (Firestore no lo permite en un ID).
export const idInventario = (unidad, variante) =>
  [unidad, variante.productoNombre, variante.talla, variante.color]
    .map((p) => encodeURIComponent(p || ""))
    .join("~");

export const refInventario = (unidad, variante) =>
  doc(db, "inventario", idInventario(unidad, variante));

const datosVariante = (unidad, v) => ({
  unidad,
  productoNombre: v.productoNombre || "",
  talla: v.talla || "",
  color: v.color || "",
  actualizadoEn: serverTimestamp(),
});

// Para set(..., { merge: true }) en un lote: suma `delta` (negativo = sale).
export const cambioInventario = (unidad, variante, delta) => ({
  ...datosVariante(unidad, variante),
  cantidad: increment(delta),
});

// Cantidad exacta (corregir un conteo).
export const inventarioFijo = (unidad, variante, cantidad) => ({
  ...datosVariante(unidad, variante),
  cantidad,
});

// Suma lo que se recibió. `maxFalta`, si se da, es lo que aún falta de esa
// variante (piezas que se deben menos las ya recibidas): no se acepta recibir
// más de lo que hace falta, para no inflar el inventario con piezas de más.
export function recibirUniforme(unidad, variante, piezas, maxFalta) {
  const n = Math.trunc(Number(piezas));
  if (!(n > 0)) throw new Error("Indica cuántas piezas recibiste.");
  if (maxFalta != null && n > maxFalta) {
    throw new Error(
      maxFalta > 0
        ? `Solo faltan ${maxFalta} de esta pieza; no puedes recibir más de las que se deben.`
        : "Ya está recibido todo lo que se debe de esta pieza."
    );
  }
  return vigilarEscritura(
    setDoc(refInventario(unidad, variante), cambioInventario(unidad, variante, n), { merge: true })
  );
}

// Corrige el conteo a una cantidad exacta.
export function fijarInventario(unidad, variante, cantidad) {
  const n = Math.trunc(Number(cantidad));
  if (!(n >= 0)) throw new Error("La cantidad no puede ser negativa.");
  return vigilarEscritura(
    setDoc(refInventario(unidad, variante), inventarioFijo(unidad, variante, n), { merge: true })
  );
}

export function listenInventario(callback, unidad) {
  const q = query(collection(db, "inventario"), where("unidad", "==", unidad));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    vigilar()
  );
}

// Existencias por variante (sumando Unidades), clave → cantidad.
export function existenciasPorVariante(inventario) {
  const mapa = new Map();
  for (const i of inventario || []) {
    const clave = claveVariante(i);
    mapa.set(clave, (mapa.get(clave) || 0) + (Number(i.cantidad) || 0));
  }
  return mapa;
}

// Existencias agrupadas por producto para la pestaña "Recibido" (solo lo que
// tiene piezas). Cada variante lleva sus documentos por Unidad.
export function recibidoPorProducto(inventario) {
  const productos = new Map();
  for (const i of inventario || []) {
    const cantidad = Number(i.cantidad) || 0;
    if (cantidad <= 0) continue;
    const nombre = i.productoNombre || "?";
    if (!productos.has(nombre)) productos.set(nombre, { producto: nombre, piezas: 0, variantes: [] });
    const p = productos.get(nombre);
    p.piezas += cantidad;
    p.variantes.push({ ...i, cantidad });
  }
  const orden = (a, b) =>
    (a.talla || "").localeCompare(b.talla || "", "es", { numeric: true }) ||
    (a.color || "").localeCompare(b.color || "", "es") ||
    (a.unidad || "").localeCompare(b.unidad || "", "es", { numeric: true });
  return [...productos.values()]
    .map((p) => ({ ...p, variantes: p.variantes.sort(orden) }))
    .sort((a, b) => a.producto.localeCompare(b.producto, "es"));
}
