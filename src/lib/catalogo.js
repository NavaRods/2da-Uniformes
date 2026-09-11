import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

const catalogoRef = collection(db, "catalogo");

export const TALLA_TIPO = {
  LISTA: "lista",
  LIBRE: "libre",
  NINGUNA: "ninguna",
};

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

export function listenCatalogo(callback) {
  const q = query(catalogoRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sembrarCatalogoInicial() {
  const existentes = await getDocs(catalogoRef);
  if (!existentes.empty) return false; // ya hay catálogo, no duplicar
  await Promise.all(CATALOGO_INICIAL.map((p) => addDoc(catalogoRef, p)));
  return true;
}

export async function crearProducto({ nombre, precio, tallaTipo, tallas, colores }) {
  return addDoc(catalogoRef, {
    nombre,
    precio: Number(precio) || 0,
    tallaTipo,
    tallas: tallas || [],
    colores: colores || [],
  });
}

export async function editarProducto(productoId, cambios) {
  return updateDoc(doc(db, "catalogo", productoId), cambios);
}

export async function agregarTalla(productoId, talla) {
  return updateDoc(doc(db, "catalogo", productoId), {
    tallas: arrayUnion(talla),
  });
}

export async function eliminarProducto(productoId) {
  return deleteDoc(doc(db, "catalogo", productoId));
}

// Borra TODOS los productos del catálogo (no toca pedidos ya creados con
// elementos, solo el catálogo de referencia). Usa un batch para que quede
// como una sola operación.
export async function vaciarCatalogo() {
  const snap = await getDocs(catalogoRef);
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}
