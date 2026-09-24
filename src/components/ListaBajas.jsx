import { useState } from "react";
import { Link } from "react-router-dom";
import { reactivarElemento } from "../lib/asistencia";
import { useDesde } from "../lib/navegacion";

// Elementos dados de baja. No se pueden eliminar: solo reactivar (salvo con
// `soloLectura`, para el rol Estado Mayor). Se usa en Elementos y en Asistencia.
export default function ListaBajas({ bajas, soloLectura = false }) {
  const [error, setError] = useState("");
  const desde = useDesde();

  async function onReactivar(el) {
    if (!confirm(`¿Reactivar a ${el.nombre}? Volverá a aparecer en las listas.`)) return;
    setError("");
    try {
      await reactivarElemento(el);
    } catch {
      setError("No se pudo reactivar. Verifica tu conexión e inténtalo de nuevo.");
    }
  }

  if (bajas.length === 0) return <p className="nota">No hay elementos dados de baja.</p>;

  return (
    <>
      {error && <p className="error">{error}</p>}
      <ul className="lista">
        {bajas.map((el) => (
          <li key={el.id} className="fila-baja">
            <Link to={`/elementos/${el.id}`} state={desde} className="fila-lista">
              <span>
                {el.nombre}
                <span className="nota"> · {[el.gradoMilitar, el.unidad].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="tag tag-baja">Baja {el.fechaBaja}</span>
            </Link>
            {!soloLectura && (
              <button type="button" className="btn-secondary btn-small" onClick={() => onReactivar(el)}>
                Reactivar
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
