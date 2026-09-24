import { useEffect, useState } from "react";
import { estadoRecepcion, faltaDeLaPieza, listenRelaciones, recibirDeRelacion } from "../lib/relaciones";
import { etiquetaDia } from "../lib/relacionPagos";
import { formatoMoneda } from "../lib/format";

// [clave, botón, qué muestra]
const FILTROS = [
  ["todas", "Todas", "Todas las relaciones de pagos que ya validaste, la más reciente primero."],
  ["por-recibir", "Por recibir", "Relaciones a las que todavía les faltan piezas por llegar del proveedor."],
  ["recibidas", "Recibidas", "Relaciones cuyas piezas ya llegaron completas."],
];

const nombrePieza = ({ productoNombre, color, talla }) =>
  `${productoNombre}${color ? ` ${color}` : ""}${talla ? ` (${talla})` : ""}`;

const ETIQUETA_ESTADO = {
  pendiente: ["insignia-cuota", "Sin recibir"],
  parcial: ["insignia-abono", "Recibido en parte"],
  completo: ["insignia-ok", "Todo recibido"],
  "sin-piezas": ["insignia-abono", "Sin piezas"],
};

function FilaPieza({ relacion, indice, puedeRecibir }) {
  const pieza = relacion.piezas[indice];
  const falta = faltaDeLaPieza(pieza);
  const recibidas = Math.min(pieza.recibido || 0, pieza.cantidad);
  // El formulario se abre solo al tocar "Recibir": con todas las piezas
  // abiertas a la vez la tarjeta era ilegible (una caja de texto por fila).
  const [abierta, setAbierta] = useState(false);
  const [cantidad, setCantidad] = useState(String(falta));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function abrir() {
    setCantidad(String(falta));
    setError("");
    setAbierta(true);
  }

  async function recibir(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      await recibirDeRelacion(relacion, new Map([[indice, cantidad]]));
      setAbierta(false);
    } catch (err) {
      setError(err.message || "No se pudo guardar. Inténtalo de nuevo.");
    }
    setGuardando(false);
  }

  return (
    <li className={falta === 0 ? "variante-completa" : ""}>
      <div className="variante-fila">
        <span className="variante-nombre">
          {nombrePieza(pieza)}
          <span className="nota">
            {formatoMoneda(pieza.total)} · recibidas {recibidas} de {pieza.cantidad}
          </span>
        </span>
        {falta === 0 ? (
          <span className="insignia insignia-ok">Completo</span>
        ) : (
          puedeRecibir && (
            <button
              type="button"
              className="btn-secondary btn-small"
              aria-expanded={abierta}
              onClick={() => (abierta ? setAbierta(false) : abrir())}
            >
              Recibir
            </button>
          )
        )}
      </div>
      {abierta && (
        <form className="recibir-form" onSubmit={recibir}>
          <label>
            ¿Cuántas te entregaron?
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={falta}
              step="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" className="btn-primary btn-small" disabled={guardando}>
            Guardar
          </button>
          <button type="button" className="btn-secondary btn-small" onClick={() => setAbierta(false)}>
            Cancelar
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </li>
  );
}

function TarjetaRelacion({ relacion, abierta, alternar, puedeRecibir, mostrarUnidad }) {
  const recepcion = estadoRecepcion(relacion.piezas);
  const [claseEstado, textoEstado] = ETIQUETA_ESTADO[recepcion.estado];
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function recibirTodo() {
    setError("");
    setGuardando(true);
    try {
      const todo = new Map(
        relacion.piezas.map((p, i) => [i, faltaDeLaPieza(p)]).filter(([, n]) => n > 0)
      );
      await recibirDeRelacion(relacion, todo);
    } catch (err) {
      setError(err.message || "No se pudo guardar. Inténtalo de nuevo.");
    }
    setGuardando(false);
  }

  return (
    <li className="tarjeta-cambio">
      <button
        type="button"
        className="relacion-cabecera"
        aria-expanded={abierta}
        onClick={alternar}
      >
        <span className="relacion-titulo">
          <strong>{etiquetaDia(relacion.fecha)}</strong>
          {mostrarUnidad && <span className="nota">Unidad {relacion.unidad}</span>}
        </span>
        <span className="relacion-datos">
          <strong>{formatoMoneda(relacion.total)}</strong>
          <span className={`insignia ${claseEstado}`}>{textoEstado}</span>
        </span>
      </button>
      <p className="nota">
        💵 Dinero entregado
        {relacion.entregadoPor ? ` (validó ${relacion.entregadoPor})` : ""}
        {recepcion.esperadas > 0 && ` · 📦 ${recepcion.recibidas} de ${recepcion.esperadas} piezas recibidas`}
      </p>

      {abierta && (
        <>
          {relacion.piezas.length > 0 && (
            <ul className="uniformidad-variantes">
              {/* Las que faltan primero, para no tener que buscarlas entre las ya completas. */}
              {relacion.piezas
                .map((p, i) => ({ p, i }))
                .sort((a, b) => faltaDeLaPieza(b.p) - faltaDeLaPieza(a.p))
                .map(({ p, i }) => (
                  <FilaPieza
                    key={`${p.productoNombre}|${p.talla}|${p.color}`}
                    relacion={relacion}
                    indice={i}
                    puedeRecibir={puedeRecibir}
                  />
                ))}
            </ul>
          )}
          {relacion.mensualidades?.length > 0 && (
            <>
              <p className="filtros-titulo">Mensualidades de ese día</p>
              <ul className="uniformidad-variantes">
                {relacion.mensualidades.map((m) => (
                  <li key={m.nombre}>
                    <div className="variante-fila">
                      <span className="variante-nombre">
                        {m.nombre}
                        <span className="nota">{m.meses.join(", ")}</span>
                      </span>
                      <strong>{formatoMoneda(m.monto)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {error && <p className="error">{error}</p>}
          {puedeRecibir && recepcion.faltan > 0 && (
            <button type="button" className="btn-primary" onClick={recibirTodo} disabled={guardando}>
              {guardando ? "Guardando…" : `Recibir todo lo que falta (${recepcion.faltan})`}
            </button>
          )}
        </>
      )}
    </li>
  );
}

// Relación General: todas las relaciones de pagos que ya se validaron (una
// por día). Aquí se marca lo que el proveedor va entregando, en parte o
// completo; esas piezas pasan a "Uniformidad disponible" (en Uniformes y
// Mensualidades), de donde se descuentan al entregarlas a cada elemento.
// `unidad` vacío = todas las Unidades visibles. `puedeRecibir`: false en solo
// lectura o si no se eligió una sola Unidad.
export default function RelacionGeneral({ unidad, puedeRecibir }) {
  const [relaciones, setRelaciones] = useState(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [abierta, setAbierta] = useState("");

  useEffect(() => {
    setRelaciones(null);
    setError("");
    return listenRelaciones(unidad, setRelaciones, () =>
      setError("No se pudieron cargar las relaciones. Verifica tu conexión e inténtalo de nuevo.")
    );
  }, [unidad]);

  const visibles = (relaciones || []).filter((r) => {
    const { estado } = estadoRecepcion(r.piezas);
    if (filtro === "por-recibir") return estado === "pendiente" || estado === "parcial";
    if (filtro === "recibidas") return estado === "completo" || estado === "sin-piezas";
    return true;
  });
  const faltan = (relaciones || []).reduce((s, r) => s + estadoRecepcion(r.piezas).faltan, 0);

  return (
    <>
      <p className="ayuda">
        Aquí están las relaciones de pagos que ya validaste (una por día). Cuando el proveedor te
        entregue uniformes, abre la relación y toca <strong>Recibir</strong>: pasan a{" "}
        <strong>Uniformidad disponible</strong>.
      </p>

      {error && <p className="error">{error}</p>}
      {!error && relaciones === null && <p className="nota">Cargando relaciones…</p>}

      {relaciones && (
        <>
          <div className="tarjetas-resumen">
            <div className="card tarjeta-total">
              <span className="ficha-etiqueta">Piezas por recibir</span>
              <span className="total-monto">{faltan}</span>
              <span className="nota">del proveedor</span>
            </div>
            <div className="card">
              <span className="ficha-etiqueta">Relaciones</span>
              <span className="total-sub">{relaciones.length}</span>
              <span className="nota">validadas</span>
            </div>
          </div>

          <p className="filtros-titulo">¿Cuáles quieres ver?</p>
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
          <p className="ayuda">{FILTROS.find(([clave]) => clave === filtro)[2]}</p>

          {relaciones.length === 0 && (
            <p className="nota">
              Todavía no hay relaciones validadas. En <strong>Del día</strong>, toca “Validar entrega del
              dinero” para guardar la de un día.
            </p>
          )}
          {relaciones.length > 0 && visibles.length === 0 && (
            <p className="nota">Ninguna relación coincide con el filtro.</p>
          )}

          <ul className="lista-tarjetas">
            {visibles.map((r) => {
              const clave = `${r.unidad}~${r.fecha}`;
              return (
                <TarjetaRelacion
                  key={clave}
                  relacion={r}
                  abierta={abierta === clave}
                  alternar={() => setAbierta(abierta === clave ? "" : clave)}
                  puedeRecibir={puedeRecibir}
                  mostrarUnidad={!unidad}
                />
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
