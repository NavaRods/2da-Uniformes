import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { listenAbonosDelDia, listenCambiosPendientes } from "../lib/pedidos";
import { fechaLocalISO } from "../lib/format";

export default function RelacionPagos() {
  const [fecha, setFecha] = useState(fechaLocalISO());
  const [abonos, setAbonos] = useState([]);
  const [filas, setFilas] = useState([]);
  const [cambiosPendientes, setCambiosPendientes] = useState([]);

  useEffect(() => listenAbonosDelDia(fecha, setAbonos), [fecha]);
  useEffect(() => listenCambiosPendientes(setCambiosPendientes), []);

  useEffect(() => {
    let cancelado = false;
    async function enriquecer() {
      const resultado = await Promise.all(
        abonos.map(async (a) => {
          const [elementoSnap, pedidoSnap] = await Promise.all([
            getDoc(doc(db, "elementos", a.elementoId)),
            getDoc(doc(db, "elementos", a.elementoId, "pedidos", a.pedidoId)),
          ]);
          const pedido = pedidoSnap.exists() ? pedidoSnap.data() : null;
          return {
            ...a,
            elementoNombre: elementoSnap.exists()
              ? elementoSnap.data().nombre
              : "?",
            articulo: pedido ? pedido.articulo : "?",
            productoNombre: pedido ? pedido.productoNombre || pedido.articulo : "?",
            talla: pedido?.talla || "",
            color: pedido?.color || "",
            liquidado: pedido ? pedido.saldoPendiente <= 0 : false,
          };
        })
      );
      if (!cancelado) {
        // Más recientes primero dentro del mismo día.
        resultado.sort((a, b) => (a.horaLocal < b.horaLocal ? 1 : -1));
        setFilas(resultado);
      }
    }
    enriquecer();
    return () => {
      cancelado = true;
    };
  }, [abonos]);

  // Relación General: mismos movimientos del día, agrupados por pieza/talla
  // (sin nombre del elemento ni quién pagó), tal como se necesita para saber
  // qué se movió en el día a nivel de inventario.
  const resumenGeneral = {};
  for (const f of filas) {
    const clave = [f.productoNombre, f.talla, f.color].filter(Boolean).join(" — ");
    if (!resumenGeneral[clave]) {
      resumenGeneral[clave] = { cantidad: 0, total: 0 };
    }
    resumenGeneral[clave].cantidad += 1;
    resumenGeneral[clave].total += f.monto;
  }
  const totalGeneral = filas.reduce((s, f) => s + f.monto, 0);

  return (
    <div className="page">
      <h1>Relación de pagos</h1>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

      <h2>Detalle por elemento</h2>
      {filas.length === 0 && <p>Sin pagos registrados este día.</p>}
      <ul className="lista">
        {filas.map((f) => (
          <li key={f.id}>
            <strong>{f.elementoNombre}</strong> — {f.articulo} — ${f.monto}{" "}
            ({f.liquidado ? "Liquidado" : "Abono"}) — recibió {f.quienRecibio || "—"} —{" "}
            {f.fechaLocal} {f.horaLocal || ""}
          </li>
        ))}
      </ul>

      <h2>Relación de pagos General</h2>
      <p className="nota">Solo piezas, tallas y montos — sin datos de elementos.</p>
      {Object.keys(resumenGeneral).length === 0 && <p>Sin movimientos este día.</p>}
      <ul className="lista">
        {Object.entries(resumenGeneral).map(([pieza, r]) => (
          <li key={pieza}>
            {r.cantidad} × {pieza || "—"} = ${r.total}
          </li>
        ))}
      </ul>
      <p className="total-general">Total general del día = ${totalGeneral}</p>

      <h2>Cambios pendientes (todos los días)</h2>
      {cambiosPendientes.length === 0 && <p>No hay cambios pendientes.</p>}
      <ul className="lista">
        {cambiosPendientes.map((c) => (
          <li key={c.id}>
            {c.articulo}
            {c.motivoCambio ? ` — ${c.motivoCambio}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
