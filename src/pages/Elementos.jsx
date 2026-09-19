import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listenElementos } from "../lib/elementos";
import FormElemento from "../components/FormElemento";

export default function Elementos() {
  const [elementos, setElementos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => listenElementos(setElementos), []);

  const filtrados = elementos.filter((el) =>
    el.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Elementos</h1>
        <button
          className="btn-primary"
          onClick={() => setMostrarForm((v) => !v)}
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo elemento"}
        </button>
      </div>

      {mostrarForm && <FormElemento onCreado={() => setMostrarForm(false)} />}

      <input
        className="buscador"
        placeholder="Buscar elemento..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <ul className="lista">
        {filtrados.map((el) => (
          <li key={el.id}>
            <Link to={`/elementos/${el.id}`} className="fila-lista">
              <span>{el.nombre}</span>
              <span className="etiquetas">
                <span className="tag">{el.grupo}</span>
                {el.documentacionEntregada && <span className="tag">📄</span>}
                {el.pagaMensualidad && <span className="tag" title="Paga mensualidad">💳</span>}
                {el.pagaInscripcion && <span className="tag" title="Paga inscripción">🎟️</span>}
              </span>
            </Link>
          </li>
        ))}
        {filtrados.length === 0 && <p>Sin elementos todavía.</p>}
      </ul>
    </div>
  );
}
