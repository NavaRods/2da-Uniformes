import { Link, useLocation, useNavigate } from "react-router-dom";

// "← Volver a …": regresa a la pantalla de donde se llegó (ver useDesde en
// lib/navegacion.js) o, si se entró directo, al lugar por defecto.
export default function BotonVolver({ porDefecto = "/", etiquetaPorDefecto = "Inicio" }) {
  const { state } = useLocation();
  const navigate = useNavigate();
  const desde = state?.desde;
  const ruta = desde?.ruta || porDefecto;
  const etiqueta = desde?.etiqueta || etiquetaPorDefecto;

  function volver(e) {
    e.preventDefault();
    // Con historial propio se retrocede (conserva scroll y estado guardado).
    if (desde) navigate(-1);
    else navigate(porDefecto);
  }

  return (
    <Link to={ruta} onClick={volver} className="volver boton-volver">
      ← Volver a {etiqueta}
    </Link>
  );
}
