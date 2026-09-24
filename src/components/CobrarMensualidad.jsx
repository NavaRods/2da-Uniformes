import { useEffect, useState } from "react";
import { listenCuotas } from "../lib/cuotas";
import CuotaMensualidad from "./CuotaMensualidad";

// Cobro de mensualidades de un elemento, con sus pagos anteriores. Es el mismo
// cobro que la pestaña Cuotas del perfil, pero sin salir de Uniformes y
// Mensualidades.
export default function CobrarMensualidad({ elemento }) {
  const [cuotas, setCuotas] = useState([]);
  useEffect(() => listenCuotas(elemento.id, setCuotas), [elemento.id]);
  return <CuotaMensualidad elemento={elemento} cuotas={cuotas} />;
}
