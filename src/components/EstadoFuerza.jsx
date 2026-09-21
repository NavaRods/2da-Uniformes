import { useEffect, useState } from "react";
import { estadoDeFuerza, CATEGORIAS } from "../lib/grados";
import { estaDeBaja } from "../lib/asistencia";
import { listenConfiguracion } from "../lib/configuracion";
import { etiquetaDia } from "../lib/relacionPagos";
import { linkWhatsapp, mensajeEstadoFuerza, normalizarTelefono, telefonoValido } from "../lib/whatsapp";

// Estado de Fuerza de una Unidad en el día seleccionado: cuántos elementos hay
// por categoría (Jefes, Oficiales, Clases, Cadetes, Tropas, Reclutas), separados
// en Varonil y Femenino, con el total de cada grupo y el total general. Cuenta
// a los elementos de la lista de ese día (los dados de baja ya no entran).
export default function EstadoFuerza({ elementos, grados, unidad, fecha }) {
  const [novedades, setNovedades] = useState("");
  const [config, setConfig] = useState(null);

  useEffect(() => listenConfiguracion(setConfig, () => setConfig({})), []);

  const enLista = elementos.filter((el) => !estaDeBaja(el, fecha));
  const fuerza = estadoDeFuerza(enLista, grados);
  const hayNumero = telefonoValido(normalizarTelefono(config?.whatsappNumero));

  // Se abre en el mismo clic para que el navegador no bloquee la ventana. Sin
  // un número configurado, WhatsApp deja elegir a quién mandarlo.
  function enviarPorWhatsapp() {
    const mensaje = mensajeEstadoFuerza({
      unidad,
      fechaEtiqueta: etiquetaDia(fecha),
      fuerza,
      novedades,
    });
    window.open(linkWhatsapp(hayNumero ? config.whatsappNumero : "", mensaje), "_blank");
  }

  return (
    <div className="card estado-fuerza">
      <h2>Estado de Fuerza</h2>
      <p className="nota">
        {unidad} · {etiquetaDia(fecha)}
      </p>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Varonil</th>
              <th>Femenino</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map((c) => (
              <tr key={c}>
                <td>{c}</td>
                <td>{fuerza.Varonil[c]}</td>
                <td>{fuerza.Femenino[c]}</td>
                <td>{fuerza.Varonil[c] + fuerza.Femenino[c]}</td>
              </tr>
            ))}
            {(fuerza.Varonil.sinGrado > 0 || fuerza.Femenino.sinGrado > 0) && (
              <tr>
                <td>Sin grado</td>
                <td>{fuerza.Varonil.sinGrado}</td>
                <td>{fuerza.Femenino.sinGrado}</td>
                <td>{fuerza.Varonil.sinGrado + fuerza.Femenino.sinGrado}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <th>{fuerza.Varonil.total}</th>
              <th>{fuerza.Femenino.total}</th>
              <th>{fuerza.totalGeneral}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="campo">
        <label htmlFor="novedades">Novedades (opcional)</label>
        <textarea
          id="novedades"
          rows={3}
          value={novedades}
          onChange={(e) => setNovedades(e.target.value)}
          placeholder="Cualquier novedad que quieras incluir en el reporte"
        />
      </div>

      <button type="button" className="btn-primary" onClick={enviarPorWhatsapp}>
        📲 Enviar Estado de Fuerza por WhatsApp
      </button>
      {!hayNumero && config && (
        <p className="nota">
          No hay número de WhatsApp configurado: podrás elegir a quién enviarlo. Un Admin puede fijarlo en
          Relación de pagos.
        </p>
      )}
    </div>
  );
}
