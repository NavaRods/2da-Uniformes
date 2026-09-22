import { useRef, useState } from "react";
import { buscar } from "../lib/busqueda";

const LIMITE_RESULTADOS = 30;

// Campo de búsqueda para elegir un elemento por nombre, con coincidencia
// difusa (ignora acentos, mayúsculas y el orden de las palabras, y perdona
// errores de tecleo) en vez de un <select> plano.
export default function BuscadorElemento({
  elementos,
  onSeleccionar,
  placeholder = "Buscar elemento...",
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const cierreProgramado = useRef(null);

  const resultados = (texto.trim() ? buscar(elementos, texto, (el) => el.nombre) : elementos).slice(
    0,
    LIMITE_RESULTADOS
  );

  function seleccionar(el) {
    onSeleccionar(el.id);
    setTexto("");
    setAbierto(false);
  }

  function onFocus() {
    clearTimeout(cierreProgramado.current);
    setAbierto(true);
  }

  function onBlur() {
    // Se retrasa el cierre para que el clic en un resultado alcance a
    // registrarse antes de que la lista desaparezca.
    cierreProgramado.current = setTimeout(() => setAbierto(false), 150);
  }

  return (
    <div className="buscador-elemento">
      <input
        type="search"
        value={texto}
        placeholder={placeholder}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {abierto && (
        <ul className="buscador-elemento-resultados">
          {resultados.map((el) => (
            <li key={el.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => seleccionar(el)}>
                {el.nombre}
              </button>
            </li>
          ))}
          {resultados.length === 0 && <li className="buscador-elemento-vacio">Sin resultados.</li>}
        </ul>
      )}
    </div>
  );
}
