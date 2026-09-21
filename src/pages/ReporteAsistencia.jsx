import { useState } from "react";
import { useElementos, useUnidades, useGrados } from "../lib/fuentes";
import { useAuth } from "../auth/AuthContext";
import { domingosDelMes, fechaLocal, obtenerAsistenciasDias } from "../lib/asistencia";
import {
  LEYENDA,
  cabecerasReporte,
  descargarPdfAsistencia,
  etiquetaMesReporte,
  filaComoLista,
  filasReporte,
} from "../lib/reporteAsistencia";

function mesActual() {
  return fechaLocal().slice(0, 7);
}

export default function ReporteAsistencia() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const grados = useGrados();
  const [unidad, setUnidad] = useState(esAdmin ? "" : perfil?.unidad || "");
  const [mes, setMes] = useState(mesActual());
  const [reporte, setReporte] = useState(null); // { unidad, mes, domingos, filas }
  const [cargando, setCargando] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [error, setError] = useState("");

  const unidades = useUnidades(esAdmin);
  // Sin Unidad elegida (Admin) no se carga nada: antes leía todos los elementos.
  const elementos = useElementos(unidad);

  async function generar() {
    if (!unidad || !mes) return;
    setCargando(true);
    setError("");
    try {
      const domingos = domingosDelMes(mes);
      const asistencias = await obtenerAsistenciasDias(domingos, unidad);
      const deLaUnidad = elementos.filter((el) => el.unidad === unidad);
      setReporte({
        unidad,
        mes,
        domingos,
        filas: filasReporte({ elementos: deLaUnidad, asistencias, domingos, mes, grados }),
      });
    } catch {
      setError("No se pudo generar el reporte. Verifica tu conexión e inténtalo de nuevo.");
    }
    setCargando(false);
  }

  async function descargarPdf() {
    setGenerandoPdf(true);
    setError("");
    try {
      await descargarPdfAsistencia(reporte);
    } catch {
      setError("No se pudo crear el PDF. Inténtalo de nuevo.");
    }
    setGenerandoPdf(false);
  }

  return (
    <div className="page">
      <h1>Reporte mensual de asistencia</h1>

      {esAdmin && (
        <div className="campo">
          <label>Unidad</label>
          <select
            value={unidad}
            onChange={(e) => {
              setUnidad(e.target.value);
              setReporte(null);
            }}
          >
            <option value="">Selecciona una Unidad...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="asistencia-controles">
        <input
          type="month"
          value={mes}
          onChange={(e) => {
            setMes(e.target.value);
            setReporte(null);
          }}
        />
        <button className="btn-primary" onClick={generar} disabled={cargando || !unidad || !mes}>
          {cargando ? "Generando..." : "Generar lista"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {reporte && (
        <>
          <div className="page-header">
            <div>
              <h2>
                {reporte.unidad} · {etiquetaMesReporte(reporte.mes)}
              </h2>
              <p className="nota">{LEYENDA}</p>
            </div>
            <button
              className="btn-primary"
              onClick={descargarPdf}
              disabled={generandoPdf || reporte.filas.length === 0}
            >
              {generandoPdf ? "Creando PDF..." : "📄 Descargar PDF"}
            </button>
          </div>

          {reporte.filas.length === 0 ? (
            <p className="nota">No hay elementos en esta Unidad.</p>
          ) : (
            <div className="tabla-scroll">
              <table>
                <thead>
                  <tr>
                    {cabecerasReporte(reporte.domingos).map((c, i) => (
                      <th key={i}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reporte.filas.map((fila, i) => (
                    <tr key={i}>
                      {filaComoLista(fila).map((celda, j) => (
                        <td key={j}>{celda}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
