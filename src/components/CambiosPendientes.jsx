import { Link } from "react-router-dom";

// Piezas con un cambio por resolver (talla/color equivocado, defecto...), de
// todos los días. Se usa en Relación de pagos y en Uniformidad.
export default function CambiosPendientes({ cambios }) {
  if (cambios.length === 0) return <p className="nota">No hay cambios pendientes.</p>;
  return (
    <ul className="pagos">
      {cambios.map((c) => (
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
  );
}
