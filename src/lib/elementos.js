import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  getCountFromServer,
  getDocsFromCache,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { vigilar } from "./estadoFirestore";
import { leerMarca, guardarMarca } from "./memoriaLocal";

const elementosRef = collection(db, "elementos");

// Cada escritura en un elemento guarda la hora del servidor en "actualizadoEn"
// (las reglas de Firestore lo exigen). Con eso la lista de una Unidad se
// sincroniza por partes: solo se descargan los elementos que cambiaron.
export const marcaActualizacion = () => ({ actualizadoEn: serverTimestamp() });

// Cada cuánto se vuelve a descargar la lista completa de una Unidad (en lugar
// de solo los cambios). Cubre lo que la sincronización por cambios no ve: un
// elemento que se pasó a otra Unidad desde otro dispositivo, o uno borrado.
export const SINCRONIA_COMPLETA_MS = 7 * 24 * 60 * 60 * 1000;
// Al pedir los cambios "desde" la última sincronización se retrocede un poco,
// por si una escritura se confirmó justo en el límite.
const MARGEN_MS = 2 * 60 * 1000;

const porNombre = (a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es");

// Elementos de una Unidad, en vivo. Dos listeners:
//  - del servidor: solo trae a la caché los elementos que cambiaron desde la
//    última sincronización (o todos, la primera vez y cada SINCRONIA_COMPLETA_MS);
//  - de la caché (source: "cache", 0 lecturas): entrega la lista completa,
//    incluidos los cambios hechos en este dispositivo aunque no haya internet.
// Así abrir la app cuesta unas pocas lecturas en vez de una por elemento.
export function listenElementos(callback, unidad) {
  const clave = `elementos:${unidad}`;
  const deLaUnidad = query(elementosRef, where("unidad", "==", unidad));
  let cancelado = false;
  const cerrar = [];

  (async () => {
    const marca = leerMarca(clave);
    let desde = null;
    if (marca && Date.now() - marca.completa < SINCRONIA_COMPLETA_MS) {
      try {
        // Si la caché perdió elementos (el navegador la limpió), no sirve.
        const enCache = await getDocsFromCache(deLaUnidad);
        if (enCache.size >= marca.n) desde = marca.desde;
      } catch {
        // Sin caché: sincronización completa.
      }
    }
    if (cancelado) return;

    const completa = desde === null;
    // En la sincronización completa no se muestra la caché hasta tener la
    // primera respuesta (evita ver una lista a medias como si fuera la final).
    let listo = !completa;

    const delServidor = completa
      ? deLaUnidad
      : query(deLaUnidad, where("actualizadoEn", ">=", Timestamp.fromMillis(Math.max(0, desde - MARGEN_MS))));

    let ultimos = [];
    const entregar = () => {
      if (listo && !cancelado) callback(ultimos);
    };

    cerrar.push(
      onSnapshot(deLaUnidad, { source: "cache" }, (snap) => {
        ultimos = snap.docs
          .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
          .sort(porNombre);
        entregar();
      })
    );

    cerrar.push(
      onSnapshot(
        delServidor,
        (snap) => {
          if (!listo) {
            listo = true;
            entregar();
          }
          if (snap.metadata.fromCache) return;
          let ultima = desde ?? 0;
          for (const d of snap.docs) {
            const t = d.metadata.hasPendingWrites ? null : d.get("actualizadoEn");
            if (typeof t?.toMillis === "function") ultima = Math.max(ultima, t.toMillis());
          }
          desde = ultima;
          guardarMarca(clave, {
            desde: ultima,
            // Cuántos elementos debe tener la caché la próxima vez. En la
            // sincronización completa es exacto; por cambios, se conserva el
            // anterior o el de la caché si creció (si un elemento salió de la
            // Unidad, la próxima vez no cuadra y se hace completa: nunca
            // se muestra una lista incompleta por error).
            n: completa ? snap.size : Math.max(marca.n, ultimos.length),
            completa: completa ? Date.now() : marca.completa,
          });
        },
        vigilar(() => {
          // Sin servidor (p. ej. cuota agotada) se muestra lo que haya en caché.
          listo = true;
          entregar();
        })
      )
    );
  })();

  return () => {
    cancelado = true;
    cerrar.forEach((f) => f());
  };
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
