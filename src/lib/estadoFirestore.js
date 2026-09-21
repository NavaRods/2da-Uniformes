import { useSyncExternalStore } from "react";

// Estado global de Firestore que la interfaz necesita mostrar: hoy, si se
// agotó la cuota diaria del plan gratuito (error "resource-exhausted").
let cuotaAgotada = false;
const oyentes = new Set();

const cambiar = (valor) => {
  if (cuotaAgotada === valor) return;
  cuotaAgotada = valor;
  oyentes.forEach((f) => f());
};

export function esErrorDeCuota(error) {
  return error?.code === "resource-exhausted";
}

export function reportarError(error) {
  if (esErrorDeCuota(error)) cambiar(true);
}

export function limpiarCuotaAgotada() {
  cambiar(false);
}

// Envuelve el manejador de error de un listener: avisa de la cuota agotada y
// después llama al manejador original (si lo había).
export function vigilar(onError) {
  return (error) => {
    reportarError(error);
    if (onError) onError(error);
  };
}

// Igual, para una escritura: si la promesa falla por cuota se avisa y el error
// se sigue propagando a quien la llamó.
export function vigilarEscritura(promesa) {
  return promesa.catch((error) => {
    reportarError(error);
    throw error;
  });
}

const suscribir = (alCambiar) => {
  oyentes.add(alCambiar);
  return () => oyentes.delete(alCambiar);
};

export const useCuotaAgotada = () => useSyncExternalStore(suscribir, () => cuotaAgotada);
