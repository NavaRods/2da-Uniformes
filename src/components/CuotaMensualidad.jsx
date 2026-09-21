import { useState } from "react";
import {
  MENSUALIDAD_DEFAULT,
  MESES,
  claveMes,
  etiquetaMes,
  eliminarCuota,
  pagosPorMes,
  registrarMensualidad,
} from "../lib/cuotas";
import { actualizarElemento } from "../lib/elementos";
import { fechaLocal } from "../lib/asistencia";
import { formatoMoneda } from "../lib/format";
import { useAuth } from "../auth/AuthContext";

export default function CuotaMensualidad({ elemento, cuotas }) {
  const { user } = useAuth();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [seleccion, setSeleccion] = useState([]);
  const [precio, setPrecio] = useState(String(MENSUALIDAD_DEFAULT));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const pagos = pagosPorMes(cuotas);
  const mesActual = fechaLocal().slice(0, 7);
  const precioNum = Number(precio);
  const precioValido = precioNum > 0;
  const total = seleccion.length * (precioValido ? precioNum : 0);

  function alternarMes(clave) {
    setSeleccion((s) => (s.includes(clave) ? s.filter((m) => m !== clave) : [...s, clave]));
  }

  async function onRegistrar() {
    if (seleccion.length === 0 || !precioValido) return;
    setGuardando(true);
    setError("");
    try {
      await registrarMensualidad(elemento.id, {
        meses: seleccion,
        montoPorMes: precioNum,
        quienRecibio: user?.displayName || user?.email,
        unidad: elemento.unidad,
        elementoNombre: elemento.nombre,
      });
      if (!elemento.pagaMensualidad) {
        await actualizarElemento(elemento.id, { pagaMensualidad: true });
      }
      setSeleccion([]);
      // El precio vuelve al predeterminado: el cambio era solo para este cobro.
      setPrecio(String(MENSUALIDAD_DEFAULT));
    } catch {
      setError("No se pudo registrar el pago. Verifica tu conexión e inténtalo de nuevo.");
    }
    setGuardando(false);
  }

  async function onEliminar(cuota) {
    const meses = cuota.meses.map(etiquetaMes).join(", ");
    if (
      !confirm(
        `¿Eliminar el pago de ${meses} (${formatoMoneda(cuota.total)})? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await eliminarCuota(elemento.id, cuota.id);
    } catch {
      setError("No se pudo eliminar el pago. Verifica tu conexión e inténtalo de nuevo.");
    }
  }

  return (
    <>
      <div className="card">
        <h2>Cobrar mensualidad</h2>

        <div className="meses-anio">
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setAnio(anio - 1)}
            aria-label="Año anterior"
          >
            ‹
          </button>
          <strong>{anio}</strong>
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setAnio(anio + 1)}
            aria-label="Año siguiente"
          >
            ›
          </button>
        </div>

        <div className="meses-grid">
          {MESES.map((nombre, i) => {
            const clave = claveMes(anio, i);
            const pagado = clave in pagos;
            const elegido = seleccion.includes(clave);
            return (
              <button
                key={clave}
                type="button"
                className={[
                  "mes",
                  pagado ? "pagado" : "",
                  elegido ? "elegido" : "",
                  clave === mesActual ? "actual" : "",
                ].join(" ")}
                aria-pressed={elegido}
                disabled={pagado}
                title={pagado ? `Pagado (${formatoMoneda(pagos[clave])})` : undefined}
                onClick={() => alternarMes(clave)}
              >
                <span className="mes-nombre">{nombre}</span>
                <span className="mes-estado">
                  {pagado ? `✓ ${formatoMoneda(pagos[clave])}` : elegido ? "Elegido" : "—"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="campo">
          <label>Precio por mes</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
          <p className="nota">Solo cambia este cobro; el precio sugerido sigue siendo ${MENSUALIDAD_DEFAULT}.</p>
        </div>

        {error && <p className="error">{error}</p>}

        <button
          type="button"
          className="btn-primary"
          onClick={onRegistrar}
          disabled={guardando || seleccion.length === 0 || !precioValido}
        >
          {guardando
            ? "Guardando..."
            : seleccion.length === 0
              ? "Elige uno o más meses"
              : `Registrar ${seleccion.length} ${seleccion.length === 1 ? "mes" : "meses"} — ${formatoMoneda(total)}`}
        </button>
      </div>

      <div className="card">
        <h2>Pagos de mensualidad</h2>
        {cuotas.length === 0 && <p className="nota">Todavía no hay pagos registrados.</p>}
        <ul className="historial-cuotas">
          {cuotas.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.meses.map(etiquetaMes).join(", ")}</strong>
                <span className="nota">
                  {formatoMoneda(c.total)} ({formatoMoneda(c.montoPorMes)}/mes) · {c.fechaLocal}{" "}
                  {c.horaLocal || ""} · {c.quienRecibio}
                </span>
              </div>
              <button type="button" className="btn-secondary btn-small" onClick={() => onEliminar(c)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
