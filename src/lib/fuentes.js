import { useCallback, useMemo, useSyncExternalStore } from "react";
import { getDocsFromCache } from "firebase/firestore";
import { listenElementos } from "./elementos";
import { listenBajasPedidos, listenPedidosDeUnidad, sinBorrados } from "./pedidos";
import { listenInventario } from "./inventario";
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
const pedidosPorUnidad = new Map();
const inventarioPorUnidad = new Map();

function fuenteElementos(unidad) {
  if (!elementosPorUnidad.has(unidad)) {
    elementosPorUnidad.set(unidad, crearFuente((cb) => listenElementos(cb, unidad)));
  }
  return elementosPorUnidad.get(unidad);
}

// Pedidos de una Unidad sin los borrados: junta los pedidos y sus bajas, y
// entrega en cuanto ambos cargaron.
export function escucharPedidosVigentes(unidad, callback, escuchar = {}) {
  const { pedidos: oirPedidos = listenPedidosDeUnidad, bajas: oirBajas = listenBajasPedidos } =
    escuchar;
  let pedidos = null;
  let bajas = null;
  const entregar = () => {
    if (pedidos && bajas) callback(sinBorrados(pedidos, bajas));
  };
  const dejarPedidos = oirPedidos((lista) => {
    pedidos = lista;
    entregar();
  }, unidad);
  const dejarBajas = oirBajas((lista) => {
    bajas = lista;
    entregar();
  }, unidad);
  return () => {
    dejarPedidos();
    dejarBajas();
  };
}

function fuentePedidos(unidad) {
  if (!pedidosPorUnidad.has(unidad)) {
    pedidosPorUnidad.set(unidad, crearFuente((cb) => escucharPedidosVigentes(unidad, cb)));
  }
  return pedidosPorUnidad.get(unidad);
}

// Uniformidad disponible de una Unidad (pocos documentos: uno por producto y talla).
function fuenteInventario(unidad) {
  if (!inventarioPorUnidad.has(unidad)) {
    inventarioPorUnidad.set(unidad, crearFuente((cb) => listenInventario(cb, unidad)));
  }
  return inventarioPorUnidad.get(unidad);
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
  pedidosPorUnidad.forEach((f) => f.detener());
  pedidosPorUnidad.clear();
  inventarioPorUnidad.forEach((f) => f.detener());
  inventarioPorUnidad.clear();
}

const VACIA = { suscribir: () => () => {}, leer: () => SIN_DATOS };

function useFuente(fuente) {
  const f = fuente || VACIA;
  return useSyncExternalStore(f.suscribir, f.leer);
}

// Elementos de una Unidad. Sin Unidad (Admin que aún no elige) no lee nada.
export const useElementos = (unidad) => useFuente(unidad ? fuenteElementos(unidad) : null);

// Junta varias fuentes (una por Unidad) en una sola lista. null mientras
// alguna no ha cargado. La lista se reutiliza mientras no cambie ninguna
// parte (useSyncExternalStore exige la misma referencia si nada cambió).
export function juntarFuentes(fuentes) {
  let previo = null;
  return {
    suscribir(alCambiar) {
      const dejar = fuentes.map((f) => f.suscribir(alCambiar));
      return () => dejar.forEach((d) => d());
    },
    leer() {
      const partes = fuentes.map((f) => f.leer());
      if (partes.some((p) => p === SIN_DATOS)) return null;
      if (previo && partes.length === previo.partes.length && partes.every((p, i) => p === previo.partes[i])) {
        return previo.valor;
      }
      previo = { partes, valor: partes.flat() };
      return previo.valor;
    },
  };
}

function useDeUnidades(obtenerFuente, unidadesPedidas) {
  const clave = unidadesPedidas.join("\u0000");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` resume la lista
  const junta = useMemo(() => juntarFuentes(unidadesPedidas.map(obtenerFuente)), [clave]);
  const suscribir = useCallback((alCambiar) => junta.suscribir(alCambiar), [junta]);
  const leer = useCallback(() => junta.leer(), [junta]);
  return useSyncExternalStore(suscribir, leer);
}

// Elementos o pedidos de varias Unidades juntos (p. ej. "Todas las
// Unidades" en la Relación de pagos). null mientras cargan.
export const useElementosDeUnidades = (unidadesPedidas) =>
  useDeUnidades(fuenteElementos, unidadesPedidas);
export const usePedidosDeUnidades = (unidadesPedidas) =>
  useDeUnidades(fuentePedidos, unidadesPedidas);
export const useInventarioDeUnidades = (unidadesPedidas) =>
  useDeUnidades(fuenteInventario, unidadesPedidas);
// Uniformidad disponible de una Unidad; [] mientras carga o sin Unidad.
export const useInventario = (unidad) => useFuente(unidad ? fuenteInventario(unidad) : null);
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
