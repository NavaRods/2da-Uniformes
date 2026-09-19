import { useEffect, useState } from "react";
import {
  listenAbonosDePedido,
  registrarAbono,
  marcarEntregado,
  marcarCambioPendiente,
  eliminarPedido,
} from "../lib/pedidos";
import {
  linkWhatsapp,
  mensajeComprobante,
  mensajeEntrega,
  mensajeCambioPendiente,
} from "../lib/whatsapp";
import { useAuth } from "../auth/AuthContext";

function avisar(elemento, mensaje) {
  const telefono = elemento.telefonos?.[0];
  if (!telefono) return;
  window.open(linkWhatsapp(telefono, mensaje), "_blank");
}

export default function PedidoCard({ cliente: elemento, pedido }) {
  const { user } = useAuth();
  const quien = user?.displayName || user?.email || "";
  const [abonos, setAbonos] = useState([]);
  const [monto, setMonto] = useState("");
  const [motivoCambio, setMotivoCambio] = useState("");
  const [mostrarFormCambio, setMostrarFormCambio] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => listenAbonosDePedido(elemento.id, pedido.id, setAbonos),
    [elemento.id, pedido.id]
  );

  // Cada abono se sigue acumulando hasta que el saldo llega a 0: el pedido
  // no se "cierra" a mano, el estado de liquidado sale directo del saldo.
  async function onAbonar(e) {
    e.preventDefault();
    if (!monto) return;
    await registrarAbono(elemento.id, pedido.id, {
      monto,
      quienRecibio: quien,
      unidad: elemento.unidad,
    });

    const saldoPendiente = pedido.saldoPendiente - Number(monto);
    avisar(
      elemento,
      mensajeComprobante({
        nombre: elemento.nombre,
        articulo: pedido.articulo,
        monto,
        saldoPendiente,
        quienRecibio: quien,
      })
    );

    setMonto("");
  }

  async function onEntregar(entregado) {
    await marcarEntregado(elemento.id, pedido.id, entregado, quien);
    avisar(
      elemento,
      mensajeEntrega({
        nombre: elemento.nombre,
        articulo: pedido.articulo,
        entregado,
        quienEntrego: quien,
      })
    );
  }

  async function onMarcarCambio(e) {
    e.preventDefault();
    await marcarCambioPendiente(elemento.id, pedido.id, true, motivoCambio);
    avisar(
      elemento,
      mensajeCambioPendiente({
        nombre: elemento.nombre,
        articulo: pedido.articulo,
        pendiente: true,
        motivo: motivoCambio,
      })
    );
    setMotivoCambio("");
    setMostrarFormCambio(false);
  }

  async function onResolverCambio() {
    await marcarCambioPendiente(elemento.id, pedido.id, false, "");
    avisar(
      elemento,
      mensajeCambioPendiente({
        nombre: elemento.nombre,
        articulo: pedido.articulo,
        pendiente: false,
      })
    );
  }

  const totalAbonado = abonos.reduce((suma, a) => suma + Number(a.monto), 0);

  async function onEliminar() {
    const aviso =
      totalAbonado > 0
        ? `Se eliminarán también los pagos registrados en este pedido ($${totalAbonado}) y dejarán de aparecer en la Relación de pagos.`
        : "Este pedido no tiene pagos registrados.";
    if (!confirm(`¿Eliminar "${pedido.articulo}"? ${aviso} Esta acción no se puede deshacer.`)) {
      return;
    }
    setError("");
    try {
      await eliminarPedido(elemento.id, pedido.id);
    } catch {
      setError("No se pudo eliminar. Verifica tu conexión e inténtalo de nuevo.");
    }
  }

  const liquidado = pedido.saldoPendiente <= 0;


  return (
    <div className="card">
      <h3>
        {pedido.articulo} — ${pedido.precioTotal}
      </h3>
      <p>
        Estado: {liquidado ? "Liquidado ✅" : `Debe $${pedido.saldoPendiente}`}
      </p>

      {error && <p className="error">{error}</p>}

      {pedido.cambioPendiente && (
        <p className="aviso-cambio">
          🔁 Cambio pendiente{pedido.motivoCambio ? `: ${pedido.motivoCambio}` : ""}
        </p>
      )}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!pedido.entregado}
          onChange={(e) => onEntregar(e.target.checked)}
        />
        Entregado
        {pedido.entregado && pedido.quienEntrego ? ` (por ${pedido.quienEntrego})` : ""}
      </label>

      {!liquidado && (
        <form onSubmit={onAbonar} className="inline-form">
          <input
            placeholder="Monto del abono"
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Registrar pago y avisar por WhatsApp
          </button>
        </form>
      )}

      {!pedido.cambioPendiente && !mostrarFormCambio && (
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => setMostrarFormCambio(true)}
        >
          🔁 Marcar cambio pendiente
        </button>
      )}

      {mostrarFormCambio && (
        <form onSubmit={onMarcarCambio} className="inline-form">
          <input
            placeholder="Motivo del cambio (talla, color, defecto...)"
            value={motivoCambio}
            onChange={(e) => setMotivoCambio(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Confirmar
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMostrarFormCambio(false)}
          >
            Cancelar
          </button>
        </form>
      )}

      {pedido.cambioPendiente && (
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={onResolverCambio}
        >
          ✅ Marcar cambio resuelto
        </button>
      )}

      <button type="button" className="btn-secondary btn-small" onClick={onEliminar}>
        🗑️ Eliminar pedido
      </button>

      {abonos.length > 0 && (
        <details>
          <summary>Historial de abonos ({abonos.length})</summary>
          <ul>
            {abonos.map((a) => (
              <li key={a.id}>
                ${a.monto} — {a.fechaLocal} {a.horaLocal || ""} — {a.quienRecibio}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
