import { useEffect, useState } from "react";
import { listenElementos } from "../lib/elementos";
import { listenAsistenciaDia, marcarAsistencia } from "../lib/asistencia";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Asistencia() {
  const [elementos, setElementos] = useState([]);
  const [fecha, setFecha] = useState(hoy());
  const [asistencia, setAsistencia] = useState({});

  useEffect(() => listenElementos(setElementos), []);
  useEffect(() => listenAsistenciaDia(fecha, setAsistencia), [fecha]);

  return (
    <div className="page">
      <h1>Asistencia</h1>
      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
      />

      <ul className="lista">
        {elementos.map((el) => (
          <li key={el.id} className="asistencia-row">
            <span>{el.nombre}</span>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!asistencia[el.id]}
                onChange={(e) =>
                  marcarAsistencia(fecha, el.id, e.target.checked)
                }
              />
              Presente
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
