import {
  collection,
  doc,
  query,
  orderBy,
  arrayUnion,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { escribirConVersion } from "./versiones";

const catalogoRef = collection(db, "catalogo");

export const TALLA_TIPO = {
  LISTA: "lista",
  LIBRE: "libre",
  NINGUNA: "ninguna",
};

// ¿Hay que capturar talla para vender este producto? Sí si es a la medida, o
// si es de lista y la lista tiene opciones (con la lista vacía no habría nada
// que elegir y la venta quedaría bloqueada).
export function requiereTalla(producto) {
  if (!producto) return false;
  if (producto.tallaTipo === TALLA_TIPO.LIBRE) return true;
  return producto.tallaTipo === TALLA_TIPO.LISTA && (producto.tallas?.length ?? 0) > 0;
}

function rango1a10() {
  return Array.from({ length: 10 }, (_, i) => String(i + 1));
}

// Catálogo inicial del club. Ya no se separa por grupo (Varonil/Femenino):
// todos los productos están disponibles para cualquier elemento. "tallas"
// queda editable desde la app (botón "Agregar talla" en Catálogo).
const CATALOGO_INICIAL = [
  { nombre: "Pantalón", precio: 350, tallaTipo: TALLA_TIPO.LISTA, tallas: ["6","8","10","12","14","16","28","30","32","34","36","38","40","42","44"] },
  { nombre: "Camisola", precio: 350, tallaTipo: TALLA_TIPO.LIBRE, tallas: [] },
  { nombre: "Falda", precio: 320, tallaTipo: TALLA_TIPO.LIBRE, tallas: [] },
  { nombre: "Insignias", precio: 80, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Insignias Chicas", precio: 80, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Sector y Contra sector", precio: 90, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Corbata", precio: 40, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Botas Negras", precio: 420, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Cintas Blancas", precio: 60, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Fajilla con chapetón", precio: 170, tallaTipo: TALLA_TIPO.LISTA, tallas: ["Ch", "M", "G"] },
  { nombre: "Gorra tipo Vanguardista", precio: 190, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Gorra de Campo con Insignia", precio: 190, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Gorra de Campo sin Insignia", precio: 100, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Cofia con Insignia", precio: 210, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Accesorios", precio: 220, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Zapatillas", precio: 395, tallaTipo: TALLA_TIPO.LIBRE, tallas: [] },
  { nombre: "Camisa Negra", precio: 320, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Canilleras", precio: 50, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  {
    nombre: "Playera",
    precio: 0, // pendiente: falta precio, editar en Catálogo
    tallaTipo: TALLA_TIPO.LISTA,
    tallas: ["6-8","8-10","10-12","12-14","Ch Niño","Mediana de Niño","Grande de Niño","Ch de adulto","Mediana de adulto","Grande de adulto"],
    colores: ["Blanca", "Negra"],
  },
];

// El catálogo se lee con useCatalogo() de lib/fuentes.js, que lo toma de la
// caché del dispositivo mientras no cambie su versión (ver lib/versiones.js).
// Por eso toda escritura aquí pasa por escribirConVersion.
export const consultaCatalogo = () => query(catalogoRef, orderBy("nombre"));

export async function sembrarCatalogoInicial() {
  const existentes = await getDocs(catalogoRef);
  if (!existentes.empty) return false; // ya hay catálogo, no duplicar
  await escribirConVersion("catalogo", (lote) => {
    CATALOGO_INICIAL.forEach((p) => lote.set(doc(catalogoRef), p));
  });
  return true;
}

function datosProducto({ nombre, precio, tallaTipo, tallas, colores }) {
  return {
    nombre,
    precio: Number(precio) || 0,
    tallaTipo,
    tallas: tallas || [],
    colores: colores || [],
  };
}

export async function editarProducto(productoId, cambios) {
  return escribirConVersion("catalogo", (lote) => {
    lote.update(doc(db, "catalogo", productoId), cambios);
  });
}

// Guarda de una vez los cambios pendientes de la pantalla de Catálogo
// (productos nuevos, precios y tallas): una sola escritura y un solo cambio de
// versión, en lugar de uno por cambio (cada uno haría que todos los
// dispositivos volvieran a descargar el catálogo).
export async function guardarCambiosCatalogo(cambios) {
  if (cambios.length === 0) return;
  return escribirConVersion("catalogo", (lote) => {
    for (const cambio of cambios) {
      if (cambio.tipo === "nuevo") {
        lote.set(doc(catalogoRef), datosProducto(cambio.datos));
        continue;
      }
      const ref = doc(db, "catalogo", cambio.productoId);
      if (cambio.precioNuevo !== null) lote.update(ref, { precio: cambio.precioNuevo });
      if (cambio.tallasNuevas.length > 0) {
        lote.update(ref, { tallas: arrayUnion(...cambio.tallasNuevas) });
      }
    }
  });
}

export async function eliminarProducto(productoId) {
  return escribirConVersion("catalogo", (lote) => {
    lote.delete(doc(db, "catalogo", productoId));
  });
}

// Borra TODOS los productos del catálogo (no toca pedidos ya creados con
// elementos, solo el catálogo de referencia). Todo en un solo lote.
export async function vaciarCatalogo() {
  const snap = await getDocs(catalogoRef);
  if (snap.empty) return 0;
  await escribirConVersion("catalogo", (lote) => {
    snap.docs.forEach((d) => lote.delete(d.ref));
  });
  return snap.size;
}
