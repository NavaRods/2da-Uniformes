import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { user, loading, login, error } = useAuth();

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="login-screen">
      <h1>Uniformes — Acceso</h1>
      <p>Inicia sesión con tu cuenta de Google autorizada.</p>
      {error && <p className="error">{error}</p>}
      <button onClick={login}>Iniciar sesión con Google</button>
    </div>
  );
}
