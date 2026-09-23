import { useState } from "react";
import { fijarInventario, recibidoPorProducto } from "../lib/inventario";

const etiquetaVariante = ({ talla, color }) =>
  [color, talla && `talla ${talla}`].filter(Boolean).join(", ") || "Sin talla";

// "Uniforme recibido": lo que ya llegó y espera a entregarse. Se suma desde
// Pendientes (Recibir) y se descuenta al marcar un pedido como entregado.
// Aquí solo se consulta y, si el conteo no cuadra, se corrige.
// `puedeEditar`: false en solo lectura. `varias`: muestra la Unidad de cada línea.
export default function UniformeRecibido({ inventario, puedeEditar, varias }) {
  const [editando, setEditando] = useState(null); // id del documento
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");

  const productos = recibidoPorProducto(inventario);
  const total = productos.reduce((s, p) => s + p.piezas, 0);

  async function onGuardar(e, v) {
    e.preventDefault();
    setError("");
    try {
      await fijarInventario(v.unidad, v, cantidad);
      setEditando(null);
    } catch (err) {
      setError(err.message || "No se pudo guardar. Inténtalo de nuevo.");
    }
  }

  return (
    <>
      <div className="tarjetas-resumen">
        <div className="card tarjeta-total">
          <span className="ficha-etiqueta">Uniforme recibido</span>
          <span className="total-monto">{total}</span>
          <span className="nota">
            {total === 1 ? "pieza lista" : "piezas listas"} para entregar
          </span>
        </div>
      </div>

      {productos.length === 0 && (
        <p className="nota">
          No hay uniforme recibido. Regístralo en Pendientes con el botón Recibir cuando te lo
          entreguen.
        </p>
      )}

      <div className="uniformidad-lista">
        {productos.map((p) => (
          <section key={p.producto} className="uniformidad-producto">
            <header className="uniformidad-cabecera">
              <span className="pago-nombre">{p.producto}</span>
              <strong>
                {p.piezas} {p.piezas === 1 ? "pieza" : "piezas"}
              </strong>
            </header>
            <ul className="uniformidad-variantes">
              {p.variantes.map((v) => (
                <li key={v.id}>
                  <div className="variante-fila">
                    <span className="variante-nombre">
                      <span>{etiquetaVariante(v)}</span>
                      {varias && <span className="nota">Unidad {v.unidad}</span>}
                    </span>
                    {puedeEditar && (
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        aria-expanded={editando === v.id}
                        onClick={() => {
                          setEditando(editando === v.id ? null : v.id);
                          setCantidad(String(v.cantidad));
                          setError("");
                        }}
                      >
                        Corregir
                      </button>
                    )}
                    <strong className="uniformidad-cantidad">{v.cantidad}</strong>
                  </div>
                  {editando === v.id && (
                    <form className="recibir-form" onSubmit={(e) => onGuardar(e, v)}>
                      <label>
                        Piezas que hay realmente
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          value={cantidad}
                          onChange={(e) => setCantidad(e.target.value)}
                          autoFocus
                        />
                      </label>
                      <button type="submit" className="btn-primary btn-small">
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => setEditando(null)}
                      >
                        Cancelar
                      </button>
                      {error && <p className="error">{error}</p>}
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
