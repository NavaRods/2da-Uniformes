import { useMemo, useSyncExternalStore } from "react";
import { listenElementos } from "./elementos";
import { listenCatalogo } from "./catalogo";
import { listenUnidades } from "./unidades";
import { listenGrados } from "./gradosDb";
import { GRADOS_PREDETERMINADOS, ordenarGrados } from "./grados";

// Fuentes compartidas: cada colección se escucha UNA vez y todas las pantallas
// que la usan reciben los mismos datos. Antes cada pantalla abría su propio
// listener y volvía a leer la colección completa al entrar. Al salir la última
// pantalla, el listener sigue vivo un rato (GRACIA_MS) para que ir y volver
// entre pantallas no cueste lecturas.
export const GRACIA_MS = 10 * 60 * 1000;

const SIN_DATOS = [];

export function crearFuente(escuchar, gracia = GRACIA_MS) {
  let datos = SIN_DATOS;
  let cerrar = null;
  let temporizador = null;
  const oyentes = new Set();

  const avisar = () => oyentes.forEach((f) => f());

  function detener() {
    clearTimeout(temporizador);
    temporizador = null;
    if (cerrar) cerrar();
    cerrar = null;
    if (datos !== SIN_DATOS) {
      datos = SIN_DATOS;
      avisar();
    }
  }

  return {
    suscribir(alCambiar) {
      clearTimeout(temporizador);
      temporizador = null;
      oyentes.add(alCambiar);
      if (!cerrar) {
        cerrar = escuchar((nuevos) => {
          datos = nuevos;
          avisar();
        });
      }
      return () => {
        oyentes.delete(alCambiar);
        if (oyentes.size === 0) temporizador = setTimeout(detener, gracia);
      };
    },
    leer: () => datos,
    detener,
  };
}

const catalogo = crearFuente(listenCatalogo);
const unidades = crearFuente(listenUnidades);
const grados = crearFuente(listenGrados);
const elementosPorUnidad = new Map();

function fuenteElementos(unidad) {
  if (!elementosPorUnidad.has(unidad)) {
    elementosPorUnidad.set(unidad, crearFuente((cb) => listenElementos(cb, unidad)));
  }
  return elementosPorUnidad.get(unidad);
}

// Al cerrar sesión se cierran todos los listeners: los datos son de esa cuenta.
export function reiniciarFuentes() {
  catalogo.detener();
  unidades.detener();
  grados.detener();
  elementosPorUnidad.forEach((f) => f.detener());
  elementosPorUnidad.clear();
}

const VACIA = { suscribir: () => () => {}, leer: () => SIN_DATOS };

function useFuente(fuente) {
  const f = fuente || VACIA;
  return useSyncExternalStore(f.suscribir, f.leer);
}

// Elementos de una Unidad. Sin Unidad (Admin que aún no elige) no lee nada.
export const useElementos = (unidad) => useFuente(unidad ? fuenteElementos(unidad) : null);
export const useCatalogo = () => useFuente(catalogo);
// `activo` en false evita suscribirse (p. ej. un Operador no necesita la lista).
export const useUnidades = (activo = true) => useFuente(activo ? unidades : null);

// Grados militares, de mayor a menor jerarquía. Mientras la colección de
// Firestore esté vacía se usan los predeterminados.
export function useGrados() {
  const guardados = useFuente(grados);
  return useMemo(
    () => ordenarGrados(guardados.length > 0 ? guardados : GRADOS_PREDETERMINADOS),
    [guardados]
  );
}
