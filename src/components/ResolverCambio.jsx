import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useInventario } from "../lib/fuentes";
import { claveVariante } from "../lib/relacionPagos";
import { existenciasPorVariante } from "../lib/inventario";
import { armarArticulo, resolverCambio } from "../lib/pedidos";

// Resolver un cambio en un solo paso. Casi todo se decide solo y se muestra
// como resumen ("Se hará automáticamente"); solo hay que confirmar y, si
// aplica, ajustar dos casillas:
//  - entregar ya la pieza nueva (se marca por defecto si ya hay en "Uniforme
//    recibido"),
//  - regresar la pieza devuelta a "Uniformidad disponible" (por defecto sí, salvo
//    que tenga un defecto).
export default function ResolverCambio({ elemento, pedido, onCerrar, onResuelto }) {
  const { user } = useAuth();
  const unidad = pedido.unidad || elemento.unidad;
  const piezas = Number(pedido.cantidad) || 1;
  const inventario = useInventario(unidad);
  const existencias = existenciasPorVariante(inventario);

  const producto = pedido.productoNombre || pedido.articulo;
  const anterior = { productoNombre: producto, talla: pedido.talla || "", color: pedido.color || "" };
  const nueva = {
    productoNombre: producto,
    talla: pedido.cambioTalla ?? pedido.talla ?? "",
    color: pedido.cambioColor ?? pedido.color ?? "",
  };
  const hayNueva = (existencias.get(claveVariante(nueva)) || 0) >= piezas;
  const habiaEntregado = !!pedido.entregado;
  const esDefecto = /defecto/i.test(pedido.motivoCambio || "");

  const [entregarAhora, setEntregarAhora] = useState(hayNueva);
  const [devolverAnterior, setDevolverAnterior] = useState(habiaEntregado && !esDefecto);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const textoAnterior = armarArticulo(anterior);
  const textoNueva = armarArticulo(nueva);
  const descontarNueva = entregarAhora && hayNueva;
  const mismaPieza = textoAnterior === textoNueva;

  async function confirmar() {
    setError("");
    setGuardando(true);
    try {
      await resolverCambio({
        elementoId: elemento.id,
        pedidoId: pedido.id,
        unidad,
        anterior,
        nueva,
        piezas,
        quien: user?.displayName || user?.email || "",
        entregarAhora,
        descontarNueva,
        devolverAnterior: habiaEntregado && devolverAnterior,
      });
      onResuelto({ anterior: textoAnterior, nueva: textoNueva, entregada: entregarAhora });
    } catch {
      setError("No se pudo resolver el cambio. Verifica tu conexión e inténtalo de nuevo.");
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Resolver cambio">
      <div className="modal modal-aviso">
        <h2>Resolver cambio</h2>
        {mismaPieza ? (
          <p className="cambio-de-a">
            <span>Cambio de la misma pieza:</span>
            <strong>{textoAnterior}</strong>
          </p>
        ) : (
          <p className="cambio-de-a">
            <span>{textoAnterior}</span>
            <span aria-hidden="true">→</span>
            <strong>{textoNueva}</strong>
          </p>
        )}

        <label className="checkbox">
          <input
            type="checkbox"
            checked={entregarAhora}
            onChange={(e) => setEntregarAhora(e.target.checked)}
          />
          Entregar ahora la pieza nueva
        </label>
        {entregarAhora && !hayNueva && (
          <p className="nota nota-alerta">
            No hay esa pieza en Uniformidad disponible: se registrará como entregada sin descontar nada.
          </p>
        )}

        {habiaEntregado && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={devolverAnterior}
              onChange={(e) => setDevolverAnterior(e.target.checked)}
            />
            La pieza devuelta está en buen estado y regresa a Uniformidad disponible
          </label>
        )}

        <div className="resumen-automatico">
          <strong>Se hará automáticamente</strong>
          <ul>
            <li>{mismaPieza ? "El pedido se queda igual (misma talla y color)." : `El pedido pasa a “${textoNueva}”.`}</li>
            <li>
              {entregarAhora
                ? descontarNueva
                  ? "La pieza nueva se marca como entregada y sale de Uniformidad disponible."
                  : "La pieza nueva se marca como entregada."
                : "La pieza nueva queda pendiente de entregar."}
            </li>
            {habiaEntregado && devolverAnterior && (
              <li>La pieza devuelta regresa a Uniformidad disponible (+{piezas}).</li>
            )}
            <li>El cambio deja de aparecer como pendiente.</li>
          </ul>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-acciones">
          <button type="button" className="btn-secondary" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={confirmar} disabled={guardando}>
            {guardando ? "Guardando…" : "Confirmar cambio"}
          </button>
        </div>
      </div>
    </div>
  );
}
