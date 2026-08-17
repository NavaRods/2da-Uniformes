import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Login from "./pages/Login";
import Clientes from "./pages/Clientes";
import ClientePerfil from "./pages/ClientePerfil";
import Asistencia from "./pages/Asistencia";
import ReporteAsistencia from "./pages/ReporteAsistencia";
import RelacionPagos from "./pages/RelacionPagos";
import Catalogo from "./pages/Catalogo";
import "./App.css";

function Privado({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="page">Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <nav className="nav">
      <Link to="/clientes">Clientes</Link>
      <Link to="/asistencia">Asistencia</Link>
      <Link to="/reporte-asistencia">Reporte mensual</Link>
      <Link to="/pagos">Relación de pagos</Link>
      <Link to="/catalogo">Catálogo</Link>
      <button onClick={logout}>Salir ({user.displayName || user.email})</button>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/clientes"
            element={
              <Privado>
                <Clientes />
              </Privado>
            }
          />
          <Route
            path="/clientes/:clienteId"
            element={
              <Privado>
                <ClientePerfil />
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
          <Route path="*" element={<Navigate to="/clientes" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
