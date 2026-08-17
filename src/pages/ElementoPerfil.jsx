import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { marcarDocumentacion } from "../lib/elementos";
import {
  listenPedidosDeElemento,
  crearPedido,
  marcarEntregado,
} from "../lib/pedidos";
import { listenCatalogo, TALLA_TIPO } from "../lib/catalogo";
import PedidoCard from "../components/PedidoCard";

export default function ElementoPerfil() {
  const { elementoId } = useParams();
  const [elemento, setElemento] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [productoId, setProductoId] = useState("");
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");
  const [precioManual, setPrecioManual] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "elementos", elementoId), (snap) => {
      setElemento(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, [elementoId]);

  useEffect(() => listenPedidosDeElemento(elementoId, setPedidos), [elementoId]);
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

    await crearPedido(elementoId, {
      articulo: partes.join(" — "),
      precioTotal: precioManual,
    });

    setProductoId("");
    setTalla("");
    setColor("");
    setPrecioManual("");
  }

  if (!elemento) return <p className="page">Cargando...</p>;

  const datos = [
    ["Unidad", elemento.unidad],
    ["Edad", elemento.edad],
    ["Fecha de nacimiento", elemento.fechaNacimiento],
    ["Teléfono(s)", elemento.telefonos?.join(", ")],
    ["Dirección", elemento.direccion],
    ["Escuela", elemento.escuela],
    ["Turno", elemento.turno],
    ["Grado escolar", elemento.gradoEscolar],
    ["Padre/Madre/Tutor", elemento.tutor],
    ["Cómo se enteró", elemento.comoSeEntero],
    ["Seguro social / servicio médico", elemento.seguroSocial],
    ["Alergias / padecimientos", elemento.alergias],
    ["Paga mensualidad", elemento.pagaMensualidad ? "Sí" : "No"],
    ["Paga inscripción", elemento.pagaInscripcion ? "Sí" : "No"],
  ];

  return (
    <div className="page">
      <Link to="/elementos" className="volver">← Volver</Link>
      <h1>{elemento.nombre}</h1>

      <div className="card ficha">
        {datos.map(([etiqueta, valor]) => (
          <div className="ficha-fila" key={etiqueta}>
            <span className="ficha-etiqueta">{etiqueta}</span>
            <span className="ficha-valor">{valor || "—"}</span>
          </div>
        ))}
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!elemento.documentacionEntregada}
          onChange={(e) => marcarDocumentacion(elementoId, e.target.checked)}
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

        <button type="submit" className="btn-primary" disabled={!producto}>
          Agregar pedido
        </button>
      </form>

      <h2>Pedidos</h2>
      {pedidos.length === 0 && <p>Sin pedidos todavía.</p>}
      {pedidos.map((p) => (
        <PedidoCard
          key={p.id}
          cliente={elemento}
          pedido={p}
          onEntregar={(entregado) =>
            marcarEntregado(elementoId, p.id, entregado)
          }
        />
      ))}
    </div>
  );
}
