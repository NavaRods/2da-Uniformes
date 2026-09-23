import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { esAdmin, esSoloLectura, veTodasLasUnidades } from "../lib/roles";
import {
  useElementosDeUnidades,
  useInventarioDeUnidades,
  usePedidosDeUnidades,
  useUnidades,
} from "../lib/fuentes";
import { filaDePedido } from "../lib/relacionPagos";
import RelacionDelDia from "../components/RelacionDelDia";
import UniformidadPendiente from "../components/UniformidadPendiente";
import UniformeRecibido from "../components/UniformeRecibido";

const SIN_UNIDADES = [];

// Relación de pagos:
//  - Del día: pagos cobrados en una fecha (abonos y mensualidades).
//  - Pendientes: uniformidad general por entregar (piezas por producto y
//    talla, sin datos de elementos).
//  - Recibido: "Uniforme recibido", lo que ya llegó y espera a entregarse.
// El detalle por elemento y los cambios pendientes están en Uniformidad.
// Pendientes y Recibido salen de los pedidos y elementos de la Unidad,
// sincronizados por cambios y leídos de la caché del dispositivo: abrirlos
// cuesta unas pocas lecturas, no una por pedido ni por elemento.
export default function RelacionPagos() {
  const { perfil } = useAuth();
  // Admin/Super Admin/Estado Mayor eligen Unidad (o todas); Responsable e
  // Instructor ven solo la suya.
  const veTodas = veTodasLasUnidades(perfil);
  const unidades = useUnidades(veTodas);
  const [unidadElegida, setUnidadElegida] = useState(""); // "" = todas
  const [vista, setVista] = useState("dia"); // dia | pendientes | recibido

  const unidadDelDia = veTodas ? unidadElegida || undefined : perfil?.unidad;
  // Los pedidos y elementos solo se cargan fuera de "Del día".
  const unidadesDePedidos = useMemo(() => {
    if (vista === "dia") return SIN_UNIDADES;
    if (!veTodas) return perfil?.unidad ? [perfil.unidad] : SIN_UNIDADES;
    return unidadElegida ? [unidadElegida] : unidades.map((u) => u.nombre);
  }, [vista, veTodas, perfil?.unidad, unidadElegida, unidades]);

  const pedidos = usePedidosDeUnidades(unidadesDePedidos);
  const elementos = useElementosDeUnidades(unidadesDePedidos);
  const inventario = useInventarioDeUnidades(unidadesDePedidos);
  // Lo recibido se registra en una sola Unidad: la propia, o la elegida.
  const unidadEditable = esSoloLectura(perfil)
    ? null
    : veTodas
      ? unidadElegida || null
      : perfil?.unidad || null;
  const cargando =
    vista !== "dia" &&
    (pedidos === null || elementos === null || inventario === null || (veTodas && !unidadElegida && unidades.length === 0));

  const datos = useMemo(() => {
    if (!pedidos || !elementos) return null;
    const elementosPorId = new Map(elementos.map((e) => [e.id, e]));
    const filas = pedidos.map((p) =>
      filaDePedido({ ...p, elementoNombre: elementosPorId.get(p.elementoId)?.nombre || "" })
    );
    return {
      filas,
      porEntregar: filas.filter((f) => f.faltaEntregar).reduce((s, f) => s + f.cantidad, 0),
    };
  }, [pedidos, elementos]);

  const recibidas = (inventario || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
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
          ["pendientes", `Pendientes${cuenta(datos?.porEntregar)}`],
          ["recibido", `Recibido${cuenta(recibidas)}`],
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
            Uniformidad que se debe, sumada por producto y talla. Cuando te entreguen piezas, toca
            Recibir y anota cuántas: pasan a Uniforme recibido. Al entregarle una pieza a un
            elemento (pestaña Por elemento, en Uniformidad) se descuenta de lo recibido.
          </p>
          <UniformidadPendiente filas={datos.filas} inventario={inventario} unidad={unidadEditable} />
        </>
      )}

      {vista === "recibido" && !cargando && datos && (
        <UniformeRecibido
          inventario={inventario}
          puedeEditar={!esSoloLectura(perfil)}
          varias={unidadesDePedidos.length > 1}
        />
      )}
    </div>
  );
}
