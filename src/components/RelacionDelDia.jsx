import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listenAbonosDelDia } from "../lib/pedidos";
import { listenCuotasDelDia } from "../lib/cuotas";
import { guardarNumeroWhatsapp } from "../lib/configuracion";
import { useConfiguracion } from "../lib/fuentes";
import { useAuth } from "../auth/AuthContext";
import { listenRelacion, relacionDesactualizada, validarRelacionDia } from "../lib/relaciones";
import {
  linkWhatsapp,
  mensajeRelacionDia,
  normalizarTelefono,
  telefonoValido,
} from "../lib/whatsapp";
import { fechaLocalISO, formatoMoneda } from "../lib/format";
import {
  etiquetaDia,
  filaDeAbono,
  filaDeCuota,
  moverDia,
  ordenarPorHora,
  pedidoDeAbono,
  resumenDia,
} from "../lib/relacionPagos";

// Relación de pagos del día: lo cobrado ese día, en general (uniformes por
// pieza y talla; mensualidades con el nombre y los meses), sin el detalle de
// cada cobro. Desde aquí se valida la entrega del dinero al proveedor (queda
// guardada en la Relación General) y se envía el resumen por WhatsApp.
// `unidad` undefined = todas (no se puede validar: la relación es por Unidad).
export default function RelacionDelDia({ unidad, puedeConfigurarWhatsapp, puedeValidar }) {
  const { user } = useAuth();
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [abonos, setAbonos] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [relacion, setRelacion] = useState(null); // la relación validada de este día
  const [confirmando, setConfirmando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [errorValidar, setErrorValidar] = useState("");
  const [cargado, setCargado] = useState({ abonos: false, cuotas: false });
  const [error, setError] = useState("");
  const config = useConfiguracion();
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [numeroEditado, setNumeroEditado] = useState("");
  const [errorConfig, setErrorConfig] = useState("");
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const hoy = fechaLocalISO();

  function cambiarFecha(nueva) {
    // Nunca se muestran pagos de un día futuro.
    if (nueva && nueva <= hoy) setFecha(nueva);
  }

  // Al cambiar de día se vacía lo del día anterior: si la consulta nueva tarda
  // o falla, no deben seguir viéndose los datos viejos como si fueran de hoy.
  useEffect(() => {
    setAbonos([]);
    setCuotas([]);
    setFilas([]);
    setError("");
    setCargado({ abonos: false, cuotas: false });

    function alFallar(e) {
      console.error("Relación de pagos:", e);
      setError(
        e?.code === "failed-precondition"
          ? "Falta un índice en Firestore o todavía se está creando. Espera unos minutos y recarga."
          : "No se pudieron cargar los pagos de este día. Verifica tu conexión e inténtalo de nuevo."
      );
    }

    const dejarAbonos = listenAbonosDelDia(
      fecha,
      (datos) => {
        setAbonos(datos);
        setCargado((c) => ({ ...c, abonos: true }));
      },
      alFallar,
      unidad
    );
    const dejarCuotas = listenCuotasDelDia(
      fecha,
      (datos) => {
        setCuotas(datos);
        setCargado((c) => ({ ...c, cuotas: true }));
      },
      alFallar,
      unidad
    );
    return () => {
      dejarAbonos();
      dejarCuotas();
    };
  }, [fecha, unidad]);

  // Los pagos nuevos traen el nombre y el artículo copiados y no leen nada.
  // Solo los antiguos consultan al elemento/pedido, y esas lecturas se
  // recuerdan: si llega un pago nuevo y esto se repite, no se vuelve a leer.
  const lecturasPrevias = useRef({ nombres: new Map(), pedidos: new Map() });

  useEffect(() => {
    let cancelado = false;
    async function enriquecer() {
      const { nombres, pedidos } = lecturasPrevias.current;
      const nombreDe = (id) => {
        if (!nombres.has(id)) {
          nombres.set(
            id,
            getDoc(doc(db, "elementos", id)).then((s) => (s.exists() ? s.data().nombre : "?"))
          );
        }
        return nombres.get(id);
      };
      const pedidoDe = (elementoId, pedidoId) => {
        const clave = `${elementoId}/${pedidoId}`;
        if (!pedidos.has(clave)) {
          pedidos.set(
            clave,
            getDoc(doc(db, "elementos", elementoId, "pedidos", pedidoId)).then((s) =>
              s.exists() ? s.data() : null
            )
          );
        }
        return pedidos.get(clave);
      };

      const deAbonos = await Promise.all(
        abonos.map(async (a) => {
          const copiado = pedidoDeAbono(a);
          const [nombre, pedido] = await Promise.all([
            a.elementoNombre ?? nombreDe(a.elementoId),
            copiado ?? pedidoDe(a.elementoId, a.pedidoId),
          ]);
          return filaDeAbono(a, pedido, nombre);
        })
      );
      const deCuotas = await Promise.all(
        cuotas.map(async (c) => filaDeCuota(c, c.elementoNombre ?? (await nombreDe(c.elementoId))))
      );

      if (!cancelado) setFilas(ordenarPorHora([...deAbonos, ...deCuotas]));
    }
    enriquecer();
    return () => {
      cancelado = true;
    };
  }, [abonos, cuotas]);

  // La relación ya validada de este día (solo si se ve una Unidad).
  useEffect(() => {
    setRelacion(null);
    setConfirmando(false);
    setErrorValidar("");
    if (!unidad) return undefined;
    return listenRelacion(unidad, fecha, setRelacion);
  }, [unidad, fecha]);

  const resumen = resumenDia(filas);
  const esHoy = fecha === hoy;
  const numeroConfigurado = config?.whatsappNumero;
  const hayNumero = telefonoValido(numeroConfigurado);
  const numeroPrevio = normalizarTelefono(numeroEditado);

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

  // Se abre en el mismo clic (sin esperas) para que el navegador no bloquee la ventana.
  function enviarPorWhatsapp() {
    if (!hayNumero) {
      abrirConfig();
      return;
    }
    const mensaje = mensajeRelacionDia({
      fechaEtiqueta: etiquetaDia(fecha),
      resumen,
    });
    window.open(linkWhatsapp(numeroConfigurado, mensaje), "_blank");
  }
  const cargando = !error && !(cargado.abonos && cargado.cuotas);
  const desactualizada = relacionDesactualizada(relacion, resumen);

  async function validar() {
    setValidando(true);
    setErrorValidar("");
    try {
      await validarRelacionDia({
        unidad,
        fecha,
        resumen,
        quien: user?.displayName || user?.email,
        previa: relacion,
      });
      setConfirmando(false);
    } catch (e) {
      setErrorValidar(e.message || "No se pudo validar. Verifica tu conexión e inténtalo de nuevo.");
    }
    setValidando(false);
  }

  return (
    <>
      <div className="dia-nav">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => cambiarFecha(moverDia(fecha, -1))}
          aria-label="Día anterior"
        >
          ‹
        </button>
        <div className="dia-centro">
          <input type="date" value={fecha} max={hoy} onChange={(e) => cambiarFecha(e.target.value)} />
          <span className="dia-etiqueta">{etiquetaDia(fecha)}</span>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => cambiarFecha(moverDia(fecha, 1))}
          disabled={esHoy}
          aria-label="Día siguiente"
        >
          ›
        </button>
        {!esHoy && (
          <button type="button" className="btn-secondary" onClick={() => setFecha(hoy)}>
            Hoy
          </button>
        )}
      </div>

      <div className="acciones-whatsapp">
        {puedeValidar && unidad && (!relacion || desactualizada) && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setConfirmando(true)}
            disabled={cargando || !!error || resumen.movimientos === 0}
          >
            {relacion ? "🔄 Actualizar la relación validada" : "✅ Validar entrega del dinero"}
          </button>
        )}
        <button
          type="button"
          className={puedeValidar && unidad && (!relacion || desactualizada) ? "btn-secondary" : "btn-primary"}
          onClick={enviarPorWhatsapp}
          disabled={cargando || !!error}
        >
          📲 Enviar por WhatsApp
        </button>
        {puedeConfigurarWhatsapp && (
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

      {confirmando && (
        <div className="card nota-alerta">
          <p>
            ¿Ya le entregaste <strong>{formatoMoneda(resumen.total)}</strong> al proveedor por lo cobrado
            este día? Quedará guardado en la <strong>Relación General</strong>, donde marcarás las
            piezas que te vaya entregando.
          </p>
          {errorValidar && <p className="error">{errorValidar}</p>}
          <div className="acciones-fila">
            <button type="button" className="btn-secondary" onClick={() => setConfirmando(false)}>
              Todavía no
            </button>
            <button type="button" className="btn-primary" onClick={validar} disabled={validando}>
              {validando ? "Guardando…" : "Sí, validar"}
            </button>
          </div>
        </div>
      )}

      {relacion && (
        <p className={desactualizada ? "nota" : "success-msg"}>
          {desactualizada
            ? `Se validó antes (${formatoMoneda(relacion.total)}), pero después hubo cambios en los pagos de este día. Actualiza la relación.`
            : `✅ Dinero entregado al proveedor${relacion.entregadoPor ? ` (validó ${relacion.entregadoPor})` : ""}.`}
        </p>
      )}
      {puedeValidar && !unidad && (
        <p className="nota">Elige una Unidad para validar la entrega del dinero.</p>
      )}

      {!hayNumero && config && !mostrarConfig && (
        <p className="nota">
          {puedeConfigurarWhatsapp
            ? "Aún no hay un número configurado: pulsa ⚙️ para elegir a quién se envía."
            : "Aún no hay un número configurado. Pide a un Admin que lo configure."}
        </p>
      )}

      {puedeConfigurarWhatsapp && mostrarConfig && (
        <form onSubmit={guardarConfig} className="card">
          <h2>Número de WhatsApp</h2>
          <p className="nota">
            Recibirá la relación de pagos del día. Se guarda para todos los usuarios.
          </p>
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
      )}

      {error && <p className="error">{error}</p>}
      {cargando && <p className="nota">Cargando pagos…</p>}

      <div className="tarjetas-resumen">
        <div className="card tarjeta-total">
          <span className="ficha-etiqueta">Total del día</span>
          <span className="total-monto">{formatoMoneda(resumen.total)}</span>
          <span className="nota">
            {resumen.movimientos} {resumen.movimientos === 1 ? "movimiento" : "movimientos"}
          </span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Uniformes</span>
          <span className="total-sub">{formatoMoneda(resumen.totalUniformes)}</span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Mensualidades</span>
          <span className="total-sub">{formatoMoneda(resumen.totalMensualidades)}</span>
          {resumen.mesesCobrados > 0 && (
            <span className="nota">
              {resumen.mesesCobrados} {resumen.mesesCobrados === 1 ? "mes" : "meses"}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Uniformes</h2>
        {!cargando && !error && resumen.general.length === 0 && (
          <p className="nota">No se cobraron uniformes este día.</p>
        )}
        <ul className="pagos">
          {resumen.general.map((r) => (
            <li key={r.pieza} className="pago">
              <div className="pago-info">
                <span>{r.pieza || "—"}</span>
                <span className="nota">
                  {r.cantidad} {r.cantidad === 1 ? "pieza" : "piezas"}
                </span>
              </div>
              <div className="pago-monto">
                <strong>{formatoMoneda(r.total)}</strong>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Mensualidades</h2>
        {!cargando && !error && resumen.mensualidades.length === 0 && (
          <p className="nota">No se cobraron mensualidades este día.</p>
        )}
        <ul className="pagos">
          {resumen.mensualidades.map((m) => (
            <li key={m.nombre} className="pago">
              <div className="pago-info">
                <span>{m.nombre}</span>
                <span className="nota">{m.meses.join(", ")}</span>
              </div>
              <div className="pago-monto">
                <strong>{formatoMoneda(m.monto)}</strong>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="total-general">Total general del día = {formatoMoneda(resumen.total)}</p>
    </>
  );
}
