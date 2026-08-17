import { useEffect, useState } from "react";
import { listenClientes } from "../lib/clientes";
import { listenAsistenciaDia, marcarAsistencia } from "../lib/asistencia";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Asistencia() {
  const [clientes, setClientes] = useState([]);
  const [fecha, setFecha] = useState(hoy());
  const [asistencia, setAsistencia] = useState({});

  useEffect(() => listenClientes(setClientes), []);
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
        {clientes.map((c) => (
          <li key={c.id} className="asistencia-row">
            <span>{c.nombre}</span>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!asistencia[c.id]}
                onChange={(e) =>
                  marcarAsistencia(fecha, c.id, e.target.checked)
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
