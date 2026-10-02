import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { validarCredenciales } from "../lib/autenticacion";

const MODOS = {
  entrar: {
    titulo: "Iniciar sesión",
    boton: "Entrar",
    ayuda: "Entra con el correo con el que un administrador te dio de alta.",
  },
  crear: {
    titulo: "Crear cuenta",
    boton: "Crear cuenta",
    ayuda:
      "Usa el correo con el que un administrador te dio de alta. Te mandaremos un enlace para verificarlo.",
  },
  recuperar: {
    titulo: "Recuperar contraseña",
    boton: "Enviar enlace",
    ayuda: "Escribe tu correo y te mandamos un enlace para crear una contraseña nueva.",
  },
};

export default function Login() {
  const {
    user,
    loading,
    login,
    error: errorGoogle,
    loginConCorreo,
    registrarConCorreo,
    recuperarContrasena,
  } = useAuth();
  const [modo, setModo] = useState("entrar");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  function cambiarModo(nuevo) {
    setModo(nuevo);
    setError("");
    setAviso("");
    setContrasena("");
    setConfirmacion("");
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    if (modo === "recuperar") {
      const problema = validarCredenciales({ correo, contrasena: "-" });
      if (problema) return setError(problema);
    } else {
      const problema = validarCredenciales({
        correo,
        contrasena,
        confirmacion: modo === "crear" ? confirmacion : undefined,
      });
      if (problema) return setError(problema);
    }

    setEnviando(true);
    try {
      if (modo === "entrar") await loginConCorreo(correo, contrasena);
      else if (modo === "crear") await registrarConCorreo(correo, contrasena);
      else {
        await recuperarContrasena(correo);
        setAviso("Si ese correo tiene cuenta, te mandamos un enlace para crear una contraseña nueva.");
      }
    } catch (err) {
      setError(err.message);
    }
    setEnviando(false);
  }

  const { titulo, boton, ayuda } = MODOS[modo];

  return (
    <div className="login-screen">
      <h1>Uniformes — Acceso</h1>
      <h2 className="login-titulo">{titulo}</h2>
      <p className="nota">{ayuda}</p>

      <form className="login-form" onSubmit={enviar} noValidate>
        <label>
          Correo
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            autoFocus
          />
        </label>
        {modo !== "recuperar" && (
          <label>
            Contraseña
            <input
              type="password"
              autoComplete={modo === "crear" ? "new-password" : "current-password"}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </label>
        )}
        {modo === "crear" && (
          <label>
            Repite la contraseña
            <input
              type="password"
              autoComplete="new-password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}
        {aviso && <p className="success-msg">{aviso}</p>}

        <button type="submit" className="btn-primary" disabled={enviando}>
          {enviando ? "Un momento…" : boton}
        </button>
      </form>

      <div className="login-enlaces">
        {modo === "entrar" && (
          <>
            <button type="button" className="enlace" onClick={() => cambiarModo("recuperar")}>
              Olvidé mi contraseña
            </button>
            <button type="button" className="enlace" onClick={() => cambiarModo("crear")}>
              Crear cuenta
            </button>
          </>
        )}
        {modo !== "entrar" && (
          <button type="button" className="enlace" onClick={() => cambiarModo("entrar")}>
            ← Volver a iniciar sesión
          </button>
        )}
      </div>

      {modo === "entrar" && (
        <>
          <p className="login-separador">o</p>
          {errorGoogle && <p className="error">{errorGoogle}</p>}
          <button type="button" className="btn-secondary" onClick={login}>
            Iniciar sesión con Google
          </button>
        </>
      )}
    </div>
  );
}
