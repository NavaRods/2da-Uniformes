import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login, error } = useAuth();

  return (
    <div className="login-screen">
      <h1>Uniformes — Acceso</h1>
      <p>Inicia sesión con tu cuenta de Google autorizada.</p>
      {error && <p className="error">{error}</p>}
      <button onClick={login}>Iniciar sesión con Google</button>
    </div>
  );
}
