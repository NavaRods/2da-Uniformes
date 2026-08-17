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
import { listenCatalogo, TALLA_TIPO } from "../lib/catalogo";
import PedidoCard from "../components/PedidoCard";

export default function ClientePerfil() {
  const { clienteId } = useParams();
  const [cliente, setCliente] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [productoId, setProductoId] = useState("");
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");
  const [precioManual, setPrecioManual] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "clientes", clienteId), (snap) => {
      setCliente(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, [clienteId]);

  useEffect(() => listenPedidosDeCliente(clienteId, setPedidos), [clienteId]);
  useEffect(() => listenCatalogo(setCatalogo), []);

  const producto = catalogo.find((p) => p.id === productoId);

  function onSeleccionarProducto(id) {
    setProductoId(id);
    const p = catalogo.find((x) => x.id === id);
    setTalla("");
    setColor(p?.colores?.[0] || "");
    setPrecioManual(p ? String(p.precio) : "");
  }

  async function onNuevoPedido(e) {
    e.preventDefault();
    if (!producto || !precioManual) return;
    if (producto.tallaTipo === TALLA_TIPO.LISTA && !talla) return;
    if (producto.tallaTipo === TALLA_TIPO.LIBRE && !talla) return;

    const partes = [producto.nombre];
    if (color) partes.push(color);
    if (talla) partes.push(`talla ${talla}`);

    await crearPedido(clienteId, {
      articulo: partes.join(" — "),
      precioTotal: precioManual,
    });

    setProductoId("");
    setTalla("");
    setColor("");
    setPrecioManual("");
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
        <select value={productoId} onChange={(e) => onSeleccionarProducto(e.target.value)}>
          <option value="">Selecciona un producto...</option>
          {["Varonil", "Femenino", "Ambos"].map((grupo) => (
            <optgroup key={grupo} label={grupo}>
              {catalogo
                .filter((p) => p.grupo === grupo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — ${p.precio}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        {producto?.colores?.length > 0 && (
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            {producto.colores.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}

        {producto?.tallaTipo === TALLA_TIPO.LISTA && (
          <select value={talla} onChange={(e) => setTalla(e.target.value)}>
            <option value="">Talla...</option>
            {producto.tallas.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}

        {producto?.tallaTipo === TALLA_TIPO.LIBRE && (
          <input
            placeholder="Talla (a la medida)"
            value={talla}
            onChange={(e) => setTalla(e.target.value)}
          />
        )}

        {producto && (
          <input
            placeholder="Precio total"
            type="number"
            value={precioManual}
            onChange={(e) => setPrecioManual(e.target.value)}
          />
        )}

        <button type="submit" disabled={!producto}>
          Agregar pedido
        </button>
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
