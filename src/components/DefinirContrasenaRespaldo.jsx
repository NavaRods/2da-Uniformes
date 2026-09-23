import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { definirContrasena } from "../lib/respaldo";

// TEMPORAL: para definir o cambiar la contraseña de respaldos desde la app.
// Cuando ya esté definida se quitará de Configuración (este archivo y su uso
// en SeccionRespaldo.jsx); la contraseña seguirá funcionando igual.
const LONGITUD_MINIMA = 8;

export default function DefinirContrasenaRespaldo({ existe, onDefinida }) {
  const { user } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  async function onGuardar(e) {
    e.preventDefault();
    setListo(false);
    if (nueva.length < LONGITUD_MINIMA) {
      setError(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
      return;
    }
    if (nueva !== repetida) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await definirContrasena({ actual, nueva, por: user.email });
      setActual("");
      setNueva("");
      setRepetida("");
      setListo(true);
      onDefinida();
    } catch (err) {
      setError(
        err?.code === "contrasena-incorrecta"
          ? "La contraseña actual no es correcta."
          : "No se pudo guardar. Verifica tu conexión e inténtalo de nuevo."
      );
    }
    setGuardando(false);
  }

  return (
    <form onSubmit={onGuardar} className="card">
      <h2>{existe ? "Cambiar contraseña de respaldos" : "Definir contraseña de respaldos"}</h2>
      <p className="nota">
        Opción temporal. Con esta contraseña se cifran los respaldos: sin ella no se pueden abrir
        ni restaurar, y no hay forma de recuperarla. Si la cambias, cada respaldo anterior se sigue
        abriendo con la contraseña con la que se hizo.
      </p>
      {existe && (
        <div className="campo">
          <label htmlFor="contrasena-actual">Contraseña actual</label>
          <input
            id="contrasena-actual"
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </div>
      )}
      <div className="campo">
        <label htmlFor="contrasena-nueva">Contraseña nueva</label>
        <input
          id="contrasena-nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="contrasena-repetida">Repite la contraseña nueva</label>
        <input
          id="contrasena-repetida"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      {listo && <p className="success-msg">✅ Contraseña guardada.</p>}
      <button type="submit" className="btn-primary" disabled={guardando || !nueva || (existe && !actual)}>
        {guardando ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
