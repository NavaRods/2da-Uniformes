import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { esAdmin, veTodasLasUnidades } from "../lib/roles";
import { useElementosDeUnidades, usePedidosDeUnidades, useUnidades } from "../lib/fuentes";
import { filaDePedido, relacionPorElemento } from "../lib/relacionPagos";
import RelacionDelDia from "../components/RelacionDelDia";
import PedidosPendientes from "../components/PedidosPendientes";
import RelacionPorElemento from "../components/RelacionPorElemento";

const SIN_UNIDADES = [];

// Relación de pagos:
//  - Del día: pagos cobrados en una fecha (abonos y mensualidades).
//  - Pendientes: pedidos que aún deben dinero o faltan por entregar.
//  - Por elemento: cada elemento con sus pedidos, lo pagado de cada uno, si
//    ya se entregó, y quién aún debe uniformes.
//  - Cambios: piezas con un cambio por resolver.
// Pendientes, Por elemento y Cambios salen de los pedidos y elementos de la
// Unidad, sincronizados por cambios y leídos de la caché del dispositivo:
// abrirlos cuesta unas pocas lecturas, no una por pedido ni por elemento.
export default function RelacionPagos() {
  const { perfil } = useAuth();
  // Admin/Super Admin/Estado Mayor eligen Unidad (o todas); Responsable e
  // Instructor ven solo la suya.
  const veTodas = veTodasLasUnidades(perfil);
  const unidades = useUnidades(veTodas);
  const [unidadElegida, setUnidadElegida] = useState(""); // "" = todas
  const [vista, setVista] = useState("dia"); // dia | pendientes | elementos | cambios

  const unidadDelDia = veTodas ? unidadElegida || undefined : perfil?.unidad;
  // Los pedidos y elementos solo se cargan fuera de "Del día".
  const unidadesDePedidos = useMemo(() => {
    if (vista === "dia") return SIN_UNIDADES;
    if (!veTodas) return perfil?.unidad ? [perfil.unidad] : SIN_UNIDADES;
    return unidadElegida ? [unidadElegida] : unidades.map((u) => u.nombre);
  }, [vista, veTodas, perfil?.unidad, unidadElegida, unidades]);

  const pedidos = usePedidosDeUnidades(unidadesDePedidos);
  const elementos = useElementosDeUnidades(unidadesDePedidos);
  const cargando =
    vista !== "dia" &&
    (pedidos === null || elementos === null || (veTodas && !unidadElegida && unidades.length === 0));

  const datos = useMemo(() => {
    if (!pedidos || !elementos) return null;
    const elementosPorId = new Map(elementos.map((e) => [e.id, e]));
    const pedidosPorId = new Map(pedidos.map((p) => [`${p.elementoId}/${p.id}`, p]));
    const filas = pedidos.map((p) =>
      filaDePedido({ ...p, elementoNombre: elementosPorId.get(p.elementoId)?.nombre || "" })
    );
    return {
      filas,
      elementosPorId,
      pedidosPorId,
      grupos: relacionPorElemento(elementos, filas),
      cambios: filas.filter((f) => f.cambioPendiente),
      pendientes: filas.filter((f) => f.pendiente).length,
    };
  }, [pedidos, elementos]);

  const cuenta = (n) => (datos && n ? ` (${n})` : "");

  return (
    <div className="page">
      <h1>Relación de pagos</h1>

      {veTodas && (
        <div className="campo">
          <label htmlFor="unidad-relacion">Unidad</label>
          <select
            id="unidad-relacion"
            value={unidadElegida}
            onChange={(e) => setUnidadElegida(e.target.value)}
          >
            <option value="">Todas las Unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="tabs" role="tablist">
        {[
          ["dia", "Del día"],
          ["pendientes", `Pendientes${cuenta(datos?.pendientes)}`],
          ["elementos", "Por elemento"],
          ["cambios", `Cambios${cuenta(datos?.cambios.length)}`],
        ].map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={vista === clave}
            className={`tab ${vista === clave ? "activo" : ""}`}
            onClick={() => setVista(clave)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {vista === "dia" && (
        <RelacionDelDia unidad={unidadDelDia} puedeConfigurarWhatsapp={esAdmin(perfil)} />
      )}

      {vista !== "dia" && cargando && <p className="nota">Cargando pedidos…</p>}

      {vista === "pendientes" && !cargando && datos && (
        <>
          <p className="nota">
            Uniformes que aún deben dinero o faltan por entregar, de todos los días.
          </p>
          <PedidosPendientes filas={datos.filas} />
        </>
      )}

      {vista === "elementos" && !cargando && datos && (
        <>
          <p className="nota">
            Cada elemento con sus uniformes: cuánto se ha pagado de cada pieza, si ya se entregó y
            quién aún debe. Toca un elemento para ver sus pedidos y sus pagos.
          </p>
          <RelacionPorElemento
            grupos={datos.grupos}
            pedidosPorId={datos.pedidosPorId}
            elementosPorId={datos.elementosPorId}
          />
        </>
      )}

      {vista === "cambios" && !cargando && datos && (
        <>
          <p className="nota">Piezas con cambio por resolver, de todos los días.</p>
          {datos.cambios.length === 0 && <p className="nota">No hay cambios pendientes.</p>}
          <ul className="pagos">
            {datos.cambios.map((c) => (
              <li key={c.id} className="pago">
                <div className="pago-info">
                  <Link to={`/elementos/${c.elementoId}`} className="pago-nombre">
                    {c.elementoNombre || "?"}
                  </Link>
                  <span>{c.articulo}</span>
                  {c.motivoCambio && <span className="nota">{c.motivoCambio}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
