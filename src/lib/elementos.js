import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../firebase";
import { escucharPorCambios } from "./sincronia";

const elementosRef = collection(db, "elementos");

// Cada escritura en un elemento guarda la hora del servidor en "actualizadoEn"
// (las reglas de Firestore lo exigen). Con eso la lista de una Unidad se
// sincroniza por partes: solo se descargan los elementos que cambiaron.
export const marcaActualizacion = () => ({ actualizadoEn: serverTimestamp() });

export { SINCRONIA_COMPLETA_MS } from "./sincronia";

const porNombre = (a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es");

// Elementos de una Unidad, en vivo y sincronizados por cambios (ver
// lib/sincronia.js): abrir la app cuesta unas pocas lecturas en vez de una
// por elemento.
export function listenElementos(callback, unidad) {
  return escucharPorCambios(
    {
      clave: `elementos:${unidad}`,
      consulta: query(elementosRef, where("unidad", "==", unidad)),
      ordenar: porNombre,
    },
    callback
  );
}

// Cuántos elementos tiene cada Unidad, sin descargarlos: una consulta de
// conteo cuesta 1 lectura por cada 1,000 elementos (mínimo 1) en lugar de una
// por elemento. Si alguna falla queda en null (desconocido), no en 0.
export async function contarElementosPorUnidad(nombres) {
  const conteos = await Promise.all(
    nombres.map(async (nombre) => {
      try {
        const snap = await getCountFromServer(query(elementosRef, where("unidad", "==", nombre)));
        return [nombre, snap.data().count];
      } catch {
        return [nombre, null];
      }
    })
  );
  return Object.fromEntries(conteos);
}

export async function crearElemento(datos) {
  return addDoc(elementosRef, {
    unidad: datos.unidad,
    grupo: datos.grupo || "Varonil",
    nombre: datos.nombre,
    numeroOrden: datos.numeroOrden || "",
    gradoMilitar: datos.gradoMilitar || "",
    edad: datos.edad || null,
    telefonos: datos.telefonos?.filter(Boolean) || [],
    direccion: datos.direccion || "",
    fechaNacimiento: datos.fechaNacimiento || "",
    escuela: datos.escuela || "",
    turno: datos.turno || "",
    gradoEscolar: datos.gradoEscolar || "",
    tutor: datos.tutor || "",
    comoSeEntero: datos.comoSeEntero || "",
    seguroSocial: datos.seguroSocial || "",
    alergias: datos.alergias || "",
    antecedentes: datos.antecedentes || "",
    antecedentesDetalle: datos.antecedentesDetalle || "",
    practicaDeporte: datos.practicaDeporte || "",
    deporte: datos.deporte || "",
    pagaMensualidad: !!datos.pagaMensualidad,
    pagaInscripcion: !!datos.pagaInscripcion,
    creadoEn: serverTimestamp(),
    ...marcaActualizacion(),
  });
}

export async function actualizarElemento(elementoId, cambios) {
  return updateDoc(doc(db, "elementos", elementoId), { ...cambios, ...marcaActualizacion() });
}

// Un elemento dado de baja tiene fechaBaja (ver darDeBaja en lib/asistencia.js).
// Sale de las listas de elementos y aparece en el apartado de Bajas.
export const estaActivo = (elemento) => !elemento.fechaBaja;
