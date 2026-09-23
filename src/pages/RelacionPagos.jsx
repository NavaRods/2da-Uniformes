import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  listenAbonosDelDia,
  listenCambiosPendientes,
  listenPedidosPendientes,
} from "../lib/pedidos";
import { listenCuotasDelDia } from "../lib/cuotas";
import { guardarNumeroWhatsapp } from "../lib/configuracion";
import { useConfiguracion } from "../lib/fuentes";
import {
  linkWhatsapp,
  mensajeRelacionDia,
  normalizarTelefono,
  telefonoValido,
} from "../lib/whatsapp";
import { fechaLocalISO, formatoMoneda } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import { esAdmin, veTodasLasUnidades } from "../lib/roles";
import {
  etiquetaDia,
  filaDeAbono,
  filaDeCuota,
  filaDePedido,
  moverDia,
  ordenarPorHora,
  pedidoDeAbono,
  pendientesPorElemento,
  resumenDia,
  resumenPendientes,
} from "../lib/relacionPagos";

const FILTROS = [
  ["todos", "Todos"],
  ["uniforme", "Uniformes"],
  ["mensualidad", "Mensualidades"],
];

const FILTROS_PENDIENTES = [
  ["todos", "Todos"],
  ["debe", "Con deuda"],
  ["sin-entregar", "Sin entregar"],
];

export default function RelacionPagos() {
  const { perfil } = useAuth();
  // Admin/Super Admin/Estado Mayor ven todas las Unidades; Responsable e
  // Instructor, solo la suya.
  const unidadFiltro = veTodasLasUnidades(perfil) ? undefined : perfil?.unidad;
  const puedeConfigurarWhatsapp = esAdmin(perfil);
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [abonos, setAbonos] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [cambiosPendientes, setCambiosPendientes] = useState([]);
  const [pedidosPend, setPedidosPend] = useState([]);
  const [nombresPend, setNombresPend] = useState({});
  const [cargadoPend, setCargadoPend] = useState(false);
  const [vista, setVista] = useState("dia"); // dia | pendientes | cambios
  const [subVista, setSubVista] = useState("detalle"); // detalle | general
  const [filtro, setFiltro] = useState("todos");
  const [filtroPend, setFiltroPend] = useState("todos");
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
      unidadFiltro
    );
    const dejarCuotas = listenCuotasDelDia(
      fecha,
      (datos) => {
        setCuotas(datos);
        setCargado((c) => ({ ...c, cuotas: true }));
      },
      alFallar,
      unidadFiltro
    );
    return () => {
      dejarAbonos();
      dejarCuotas();
    };
  }, [fecha, unidadFiltro]);

  useEffect(
    () => listenCambiosPendientes(setCambiosPendientes, undefined, unidadFiltro),
    [unidadFiltro]
  );

  // Solo se abren los pedidos pendientes al entrar a esa pestaña: la
  // consulta es de todos los días y no debe costar lecturas mientras se
  // está viendo el resumen del día.
  useEffect(() => {
    if (vista !== "pendientes") return undefined;
    setPedidosPend([]);
    setCargadoPend(false);
    return listenPedidosPendientes(
      (datos) => {
        setPedidosPend(datos);
        setCargadoPend(true);
      },
      (e) => {
        console.error("Pedidos pendientes:", e);
        setCargadoPend(true);
      },
      unidadFiltro
    );
  }, [vista, unidadFiltro]);

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

  // Los pedidos no guardan el nombre del elemento: se usa la misma caché de
  // lecturas que la vista del día (una sola lectura por elemento).
  useEffect(() => {
    let cancelado = false;
    if (pedidosPend.length === 0) {
      setNombresPend({});
      return () => {
        cancelado = true;
      };
    }
    (async () => {
      const { nombres } = lecturasPrevias.current;
      const ids = [...new Set(pedidosPend.map((p) => p.elementoId))];
      const entradas = await Promise.all(
        ids.map(async (id) => {
          if (!nombres.has(id)) {
            nombres.set(
              id,
              getDoc(doc(db, "elementos", id)).then((s) =>
                s.exists() ? s.data().nombre : "?"
              )
            );
          }
          return [id, await nombres.get(id)];
        })
      );
      if (!cancelado) setNombresPend(Object.fromEntries(entradas));
    })();
    return () => {
      cancelado = true;
    };
  }, [pedidosPend]);

  const filasPendientes = useMemo(
    () =>
      pedidosPend.map((p) =>
        filaDePedido({ ...p, elementoNombre: nombresPend[p.elementoId] || "" })
      ),
    [pedidosPend, nombresPend]
  );
  const resumenPend = resumenPendientes(filasPendientes);
  const gruposPend = pendientesPorElemento(filasPendientes);
  const gruposVisibles = gruposPend
    .map((g) => ({
      ...g,
      pedidos: g.pedidos.filter(
        (f) =>
          filtroPend === "todos" ||
          (filtroPend === "debe" && f.debeDinero) ||
          (filtroPend === "sin-entregar" && f.faltaEntregar)
      ),
    }))
    .filter((g) => g.pedidos.length > 0);

  const resumen = resumenDia(filas);
  const visibles = filas.filter((f) => filtro === "todos" || f.tipo === filtro);
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

  return (
    <div className="page">
      <h1>Relación de pagos</h1>

      <div className="tabs" role="tablist">
        {[
          ["dia", "Del día"],
          ["pendientes", "Por cobrar"],
          ["cambios", `Cambios${cambiosPendientes.length ? ` (${cambiosPendientes.length})` : ""}`],
        ].map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={vista === clave}
            className={`tab ${vista === clave ? "activo" : ""}`}
            onClick={() => setVista(clave)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {vista === "dia" && (
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
              <input
                type="date"
                value={fecha}
                max={hoy}
                onChange={(e) => cambiarFecha(e.target.value)}
              />
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
            <button
              type="button"
              className="btn-primary"
              onClick={enviarPorWhatsapp}
              disabled={cargando || !!error}
            >
              📲 Enviar relación del día por WhatsApp
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
                    {telefonoValido(numeroPrevio)
                      ? `Se enviará a +${numeroPrevio}`
                      : "Número incompleto"}
                  </p>
                )}
              </div>
              {errorConfig && <p className="error">{errorConfig}</p>}
              <div className="inline-form acciones-pedido">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMostrarConfig(false)}
                >
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

          <div className="tabs" role="tablist">
            {[
              ["detalle", "Detalle"],
              ["general", "General"],
            ].map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                role="tab"
                aria-selected={subVista === clave}
                className={`tab ${subVista === clave ? "activo" : ""}`}
                onClick={() => setSubVista(clave)}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {subVista === "detalle" && (
            <>
              <div className="filtros">
                {FILTROS.map(([clave, etiqueta]) => (
                  <button
                    key={clave}
                    type="button"
                    className={`chip ${filtro === clave ? "activo" : ""}`}
                    aria-pressed={filtro === clave}
                    onClick={() => setFiltro(clave)}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>

              {!cargando && !error && visibles.length === 0 && (
                <p className="nota">Sin pagos registrados este día.</p>
              )}
              <ul className="pagos">
                {visibles.map((f) => (
                  <li key={f.id} className="pago">
                    <div className="pago-info">
                      <Link to={`/elementos/${f.elementoId}`} className="pago-nombre">
                        {f.elementoNombre}
                      </Link>
                      <span>{f.concepto}</span>
                      <span className="nota">
                        {f.horaLocal} · recibió {f.quienRecibio || "—"}
                      </span>
                    </div>
                    <div className="pago-monto">
                      <strong>{formatoMoneda(f.monto)}</strong>
                      <span
                        className={`insignia insignia-${
                          f.tipo === "mensualidad"
                            ? "cuota"
                            : f.etiqueta === "Liquidado"
                              ? "ok"
                              : "abono"
                        }`}
                      >
                        {f.etiqueta}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {subVista === "general" && (
            <>
              <p className="nota">Solo piezas, tallas y montos — sin datos de elementos.</p>
              {!cargando && !error && resumen.general.length === 0 && resumen.mesesCobrados === 0 && (
                <p className="nota">Sin movimientos este día.</p>
              )}
              <ul className="pagos">
                {resumen.general.map((r) => (
                  <li key={r.pieza} className="pago">
                    <div className="pago-info">
                      <span>
                        {r.cantidad} × {r.pieza || "—"}
                      </span>
                    </div>
                    <div className="pago-monto">
                      <strong>{formatoMoneda(r.total)}</strong>
                    </div>
                  </li>
                ))}
                {resumen.mesesCobrados > 0 && (
                  <li className="pago">
                    <div className="pago-info">
                      <span>{resumen.mesesCobrados} × Mensualidad</span>
                    </div>
                    <div className="pago-monto">
                      <strong>{formatoMoneda(resumen.totalMensualidades)}</strong>
                    </div>
                  </li>
                )}
              </ul>
              <p className="total-general">Total general del día = {formatoMoneda(resumen.total)}</p>
            </>
          )}
        </>
      )}

      {vista === "pendientes" && (
        <>
          <p className="nota">
            Uniformes con saldo pendiente o sin entregar, de todos los días — agrupados por
            elemento.
          </p>

          <div className="tarjetas-resumen">
            <div className="card tarjeta-total">
              <span className="ficha-etiqueta">Por cobrar</span>
              <span className="total-monto">{formatoMoneda(resumenPend.porCobrar)}</span>
              <span className="nota">
                de {formatoMoneda(resumenPend.valorTotal)} en {resumenPend.pedidos}{" "}
                {resumenPend.pedidos === 1 ? "pedido" : "pedidos"}
              </span>
            </div>
            <div className="card">
              <span className="ficha-etiqueta">Ya pagado</span>
              <span className="total-sub">{formatoMoneda(resumenPend.pagado)}</span>
              <span className="nota">
                en {resumenPend.elementos}{" "}
                {resumenPend.elementos === 1 ? "elemento" : "elementos"}
              </span>
            </div>
            <div className="card">
              <span className="ficha-etiqueta">Con deuda</span>
              <span className="total-sub">{resumenPend.conDeuda}</span>
              <span className="nota">
                {resumenPend.conDeuda === 1 ? "pedido" : "pedidos"} sin liquidar
              </span>
            </div>
            <div className="card">
              <span className="ficha-etiqueta">Sin entregar</span>
              <span className="total-sub">{resumenPend.sinEntregar}</span>
              <span className="nota">
                {resumenPend.sinEntregar === 1 ? "pieza" : "piezas"} por entregar
              </span>
            </div>
          </div>

          <div className="filtros">
            {FILTROS_PENDIENTES.map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                className={`chip ${filtroPend === clave ? "activo" : ""}`}
                aria-pressed={filtroPend === clave}
                onClick={() => setFiltroPend(clave)}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {!cargadoPend && <p className="nota">Cargando pedidos…</p>}
          {cargadoPend && gruposVisibles.length === 0 && (
            <p className="nota">
              {filasPendientes.length === 0
                ? "No hay uniformes pendientes: todo está pagado y entregado."
                : "Ningún pedido coincide con el filtro."}
            </p>
          )}

          <div className="grupos-pendientes">
            {gruposVisibles.map((g) => (
              <section key={g.elementoId} className="card grupo-pendiente">
                <header className="grupo-cabecera">
                  <Link to={`/elementos/${g.elementoId}`} className="pago-nombre">
                    {g.elementoNombre || "?"}
                  </Link>
                  <div className="grupo-totales">
                    {g.porCobrar > 0 && (
                      <span className="insignia insignia-abono">
                        Debe {formatoMoneda(g.porCobrar)}
                      </span>
                    )}
                    {g.porCobrar === 0 && (
                      <span className="insignia insignia-ok">Al corriente</span>
                    )}
                    {g.sinEntregar > 0 && (
                      <span className="insignia insignia-cuota">
                        {g.sinEntregar} sin entregar
                      </span>
                    )}
                  </div>
                </header>
                <p className="nota">
                  Pagado {formatoMoneda(g.pagado)} de {formatoMoneda(g.valorTotal)} ·{" "}
                  {g.pedidos.length} {g.pedidos.length === 1 ? "pieza" : "piezas"}
                </p>
                <ul className="pagos">
                  {g.pedidos.map((f) => {
                    const pct =
                      f.precioTotal > 0
                        ? Math.min(100, Math.round((f.pagado / f.precioTotal) * 100))
                        : 100;
                    return (
                      <li key={f.id} className="pago">
                        <div className="pago-info">
                          <span>{f.articulo}</span>
                          <span className="nota">
                            Pagado {formatoMoneda(f.pagado)} de {formatoMoneda(f.precioTotal)} (
                            {pct}%)
                          </span>
                          <div
                            className="barra-progreso"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <span className="barra-progreso-relleno" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="pago-monto">
                          <strong>
                            {f.debeDinero ? formatoMoneda(f.saldoPendiente) : "Liquidado"}
                          </strong>
                          <span
                            className={`insignia ${
                              f.entregado ? "insignia-ok" : "insignia-cuota"
                            }`}
                          >
                            {f.entregado ? "Entregado" : "Sin entregar"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {vista === "cambios" && (
        <>
          <p className="nota">Piezas con cambio por resolver, de todos los días.</p>
          {cambiosPendientes.length === 0 && <p className="nota">No hay cambios pendientes.</p>}
          <ul className="pagos">
            {cambiosPendientes.map((c) => (
              <li key={c.id} className="pago">
                <div className="pago-info">
                  <Link to={`/elementos/${c.elementoId}`} className="pago-nombre">
                    {c.articulo}
                  </Link>
                  {c.motivoCambio && <span className="nota">{c.motivoCambio}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
