import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
  getDocs,
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

// Catálogo inicial del club. "tallas" queda editable desde la app
// (botón "Agregar talla" en Catálogo) para no depender de tocar código.
const CATALOGO_INICIAL = [
  // --- Grupo Varonil ---
  { nombre: "Pantalón", grupo: "Varonil", precio: 350, tallaTipo: TALLA_TIPO.LISTA, tallas: ["6","8","10","12","14","16","28","30","32","34","36","38","40","42","44"] },
  { nombre: "Camisola", grupo: "Varonil", precio: 350, tallaTipo: TALLA_TIPO.LISTA, tallas: ["6","8","10","12","14","16","18","34","36","38","40","42","44"] },
  { nombre: "Insignias", grupo: "Varonil", precio: 80, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Sector y Contra sector", grupo: "Varonil", precio: 90, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Corbata", grupo: "Varonil", precio: 40, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Botas Negras", grupo: "Varonil", precio: 420, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Cintas Blancas", grupo: "Varonil", precio: 60, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Fajilla con chapetón", grupo: "Varonil", precio: 170, tallaTipo: TALLA_TIPO.LISTA, tallas: ["Ch", "M", "G"] },
  { nombre: "Gorra tipo Vanguardista", grupo: "Varonil", precio: 190, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Gorra de Campo con Insignia", grupo: "Varonil", precio: 190, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Gorra de Campo sin Insignia", grupo: "Varonil", precio: 100, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Camisa Negra", grupo: "Varonil", precio: 320, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Canilleras", grupo: "Varonil", precio: 50, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },

  // --- Grupo Femenino ---
  { nombre: "Pantalón", grupo: "Femenino", precio: 350, tallaTipo: TALLA_TIPO.LISTA, tallas: ["6","8","10","12","14","16","28","30","32","34","36","38","40","42","44"] },
  { nombre: "Camisola", grupo: "Femenino", precio: 380, tallaTipo: TALLA_TIPO.LIBRE, tallas: [] },
  { nombre: "Falda", grupo: "Femenino", precio: 320, tallaTipo: TALLA_TIPO.LIBRE, tallas: [] },
  { nombre: "Cofia con Insignia", grupo: "Femenino", precio: 210, tallaTipo: TALLA_TIPO.LISTA, tallas: rango1a10() },
  { nombre: "Accesorios", grupo: "Femenino", precio: 220, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Zapatillas", grupo: "Femenino", precio: 395, tallaTipo: TALLA_TIPO.LIBRE, tallas: [] },
  { nombre: "Sector y Contra sector", grupo: "Femenino", precio: 90, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Corbata", grupo: "Femenino", precio: 40, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Canilleras", grupo: "Femenino", precio: 50, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Fajilla con chapetón", grupo: "Femenino", precio: 170, tallaTipo: TALLA_TIPO.LISTA, tallas: ["Ch", "M", "G"] },
  { nombre: "Camisa Negra", grupo: "Femenino", precio: 320, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },
  { nombre: "Insignias Chicas", grupo: "Femenino", precio: 80, tallaTipo: TALLA_TIPO.NINGUNA, tallas: [] },

  // --- Ambos (playeras, con variante de color) ---
  {
    nombre: "Playera",
    grupo: "Ambos",
    precio: 0, // pendiente: falta precio, editar en Catálogo
    tallaTipo: TALLA_TIPO.LISTA,
    tallas: ["6-8","8-10","10-12","12-14","Ch Niño","Mediana de Niño","Grande de Niño","Ch de adulto","Mediana de adulto","Grande de adulto"],
    colores: ["Blanca", "Negra"],
  },
];

export function listenCatalogo(callback) {
  const q = query(catalogoRef, orderBy("grupo"));
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

export async function crearProducto({ nombre, grupo, precio, tallaTipo, tallas, colores }) {
  return addDoc(catalogoRef, {
    nombre,
    grupo,
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
