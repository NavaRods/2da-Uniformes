import { useEffect, useState } from "react";
import { useElementos, useUnidades } from "../lib/fuentes";
import { buscar } from "../lib/busqueda";
import { useAuth } from "../auth/AuthContext";
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
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const [unidad, setUnidad] = useState(esAdmin ? "" : perfil?.unidad || "");
  const [fecha, setFecha] = useState(fechaLocal());
  const [asistencia, setAsistencia] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  const unidades = useUnidades(esAdmin);
  // Sin Unidad elegida (Admin) no se carga nada: antes leía todos los elementos.
  const elementos = useElementos(unidad);
  useEffect(() => listenAsistenciaDia(fecha, unidad, setAsistencia), [fecha, unidad]);

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
  const elementosDeUnidad = esAdmin ? elementos.filter((e) => !unidad || e.unidad === unidad) : elementos;
  const visibles = busqueda.trim()
    ? buscar(elementosDeUnidad, busqueda, (el) => el.nombre)
    : elementosDeUnidad.filter((el) => visibleEnLista(el, fecha));

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

      {(!esAdmin || unidad) && (
        <>
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
        </>
      )}
    </div>
  );
}
