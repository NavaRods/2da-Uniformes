import { useEffect, useState } from "react";
import { listenElementos } from "../lib/elementos";
import { listenUnidades } from "../lib/unidades";
import { useAuth } from "../auth/AuthContext";
import {
  ESTADOS,
  fechaLocal,
  normalizarEstado,
  obtenerAsistenciasMes,
} from "../lib/asistencia";

const ABREVIATURA = Object.fromEntries(ESTADOS.map(([v, , abr]) => [v, abr]));

function mesActual() {
  return fechaLocal().slice(0, 7);
}

export default function ReporteAsistencia() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const [unidades, setUnidades] = useState([]);
  const [unidad, setUnidad] = useState(esAdmin ? "" : perfil?.unidad || "");
  const [elementos, setElementos] = useState([]);
  const [mes, setMes] = useState(mesActual());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (esAdmin) return listenUnidades(setUnidades);
  }, [esAdmin]);
  useEffect(
    () => listenElementos(setElementos, esAdmin ? unidad || undefined : unidad),
    [esAdmin, unidad]
  );

  async function generar() {
    if (!unidad) return;
    setCargando(true);
    const resultado = await obtenerAsistenciasMes(mes, unidad);
    setDatos(resultado);
    setCargando(false);
  }

  const dias = datos ? Object.keys(datos).sort() : [];

  return (
    <div className="page">
      <h1>Reporte mensual de asistencia</h1>

      {esAdmin && (
        <div className="campo">
          <label>Unidad</label>
          <select value={unidad} onChange={(e) => { setUnidad(e.target.value); setDatos(null); }}>
            <option value="">Selecciona una Unidad...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
      <button className="btn-primary" onClick={generar} disabled={cargando || !unidad}>
        {cargando ? "Generando..." : "Generar lista"}
      </button>

      {datos && (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Elemento</th>
                {dias.map((d) => (
                  <th key={d}>{d.slice(8)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {elementos
                // Las bajas de meses anteriores ya no forman parte de la lista.
                .filter((el) => !el.fechaBaja || el.fechaBaja >= `${mes}-01`)
                .map((el) => (
                <tr key={el.id}>
                  <td>{el.nombre}</td>
                  {dias.map((d) => (
                    <td key={d}>{ABREVIATURA[normalizarEstado(datos[d][el.id])] || ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
