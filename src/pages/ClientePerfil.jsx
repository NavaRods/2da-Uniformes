import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { marcarDocumentacion } from "../lib/clientes";
import {
  listenPedidosDeCliente,
  crearPedido,
  marcarEntregado,
} from "../lib/pedidos";
import PedidoCard from "../components/PedidoCard";

export default function ClientePerfil() {
  const { clienteId } = useParams();
  const [cliente, setCliente] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [nuevoPedido, setNuevoPedido] = useState({ articulo: "", precioTotal: "" });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "clientes", clienteId), (snap) => {
      setCliente(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, [clienteId]);

  useEffect(() => listenPedidosDeCliente(clienteId, setPedidos), [clienteId]);

  async function onNuevoPedido(e) {
    e.preventDefault();
    if (!nuevoPedido.articulo || !nuevoPedido.precioTotal) return;
    await crearPedido(clienteId, nuevoPedido);
    setNuevoPedido({ articulo: "", precioTotal: "" });
  }

  if (!cliente) return <p className="page">Cargando...</p>;

  return (
    <div className="page">
      <Link to="/clientes">← Volver</Link>
      <h1>{cliente.nombre}</h1>
      <p>Edad: {cliente.edad || "—"} · Tel: {cliente.telefono || "—"}</p>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!cliente.documentacionEntregada}
          onChange={(e) => marcarDocumentacion(clienteId, e.target.checked)}
        />
        Documentación entregada (acta, CURP, etc. vía Google Form)
      </label>

      <form onSubmit={onNuevoPedido} className="card">
        <h2>Nuevo pedido</h2>
        <input
          placeholder="Artículo (ej. Uniforme talla M)"
          value={nuevoPedido.articulo}
          onChange={(e) =>
            setNuevoPedido({ ...nuevoPedido, articulo: e.target.value })
          }
        />
        <input
          placeholder="Precio total"
          type="number"
          value={nuevoPedido.precioTotal}
          onChange={(e) =>
            setNuevoPedido({ ...nuevoPedido, precioTotal: e.target.value })
          }
        />
        <button type="submit">Agregar pedido</button>
      </form>

      <h2>Pedidos</h2>
      {pedidos.length === 0 && <p>Sin pedidos todavía.</p>}
      {pedidos.map((p) => (
        <PedidoCard
          key={p.id}
          cliente={cliente}
          pedido={p}
          onEntregar={(entregado) =>
            marcarEntregado(clienteId, p.id, entregado)
          }
        />
      ))}
    </div>
  );
}
