import { useEffect, useState } from "react";
import { useElementos, useUnidades, useGrados } from "../lib/fuentes";
import { buscar } from "../lib/busqueda";
import { useAuth } from "../auth/AuthContext";
import { veTodasLasUnidades, esSoloLectura } from "../lib/roles";
import { useEstadoPersistente } from "../lib/navegacion";
import FormElemento from "../components/FormElemento";
import ListaBajas from "../components/ListaBajas";
import EstadoFuerza from "../components/EstadoFuerza";
import { comparadorPorJerarquia } from "../lib/grados";
import { estaActivo } from "../lib/elementos";
import {
  fechaLocal,
  listenAsistenciaDia,
  marcarAsistencia,
  normalizarEstado,
} from "../lib/asistencia";

// Botones de cada renglón de la lista (la baja va aparte, con confirmación).
const OPCIONES_LISTA = [
  ["asistencia", "Asistió"],
  ["falta", "Faltó"],
  ["justificada", "Justificada"],
];

export default function Asistencia() {
  const { user, perfil } = useAuth();
  const puedeElegirUnidad = veTodasLasUnidades(perfil);
  const soloLectura = esSoloLectura(perfil);
  // Lo elegido se recuerda al volver de otra pantalla (por usuario).
  const [unidadElegida, setUnidad] = useEstadoPersistente(`${user?.email}:asistencia:unidad`, "");
  // Responsable/Instructor traen su Unidad precargada y fija; el resto elige.
  const unidad = puedeElegirUnidad ? unidadElegida : perfil?.unidad || "";
  const [fecha, setFecha] = useState(fechaLocal());
  const [asistencia, setAsistencia] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [vista, setVista] = useEstadoPersistente(`${user?.email}:asistencia:vista`, "lista"); // lista | fuerza | bajas
  const grados = useGrados();

  const unidades = useUnidades(puedeElegirUnidad);
  // Sin Unidad elegida (roles que ven todas) no se carga nada: antes leía
  // todos los elementos.
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

  const elementosDeUnidad = puedeElegirUnidad
    ? elementos.filter((e) => !unidad || e.unidad === unidad)
    : elementos;
  // Los elementos de baja no aparecen en la Lista (ni al buscar): para eso
  // está la pestaña de Bajas, donde se pueden reactivar.
  const activos = elementosDeUnidad.filter((el) => estaActivo(el));
  const visibles = (busqueda.trim() ? buscar(activos, busqueda, (el) => el.nombre) : activos)
    .slice()
    .sort(comparadorPorJerarquia(grados));
  const bajas = elementosDeUnidad.filter((el) => !estaActivo(el));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Asistencia</h1>
        {!soloLectura && (
          <button
            className="btn-primary"
            onClick={() => setMostrarForm((v) => !v)}
          >
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

      {(!puedeElegirUnidad || unidad) && (
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
              placeholder="Buscar elemento..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {error && <p className="error">{error}</p>}

          <div className="tabs" role="tablist">
            {[
              ["lista", "Lista"],
              ["fuerza", "Estado de Fuerza"],
              ["bajas", `Bajas (${bajas.length})`],
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

          {vista === "fuerza" && (
            <EstadoFuerza
              elementos={elementosDeUnidad}
              asistencia={asistencia}
              grados={grados}
              unidad={unidad}
              fecha={fecha}
            />
          )}

          {vista === "bajas" && <ListaBajas bajas={bajas} soloLectura={soloLectura} />}

          {vista === "lista" && (
          <>
          <p className="ayuda">
            Toca <strong>Asistió</strong>, <strong>Faltó</strong> o <strong>Justificada</strong> en cada
            persona. Se guarda al instante. Cuando termines, abre <strong>Estado de Fuerza</strong>.
          </p>
          {activos.length > 0 && (
            <p className="nota">
              Marcados: {activos.filter((el) => normalizarEstado(asistencia[el.id])).length} de {activos.length}
            </p>
          )}
          <ul className="lista">
            {visibles.map((el) => {
              const estado = normalizarEstado(asistencia[el.id]);
              return (
                <li key={el.id} className="asistencia-row asistencia-row-botones">
                  <span className="asistencia-nombre">
                    {el.nombre}
                    {el.gradoMilitar && <span className="tag">{el.gradoMilitar}</span>}
                  </span>
                  <div className="asistencia-estados" role="group" aria-label={`Asistencia de ${el.nombre}`}>
                    {OPCIONES_LISTA.map(([valor, etiqueta]) => (
                      <button
                        key={valor}
                        type="button"
                        className={`estado-boton estado-boton-${valor} ${estado === valor ? "activo" : ""}`}
                        aria-pressed={estado === valor}
                        disabled={soloLectura}
                        onClick={() => cambiar(el, valor)}
                      >
                        {etiqueta}
                      </button>
                    ))}
                    {!soloLectura && (
                      <button
                        type="button"
                        className="estado-boton estado-boton-baja"
                        onClick={() => {
                          if (confirm(`¿Dar de baja a ${el.nombre}? Dejará de aparecer en la lista y podrás reactivarlo en la pestaña Bajas.`)) {
                            cambiar(el, "baja");
                          }
                        }}
                      >
                        Baja
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {visibles.length === 0 && <p className="nota">No hay elementos.</p>}
          </>
          )}
        </>
      )}
    </div>
  );
}
