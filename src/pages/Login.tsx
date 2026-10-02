import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { validarCredenciales } from "../lib/autenticacion";
import AccesoLayout from "../components/AccesoLayout";

type Modo = "entrar" | "recuperar";

const TEXTOS: Record<Modo, { titulo: string; ayuda: string; boton: string }> = {
  entrar: {
    titulo: "Bienvenido de nuevo",
    ayuda: "Entra con tu correo y contraseña.",
    boton: "Entrar",
  },
  recuperar: {
    titulo: "Recupera tu contraseña",
    ayuda: "Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.",
    boton: "Enviar enlace",
  },
};

// Iconos de trazo (los mismos de Lucide), heredan el color del texto.
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconoCorreo = () => (
  <Icono>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Icono>
);

const IconoCandado = () => (
  <Icono>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icono>
);

const IconoOjo = () => (
  <Icono>
    <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
    <circle cx="12" cy="12" r="3" />
  </Icono>
);

const IconoOjoCerrado = () => (
  <Icono>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.5 0 8.5 2.8 9.94 6.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.49 2.7" />
    <path d="M6.61 6.61A13.5 13.5 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.5 16.2 7.5 19 12 19a9.7 9.7 0 0 0 5.39-1.61" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="m2 2 20 20" />
  </Icono>
);

function IconoGoogle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

interface CampoCorreoProps {
  valor: string;
  alCambiar: (valor: string) => void;
}

function CampoCorreo({ valor, alCambiar }: CampoCorreoProps) {
  return (
    <label className="acceso-campo">
      <span>Correo</span>
      <span className="acceso-entrada">
        <span className="acceso-icono">
          <IconoCorreo />
        </span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          autoFocus
        />
      </span>
    </label>
  );
}

interface CampoClaveProps {
  valor: string;
  alCambiar: (valor: string) => void;
}

// Contraseña con candado y un ojo para ver lo que se escribe (útil en el celular).
function CampoClave({ valor, alCambiar }: CampoClaveProps) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="acceso-campo">
      <span>Contraseña</span>
      <span className="acceso-entrada">
        <span className="acceso-icono">
          <IconoCandado />
        </span>
        <input
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
        />
        <button
          type="button"
          className="acceso-ver"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <IconoOjoCerrado /> : <IconoOjo />}
        </button>
      </span>
    </label>
  );
}

export default function Login() {
  const { user, loading, login, error: errorGoogle, loginConCorreo, recuperarContrasena } = useAuth();
  const [modo, setModo] = useState<Modo>("entrar");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError("");
    setAviso("");
    setContrasena("");
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAviso("");
    // Al recuperar solo hace falta el correo.
    const problema = validarCredenciales({
      correo,
      contrasena: modo === "recuperar" ? "-" : contrasena,
    });
    if (problema) {
      setError(problema);
      return;
    }

    setEnviando(true);
    try {
      if (modo === "entrar") await loginConCorreo(correo, contrasena);
      else {
        await recuperarContrasena(correo);
        setAviso("Si ese correo tiene cuenta, te mandamos un enlace para crear una contraseña nueva.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    }
    setEnviando(false);
  }

  const { titulo, ayuda, boton } = TEXTOS[modo];

  return (
    <AccesoLayout>
      <h2 className="acceso-titulo">{titulo}</h2>
      <p className="acceso-ayuda">{ayuda}</p>

      <form className="acceso-form" onSubmit={enviar} noValidate>
        <CampoCorreo valor={correo} alCambiar={setCorreo} />

        {modo === "entrar" && (
          <>
            <CampoClave valor={contrasena} alCambiar={setContrasena} />
            <button type="button" className="enlace acceso-olvide" onClick={() => cambiarModo("recuperar")}>
              Olvidé mi contraseña
            </button>
          </>
        )}

        <div aria-live="polite">
          {error && <p className="acceso-mensaje-error">{error}</p>}
          {aviso && <p className="acceso-mensaje-ok">{aviso}</p>}
        </div>

        <button type="submit" className="btn-primary acceso-boton" disabled={enviando}>
          {enviando ? "Un momento…" : boton}
        </button>
      </form>

      {modo === "recuperar" && (
        <button type="button" className="enlace acceso-volver" onClick={() => cambiarModo("entrar")}>
          ← Volver a iniciar sesión
        </button>
      )}

      {modo === "entrar" && (
        <>
          <div className="acceso-separador">
            <span>o continúa con</span>
          </div>
          {errorGoogle && <p className="acceso-mensaje-error">{errorGoogle}</p>}
          <button type="button" className="acceso-google" onClick={login}>
            <IconoGoogle />
            Google
          </button>
        </>
      )}
    </AccesoLayout>
  );
}
