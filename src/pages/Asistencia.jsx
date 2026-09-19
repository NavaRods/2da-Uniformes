import { useEffect, useState } from "react";
import { listenElementos } from "../lib/elementos";
import { buscar } from "../lib/busqueda";
import FormElemento from "../components/FormElemento";
import {
  ESTADOS,
  fechaLocal,
  listenAsistenciaDia,
  marcarAsistencia,
  normalizarEstado,
  estaDeBaja,
  visibleEnLista,
} from "../lib/asistencia";

export default function Asistencia() {
  const [elementos, setElementos] = useState([]);
  const [fecha, setFecha] = useState(fechaLocal());
  const [asistencia, setAsistencia] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => listenElementos(setElementos), []);
  useEffect(() => listenAsistenciaDia(fecha, setAsistencia), [fecha]);

  async function cambiar(el, estado) {
    setError("");
    try {
      await marcarAsistencia(fecha, el, estado);
    } catch {
      setError("No se pudo guardar. Verifica tu conexión e inténtalo de nuevo.");
    }
  }

  // Sin búsqueda: solo la lista del día (sin las bajas anteriores).
  // Con búsqueda: se consulta a todos, incluidas las bajas.
  const visibles = busqueda.trim()
    ? buscar(elementos, busqueda, (el) => el.nombre)
    : elementos.filter((el) => visibleEnLista(el, fecha));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Asistencia</h1>
        <button
          className="btn-primary"
          onClick={() => setMostrarForm((v) => !v)}
        >
          {mostrarForm ? "Cancelar" : "+ Nuevo elemento"}
        </button>
      </div>

      {mostrarForm && <FormElemento onCreado={() => setMostrarForm(false)} />}

      <div className="asistencia-controles">
        <input
          type="date"
          value={fecha}
          max={fechaLocal()}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
        />
        <input
          type="search"
          placeholder="Buscar elemento (incluye bajas)..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}

      <ul className="lista">
        {visibles.map((el) => {
          const baja = estaDeBaja(el, fecha);
          const estado = baja ? "baja" : normalizarEstado(asistencia[el.id]);
          return (
            <li key={el.id} className="asistencia-row">
              <span>
                {el.nombre}
                {el.fechaBaja && (
                  <span className="tag tag-baja">Baja {el.fechaBaja}</span>
                )}
              </span>
              <select
                value={estado}
                onChange={(e) => cambiar(el, e.target.value)}
                className={`estado estado-${estado || "sin"}`}
                aria-label={`Estado de ${el.nombre}`}
              >
                <option value="" disabled>
                  Sin marcar
                </option>
                {ESTADOS.map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      {visibles.length === 0 && <p className="nota">No hay elementos.</p>}
    </div>
  );
}
