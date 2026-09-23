import { porcentajePagado } from "../lib/relacionPagos";

// Barra de cuánto se ha pagado de un precio. `fila` necesita pagado y precioTotal.
export default function BarraPagado({ fila }) {
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
