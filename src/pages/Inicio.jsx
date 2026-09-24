import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { esAdmin } from "../lib/roles";

const SECCIONES = [
  ["/elementos", "👥", "Elementos", "Ver y registrar a las personas, y abrir su perfil"],
  ["/asistencia", "✅", "Asistencia", "Pasar lista y sacar el Estado de Fuerza"],
  ["/reporte-asistencia", "📊", "Reportes", "Lista de asistencia del mes en PDF"],
  ["/pagos", "💵", "Relación de pagos", "Cobros del día, entrega al proveedor y piezas por recibir"],
  ["/uniformidad", "👕", "Uniformes y Mensualidades", "Vender uniformes, cobrar mensualidades, entregas y cambios"],
];

const SECCIONES_ADMIN = [
  ["/usuarios", "🛡️", "Usuarios", "Dar de alta al personal y sus roles"],
  ["/configuracion", "⚙️", "Configuración", "Unidades, grados y catálogo"],
];

export default function Inicio() {
  const { perfil } = useAuth();
  const secciones = esAdmin(perfil) ? [...SECCIONES, ...SECCIONES_ADMIN] : SECCIONES;
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
