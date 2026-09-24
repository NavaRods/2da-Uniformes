import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDesde } from "../lib/navegacion";
import { useInventarioDeUnidades } from "../lib/fuentes";
import { existenciasPorVariante, recibirUniforme } from "../lib/inventario";
import { claveVariante } from "../lib/relacionPagos";
import { armarArticulo } from "../lib/pedidos";
import { esSoloLectura } from "../lib/roles";
import { useAuth } from "../auth/AuthContext";
import { mensajeCambioResuelto } from "../lib/whatsapp";
import ResolverCambio from "./ResolverCambio";
import { useAviso } from "./AvisoProvider";

const SIN_UNIDADES = [];

// Piezas con un cambio por resolver (talla/color equivocado, defecto...), de
// todos los días. Cada una dice qué se cambia por qué, si la pieza nueva ya
// llegó (Uniformidad disponible) y se resuelve aquí mismo, en un paso: ver
// ResolverCambio. La pieza nueva también cuenta como pendiente en la Relación
// de pagos.
export default function CambiosPendientes({ cambios, pedidosPorId, elementosPorId }) {
  const desde = useDesde();
  const { user, perfil } = useAuth();
  const soloLectura = esSoloLectura(perfil);
  const [resolviendo, setResolviendo] = useState(null); // { elemento, pedido }
  const mostrarAviso = useAviso();
  const [error, setError] = useState("");

  async function recibirNueva(c) {
    setError("");
    try {
      await recibirUniforme(
        c.unidad,
        { productoNombre: c.productoNombre, talla: c.tallaEntrega, color: c.colorEntrega },
        c.cantidad
      );
    } catch (e) {
      setError(e.message || "No se pudo guardar. Inténtalo de nuevo.");
    }
  }

  const unidades = useMemo(
    () => [...new Set(cambios.map((c) => c.unidad).filter(Boolean))],
    [cambios]
  );
  const inventario = useInventarioDeUnidades(unidades.length ? unidades : SIN_UNIDADES);
  // Existencias por Unidad (la pieza debe estar en la Unidad de quien la pidió).
  const existencias = useMemo(() => {
    const porUnidad = new Map();
    for (const u of unidades) {
      porUnidad.set(u, existenciasPorVariante((inventario || []).filter((i) => i.unidad === u)));
    }
    return porUnidad;
  }, [inventario, unidades]);

  return (
    <>
      {cambios.length === 0 && (
        <p className="nota">
          No hay cambios pendientes. Para pedir uno, abre el perfil del elemento, entra a una pieza y toca
          “Pedir cambio de talla o color”.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="lista-tarjetas">
        {cambios.map((c) => {
          const pedido = pedidosPorId?.get(c.id);
          const elemento = elementosPorId?.get(c.elementoId) || {
            id: c.elementoId,
            nombre: c.elementoNombre,
            unidad: c.unidad,
          };
          const nueva = armarArticulo({
            productoNombre: c.productoNombre,
            talla: c.tallaEntrega,
            color: c.colorEntrega,
          });
          const enExistencia =
            (existencias.get(c.unidad)?.get(
              claveVariante({ productoNombre: c.productoNombre, talla: c.tallaEntrega, color: c.colorEntrega })
            ) || 0) >= c.cantidad;
          return (
            <li key={c.id} className="tarjeta-cambio">
              <div className="tarjeta-cambio-cabecera">
                <Link to={`/elementos/${c.elementoId}`} state={desde} className="pago-nombre">
                  {c.elementoNombre || "?"}
                </Link>
                <span className={`insignia ${enExistencia ? "insignia-ok" : "insignia-cuota"}`}>
                  {enExistencia ? "Pieza nueva ya recibida" : "Falta recibir la pieza nueva"}
                </span>
              </div>
              {nueva === c.articulo ? (
                <p className="cambio-de-a">
                  <span>Cambio de la misma pieza:</span>
                  <strong>{c.articulo}</strong>
                </p>
              ) : (
                <p className="cambio-de-a">
                  <span>{c.articulo}</span>
                  <span aria-hidden="true">→</span>
                  <strong>{nueva}</strong>
                </p>
              )}
              {c.motivoCambio && <p className="nota">Motivo: {c.motivoCambio}</p>}
              <div className="acciones-fila">
                <Link
                  to={`/elementos/${c.elementoId}`}
                  state={desde}
                  className="btn-secondary btn-small"
                >
                  👤 Ver perfil
                </Link>
                {!soloLectura && !enExistencia && (
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => recibirNueva(c)}
                  >
                    📦 Recibí la pieza nueva
                  </button>
                )}
                {!soloLectura && pedido && (
                  <button
                    type="button"
                    className="btn-primary btn-small"
                    onClick={() => setResolviendo({ elemento, pedido })}
                  >
                    Resolver cambio
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {resolviendo && (
        <ResolverCambio
          elemento={resolviendo.elemento}
          pedido={resolviendo.pedido}
          onCerrar={() => setResolviendo(null)}
          onResuelto={({ anterior, nueva, entregada }) => {
            mostrarAviso({
              elemento: resolviendo.elemento,
              titulo: "Cambio resuelto",
              mensaje: mensajeCambioResuelto({
                nombre: resolviendo.elemento.nombre,
                anterior,
                nueva,
                entregada,
                quienEntrego: user?.displayName || user?.email || "",
              }),
            });
            setResolviendo(null);
          }}
        />
      )}

    </>
  );
}
