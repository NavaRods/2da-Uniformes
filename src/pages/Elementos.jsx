import { useState } from "react";
import { Link } from "react-router-dom";
import { useElementos, useUnidades } from "../lib/fuentes";
import { useAuth } from "../auth/AuthContext";
import FormElemento from "../components/FormElemento";

export default function Elementos() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const [unidad, setUnidad] = useState(esAdmin ? "" : perfil?.unidad || "");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  const unidades = useUnidades(esAdmin);
  // El Admin elige una Unidad antes de cargar su lista: así no se leen todos
  // los elementos de todas las Unidades cada vez que se abre la pantalla.
  const elementos = useElementos(unidad);

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

      {esAdmin && (
        <div className="campo">
          <label>Unidad</label>
          <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>
            <option value="">Selecciona una Unidad...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        className="buscador"
        placeholder="Buscar elemento..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <ul className="lista">
        {filtrados.map((el) => (
          <li key={el.id}>
            <Link to={`/elementos/${el.id}`} state={{ unidad: el.unidad }} className="fila-lista">
              <span>{el.nombre}</span>
              <span className="etiquetas">
                <span className="tag">{el.grupo}</span>
                {el.pagaMensualidad && <span className="tag" title="Paga mensualidad">💳</span>}
                {el.pagaInscripcion && <span className="tag" title="Paga inscripción">🎟️</span>}
              </span>
            </Link>
          </li>
        ))}
        {filtrados.length === 0 && <p>{esAdmin && !unidad ? "Selecciona una Unidad para ver sus elementos." : "Sin elementos todavía."}</p>}
      </ul>
    </div>
  );
}
