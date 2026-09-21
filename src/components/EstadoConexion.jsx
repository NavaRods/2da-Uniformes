import { useEffect, useState, useSyncExternalStore } from "react";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "../firebase";
import { limpiarCuotaAgotada, useCuotaAgotada } from "../lib/estadoFirestore";

const enLinea = () => navigator.onLine;
const suscribirConexion = (alCambiar) => {
  window.addEventListener("online", alCambiar);
  window.addEventListener("offline", alCambiar);
  return () => {
    window.removeEventListener("online", alCambiar);
    window.removeEventListener("offline", alCambiar);
  };
};

// Avisos globales bajo la barra de navegación:
//  - sin conexión: lo que se registre se guarda en este dispositivo;
//  - sincronizando: hay cambios que aún no llegaron al servidor;
//  - cuota diaria agotada (plan gratuito de Firebase).
export default function EstadoConexion() {
  const conectado = useSyncExternalStore(suscribirConexion, enLinea, () => true);
  const cuotaAgotada = useCuotaAgotada();
  const [sincronizando, setSincronizando] = useState(false);

  // Al volver internet se espera a que se envíen los cambios guardados en el
  // dispositivo. Si no había nada pendiente termina al instante y no se muestra.
  useEffect(() => {
    if (!conectado) return;
    let vigente = true;
    const espera = setTimeout(() => vigente && setSincronizando(true), 800);
    waitForPendingWrites(db)
      .catch(() => {})
      .finally(() => {
        clearTimeout(espera);
        if (vigente) setSincronizando(false);
      });
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [conectado]);

  if (conectado && !sincronizando && !cuotaAgotada) return null;

  return (
    <div className="estado-avisos" role="status" aria-live="polite">
      {!conectado && (
        <p className="aviso-estado aviso-sin-conexion">
          📴 Sin conexión. Lo que registres se guarda en este dispositivo y se enviará
          solo cuando vuelva internet. Puede tardar en verse en los demás dispositivos.
        </p>
      )}
      {conectado && sincronizando && (
        <p className="aviso-estado aviso-sincronizando">
          🔄 Enviando los cambios guardados en este dispositivo…
        </p>
      )}
      {cuotaAgotada && (
        <p className="aviso-estado aviso-cuota">
          <span>
            ⚠️ Se agotó la cuota diaria gratuita de Firebase. Los datos dejarán de actualizarse
            y lo que registres se enviará cuando se restablezca (a medianoche, hora del Pacífico:
            de madrugada en México). Avisa a un administrador si esto es frecuente.
          </span>
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => {
              limpiarCuotaAgotada();
              window.location.reload();
            }}
          >
            Reintentar
          </button>
        </p>
      )}
    </div>
  );
}
