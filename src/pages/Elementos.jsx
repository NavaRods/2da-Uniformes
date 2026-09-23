import { useState } from "react";
import { Link } from "react-router-dom";
import { useElementos, useUnidades } from "../lib/fuentes";
import { estaActivo } from "../lib/elementos";
import { useAuth } from "../auth/AuthContext";
import { veTodasLasUnidades, esSoloLectura } from "../lib/roles";
import FormElemento from "../components/FormElemento";
import ListaBajas from "../components/ListaBajas";

export default function Elementos() {
  const { perfil } = useAuth();
  const puedeElegirUnidad = veTodasLasUnidades(perfil);
  const soloLectura = esSoloLectura(perfil);
  // Responsable/Instructor traen su Unidad precargada y fija; el resto elige.
  const [unidad, setUnidad] = useState(puedeElegirUnidad ? "" : perfil?.unidad || "");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [vista, setVista] = useState("activos"); // activos | bajas

  const unidades = useUnidades(puedeElegirUnidad);
  // Sin Unidad elegida (roles que ven todas) no se carga nada: así no se leen
  // todos los elementos de todas las Unidades cada vez que se abre la pantalla.
  const elementos = useElementos(unidad);

  const coincide = (el) => el.nombre.toLowerCase().includes(busqueda.toLowerCase());
  const activos = elementos.filter(estaActivo).filter(coincide);
  const bajas = elementos.filter((el) => !estaActivo(el)).filter(coincide);
  const totalBajas = elementos.filter((el) => !estaActivo(el)).length;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Elementos</h1>
        {!soloLectura && (
          <button className="btn-primary" onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Cancelar" : "+ Nuevo elemento"}
          </button>
        )}
      </div>

      {mostrarForm && (
        <FormElemento
          onGuardado={() => setMostrarForm(false)}
          onCancelar={() => setMostrarForm(false)}
        />
      )}

      {puedeElegirUnidad && (
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

      <div className="tabs" role="tablist">
        {[
          ["activos", "Activos"],
          ["bajas", `Bajas (${totalBajas})`],
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
              <Link to={`/elementos/${el.id}`} state={{ unidad: el.unidad }} className="fila-lista">
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
          {activos.length === 0 && (
            <p>
              {puedeElegirUnidad && !unidad
                ? "Selecciona una Unidad para ver sus elementos."
                : "Sin elementos todavía."}
            </p>
          )}
        </ul>
      )}

      {vista === "bajas" && <ListaBajas bajas={bajas} soloLectura={soloLectura} />}
    </div>
  );
}
