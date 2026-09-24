import { useState } from "react";
import { buscar } from "../lib/busqueda";
import { estaActivo } from "../lib/elementos";

const POR_PAGINA = 8;

// Elegir un elemento: un campo de búsqueda y, debajo, tarjetas grandes que se
// tocan para elegir (mejor en teléfono que un desplegable). La búsqueda
// perdona acentos y errores de tecleo. Sin texto muestra los primeros y
// permite ver más.
export default function ListaElementosBuscable({ elementos, onSeleccionar, vacio }) {
  const [texto, setTexto] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  const activos = elementos.filter(estaActivo);
  const coincidencias = texto.trim() ? buscar(activos, texto, (el) => el.nombre) : activos;
  const visibles = verTodos || texto.trim() ? coincidencias : coincidencias.slice(0, POR_PAGINA);

  return (
    <div className="selector-elemento">
      <input
        type="search"
        className="buscador-grande"
        placeholder="Escribe el nombre del elemento…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        aria-label="Buscar elemento por nombre"
      />

      {activos.length === 0 && <p className="nota">{vacio || "No hay elementos para elegir."}</p>}

      <ul className="lista-tarjetas">
        {visibles.map((el) => (
          <li key={el.id}>
            <button type="button" className="tarjeta-enlace tarjeta-boton" onClick={() => onSeleccionar(el.id)}>
              <span className="tarjeta-datos">
                <strong className="tarjeta-titulo">{el.nombre}</strong>
                <span className="etiquetas">
                  {el.gradoMilitar && <span className="tag">{el.gradoMilitar}</span>}
                  {el.unidad && <span className="tag">{el.unidad}</span>}
                </span>
              </span>
              <span className="tarjeta-accion">
                Elegir <span aria-hidden="true">›</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {texto.trim() && coincidencias.length === 0 && (
        <p className="nota">Nadie coincide con “{texto}”. Revisa cómo se escribe.</p>
      )}

      {!texto.trim() && !verTodos && coincidencias.length > POR_PAGINA && (
        <button type="button" className="btn-secondary" onClick={() => setVerTodos(true)}>
          Ver los {coincidencias.length} elementos
        </button>
      )}
    </div>
  );
}
