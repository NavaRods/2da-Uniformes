import { useState } from "react";
import { claveVariante, resumenUniformidad, uniformidadPorEntregar } from "../lib/relacionPagos";
import { existenciasPorVariante, recibirUniforme } from "../lib/inventario";

const FILTROS = [
  ["todas", "Todas"],
  ["por-recibir", "Falta recibir"],
  ["pagadas", "Ya pagadas"],
  ["con-saldo", "Con saldo"],
];

const etiquetaVariante = ({ talla, color }) =>
  [color, talla && `talla ${talla}`].filter(Boolean).join(", ") || "Sin talla";

// Uniformidad general por entregar: cuántas piezas de cada producto y talla
// se deben, sin datos de elementos, y cuántas ya están en "Uniforme recibido".
// Lo que llega del proveedor se registra aquí (Recibir); la entrega se marca
// en el pedido de cada elemento y se descuenta de lo recibido.
// `unidad`: la Unidad donde se registra lo recibido (null = no se puede, p. ej.
// "Todas las Unidades" o solo lectura).
export default function UniformidadPendiente({ filas, inventario, unidad }) {
  const [filtro, setFiltro] = useState("todas");
  const [recibiendo, setRecibiendo] = useState(null); // clave de la variante
  const [maxRecibir, setMaxRecibir] = useState(0); // lo que aún falta de esa variante
  const [piezas, setPiezas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const existencias = existenciasPorVariante(inventario);
  const todos = uniformidadPorEntregar(filas, existencias);
  const total = resumenUniformidad(todos);
  const productos =
    filtro === "por-recibir"
      ? todos
          .map((p) => ({ ...p, variantes: p.variantes.filter((v) => v.faltaRecibir > 0) }))
          .filter((p) => p.variantes.length > 0)
      : filtro === "todas"
        ? todos
        : uniformidadPorEntregar(
            filas.filter((f) => (filtro === "pagadas" ? f.liquidado : f.debeDinero)),
            existencias
          );

  function abrir(clave, v) {
    setRecibiendo(recibiendo === clave ? null : clave);
    setMaxRecibir(v.faltaRecibir || 0);
    setPiezas(String(v.faltaRecibir || ""));
    setError("");
  }

  async function onRecibir(e, variante) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      // No se puede recibir más de lo que aún falta: si me deben 4 y ya tengo
      // 4 recibidas, no se registra un sobrante inventado.
      await recibirUniforme(unidad, variante, piezas, maxRecibir);
      setRecibiendo(null);
    } catch (err) {
      setError(err.message || "No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="tarjetas-resumen">
        <div className="card tarjeta-total">
          <span className="ficha-etiqueta">Piezas por entregar</span>
          <span className="total-monto">{total.piezas}</span>
          <span className="nota">
            de {total.productos} {total.productos === 1 ? "producto" : "productos"}
          </span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Ya recibidas</span>
          <span className="total-sub">{total.recibido}</span>
          <span className="nota">listas para entregar</span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Falta recibir</span>
          <span className="total-sub">{total.faltaRecibir}</span>
          <span className="nota">aún no llegan</span>
        </div>
      </div>

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

      {!unidad && total.piezas > 0 && (
        <p className="nota">Elige una Unidad para registrar el uniforme recibido.</p>
      )}

      {productos.length === 0 && (
        <p className="nota">
          {total.piezas === 0
            ? "No hay piezas por entregar: toda la uniformidad está entregada."
            : "Ninguna pieza coincide con el filtro."}
        </p>
      )}

      <div className="uniformidad-lista">
        {productos.map((p) => (
          <section key={p.producto} className="uniformidad-producto">
            <header className="uniformidad-cabecera">
              <span className="pago-nombre">{p.producto}</span>
              <strong>
                {p.faltaRecibir} {p.faltaRecibir === 1 ? "pieza" : "piezas"}
              </strong>
            </header>
            <ul className="uniformidad-variantes">
              {p.variantes.map((v) => {
                const variante = { productoNombre: p.producto, talla: v.talla, color: v.color };
                const clave = claveVariante(variante);
                const abierta = recibiendo === clave;
                return (
                  <li key={clave} className={v.faltaRecibir === 0 ? "variante-completa" : ""}>
                    <div className="variante-fila">
                      <span className="variante-nombre">{etiquetaVariante(v)}</span>
                      {v.faltaRecibir > 0 ? (
                        <strong className="uniformidad-cantidad" title="Faltan por recibir">
                          {v.faltaRecibir}
                        </strong>
                      ) : (
                        <span className="insignia insignia-ok">Completo</span>
                      )}
                      {unidad && v.faltaRecibir > 0 && (
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          aria-expanded={abierta}
                          onClick={() => abrir(clave, v)}
                        >
                          Recibir
                        </button>
                      )}
                    </div>
                    {abierta && (
                      <form className="recibir-form" onSubmit={(e) => onRecibir(e, variante)}>
                        <label>
                          ¿Cuántas te entregaron?
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={maxRecibir}
                            step="1"
                            value={piezas}
                            onChange={(e) => setPiezas(e.target.value)}
                            autoFocus
                          />
                        </label>
                        <button type="submit" className="btn-primary btn-small" disabled={guardando}>
                          Guardar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => setRecibiendo(null)}
                        >
                          Cancelar
                        </button>
                        {error && <p className="error">{error}</p>}
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
