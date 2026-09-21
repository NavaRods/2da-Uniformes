import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listenElementos, estaActivo } from "../lib/elementos";
import { useAuth } from "../auth/AuthContext";
import FormElemento from "../components/FormElemento";
import ListaBajas from "../components/ListaBajas";

export default function Elementos() {
  const { perfil } = useAuth();
  const [elementos, setElementos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [vista, setVista] = useState("activos"); // activos | bajas

  useEffect(
    () => listenElementos(setElementos, perfil?.rol === "admin" ? undefined : perfil?.unidad),
    [perfil?.rol, perfil?.unidad]
  );

  const coincide = (el) => el.nombre.toLowerCase().includes(busqueda.toLowerCase());
  const activos = elementos.filter(estaActivo).filter(coincide);
  const bajas = elementos.filter((el) => !estaActivo(el)).filter(coincide);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Elementos</h1>
        <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? "Cancelar" : "+ Nuevo elemento"}
        </button>
      </div>

      {mostrarForm && (
        <FormElemento
          onGuardado={() => setMostrarForm(false)}
          onCancelar={() => setMostrarForm(false)}
        />
      )}

      <div className="tabs" role="tablist">
        {[
          ["activos", "Activos"],
          ["bajas", `Bajas (${elementos.filter((el) => !estaActivo(el)).length})`],
        ].map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={vista === clave}
            className={`tab ${vista === clave ? "activo" : ""}`}
            onClick={() => setVista(clave)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <input
        className="buscador"
        placeholder="Buscar elemento..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {vista === "activos" && (
        <ul className="lista">
          {activos.map((el) => (
            <li key={el.id}>
              <Link to={`/elementos/${el.id}`} className="fila-lista">
                <span>{el.nombre}</span>
                <span className="etiquetas">
                  {el.gradoMilitar && <span className="tag">{el.gradoMilitar}</span>}
                  <span className="tag">{el.grupo}</span>
                  {el.pagaMensualidad && <span className="tag" title="Paga mensualidad">💳</span>}
                  {el.pagaInscripcion && <span className="tag" title="Paga inscripción">🎟️</span>}
                </span>
              </Link>
            </li>
          ))}
          {activos.length === 0 && <p>Sin elementos todavía.</p>}
        </ul>
      )}

      {vista === "bajas" && <ListaBajas bajas={bajas} />}
    </div>
  );
}
