import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AccesoLayout from "./AccesoLayout";

const mensajeDe = (e: unknown, alternativo: string) => (e instanceof Error ? e.message : alternativo);

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
      setError(mensajeDe(e, "No se pudo reenviar el correo."));
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
    <AccesoLayout>
      <div className="acceso-sobre" aria-hidden="true">
        ✉️
      </div>
      <h2 className="acceso-titulo">Verifica tu correo</h2>
      <p className="acceso-ayuda">
        Para entrar necesitas verificar <strong>{user?.email}</strong>. Si no te llegó el enlace,
        toca “Reenviar correo”; ábrelo y luego toca “Ya verifiqué mi correo”.
      </p>

      <div aria-live="polite">
        {error && <p className="acceso-mensaje-error">{error}</p>}
        {mensaje && <p className="acceso-mensaje-ok">{mensaje}</p>}
      </div>

      <div className="acceso-form">
        <button type="button" className="btn-primary acceso-boton" onClick={yaVerifique} disabled={ocupado}>
          Ya verifiqué mi correo
        </button>
        <button type="button" className="acceso-google" onClick={reenviar} disabled={ocupado}>
          Reenviar correo
        </button>
        <button type="button" className="enlace acceso-volver" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </AccesoLayout>
  );
}
