import { useEffect, useRef, useState } from "react";
import { buscar } from "../lib/busqueda";

// Campo tipo "select" que despliega la lista completa de opciones, con una
// barra de búsqueda arriba para filtrarla con coincidencia difusa (ignora
// acentos, mayúsculas, el orden de las palabras y perdona errores de
// tecleo). `obtenerTexto` da el texto de cada opción (se usa para buscar y
// para mostrarla); `valorId`/`obtenerId` son opcionales y sirven para que el
// campo muestre la opción ya elegida en vez del placeholder.
export default function SelectorBuscable({
  items,
  valorId = "",
  obtenerId = (item) => item.id,
  obtenerTexto,
  onSeleccionar,
  placeholder = "Selecciona...",
  placeholderBusqueda = "Buscar...",
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const cajaRef = useRef(null);
  const buscadorRef = useRef(null);

  const seleccionado = items.find((item) => obtenerId(item) === valorId);
  const resultados = texto.trim() ? buscar(items, texto, obtenerTexto) : items;

  useEffect(() => {
    if (!abierto) return;
    buscadorRef.current?.focus();
    function alHacerClicFuera(e) {
      if (!cajaRef.current?.contains(e.target)) cerrar();
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setTexto("");
  }

  function seleccionar(item) {
    onSeleccionar(obtenerId(item));
    cerrar();
  }

  return (
    <div className="buscador-elemento" ref={cajaRef}>
      <button
        type="button"
        className="buscador-elemento-campo"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className={seleccionado ? "buscador-elemento-valor" : "buscador-elemento-placeholder"}>
          {seleccionado ? obtenerTexto(seleccionado) : placeholder}
        </span>
        <span className="buscador-elemento-flecha">▾</span>
      </button>

      {abierto && (
        <div className="buscador-elemento-panel">
          <input
            ref={buscadorRef}
            type="search"
            className="buscador-elemento-buscar"
            placeholder={placeholderBusqueda}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && cerrar()}
          />
          <ul className="buscador-elemento-resultados">
            {resultados.map((item) => (
              <li key={obtenerId(item)}>
                <button type="button" onClick={() => seleccionar(item)}>
                  {obtenerTexto(item)}
                </button>
              </li>
            ))}
            {resultados.length === 0 && <li className="buscador-elemento-vacio">Sin resultados.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
