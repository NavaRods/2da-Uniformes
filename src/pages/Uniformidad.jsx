import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listenElementos } from "../lib/elementos";
import { listenCatalogo, requiereTalla, TALLA_TIPO } from "../lib/catalogo";
import { crearPedido, registrarAbono } from "../lib/pedidos";
import { linkWhatsapp } from "../lib/whatsapp";
import { useAuth } from "../auth/AuthContext";

export default function Uniformidad() {
  const { user, perfil } = useAuth();
  const [elementos, setElementos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);

  const [elementoSeleccionado, setElementoSeleccionado] = useState(null);
  const [elementoParaConfirmar, setElementoParaConfirmar] = useState(null);

  const [productoId, setProductoId] = useState("");
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");
  const [tipoPago, setTipoPago] = useState("liquidacion");
  const [monto, setMonto] = useState("");

  const [carrito, setCarrito] = useState([]);
  const [cerrando, setCerrando] = useState(false);
  const [ventaCerrada, setVentaCerrada] = useState(false);

  useEffect(
    () => listenElementos(setElementos, perfil?.rol === "admin" ? undefined : perfil?.unidad),
    [perfil?.rol, perfil?.unidad]
  );
  useEffect(() => listenCatalogo(setCatalogo), []);

  const producto = catalogo.find((p) => p.id === productoId);
  const faltaTalla = requiereTalla(producto) && !talla.trim();

  function onSeleccionarProducto(id) {
    setProductoId(id);
    const p = catalogo.find((x) => x.id === id);
    setTalla("");
    setColor(p?.colores?.[0] || "");
    setTipoPago("liquidacion");
    setMonto(p ? String(p.precio) : "");
  }

  function onCambiarTipoPago(tipo) {
    setTipoPago(tipo);
    if (tipo === "liquidacion" && producto) setMonto(String(producto.precio));
    if (tipo === "abono") setMonto("");
  }

  function elegirElemento(id) {
    const el = elementos.find((e) => e.id === id);
    setElementoParaConfirmar(el || null);
  }

  function confirmarElemento() {
    setElementoSeleccionado(elementoParaConfirmar);
    setElementoParaConfirmar(null);
    setCarrito([]);
    setVentaCerrada(false);
  }

  function cancelarConfirmacion() {
    setElementoParaConfirmar(null);
  }

  function agregarAlCarrito() {
    if (!producto || !monto) return;
    if (faltaTalla) return;

    const partes = [producto.nombre];
    if (color) partes.push(color);
    if (talla) partes.push(`talla ${talla}`);

    setCarrito((c) => [
      ...c,
      {
        key: crypto.randomUUID(),
        articulo: partes.join(" — "),
        productoNombre: producto.nombre,
        talla,
        color,
        precioTotal: producto.precio,
        tipoPago,
        monto: Number(monto),
      },
    ]);

    setProductoId("");
    setTalla("");
    setColor("");
    setTipoPago("liquidacion");
    setMonto("");
  }

  function quitarDelCarrito(key) {
    setCarrito((c) => c.filter((item) => item.key !== key));
  }

  async function cerrarVenta() {
    if (carrito.length === 0 || !elementoSeleccionado) return;
    setCerrando(true);

    for (const item of carrito) {
      const pedidoRef = await crearPedido(elementoSeleccionado.id, {
        articulo: item.articulo,
        precioTotal: item.precioTotal,
        productoNombre: item.productoNombre,
        talla: item.talla,
        color: item.color,
        cantidad: 1,
      });
      await registrarAbono(elementoSeleccionado.id, pedidoRef.id, {
        monto: item.monto,
        quienRecibio: user?.displayName || user?.email,
      });
    }

    const lineas = carrito.map(
      (i) =>
        `• ${i.articulo} — $${i.monto} (${
          i.tipoPago === "liquidacion" ? "Liquidado" : "Abono"
        })`
    );
    const total = carrito.reduce((s, i) => s + i.monto, 0);
    const mensaje = `Hola ${elementoSeleccionado.nombre}, se registró tu compra:\n${lineas.join(
      "\n"
    )}\nTotal pagado hoy: $${total}`;

    const telefono = elementoSeleccionado.telefonos?.[0];
    if (telefono) window.open(linkWhatsapp(telefono, mensaje), "_blank");

    setCarrito([]);
    setCerrando(false);
    setVentaCerrada(true);
  }

  const totalCarrito = carrito.reduce((s, i) => s + i.monto, 0);

  return (
    <div className="page">
      <h1>Uniformidad</h1>

      {!elementoSeleccionado && (
        <div className="card">
          <h2>Selecciona un elemento</h2>
          <select value="" onChange={(e) => elegirElemento(e.target.value)}>
            <option value="">Buscar elemento...</option>
            {elementos.map((el) => (
              <option key={el.id} value={el.id}>
                {el.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {elementoParaConfirmar && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>¿Confirmas que es el elemento correcto?</h2>
            <p>
              <strong>{elementoParaConfirmar.nombre}</strong>
              {elementoParaConfirmar.unidad ? ` — ${elementoParaConfirmar.unidad}` : ""}
              {elementoParaConfirmar.grupo ? ` (${elementoParaConfirmar.grupo})` : ""}
            </p>
            <div className="modal-acciones">
              <button className="btn-secondary" onClick={cancelarConfirmacion}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={confirmarElemento}>
                Sí, es correcto
              </button>
            </div>
          </div>
        </div>
      )}

      {elementoSeleccionado && (
        <>
          <div className="venta-elemento">
            <strong>{elementoSeleccionado.nombre}</strong>
            <button
              className="btn-secondary btn-small"
              onClick={() => {
                setElementoSeleccionado(null);
                setCarrito([]);
              }}
            >
              Cambiar elemento
            </button>
          </div>

          {ventaCerrada && (
            <p className="success-msg">✅ Venta cerrada y registrada.</p>
          )}

          <div className="card">
            <h2>Agregar artículo</h2>
            <select value={productoId} onChange={(e) => onSeleccionarProducto(e.target.value)}>
              <option value="">Selecciona un producto...</option>
              {catalogo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — ${p.precio}
                </option>
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
              <>
                <div className="inline-form">
                  <label className="checkbox">
                    <input
                      type="radio"
                      name="tipoPago"
                      checked={tipoPago === "liquidacion"}
                      onChange={() => onCambiarTipoPago("liquidacion")}
                    />
                    Liquidación (${producto.precio})
                  </label>
                  <label className="checkbox">
                    <input
                      type="radio"
                      name="tipoPago"
                      checked={tipoPago === "abono"}
                      onChange={() => onCambiarTipoPago("abono")}
                    />
                    Abono
                  </label>
                </div>

                {tipoPago === "abono" && (
                  <input
                    placeholder="Monto del abono"
                    type="number"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                )}

                <button
                  className="btn-primary"
                  onClick={agregarAlCarrito}
                  disabled={faltaTalla}
                >
                  + Agregar a la venta
                </button>
              </>
            )}
          </div>

          {carrito.length > 0 && (
            <div className="card">
              <h2>Venta en curso</h2>
              {carrito.map((item) => (
                <div className="carrito-item" key={item.key}>
                  <span>
                    {item.articulo} — ${item.monto} (
                    {item.tipoPago === "liquidacion" ? "Liquidado" : "Abono"})
                  </span>
                  <button
                    className="btn-secondary"
                    onClick={() => quitarDelCarrito(item.key)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <div className="carrito-total">
                <span>Total</span>
                <span>${totalCarrito}</span>
              </div>
              <button
                className="btn-primary"
                onClick={cerrarVenta}
                disabled={cerrando}
              >
                {cerrando ? "Cerrando venta..." : "Cerrar venta"}
              </button>
            </div>
          )}
        </>
      )}

      <p style={{ marginTop: 24 }}>
        <Link to="/catalogo" className="volver">
          Administrar catálogo de productos →
        </Link>
      </p>
    </div>
  );
}
