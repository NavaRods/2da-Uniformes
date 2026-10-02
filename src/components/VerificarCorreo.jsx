import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

// Pantalla para quien creó su cuenta con correo y contraseña y aún no abre el
// enlace de verificación. Mientras tanto no se carga nada de la app (las
// reglas de Firestore exigen el correo verificado).
export default function VerificarCorreo() {
  const { user, logout, reenviarVerificacion, revisarVerificacion } = useAuth();
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function reenviar() {
    setError("");
    setMensaje("");
    setOcupado(true);
    try {
      await reenviarVerificacion();
      setMensaje("Te mandamos otro correo. Revisa también la carpeta de spam.");
    } catch (e) {
      setError(e.message);
    }
    setOcupado(false);
  }

  async function yaVerifique() {
    setError("");
    setMensaje("");
    setOcupado(true);
    try {
      const listo = await revisarVerificacion();
      if (!listo) setError("Todavía no aparece verificado. Abre el enlace del correo y vuelve a intentar.");
    } catch {
      setError("No se pudo comprobar. Verifica tu conexión e inténtalo de nuevo.");
    }
    setOcupado(false);
  }

  return (
    <div className="login-screen">
      <h1>Verifica tu correo</h1>
      <p>
        Te mandamos un enlace a <strong>{user?.email}</strong>. Ábrelo para activar tu cuenta y
        luego toca “Ya verifiqué mi correo”.
      </p>
      {error && <p className="error">{error}</p>}
      {mensaje && <p className="success-msg">{mensaje}</p>}
      <div className="login-form">
        <button type="button" className="btn-primary" onClick={yaVerifique} disabled={ocupado}>
          Ya verifiqué mi correo
        </button>
        <button type="button" className="btn-secondary" onClick={reenviar} disabled={ocupado}>
          Reenviar correo
        </button>
        <button type="button" className="enlace" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
