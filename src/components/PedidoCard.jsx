import { useEffect, useState } from "react";
import { listenAbonosDePedido, registrarAbono } from "../lib/pedidos";
import { linkWhatsapp, mensajeComprobante } from "../lib/whatsapp";
import { useAuth } from "../auth/AuthContext";

export default function PedidoCard({ cliente, pedido, onEntregar }) {
  const { user } = useAuth();
  const [abonos, setAbonos] = useState([]);
  const [monto, setMonto] = useState("");

  useEffect(
    () => listenAbonosDePedido(cliente.id, pedido.id, setAbonos),
    [cliente.id, pedido.id]
  );

  async function onAbonar(e) {
    e.preventDefault();
    if (!monto) return;
    await registrarAbono(cliente.id, pedido.id, {
      monto,
      quienRecibio: user?.displayName || user?.email,
    });

    const saldoPendiente = pedido.saldoPendiente - Number(monto);
    const mensaje = mensajeComprobante({
      nombre: cliente.nombre,
      articulo: pedido.articulo,
      monto,
      saldoPendiente,
    });
    window.open(linkWhatsapp(cliente.telefono, mensaje), "_blank");

    setMonto("");
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
      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!pedido.entregado}
          onChange={(e) => onEntregar(e.target.checked)}
        />
        Entregado
      </label>

      {!liquidado && (
        <form onSubmit={onAbonar} className="inline-form">
          <input
            placeholder="Monto del abono"
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <button type="submit">Registrar pago y avisar por WhatsApp</button>
        </form>
      )}

      {abonos.length > 0 && (
        <details>
          <summary>Historial de abonos ({abonos.length})</summary>
          <ul>
            {abonos.map((a) => (
              <li key={a.id}>
                ${a.monto} — {a.fechaLocal} — {a.quienRecibio}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
