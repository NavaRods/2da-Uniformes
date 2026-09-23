import { onSnapshot, query, where, getDocsFromCache, Timestamp } from "firebase/firestore";
import { vigilar } from "./estadoFirestore";
import { leerMarca, guardarMarca } from "./memoriaLocal";

// Sincronización por cambios: la usan los elementos y los pedidos de cada
// Unidad (y las bajas de pedidos). Cada escritura guarda la hora del servidor
// en un campo ("actualizadoEn"; las reglas de Firestore lo exigen), así que
// basta pedir al servidor los documentos con esa hora posterior a la última
// sincronización.

// Cada cuánto se vuelve a descargar todo (en lugar de solo los cambios).
// Cubre lo que la sincronización por cambios no ve: un documento que se pasó
// a otra Unidad desde otro dispositivo, o uno borrado a mano en la consola.
export const SINCRONIA_COMPLETA_MS = 7 * 24 * 60 * 60 * 1000;
// Al pedir los cambios "desde" la última sincronización se retrocede un poco,
// por si una escritura se confirmó justo en el límite.
const MARGEN_MS = 2 * 60 * 1000;

const datosDe = (d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });

// Escucha `consulta` en vivo con dos listeners:
//  - del servidor: solo trae a la caché lo que cambió desde la última
//    sincronización (o todo, la primera vez y cada SINCRONIA_COMPLETA_MS);
//  - de la caché (source: "cache", 0 lecturas): entrega la lista completa,
//    incluidos los cambios hechos en este dispositivo aunque no haya internet.
// `clave` identifica la marca de sincronización guardada en el dispositivo.
// `convertir(doc)` arma cada objeto; `ordenar` es opcional.
export function escucharPorCambios(
  { clave, consulta, campo = "actualizadoEn", convertir = datosDe, ordenar },
  callback
) {
  let cancelado = false;
  const cerrar = [];

  (async () => {
    const marca = leerMarca(clave);
    let desde = null;
    if (marca && Date.now() - marca.completa < SINCRONIA_COMPLETA_MS) {
      try {
        // Si la caché perdió documentos (el navegador la limpió), no sirve.
        const enCache = await getDocsFromCache(consulta);
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
      ? consulta
      : query(consulta, where(campo, ">=", Timestamp.fromMillis(Math.max(0, desde - MARGEN_MS))));

    let ultimos = [];
    const entregar = () => {
      if (listo && !cancelado) callback(ultimos);
    };

    cerrar.push(
      onSnapshot(consulta, { source: "cache" }, (snap) => {
        const lista = snap.docs.map(convertir);
        ultimos = ordenar ? lista.sort(ordenar) : lista;
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
            const t = d.metadata.hasPendingWrites ? null : d.get(campo);
            if (typeof t?.toMillis === "function") ultima = Math.max(ultima, t.toMillis());
          }
          desde = ultima;
          guardarMarca(clave, {
            desde: ultima,
            // Cuántos documentos debe tener la caché la próxima vez. En la
            // sincronización completa es exacto; por cambios, se conserva el
            // anterior o el de la caché si creció (si un documento salió de
            // la consulta, la próxima vez no cuadra y se hace completa: nunca
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
