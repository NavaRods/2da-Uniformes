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
import { esAdmin, esSoloLectura } from "../lib/roles";
import { useInventario } from "../lib/fuentes";
import { claveVariante } from "../lib/relacionPagos";
import { existenciasPorVariante } from "../lib/inventario";

function avisar(elemento, mensaje) {
  const telefono = elemento.telefonos?.[0];
  if (!telefono) return;
  window.open(linkWhatsapp(telefono, mensaje), "_blank");
}

export default function PedidoCard({ cliente: elemento, pedido }) {
  const { user, perfil } = useAuth();
  const soloLectura = esSoloLectura(perfil);
  // Un pedido con pagos solo lo borra un Admin; uno sin pagos, cualquiera con
  // acceso de escritura (Estado Mayor no borra nada).
  const puedeEliminar = !soloLectura && (esAdmin(perfil) || pedido.saldoPendiente === pedido.precioTotal);
  const quien = user?.displayName || user?.email || "";
  const [abonos, setAbonos] = useState([]);
  const [verHistorial, setVerHistorial] = useState(false);
  const [monto, setMonto] = useState("");
  const [motivoCambio, setMotivoCambio] = useState("");
  const [mostrarFormCambio, setMostrarFormCambio] = useState(false);
  const [error, setError] = useState("");
  const unidad = pedido.unidad || elemento.unidad;
  const inventario = useInventario(soloLectura ? null : unidad);
  const variante = {
    productoNombre: pedido.productoNombre || pedido.articulo,
    talla: pedido.talla || "",
    color: pedido.color || "",
  };
  const piezas = Number(pedido.cantidad) || 1;
  const recibidas = existenciasPorVariante(inventario).get(claveVariante(variante)) || 0;

  // Los abonos se leen solo si se abre el historial (antes se leían siempre,
  // por cada pedido de la lista).
  useEffect(() => {
    if (verHistorial) return listenAbonosDePedido(elemento.id, pedido.id, setAbonos);
  }, [verHistorial, elemento.id, pedido.id]);

  // Cada abono se sigue acumulando hasta que el saldo llega a 0: el pedido
  // no se "cierra" a mano, el estado de liquidado sale directo del saldo.
  async function onAbonar(e) {
    e.preventDefault();
    if (!monto) return;
    await registrarAbono(elemento.id, pedido.id, {
      monto,
      quienRecibio: quien,
      unidad: elemento.unidad,
      elementoNombre: elemento.nombre,
      pedido,
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

  // Al entregar, la pieza sale de "Uniforme recibido"; si no hay, se pregunta
  // (se puede entregar igual, sin descontar). Al desmarcar, regresa solo si
  // se había descontado.
  async function onEntregar(entregado) {
    let inventarioMov = null;
    if (entregado) {
      if (recibidas >= piezas) {
        inventarioMov = { unidad, variante, piezas };
      } else if (
        !confirm(
          `No hay "${pedido.articulo}" suficiente en Uniforme recibido (hay ${recibidas}, se ` +
            `necesitan ${piezas}). ¿Marcarlo como entregado de todos modos? No se descontará nada.`
        )
      ) {
        return;
      }
    } else if (pedido.descontoInventario) {
      inventarioMov = { unidad, variante, piezas };
    }
    setError("");
    try {
      await marcarEntregado(elemento.id, pedido.id, entregado, quien, inventarioMov);
    } catch {
      setError("No se pudo guardar la entrega. Verifica tu conexión e inténtalo de nuevo.");
      return;
    }
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

  // Lo abonado = precio - saldo (cada abono descuenta del saldo): no hace falta leer los abonos.
  const totalAbonado = Math.max((pedido.precioTotal || 0) - (pedido.saldoPendiente || 0), 0);

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
      await eliminarPedido(elemento.id, pedido.id, pedido.unidad || elemento.unidad);
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
          disabled={soloLectura}
        />
        Entregado
        {pedido.entregado && pedido.quienEntrego ? ` (por ${pedido.quienEntrego})` : ""}
      </label>
      {!pedido.entregado && !soloLectura && (
        <p className="nota nota-recibido">
          {recibidas > 0
            ? `En Uniforme recibido: ${recibidas}`
            : "No hay en Uniforme recibido"}
        </p>
      )}

      {!soloLectura && !liquidado && (
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

      {!soloLectura && !pedido.cambioPendiente && !mostrarFormCambio && (
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

      {!soloLectura && pedido.cambioPendiente && (
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={onResolverCambio}
        >
          ✅ Marcar cambio resuelto
        </button>
      )}

      {puedeEliminar && (
        <button type="button" className="btn-secondary btn-small" onClick={onEliminar}>
          🗑️ Eliminar pedido
        </button>
      )}

      {totalAbonado > 0 && (
        <details onToggle={(e) => setVerHistorial(e.currentTarget.open)}>
          <summary>Historial de abonos</summary>
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
