import { useMemo, useSyncExternalStore } from "react";
import { getDocsFromCache } from "firebase/firestore";
import { listenElementos } from "./elementos";
import { consultaCatalogo } from "./catalogo";
import { consultaUnidades, compararUnidades } from "./unidades";
import { consultaGrados } from "./gradosDb";
import { consultaUsuarios } from "./usuarios";
import { listenConfiguracion } from "./configuracion";
import { cargarConVersion, claveVersion, listenVersiones } from "./versiones";
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

// Documento con la versión de cada colección versionada (ver lib/versiones.js).
const versiones = crearFuente(listenVersiones);

// Colección que casi nunca cambia: se entrega desde la caché del dispositivo y
// solo se descarga del servidor cuando cambia su versión. Si el cambio lo hizo
// este mismo dispositivo, su caché ya lo tiene: tampoco se descarga.
export function escucharVersionada(coleccion, consulta, convertir, fuenteVersiones = versiones) {
  return (callback) => {
    let entregada; // versión ya entregada
    let cambioPropio = false;
    let turno = 0;

    async function entregar(cargar) {
      const mio = ++turno;
      try {
        const snap = await cargar();
        if (mio === turno) callback(convertir(snap));
      } catch {
        // Sin servidor ni caché: se queda lo que ya se mostraba.
      }
    }

    function revisar() {
      const estado = fuenteVersiones.leer();
      if (estado === SIN_DATOS) return;
      const valor = estado.datos[coleccion];
      if (estado.pendiente && valor === null) {
        // Cambio de este dispositivo aún sin confirmar: se muestra de la caché.
        cambioPropio = true;
        entregar(() => getDocsFromCache(consulta()));
        return;
      }
      const version = claveVersion(valor);
      if (version === entregada) {
        cambioPropio = false;
        return;
      }
      entregada = version;
      const propio = cambioPropio;
      cambioPropio = false;
      entregar(() => cargarConVersion(coleccion, consulta(), version, { propio }));
    }

    const dejar = fuenteVersiones.suscribir(revisar);
    revisar();
    return () => {
      turno += 1;
      dejar();
    };
  };
}

const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

const catalogo = crearFuente(escucharVersionada("catalogo", consultaCatalogo, lista));
const unidades = crearFuente(
  escucharVersionada("unidades", consultaUnidades, (snap) => lista(snap).sort(compararUnidades))
);
const grados = crearFuente(escucharVersionada("grados", consultaGrados, lista));
const usuarios = crearFuente(escucharVersionada("usuarios", consultaUsuarios, lista));
// Un solo documento: se escucha una vez para todas las pantallas que lo usan.
const configuracion = crearFuente((cb) => listenConfiguracion(cb, () => cb({})));
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
  usuarios.detener();
  configuracion.detener();
  versiones.detener();
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
// Todas las cuentas con acceso (pantalla de Usuarios, solo Admin).
export const useUsuarios = () => useFuente(usuarios);

// Ajustes compartidos (número de WhatsApp). null mientras carga.
export function useConfiguracion() {
  const datos = useFuente(configuracion);
  return datos === SIN_DATOS ? null : datos;
}

// Grados tal como están guardados; null mientras cargan (Configuración).
export function useGradosGuardados() {
  const guardados = useFuente(grados);
  return guardados === SIN_DATOS ? null : guardados;
}

// Grados militares, de mayor a menor jerarquía. Mientras la colección de
// Firestore esté vacía se usan los predeterminados.
export function useGrados() {
  const guardados = useFuente(grados);
  return useMemo(
    () => ordenarGrados(guardados.length > 0 ? guardados : GRADOS_PREDETERMINADOS),
    [guardados]
  );
}
