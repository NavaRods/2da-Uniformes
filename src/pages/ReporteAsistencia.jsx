import { useEffect, useState } from "react";
import { listenElementos } from "../lib/elementos";
import { obtenerAsistenciasMes } from "../lib/asistencia";

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

export default function ReporteAsistencia() {
  const [elementos, setElementos] = useState([]);
  const [mes, setMes] = useState(mesActual());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => listenElementos(setElementos), []);

  async function generar() {
    setCargando(true);
    const resultado = await obtenerAsistenciasMes(mes);
    setDatos(resultado);
    setCargando(false);
  }

  const dias = datos ? Object.keys(datos).sort() : [];

  return (
    <div className="page">
      <h1>Reporte mensual de asistencia</h1>
      <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
      <button className="btn-primary" onClick={generar} disabled={cargando}>
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
              {elementos.map((el) => (
                <tr key={el.id}>
                  <td>{el.nombre}</td>
                  {dias.map((d) => (
                    <td key={d}>{datos[d][el.id] ? "✓" : ""}</td>
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
