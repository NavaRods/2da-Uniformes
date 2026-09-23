import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import Elementos from "./pages/Elementos";
import ElementoPerfil from "./pages/ElementoPerfil";
import Asistencia from "./pages/Asistencia";
import ReporteAsistencia from "./pages/ReporteAsistencia";
import RelacionPagos from "./pages/RelacionPagos";
import Catalogo from "./pages/Catalogo";
import Uniformidad from "./pages/Uniformidad";
import Usuarios from "./pages/Usuarios";
import Configuracion from "./pages/Configuracion";
import EstadoConexion from "./components/EstadoConexion";
import { esAdmin, requiereUnidad } from "./lib/roles";
import "./App.css";

function Privado({ children, soloAdmin = false }) {
  const { user, perfil, loading, logout } = useAuth();
  if (loading) return <p className="page">Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!perfil) {
    return (
      <div className="page">
        <h1>Sin acceso</h1>
        <p>Tu cuenta no tiene acceso a la app. Contacta a un administrador.</p>
        <button className="btn-secondary" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    );
  }
  if (requiereUnidad(perfil.rol) && !perfil.unidad) {
    return (
      <div className="page">
        <h1>Sin Unidad asignada</h1>
        <p>Tu cuenta todavía no tiene una Unidad asignada. Contacta a un administrador.</p>
        <button className="btn-secondary" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    );
  }
  if (soloAdmin && !esAdmin(perfil)) return <Navigate to="/" replace />;
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  const { tema, alternar } = useTheme();
  const location = useLocation();
  if (!user) return null;

  return (
    <nav className="nav">
      {location.pathname !== "/" && <Link to="/">← Inicio</Link>}
      <span className="nav-spacer" />
      <button className="theme-toggle" onClick={alternar} title="Cambiar tema">
        {tema === "dark" ? "☀️" : "🌙"}
      </button>
      <button className="nav-btn nav-salir" onClick={logout}>
        Salir
      </button>
    </nav>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Nav />
      <EstadoConexion />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <Privado>
              <Inicio />
            </Privado>
          }
        />
        <Route
          path="/elementos"
          element={
            <Privado>
              <Elementos />
            </Privado>
          }
        />
        <Route
          path="/elementos/:elementoId"
          element={
            <Privado>
              <ElementoPerfil />
            </Privado>
          }
        />
        <Route
          path="/asistencia"
          element={
            <Privado>
              <Asistencia />
            </Privado>
          }
        />
        <Route
          path="/reporte-asistencia"
          element={
            <Privado>
              <ReporteAsistencia />
            </Privado>
          }
        />
        <Route
          path="/pagos"
          element={
            <Privado>
              <RelacionPagos />
            </Privado>
          }
        />
        <Route
          path="/catalogo"
          element={
            <Privado>
              <Catalogo />
            </Privado>
          }
        />
        <Route
          path="/uniformidad"
          element={
            <Privado>
              <Uniformidad />
            </Privado>
          }
        />
        <Route
          path="/usuarios"
          element={
            <Privado soloAdmin>
              <Usuarios />
            </Privado>
          }
        />
        <Route
          path="/configuracion"
          element={
            <Privado soloAdmin>
              <Configuracion />
            </Privado>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
