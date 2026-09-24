import { useEffect, useState } from "react";
import {
  listenAbonosDePedido,
  registrarAbono,
  marcarEntregado,
  cancelarCambio,
  eliminarPedido,
} from "../lib/pedidos";
import {
  mensajeComprobante,
  mensajeEntrega,
  mensajeCambioPendiente,
  mensajeCambioResuelto,
} from "../lib/whatsapp";
import { useAuth } from "../auth/AuthContext";
import { esAdmin, esSoloLectura } from "../lib/roles";
import { useInventario } from "../lib/fuentes";
import { claveVariante } from "../lib/relacionPagos";
import { existenciasPorVariante } from "../lib/inventario";
import { formatoMoneda } from "../lib/format";
import { useAviso } from "./AvisoProvider";
import BarraPagado from "./BarraPagado";
import SolicitarCambio from "./SolicitarCambio";
import ResolverCambio from "./ResolverCambio";

// Una pieza (pedido) de un elemento, en tres bloques: Pago, Entrega y Cambio.
// Nada se avisa por WhatsApp solo: después de registrar un pago, una entrega o
// un cambio se ofrece el aviso (AvisoWhatsapp) y la persona decide si enviarlo.
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
  const [error, setError] = useState("");
  const [confirmarEntrega, setConfirmarEntrega] = useState(null); // "entregar" | "deshacer"
  const [guardando, setGuardando] = useState(false);
  const [pidiendoCambio, setPidiendoCambio] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  const mostrarAviso = useAviso();

  const unidad = pedido.unidad || elemento.unidad;
  const inventario = useInventario(soloLectura ? null : unidad);
  const producto = pedido.productoNombre || pedido.articulo;
  const varianteActual = { productoNombre: producto, talla: pedido.talla || "", color: pedido.color || "" };
  const piezas = Number(pedido.cantidad) || 1;
  const recibidas = existenciasPorVariante(inventario).get(claveVariante(varianteActual)) || 0;

  // Los abonos se leen solo si se abre el historial (antes se leían siempre,
  // por cada pedido de la lista).
  useEffect(() => {
    if (verHistorial) return listenAbonosDePedido(elemento.id, pedido.id, setAbonos);
  }, [verHistorial, elemento.id, pedido.id]);

  // Lo abonado = precio - saldo (cada abono descuenta del saldo): no hace falta leer los abonos.
  const totalAbonado = Math.max((pedido.precioTotal || 0) - (pedido.saldoPendiente || 0), 0);
  const liquidado = pedido.saldoPendiente <= 0;

  // Cada abono se sigue acumulando hasta que el saldo llega a 0: el pedido
  // no se "cierra" a mano, el estado de liquidado sale directo del saldo.
  async function onAbonar(e) {
    e.preventDefault();
    if (!(Number(monto) > 0)) return;
    setError("");
    setGuardando(true);
    try {
      await registrarAbono(elemento.id, pedido.id, {
        monto,
        quienRecibio: quien,
        unidad: elemento.unidad,
        elementoNombre: elemento.nombre,
        pedido,
      });
    } catch {
      setError("No se pudo registrar el pago. Verifica tu conexión e inténtalo de nuevo.");
      setGuardando(false);
      return;
    }
    const saldoPendiente = pedido.saldoPendiente - Number(monto);
    mostrarAviso({
      elemento,
      titulo: "Pago registrado",
      mensaje: mensajeComprobante({
        nombre: elemento.nombre,
        articulo: pedido.articulo,
        monto,
        saldoPendiente,
        quienRecibio: quien,
      }),
    });
    setMonto("");
    setGuardando(false);
  }

  // Al entregar, la pieza sale de "Uniformidad disponible"; si no hay, se entrega
  // igual sin descontar (la confirmación lo avisa). Al deshacer, regresa solo
  // si se había descontado.
  async function ejecutarEntrega(entregado) {
    let inventarioMov = null;
    if (entregado) {
      if (recibidas >= piezas) inventarioMov = { unidad, variante: varianteActual, piezas };
    } else if (pedido.descontoInventario) {
      inventarioMov = { unidad, variante: varianteActual, piezas };
    }
    setError("");
    setGuardando(true);
    try {
      await marcarEntregado(elemento.id, pedido.id, entregado, quien, inventarioMov);
    } catch {
      setError("No se pudo guardar la entrega. Verifica tu conexión e inténtalo de nuevo.");
      setGuardando(false);
      setConfirmarEntrega(null);
      return;
    }
    setConfirmarEntrega(null);
    setGuardando(false);
    mostrarAviso({
      elemento,
      titulo: entregado ? "Entrega registrada" : "Entrega cancelada",
      mensaje: mensajeEntrega({
        nombre: elemento.nombre,
        articulo: pedido.articulo,
        entregado,
        quienEntrego: quien,
      }),
    });
  }

  async function onCancelarCambio() {
    if (!confirm("¿Cancelar el cambio? La pieza se queda como estaba.")) return;
    setError("");
    try {
      await cancelarCambio(elemento.id, pedido.id);
    } catch {
      setError("No se pudo cancelar el cambio. Verifica tu conexión e inténtalo de nuevo.");
    }
  }

  async function onEliminar() {
    const aviso =
      totalAbonado > 0
        ? `Se eliminarán también los pagos registrados en este pedido (${formatoMoneda(totalAbonado)}) y dejarán de aparecer en la Relación de pagos.`
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

  const textoNueva = [producto, pedido.cambioColor ?? pedido.color, (pedido.cambioTalla ?? pedido.talla) && `talla ${pedido.cambioTalla ?? pedido.talla}`]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="card pedido-card">
      <div className="pedido-cabecera">
        <h3>{pedido.articulo}</h3>
        <strong className="pedido-precio">{formatoMoneda(pedido.precioTotal)}</strong>
      </div>

      <div className="pedido-estados">
        <span className={`insignia ${liquidado ? "insignia-ok" : "insignia-abono"}`}>
          {liquidado ? "Pagado" : `Debe ${formatoMoneda(pedido.saldoPendiente)}`}
        </span>
        <span className={`insignia ${pedido.entregado ? "insignia-ok" : "insignia-cuota"}`}>
          {pedido.entregado ? "Entregado" : "Sin entregar"}
        </span>
        {pedido.cambioPendiente && <span className="insignia insignia-abono">Cambio pendiente</span>}
      </div>

      {error && <p className="error">{error}</p>}

      <section className="pedido-seccion">
        <h4>💵 Pago</h4>
        <BarraPagado fila={{ pagado: totalAbonado, precioTotal: pedido.precioTotal }} />
        <p className="nota">
          Pagado {formatoMoneda(totalAbonado)} de {formatoMoneda(pedido.precioTotal)}
        </p>
        {!soloLectura && !liquidado && (
          <form onSubmit={onAbonar} className="fila-formulario">
            <input
              placeholder="¿Cuánto paga? ($)"
              type="number"
              inputMode="decimal"
              min="1"
              max={pedido.saldoPendiente}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              aria-label="Monto del pago"
            />
            <button type="submit" className="btn-primary" disabled={guardando || !(Number(monto) > 0)}>
              Registrar pago
            </button>
          </form>
        )}
        {totalAbonado > 0 && (
          <details onToggle={(e) => setVerHistorial(e.currentTarget.open)}>
            <summary>Ver pagos anteriores</summary>
            <ul>
              {abonos.map((a) => (
                <li key={a.id}>
                  {formatoMoneda(a.monto)} — {a.fechaLocal} {a.horaLocal || ""} — {a.quienRecibio}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="pedido-seccion">
        <h4>📦 Entrega</h4>
        <p>
          {pedido.entregado
            ? `Entregada${pedido.quienEntrego ? ` por ${pedido.quienEntrego}` : ""}.`
            : "Todavía no se entrega."}
        </p>
        {!pedido.entregado && !soloLectura && (
          <p className="nota nota-recibido">
            {recibidas > 0 ? `En Uniformidad disponible: ${recibidas}` : "No hay en Uniformidad disponible"}
          </p>
        )}
        {!soloLectura &&
          (pedido.entregado ? (
            <button type="button" className="btn-secondary" onClick={() => setConfirmarEntrega("deshacer")}>
              Deshacer entrega
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setConfirmarEntrega("entregar")}>
              Entregar pieza
            </button>
          ))}
      </section>

      <section className="pedido-seccion">
        <h4>🔁 Cambio</h4>
        {pedido.cambioPendiente ? (
          <>
            <p className="aviso-cambio">
              {textoNueva === pedido.articulo ? (
                "Cambio pendiente de esta misma pieza (misma talla y color)."
              ) : (
                <>
                  Cambio pendiente: {pedido.articulo} <span aria-hidden="true">→</span> {textoNueva}
                </>
              )}
            </p>
            {pedido.motivoCambio && <p className="nota">Motivo: {pedido.motivoCambio}</p>}
            {!soloLectura && (
              <div className="acciones-fila">
                <button type="button" className="btn-secondary" onClick={onCancelarCambio}>
                  Cancelar cambio
                </button>
                <button type="button" className="btn-primary" onClick={() => setResolviendo(true)}>
                  Resolver cambio
                </button>
              </div>
            )}
          </>
        ) : pidiendoCambio ? (
          <SolicitarCambio
            elementoId={elemento.id}
            pedido={pedido}
            onCancelar={() => setPidiendoCambio(false)}
            onSolicitado={({ motivo, nueva }) => {
              setPidiendoCambio(false);
              mostrarAviso({
      elemento,
                titulo: "Cambio registrado",
                mensaje: mensajeCambioPendiente({
                  nombre: elemento.nombre,
                  articulo: pedido.articulo,
                  pendiente: true,
                  motivo,
                  nueva,
                }),
              });
            }}
          />
        ) : (
          !soloLectura && (
            <button type="button" className="btn-secondary" onClick={() => setPidiendoCambio(true)}>
              Pedir cambio de talla o color
            </button>
          )
        )}
        {soloLectura && !pedido.cambioPendiente && <p className="nota">Sin cambios pedidos.</p>}
      </section>

      {puedeEliminar && (
        <button type="button" className="btn-secondary btn-eliminar" onClick={onEliminar}>
          🗑️ Eliminar este pedido
        </button>
      )}

      {confirmarEntrega && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirmar entrega">
          <div className="modal modal-aviso">
            {confirmarEntrega === "entregar" ? (
              <>
                <h2>¿Confirmas la entrega?</h2>
                <p>
                  Le entregas <strong>{pedido.articulo}</strong> a <strong>{elemento.nombre}</strong>.
                </p>
                {!liquidado && (
                  <p className="nota nota-alerta">
                    Todavía debe {formatoMoneda(pedido.saldoPendiente)} de esta pieza.
                  </p>
                )}
                {recibidas < piezas && (
                  <p className="nota nota-alerta">
                    No hay suficiente en Uniformidad disponible (hay {recibidas}, se necesitan {piezas}).
                    Se registra la entrega igual, sin descontar nada.
                  </p>
                )}
              </>
            ) : (
              <>
                <h2>¿Deshacer la entrega?</h2>
                <p>
                  <strong>{pedido.articulo}</strong> volverá a quedar sin entregar
                  {pedido.descontoInventario ? " y regresará a Uniformidad disponible" : ""}.
                </p>
              </>
            )}
            <div className="modal-acciones">
              <button type="button" className="btn-secondary" onClick={() => setConfirmarEntrega(null)} disabled={guardando}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => ejecutarEntrega(confirmarEntrega === "entregar")}
                disabled={guardando}
              >
                {guardando ? "Guardando…" : confirmarEntrega === "entregar" ? "Sí, entregar" : "Sí, deshacer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {resolviendo && (
        <ResolverCambio
          elemento={elemento}
          pedido={pedido}
          onCerrar={() => setResolviendo(false)}
          onResuelto={({ anterior, nueva, entregada }) => {
            setResolviendo(false);
            mostrarAviso({
      elemento,
              titulo: "Cambio resuelto",
              mensaje: mensajeCambioResuelto({
                nombre: elemento.nombre,
                anterior,
                nueva,
                entregada,
                quienEntrego: quien,
              }),
            });
          }}
        />
      )}

    </div>
  );
}
