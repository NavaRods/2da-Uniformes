import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listenAbonosDelDia, listenCambiosPendientes } from "../lib/pedidos";
import { listenCuotasDelDia } from "../lib/cuotas";
import { fechaLocalISO, formatoMoneda } from "../lib/format";
import {
  etiquetaDia,
  filaDeAbono,
  filaDeCuota,
  moverDia,
  ordenarPorHora,
  resumenDia,
} from "../lib/relacionPagos";

const FILTROS = [
  ["todos", "Todos"],
  ["uniforme", "Uniformes"],
  ["mensualidad", "Mensualidades"],
];

export default function RelacionPagos() {
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [abonos, setAbonos] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [cambiosPendientes, setCambiosPendientes] = useState([]);
  const [vista, setVista] = useState("detalle"); // detalle | general | pendientes
  const [filtro, setFiltro] = useState("todos");
  const [cargado, setCargado] = useState({ abonos: false, cuotas: false });
  const [error, setError] = useState("");

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
      alFallar
    );
    const dejarCuotas = listenCuotasDelDia(
      fecha,
      (datos) => {
        setCuotas(datos);
        setCargado((c) => ({ ...c, cuotas: true }));
      },
      alFallar
    );
    return () => {
      dejarAbonos();
      dejarCuotas();
    };
  }, [fecha]);

  useEffect(() => listenCambiosPendientes(setCambiosPendientes), []);

  useEffect(() => {
    let cancelado = false;
    async function enriquecer() {
      // Un elemento con varios pagos se consulta una sola vez.
      const nombres = new Map();
      const nombreDe = (id) => {
        if (!nombres.has(id)) {
          nombres.set(
            id,
            getDoc(doc(db, "elementos", id)).then((s) => (s.exists() ? s.data().nombre : "?"))
          );
        }
        return nombres.get(id);
      };

      const deAbonos = await Promise.all(
        abonos.map(async (a) => {
          const [nombre, pedidoSnap] = await Promise.all([
            nombreDe(a.elementoId),
            getDoc(doc(db, "elementos", a.elementoId, "pedidos", a.pedidoId)),
          ]);
          return filaDeAbono(a, pedidoSnap.exists() ? pedidoSnap.data() : null, nombre);
        })
      );
      const deCuotas = await Promise.all(
        cuotas.map(async (c) => filaDeCuota(c, await nombreDe(c.elementoId)))
      );

      if (!cancelado) setFilas(ordenarPorHora([...deAbonos, ...deCuotas]));
    }
    enriquecer();
    return () => {
      cancelado = true;
    };
  }, [abonos, cuotas]);

  const resumen = resumenDia(filas);
  const visibles = filas.filter((f) => filtro === "todos" || f.tipo === filtro);
  const esHoy = fecha === hoy;
  const cargando = !error && !(cargado.abonos && cargado.cuotas);

  return (
    <div className="page">
      <h1>Relación de pagos</h1>

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
          ["pendientes", `Cambios${cambiosPendientes.length ? ` (${cambiosPendientes.length})` : ""}`],
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

      {vista === "detalle" && (
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
                  <span className={`insignia insignia-${f.tipo === "mensualidad" ? "cuota" : f.etiqueta === "Liquidado" ? "ok" : "abono"}`}>
                    {f.etiqueta}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {vista === "general" && (
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
                  <span>
                    {resumen.mesesCobrados} × Mensualidad
                  </span>
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

      {vista === "pendientes" && (
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
