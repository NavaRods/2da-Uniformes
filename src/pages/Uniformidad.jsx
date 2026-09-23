import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useElementos,
  useElementosDeUnidades,
  usePedidosDeUnidades,
  useUnidades,
  useCatalogo,
} from "../lib/fuentes";
import { requiereTalla, TALLA_TIPO } from "../lib/catalogo";
import { filaDePedido, relacionPorElemento } from "../lib/relacionPagos";
import BuscadorElemento from "../components/BuscadorElemento";
import SelectorBuscable from "../components/SelectorBuscable";
import RelacionPorElemento from "../components/RelacionPorElemento";
import CambiosPendientes from "../components/CambiosPendientes";
import { crearPedido, registrarAbono } from "../lib/pedidos";
import { linkWhatsapp } from "../lib/whatsapp";
import { useAuth } from "../auth/AuthContext";
import { esAdmin, veTodasLasUnidades, esSoloLectura } from "../lib/roles";

const SIN_UNIDADES = [];

// Uniformidad:
//  - Venta: registrar una compra nueva a un elemento (producto, talla, pago).
//    Necesita elegir una sola Unidad (no aplica "Todas").
//  - Por elemento: cada elemento con sus uniformes, lo pagado y si ya se
//    entregó. Toca un elemento para ver sus pedidos y sus pagos.
//  - Cambios: piezas con un cambio por resolver.
// Por elemento y Cambios aceptan "Todas las Unidades" (Admin/Super
// Admin/Estado Mayor); Responsable e Instructor solo tienen la suya.
export default function Uniformidad() {
  const { user, perfil } = useAuth();
  const puedeElegirUnidad = veTodasLasUnidades(perfil);
  const soloLectura = esSoloLectura(perfil);
  // Responsable/Instructor traen su Unidad precargada y fija; el resto elige.
  const [unidad, setUnidad] = useState(puedeElegirUnidad ? "" : perfil?.unidad || "");
  const [vista, setVista] = useState(soloLectura ? "elementos" : "venta");

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

  const unidades = useUnidades(puedeElegirUnidad);
  // Venta necesita una sola Unidad para cargar sus elementos (no se leen
  // todas). Por elemento y Cambios sí aceptan "Todas las Unidades": ahí
  // "unidad" vacío junta la Unidad de cada quien (Responsable/Instructor) o
  // todas (Admin/Super Admin/Estado Mayor).
  const elementosVenta = useElementos(unidad);
  const catalogo = useCatalogo();

  const unidadesDeUniformidad = useMemo(() => {
    if (vista === "venta") return SIN_UNIDADES;
    if (unidad) return [unidad];
    if (puedeElegirUnidad) return unidades.map((u) => u.nombre);
    return perfil?.unidad ? [perfil.unidad] : SIN_UNIDADES;
  }, [vista, unidad, puedeElegirUnidad, unidades, perfil?.unidad]);

  const elementos = useElementosDeUnidades(unidadesDeUniformidad);
  const pedidos = usePedidosDeUnidades(unidadesDeUniformidad);
  const cargandoUniformidad =
    vista !== "venta" &&
    (elementos === null ||
      pedidos === null ||
      (puedeElegirUnidad && !unidad && unidades.length === 0));

  const datosUniformidad = useMemo(() => {
    if (!elementos || !pedidos) return null;
    const elementosPorId = new Map(elementos.map((e) => [e.id, e]));
    const pedidosPorId = new Map(pedidos.map((p) => [`${p.elementoId}/${p.id}`, p]));
    const filas = pedidos.map((p) =>
      filaDePedido({ ...p, elementoNombre: elementosPorId.get(p.elementoId)?.nombre || "" })
    );
    return {
      pedidosPorId,
      elementosPorId,
      grupos: relacionPorElemento(elementos, filas),
      cambios: filas.filter((f) => f.cambioPendiente),
    };
  }, [pedidos, elementos]);

  const cuenta = (n) => (datosUniformidad && n ? ` (${n})` : "");

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
    const el = elementosVenta.find((e) => e.id === id);
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
        unidad: elementoSeleccionado.unidad,
      });
      await registrarAbono(elementoSeleccionado.id, pedidoRef.id, {
        monto: item.monto,
        quienRecibio: user?.displayName || user?.email,
        unidad: elementoSeleccionado.unidad,
        elementoNombre: elementoSeleccionado.nombre,
        pedido: {
          articulo: item.articulo,
          productoNombre: item.productoNombre,
          talla: item.talla,
          color: item.color,
          saldoPendiente: item.precioTotal,
        },
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

  const tabs = [
    !soloLectura && ["venta", "Venta"],
    ["elementos", "Por elemento"],
    ["cambios", `Cambios${cuenta(datosUniformidad?.cambios.length)}`],
  ].filter(Boolean);

  return (
    <div className="page">
      <h1>Uniformidad</h1>

      {puedeElegirUnidad && (
        <div className="campo">
          <label htmlFor="unidad-uniformidad">Unidad</label>
          <select
            id="unidad-uniformidad"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
          >
            <option value="">
              {vista === "venta" ? "Selecciona una Unidad..." : "Todas las Unidades"}
            </option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="tabs" role="tablist">
        {tabs.map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={vista === clave}
            className={`tab ${vista === clave ? "activo" : ""}`}
            onClick={() => setVista(clave)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {vista === "venta" && !soloLectura && (
        <>
          {!elementoSeleccionado && (
            <div className="card">
              <h2>Selecciona un elemento</h2>
              {!unidad && <p className="nota">Elige una Unidad arriba.</p>}
              <BuscadorElemento elementos={elementosVenta} onSeleccionar={elegirElemento} />
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
                <SelectorBuscable
                  items={catalogo}
                  valorId={productoId}
                  obtenerTexto={(p) => `${p.nombre} — $${p.precio}`}
                  onSeleccionar={onSeleccionarProducto}
                  placeholder="Selecciona un producto..."
                  placeholderBusqueda="Buscar por nombre..."
                />

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
            {esAdmin(perfil) && (
              <Link to="/catalogo" className="volver">
                Administrar catálogo de productos →
              </Link>
            )}
          </p>
        </>
      )}

      {vista === "elementos" && (
        <>
          {cargandoUniformidad && <p className="nota">Cargando pedidos…</p>}
          {!cargandoUniformidad && datosUniformidad && (
            <>
              <p className="nota">
                Cada elemento con sus uniformes: cuánto se ha pagado de cada pieza, si ya se
                entregó y quién aún debe. Toca un elemento para ver sus pedidos y sus pagos.
              </p>
              <RelacionPorElemento
                grupos={datosUniformidad.grupos}
                pedidosPorId={datosUniformidad.pedidosPorId}
                elementosPorId={datosUniformidad.elementosPorId}
              />
            </>
          )}
        </>
      )}

      {vista === "cambios" && (
        <>
          {cargandoUniformidad && <p className="nota">Cargando pedidos…</p>}
          {!cargandoUniformidad && datosUniformidad && (
            <>
              <p className="nota">Piezas con cambio por resolver, de todos los días.</p>
              <CambiosPendientes cambios={datosUniformidad.cambios} />
            </>
          )}
        </>
      )}
    </div>
  );
}
