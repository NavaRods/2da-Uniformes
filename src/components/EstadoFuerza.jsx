import { useEffect, useState } from "react";
import { estadoDeFuerza, CATEGORIAS } from "../lib/grados";
import { estaDeBaja, normalizarEstado } from "../lib/asistencia";
import { guardarNumeroWhatsapp, listenConfiguracion } from "../lib/configuracion";
import { etiquetaDia } from "../lib/relacionPagos";
import { linkWhatsapp, mensajeEstadoFuerza, normalizarTelefono, telefonoValido } from "../lib/whatsapp";
import { useAuth } from "../auth/AuthContext";

// Estado de Fuerza de una Unidad en el día seleccionado: cuenta a quienes se
// marcaron como Asistencia ese día (no todo el padrón), por categoría militar
// (Jefes, Oficiales, Clases, Cadetes, Tropas, Reclutas) y Varonil/Femenino,
// con una fila de SubTotal (suma de cada columna) y otra de Total (suma
// general). Se genera solo al pedirlo con el botón: si se genera sin haber
// pasado lista, todo sale en 0 (nadie está marcado como Asistencia todavía),
// y se puede volver a generar cuando se quiera.
export default function EstadoFuerza({ elementos, asistencia, grados, unidad, fecha }) {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const [novedades, setNovedades] = useState("");
  const [config, setConfig] = useState(null);
  const [generado, setGenerado] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [numeroEditado, setNumeroEditado] = useState("");
  const [errorConfig, setErrorConfig] = useState("");
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  useEffect(() => listenConfiguracion(setConfig, () => setConfig({})), []);
  // Cambiar de día o de Unidad vuelve a pedir generarlo: no se debe arrastrar
  // un Estado de Fuerza que ya no corresponde a lo que se está viendo.
  useEffect(() => setGenerado(false), [unidad, fecha]);

  const presentes = elementos.filter(
    (el) => !estaDeBaja(el, fecha) && normalizarEstado(asistencia[el.id]) === "asistencia"
  );
  const fuerza = estadoDeFuerza(presentes, grados);
  const numeroConfigurado = config?.whatsappNumero;
  const hayNumero = telefonoValido(numeroConfigurado);
  const numeroPrevio = normalizarTelefono(numeroEditado);

  // Mismo número que usa la Relación de pagos (se guarda una sola vez para
  // toda la app): aquí se puede consultar y cambiar sin salir de esta pantalla.
  function abrirConfig() {
    setNumeroEditado(numeroConfigurado || "");
    setErrorConfig("");
    setMostrarConfig((v) => !v);
  }

  async function guardarConfig(e) {
    e.preventDefault();
    if (!telefonoValido(numeroPrevio)) {
      setErrorConfig("Escribe un número válido: 10 dígitos, o con código de país.");
      return;
    }
    setGuardandoConfig(true);
    setErrorConfig("");
    try {
      await guardarNumeroWhatsapp(numeroPrevio);
      setMostrarConfig(false);
    } catch {
      setErrorConfig("No se pudo guardar el número. Verifica tu conexión e inténtalo de nuevo.");
    }
    setGuardandoConfig(false);
  }

  // Se abre en el mismo clic para que el navegador no bloquee la ventana. Sin
  // un número configurado, WhatsApp deja elegir a quién mandarlo.
  function enviarPorWhatsapp() {
    const mensaje = mensajeEstadoFuerza({
      unidad,
      fechaEtiqueta: etiquetaDia(fecha),
      fuerza,
      novedades,
    });
    window.open(linkWhatsapp(hayNumero ? numeroConfigurado : "", mensaje), "_blank");
  }

  function formularioConfig() {
    if (!esAdmin || !mostrarConfig) return null;
    return (
      <form onSubmit={guardarConfig} className="card">
        <h2>Número de WhatsApp</h2>
        <p className="nota">Recibirá el Estado de Fuerza. Se guarda para todos los usuarios.</p>
        <div className="campo">
          <label>Número</label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="10 dígitos, ej. 55 1234 5678"
            value={numeroEditado}
            onChange={(e) => setNumeroEditado(e.target.value)}
            autoFocus
          />
          {numeroEditado && (
            <p className="nota">
              {telefonoValido(numeroPrevio) ? `Se enviará a +${numeroPrevio}` : "Número incompleto"}
            </p>
          )}
        </div>
        {errorConfig && <p className="error">{errorConfig}</p>}
        <div className="inline-form acciones-pedido">
          <button type="button" className="btn-secondary" onClick={() => setMostrarConfig(false)}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={guardandoConfig}>
            {guardandoConfig ? "Guardando..." : "Guardar número"}
          </button>
        </div>
      </form>
    );
  }

  if (!generado) {
    return (
      <div className="card estado-fuerza">
        <h2>Estado de Fuerza</h2>
        <p className="nota">
          {unidad} · {etiquetaDia(fecha)}
        </p>
        <p className="nota">
          Cuenta a quienes se marquen como Asistencia este día. Pasa lista primero en la
          pestaña "Lista" y después genera el Estado de Fuerza; si lo generas sin haber
          pasado lista, saldrá todo en 0.
        </p>
        <div className="acciones-pedido">
          <button type="button" className="btn-primary" onClick={() => setGenerado(true)}>
            Generar Estado de Fuerza
          </button>
          {esAdmin && (
            <button
              type="button"
              className="btn-secondary"
              onClick={abrirConfig}
              aria-expanded={mostrarConfig}
              aria-label="Configurar número de WhatsApp"
              title="Configurar número de WhatsApp"
            >
              ⚙️
            </button>
          )}
        </div>
        {formularioConfig()}
      </div>
    );
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
              <th>Jerarquía</th>
              <th>Varonil</th>
              <th>Femenino</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIAS.map((c) => (
              <tr key={c}>
                <td>{c}</td>
                <td>{fuerza.Varonil[c]}</td>
                <td>{fuerza.Femenino[c]}</td>
              </tr>
            ))}
            {(fuerza.Varonil.sinGrado > 0 || fuerza.Femenino.sinGrado > 0) && (
              <tr>
                <td>Sin grado</td>
                <td>{fuerza.Varonil.sinGrado}</td>
                <td>{fuerza.Femenino.sinGrado}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th>SubTotal</th>
              <th>{fuerza.Varonil.total}</th>
              <th>{fuerza.Femenino.total}</th>
            </tr>
            <tr>
              <th>Total</th>
              <th colSpan={2}>{fuerza.totalGeneral}</th>
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

      <div className="acciones-pedido">
        <button type="button" className="btn-secondary" onClick={() => setGenerado(false)}>
          🔄 Regenerar
        </button>
        <button type="button" className="btn-primary" onClick={enviarPorWhatsapp}>
          📲 Enviar Estado de Fuerza por WhatsApp
        </button>
        {esAdmin && (
          <button
            type="button"
            className="btn-secondary"
            onClick={abrirConfig}
            aria-expanded={mostrarConfig}
            aria-label="Configurar número de WhatsApp"
            title="Configurar número de WhatsApp"
          >
            ⚙️
          </button>
        )}
      </div>

      {!hayNumero && config && !mostrarConfig && (
        <p className="nota">
          {esAdmin
            ? "Aún no hay un número configurado: pulsa ⚙️ para elegir a quién se envía."
            : "Aún no hay un número configurado. Pide a un Admin que lo configure."}
        </p>
      )}

      {formularioConfig()}
    </div>
  );
}
