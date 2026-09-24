import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { useEstadoPersistente } from "../lib/navegacion";
import { esAdmin, esSoloLectura, veTodasLasUnidades } from "../lib/roles";
import { useElementosDeUnidades, usePedidosDeUnidades, useUnidades } from "../lib/fuentes";
import { filaDePedido } from "../lib/relacionPagos";
import RelacionDelDia from "../components/RelacionDelDia";
import RelacionGeneral from "../components/RelacionGeneral";
import CambiosPendientes from "../components/CambiosPendientes";

const SIN_UNIDADES = [];

// Relación de pagos:
//  - Del día: lo cobrado ese día, en general (uniformes por pieza y talla,
//    mensualidades con nombre y meses). Ahí se valida la entrega del dinero al
//    proveedor y se manda el resumen por WhatsApp.
//  - General: las relaciones ya validadas. Aquí se marca lo que el proveedor
//    entrega (parcial o total), que pasa a "Uniformidad disponible" (en
//    Uniformes y Mensualidades). También se ven los cambios pendientes.
export default function RelacionPagos() {
  const { user, perfil } = useAuth();
  // Admin/Super Admin/Estado Mayor eligen Unidad (o todas); Responsable e
  // Instructor ven solo la suya.
  const veTodas = veTodasLasUnidades(perfil);
  const unidades = useUnidades(veTodas);
  // Lo elegido se recuerda al volver de un perfil (por usuario).
  const [unidadElegida, setUnidadElegida] = useEstadoPersistente(`${user?.email}:pagos:unidad`, ""); // "" = todas
  const [vistaGuardada, setVista] = useEstadoPersistente(`${user?.email}:pagos:vista`, "dia"); // dia | general
  const vista = vistaGuardada === "general" ? "general" : "dia";
  const soloLectura = esSoloLectura(perfil);

  const unidadActual = veTodas ? unidadElegida || undefined : perfil?.unidad;
  // Los pedidos (para los cambios pendientes) solo se cargan en General.
  const unidadesDePedidos = useMemo(() => {
    if (vista !== "general") return SIN_UNIDADES;
    if (!veTodas) return perfil?.unidad ? [perfil.unidad] : SIN_UNIDADES;
    return unidadElegida ? [unidadElegida] : unidades.map((u) => u.nombre);
  }, [vista, veTodas, perfil?.unidad, unidadElegida, unidades]);

  const pedidos = usePedidosDeUnidades(unidadesDePedidos);
  const elementos = useElementosDeUnidades(unidadesDePedidos);

  const cambios = useMemo(() => {
    if (!pedidos || !elementos) return null;
    const elementosPorId = new Map(elementos.map((e) => [e.id, e]));
    return {
      elementosPorId,
      pedidosPorId: new Map(pedidos.map((p) => [`${p.elementoId}/${p.id}`, p])),
      lista: pedidos
        .map((p) => filaDePedido({ ...p, elementoNombre: elementosPorId.get(p.elementoId)?.nombre || "" }))
        .filter((f) => f.cambioPendiente),
    };
  }, [pedidos, elementos]);

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
          ["general", `General${cambios?.lista.length ? ` (${cambios.lista.length} cambio${cambios.lista.length === 1 ? "" : "s"})` : ""}`],
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
        <RelacionDelDia
          unidad={unidadActual}
          puedeConfigurarWhatsapp={esAdmin(perfil)}
          puedeValidar={!soloLectura}
        />
      )}

      {vista === "general" && (
        <>
          <RelacionGeneral unidad={unidadActual} puedeRecibir={!soloLectura} />

          {cambios && cambios.lista.length > 0 && (
            <>
              <h2 className="subtitulo">Cambios pendientes</h2>
              <p className="ayuda">
                Piezas que se van a cambiar por otra talla o color. La pieza nueva cuenta como pendiente:
                cuando llegue, regístrala como recibida y resuelve el cambio.
              </p>
              <CambiosPendientes
                cambios={cambios.lista}
                pedidosPorId={cambios.pedidosPorId}
                elementosPorId={cambios.elementosPorId}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
