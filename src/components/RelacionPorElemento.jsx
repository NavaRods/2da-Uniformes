import { useState } from "react";
import { Link } from "react-router-dom";
import { formatoMoneda } from "../lib/format";
import { normalizar } from "../lib/busqueda";
import { ESTADOS_UNIFORME, resumenRelacion } from "../lib/relacionPagos";
import PedidoCard from "./PedidoCard";
import BarraPagado from "./BarraPagado";

const FILTROS = [
  ["todos", "Todos"],
  ["debe", "Deben"],
  ["sin-entregar", "Falta entregar"],
  ["al-corriente", "Al corriente"],
  ["sin-pedidos", "Sin uniformes"],
];

const CLASE_ESTADO = {
  debe: "insignia-abono",
  "sin-entregar": "insignia-cuota",
  "al-corriente": "insignia-ok",
  "sin-pedidos": "insignia-neutra",
};

// Estado de una pieza, para el color de su franja: debe dinero, falta
// entregarla o ya está completa.
const estadoPieza = (f) => (f.debeDinero ? "debe" : f.faltaEntregar ? "sin-entregar" : "ok");

const detallePieza = (f) =>
  [f.color, f.talla && `talla ${f.talla}`].filter(Boolean).join(", ");

// Relación pagos ↔ pedidos por elemento. `grupos` viene de
// relacionPorElemento; `pedidosPorId` y `elementosPorId` dan los datos
// completos para la tarjeta de cada pieza (cobrar, entregar, ver sus pagos).
export default function RelacionPorElemento({ grupos, pedidosPorId, elementosPorId }) {
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(null); // elementoId desplegado
  const [piezaAbierta, setPiezaAbierta] = useState(null); // fila.id con su tarjeta abierta

  const resumen = resumenRelacion(grupos);
  const texto = normalizar(busqueda.trim());
  const visibles = grupos
    .filter(
      (g) =>
        (filtro === "todos" ||
          g.estado === filtro ||
          (filtro === "sin-entregar" && g.sinEntregar > 0)) &&
        (!texto || normalizar(g.elementoNombre).includes(texto))
    )
    // Quien más debe, primero, al ver a los que deben.
    .sort((a, b) => (filtro === "debe" ? b.porCobrar - a.porCobrar : 0));

  const cuantos = {
    todos: resumen.elementos,
    debe: resumen.deben,
    "sin-entregar": resumen.faltaEntregar,
    "al-corriente": resumen.alCorriente,
    "sin-pedidos": resumen.sinPedidos,
  };

  function alternar(elementoId, boton) {
    const cerrando = abierto === elementoId;
    setAbierto(cerrando ? null : elementoId);
    setPiezaAbierta(null);
    // Al cerrar un elemento largo, la página vuelve a su nombre (si no, quedaría
    // mucho más abajo, a media lista).
    if (cerrando) requestAnimationFrame(() => boton.scrollIntoView({ block: "nearest" }));
  }

  return (
    <>
      <div className="tarjetas-resumen">
        <div className="card tarjeta-total">
          <span className="ficha-etiqueta">Deben uniformes</span>
          <span className="total-monto">{formatoMoneda(resumen.porCobrar)}</span>
          <span className="nota">
            {resumen.deben} de {resumen.elementos} elementos · pagado{" "}
            {formatoMoneda(resumen.pagado)} de {formatoMoneda(resumen.valorTotal)} vendidos
          </span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Falta entregar</span>
          <span className="total-sub">{resumen.faltaEntregar}</span>
          <span className="nota">
            {resumen.faltaEntregar === 1 ? "elemento" : "elementos"} ·{" "}
            {resumen.piezasSinEntregar} {resumen.piezasSinEntregar === 1 ? "pieza" : "piezas"}
          </span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Al corriente</span>
          <span className="total-sub">{resumen.alCorriente}</span>
          <span className="nota">pagado y entregado</span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Sin uniformes</span>
          <span className="total-sub">{resumen.sinPedidos}</span>
          <span className="nota">sin ningún pedido</span>
        </div>
      </div>

      <div className="filtros">
        {FILTROS.map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            className={`chip ${filtro === clave ? "activo" : ""}`}
            aria-pressed={filtro === clave}
            onClick={() => setFiltro(clave)}
          >
            {etiqueta} ({cuantos[clave]})
          </button>
        ))}
      </div>
      <input
        className="buscador"
        type="search"
        placeholder="Buscar elemento..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {visibles.length === 0 && <p className="nota">Ningún elemento coincide con el filtro.</p>}

      <ul className="lista-relacion">
        {visibles.map((g) => {
          const estaAbierto = abierto === g.elementoId;
          const elemento = elementosPorId.get(g.elementoId) || {
            id: g.elementoId,
            nombre: g.elementoNombre,
            unidad: g.pedidos[0]?.unidad || "",
          };
          return (
            <li key={g.elementoId} className={`relacion-elemento ${estaAbierto ? "abierto" : ""}`}>
              <button
                type="button"
                className="relacion-cabecera"
                aria-expanded={estaAbierto}
                onClick={(e) => alternar(g.elementoId, e.currentTarget)}
                disabled={g.piezas === 0}
              >
                <span className="relacion-nombre">
                  <span className="pago-nombre">{g.elementoNombre || "?"}</span>
                  {g.gradoMilitar && <span className="tag">{g.gradoMilitar}</span>}
                  {g.baja && <span className="tag tag-baja">Baja</span>}
                </span>
                <span className="grupo-totales">
                  <span className={`insignia ${CLASE_ESTADO[g.estado]}`}>
                    {g.estado === "debe"
                      ? `Debe ${formatoMoneda(g.porCobrar)}`
                      : ESTADOS_UNIFORME[g.estado]}
                  </span>
                  {g.estado === "debe" && g.sinEntregar > 0 && (
                    <span className="insignia insignia-cuota">{g.sinEntregar} sin entregar</span>
                  )}
                  {g.cambios > 0 && (
                    <span className="insignia insignia-abono">
                      {g.cambios} {g.cambios === 1 ? "cambio" : "cambios"}
                    </span>
                  )}
                </span>
                {g.piezas > 0 && (
                  <span className="relacion-resumen nota">
                    <span>
                      {g.piezas} {g.piezas === 1 ? "pieza" : "piezas"} · pagado{" "}
                      {formatoMoneda(g.pagado)} de {formatoMoneda(g.valorTotal)}
                    </span>
                    <span className="relacion-flecha" aria-hidden="true">
                      {estaAbierto ? "▲" : "▼"}
                    </span>
                  </span>
                )}
                {g.piezas > 0 && (
                  <BarraPagado fila={{ pagado: g.pagado, precioTotal: g.valorTotal }} />
                )}
              </button>

              {estaAbierto && (
                <div className="relacion-detalle">
                  <ul className="piezas">
                    {g.pedidos.map((f) => {
                      const pedido = pedidosPorId.get(f.id);
                      const abierta = piezaAbierta === f.id;
                      return (
                        <li key={f.id} className={`pieza pieza-${estadoPieza(f)}`}>
                          <button
                            type="button"
                            className="pieza-fila"
                            aria-expanded={abierta}
                            onClick={() => setPiezaAbierta(abierta ? null : f.id)}
                          >
                            <span className="pieza-nombre">
                              <strong>{f.productoNombre}</strong>
                              {detallePieza(f) && <span className="nota">{detallePieza(f)}</span>}
                            </span>
                            <span className="pieza-montos nota">
                              {formatoMoneda(f.pagado)} / {formatoMoneda(f.precioTotal)}
                            </span>
                            <span className="pieza-estados">
                              <span className={`insignia ${f.debeDinero ? "insignia-abono" : "insignia-ok"}`}>
                                {f.debeDinero ? `Debe ${formatoMoneda(f.saldoPendiente)}` : "Pagado"}
                              </span>
                              <span
                                className={`insignia ${f.entregado ? "insignia-ok" : "insignia-cuota"}`}
                              >
                                {f.entregado ? "Entregado" : "Sin entregar"}
                              </span>
                              {f.cambioPendiente && (
                                <span className="insignia insignia-abono">Cambio</span>
                              )}
                            </span>
                          </button>
                          {abierta && pedido && (
                            <div className="pieza-detalle">
                              <PedidoCard cliente={elemento} pedido={pedido} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <Link to={`/elementos/${g.elementoId}`} className="volver relacion-perfil">
                    Ver perfil completo →
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
