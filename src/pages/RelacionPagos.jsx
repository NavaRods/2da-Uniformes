import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listenAbonosDelDia } from "../lib/pedidos";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function RelacionPagos() {
  const [fecha, setFecha] = useState(hoy());
  const [abonos, setAbonos] = useState([]);
  const [filas, setFilas] = useState([]);

  useEffect(() => listenAbonosDelDia(fecha, setAbonos), [fecha]);

  useEffect(() => {
    let cancelado = false;
    async function enriquecer() {
      const resultado = await Promise.all(
        abonos.map(async (a) => {
          const [elementoSnap, pedidoSnap] = await Promise.all([
            getDoc(doc(db, "elementos", a.elementoId)),
            getDoc(doc(db, "elementos", a.elementoId, "pedidos", a.pedidoId)),
          ]);
          return {
            ...a,
            elementoNombre: elementoSnap.exists()
              ? elementoSnap.data().nombre
              : "?",
            articulo: pedidoSnap.exists() ? pedidoSnap.data().articulo : "?",
            liquidado: pedidoSnap.exists()
              ? pedidoSnap.data().saldoPendiente <= 0
              : false,
          };
        })
      );
      if (!cancelado) setFilas(resultado);
    }
    enriquecer();
    return () => {
      cancelado = true;
    };
  }, [abonos]);

  // Resumen agrupado por artículo
  const resumen = {};
  for (const f of filas) {
    if (!resumen[f.articulo]) resumen[f.articulo] = { cantidad: 0, total: 0 };
    resumen[f.articulo].cantidad += 1;
    resumen[f.articulo].total += f.monto;
  }
  const totalGeneral = filas.reduce((s, f) => s + f.monto, 0);

  return (
    <div className="page">
      <h1>Relación de pagos</h1>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

      <h2>Detalle</h2>
      {filas.length === 0 && <p>Sin pagos registrados este día.</p>}
      <ul className="lista">
        {filas.map((f) => (
          <li key={f.id}>
            <strong>{f.elementoNombre}</strong> — {f.articulo} ${f.monto} (
            {f.fechaLocal}) {f.liquidado ? "Liquidado" : "Abono"}
          </li>
        ))}
      </ul>

      <h2>Resumen del día</h2>
      <ul className="lista">
        {Object.entries(resumen).map(([articulo, r]) => (
          <li key={articulo}>
            {r.cantidad} {articulo} × ${(r.total / r.cantidad).toFixed(0)}{" "}
            aprox = ${r.total}
          </li>
        ))}
      </ul>
      <p className="total-general">Total general = ${totalGeneral}</p>
    </div>
  );
}
