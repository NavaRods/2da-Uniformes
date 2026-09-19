import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const SECCIONES = [
  ["/elementos", "👥", "Elementos", "Perfiles, datos y documentación"],
  ["/asistencia", "✅", "Asistencia", "Pasar lista de cada sesión"],
  ["/reporte-asistencia", "📊", "Reportes", "Resumen de asistencia"],
  ["/pagos", "💵", "Relación de pagos", "Mensualidades e inscripciones"],
  ["/uniformidad", "👕", "Uniformidad", "Pedidos, abonos y entregas"],
];

const SECCION_ADMIN = ["/usuarios", "🛡️", "Usuarios", "Cuentas, roles y Unidades"];

export default function Inicio() {
  const { perfil } = useAuth();
  const secciones = perfil?.rol === "admin" ? [...SECCIONES, SECCION_ADMIN] : SECCIONES;
  return (
    <div className="page">
      <h1>Uniformes</h1>
      <div className="inicio-grid">
        {secciones.map(([to, icono, titulo, detalle]) => (
          <Link key={to} to={to} className="inicio-card">
            <span className="inicio-icono" aria-hidden="true">{icono}</span>
            <span className="inicio-titulo">{titulo}</span>
            <span className="inicio-detalle">{detalle}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
