import { useState } from "react";
import { Link } from "react-router-dom";
import { formatoMoneda } from "../lib/format";
import { normalizar } from "../lib/busqueda";
import { pedidosPendientes, porcentajePagado, resumenPendientes } from "../lib/relacionPagos";

const FILTROS = [
  ["todos", "Todos"],
  ["debe", "Con deuda"],
  ["sin-entregar", "Sin entregar"],
];

export function BarraPagado({ fila }) {
  const pct = porcentajePagado(fila);
  return (
    <div
      className="barra-progreso"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Pagado ${pct}%`}
    >
      <span className="barra-progreso-relleno" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Todos los pedidos pendientes (deben dinero o falta entregarlos), de todos
// los días, primero los de mayor deuda. `filas` = filaDePedido de cada pedido.
export default function PedidosPendientes({ filas }) {
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  const pendientes = pedidosPendientes(filas);
  const resumen = resumenPendientes(pendientes);
  const texto = normalizar(busqueda.trim());
  const visibles = pendientes.filter(
    (f) =>
      (filtro === "todos" ||
        (filtro === "debe" && f.debeDinero) ||
        (filtro === "sin-entregar" && f.faltaEntregar)) &&
      (!texto || normalizar(`${f.elementoNombre} ${f.articulo}`).includes(texto))
  );

  return (
    <>
      <div className="tarjetas-resumen">
        <div className="card tarjeta-total">
          <span className="ficha-etiqueta">Por cobrar</span>
          <span className="total-monto">{formatoMoneda(resumen.porCobrar)}</span>
          <span className="nota">
            {resumen.elementosConDeuda}{" "}
            {resumen.elementosConDeuda === 1 ? "elemento debe" : "elementos deben"} ·{" "}
            {resumen.conDeuda} {resumen.conDeuda === 1 ? "pedido" : "pedidos"} sin liquidar
          </span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Ya abonado</span>
          <span className="total-sub">{formatoMoneda(resumen.pagado)}</span>
          <span className="nota">de {formatoMoneda(resumen.valorTotal)} en pendientes</span>
        </div>
        <div className="card">
          <span className="ficha-etiqueta">Sin entregar</span>
          <span className="total-sub">{resumen.sinEntregar}</span>
          <span className="nota">{resumen.sinEntregar === 1 ? "pieza" : "piezas"} por entregar</span>
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
            {etiqueta}
          </button>
        ))}
      </div>
      <input
        className="buscador"
        type="search"
        placeholder="Buscar por elemento o pieza..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {visibles.length === 0 && (
        <p className="nota">
          {pendientes.length === 0
            ? "No hay uniformes pendientes: todo está pagado y entregado."
            : "Ningún pedido coincide con el filtro."}
        </p>
      )}
      <ul className="pagos">
        {visibles.map((f) => (
          <li key={f.id} className="pago">
            <div className="pago-info">
              <Link to={`/elementos/${f.elementoId}`} className="pago-nombre">
                {f.elementoNombre || "?"}
              </Link>
              <span>{f.articulo}</span>
              <span className="nota">
                Pagado {formatoMoneda(f.pagado)} de {formatoMoneda(f.precioTotal)} (
                {porcentajePagado(f)}%)
              </span>
              <BarraPagado fila={f} />
            </div>
            <div className="pago-monto">
              <strong>{f.debeDinero ? formatoMoneda(f.saldoPendiente) : "Liquidado"}</strong>
              <span className={`insignia ${f.entregado ? "insignia-ok" : "insignia-cuota"}`}>
                {f.entregado ? "Entregado" : "Sin entregar"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
