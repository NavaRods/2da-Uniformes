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
import "./App.css";

function Privado({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="page">Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
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
