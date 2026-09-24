import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// "De dónde vengo": al ir de una pantalla a otra (p. ej. de Uniformes al
// perfil de un elemento) se manda `state={useDesde("Uniformes")}` en el
// enlace. La pantalla de destino lo lee en BotonVolver y regresa ahí, no a un
// lugar fijo.
const NOMBRES = {
  "/": "Inicio",
  "/elementos": "Elementos",
  "/asistencia": "Asistencia",
  "/reporte-asistencia": "Reportes",
  "/pagos": "Relación de pagos",
  "/uniformidad": "Uniformes y Mensualidades",
  "/catalogo": "Catálogo",
  "/configuracion": "Configuración",
  "/usuarios": "Usuarios",
};

// Sin `etiqueta`, se toma el nombre de la pantalla actual.
export function useDesde(etiqueta) {
  const { pathname, search } = useLocation();
  return { desde: { ruta: pathname + search, etiqueta: etiqueta || NOMBRES[pathname] || "la pantalla anterior" } };
}

// Igual que useState, pero recuerda el valor mientras dure la pestaña
// (sessionStorage): al volver a una pantalla se conserva la Unidad, la
// pestaña o el filtro que se tenía, en vez de empezar de cero.
export function useEstadoPersistente(clave, inicial) {
  const llave = `vmm:${clave}`;
  const [valor, setValor] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(llave);
      return guardado === null ? inicial : JSON.parse(guardado);
    } catch {
      return inicial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(llave, JSON.stringify(valor));
    } catch {
      // Sin almacenamiento (modo privado): simplemente no se recuerda.
    }
  }, [llave, valor]);
  return [valor, setValor];
}
