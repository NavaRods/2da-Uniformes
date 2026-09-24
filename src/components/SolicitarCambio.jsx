import { useState } from "react";
import { useCatalogo } from "../lib/fuentes";
import { requiereTalla, TALLA_TIPO } from "../lib/catalogo";
import { solicitarCambio, armarArticulo } from "../lib/pedidos";

const MOTIVOS = [
  "Talla equivocada",
  "Color equivocado",
  "Defecto de la pieza",
  "Otro",
];

// Formulario para pedir el cambio de una pieza: por qué, y qué talla/color
// se quiere en su lugar. Al guardar, la pieza nueva pasa a la Relación de
// pagos como pendiente (por recibir y por entregar).
export default function SolicitarCambio({ elementoId, pedido, onCancelar, onSolicitado }) {
  const catalogo = useCatalogo();
  const producto = catalogo.find((p) => p.nombre === (pedido.productoNombre || pedido.articulo));
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalle, setDetalle] = useState("");
  const [talla, setTalla] = useState(pedido.talla || "");
  const [color, setColor] = useState(pedido.color || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const tieneTallas = producto && producto.tallaTipo !== TALLA_TIPO.NINGUNA;
  const tieneColores = producto?.colores?.length > 0;
  const sinCambio = talla === (pedido.talla || "") && color === (pedido.color || "");
  const falta = tieneTallas && requiereTalla(producto) && !talla.trim();

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    const motivoCompleto = detalle.trim() ? `${motivo}: ${detalle.trim()}` : motivo;
    try {
      await solicitarCambio(elementoId, pedido.id, {
        motivo: motivoCompleto,
        talla,
        color,
      });
      onSolicitado({
        motivo: motivoCompleto,
        nueva: armarArticulo({ productoNombre: pedido.productoNombre || pedido.articulo, talla, color }),
      });
    } catch {
      setError("No se pudo guardar el cambio. Verifica tu conexión e inténtalo de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="subformulario">
      <h4>Pedir cambio de esta pieza</h4>

      <div className="campo">
        <label htmlFor={`motivo-${pedido.id}`}>¿Por qué se cambia?</label>
        <select id={`motivo-${pedido.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      {tieneTallas && (
        <div className="campo">
          <label htmlFor={`talla-${pedido.id}`}>Talla que necesita</label>
          {producto.tallaTipo === TALLA_TIPO.LISTA ? (
            <select id={`talla-${pedido.id}`} value={talla} onChange={(e) => setTalla(e.target.value)}>
              <option value="">Elige una talla…</option>
              {producto.tallas.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          ) : (
            <input
              id={`talla-${pedido.id}`}
              value={talla}
              onChange={(e) => setTalla(e.target.value)}
              placeholder="Talla (a la medida)"
            />
          )}
        </div>
      )}

      {tieneColores && (
        <div className="campo">
          <label htmlFor={`color-${pedido.id}`}>Color que necesita</label>
          <select id={`color-${pedido.id}`} value={color} onChange={(e) => setColor(e.target.value)}>
            {producto.colores.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      <div className="campo">
        <label htmlFor={`detalle-${pedido.id}`}>Detalle (opcional)</label>
        <input
          id={`detalle-${pedido.id}`}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Ej. le queda grande de la cintura"
        />
      </div>

      {sinCambio && (tieneTallas || tieneColores) && (
        <p className="nota">
          Es la misma talla y color: se tomará como un cambio de la misma pieza (por defecto o
          cambio directo).
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <div className="acciones-fila">
        <button type="button" className="btn-secondary" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={guardando || falta}>
          {guardando ? "Guardando…" : "Guardar cambio"}
        </button>
      </div>
    </form>
  );
}
