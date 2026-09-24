import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useElementos,
  useElementosDeUnidades,
  useInventarioDeUnidades,
  usePedidosDeUnidades,
  useUnidades,
  useCatalogo,
} from "../lib/fuentes";
import { requiereTalla, TALLA_TIPO } from "../lib/catalogo";
import { filaDePedido, relacionPorElemento } from "../lib/relacionPagos";
import { formatoMoneda } from "../lib/format";
import ListaElementosBuscable from "../components/ListaElementosBuscable";
import SelectorBuscable from "../components/SelectorBuscable";
import RelacionPorElemento from "../components/RelacionPorElemento";
import CambiosPendientes from "../components/CambiosPendientes";
import CobrarMensualidad from "../components/CobrarMensualidad";
import UniformeRecibido from "../components/UniformeRecibido";
import { useAviso } from "../components/AvisoProvider";
import { crearPedido, registrarAbono } from "../lib/pedidos";
import { useAuth } from "../auth/AuthContext";
import { esAdmin, veTodasLasUnidades, esSoloLectura } from "../lib/roles";
import { useDesde, useEstadoPersistente } from "../lib/navegacion";

const SIN_UNIDADES = [];

// Explica en una línea qué se hace en cada pestaña.
const AYUDA = {
  venta: "Registra lo que un elemento compra hoy: elige a la persona, agrega sus piezas y cobra.",
  mensualidad: "Cobra las mensualidades de un elemento: elige a la persona y marca los meses que paga.",
  disponible:
    "Los uniformes que ya te entregó el proveedor y tienes para entregar. Cada pieza que entregas a un elemento se descuenta de aquí.",
  elementos:
    "Cada elemento con sus uniformes: cuánto ha pagado, si ya se entregó y quién aún debe. Toca uno para ver sus piezas.",
  cambios:
    "Piezas que se van a cambiar por otra talla o color. Aquí se resuelven; la pieza nueva también aparece como pendiente en Relación de pagos.",
};

// Uniformes y Mensualidades:
//  - Nueva venta: registrar una compra a un elemento (producto, talla, pago).
//    Necesita elegir una sola Unidad (no aplica "Todas").
//  - Por elemento: cada elemento con sus uniformes, lo pagado y si ya se
//    entregó. Toca un elemento para ver sus pedidos y sus pagos.
//  - Mensualidad: cobrar mensualidades a un elemento.
//  - Cambios: piezas con un cambio por resolver.
//  - Disponible: "Uniformidad disponible", lo que el proveedor ya entregó
//    (se marca en la Relación de pagos) y se descuenta al entregar.
// Por elemento y Cambios aceptan "Todas las Unidades" (Admin/Super
// Admin/Estado Mayor); Responsable e Instructor solo tienen la suya.
export default function Uniformidad() {
  const { user, perfil } = useAuth();
  const puedeElegirUnidad = veTodasLasUnidades(perfil);
  const soloLectura = esSoloLectura(perfil);
  const desde = useDesde();
  // Lo elegido se recuerda al volver de un perfil (por usuario).
  const [unidadElegida, setUnidad] = useEstadoPersistente(`${user?.email}:uniformidad:unidad`, "");
  // Responsable/Instructor traen su Unidad precargada y fija; el resto elige.
  const unidad = puedeElegirUnidad ? unidadElegida : perfil?.unidad || "";
  const [vistaGuardada, setVista] = useEstadoPersistente(`${user?.email}:uniformidad:vista`, "venta");
  const vista =
    soloLectura && (vistaGuardada === "venta" || vistaGuardada === "mensualidad") ? "elementos" : vistaGuardada;

  const [elementoSeleccionado, setElementoSeleccionado] = useState(null);
  const [elementoMensualidad, setElementoMensualidad] = useState(null);

  const [productoId, setProductoId] = useState("");
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");
  const [tipoPago, setTipoPago] = useState("liquidacion");
  const [monto, setMonto] = useState("");

  const [carrito, setCarrito] = useState([]);
  const [cerrando, setCerrando] = useState(false);
  const [ventaCerrada, setVentaCerrada] = useState(false);
  const [errorVenta, setErrorVenta] = useState("");
  const mostrarAviso = useAviso();

  const unidades = useUnidades(puedeElegirUnidad);
  // Venta necesita una sola Unidad para cargar sus elementos (no se leen
  // todas). Por elemento y Cambios sí aceptan "Todas las Unidades": ahí
  // "unidad" vacío junta la Unidad de cada quien (Responsable/Instructor) o
  // todas (Admin/Super Admin/Estado Mayor).
  const elementosVenta = useElementos(unidad);
  const catalogo = useCatalogo();

  const unidadesVisibles = useMemo(() => {
    if (unidad) return [unidad];
    if (puedeElegirUnidad) return unidades.map((u) => u.nombre);
    return perfil?.unidad ? [perfil.unidad] : SIN_UNIDADES;
  }, [unidad, puedeElegirUnidad, unidades, perfil?.unidad]);
  // Cada pestaña carga solo lo que necesita.
  const necesitaPedidos = vista === "elementos" || vista === "cambios";
  const unidadesDeUniformidad = necesitaPedidos ? unidadesVisibles : SIN_UNIDADES;
  const inventario = useInventarioDeUnidades(vista === "disponible" ? unidadesVisibles : SIN_UNIDADES);

  const elementos = useElementosDeUnidades(unidadesDeUniformidad);
  const pedidos = usePedidosDeUnidades(unidadesDeUniformidad);
  const cargandoUniformidad =
    necesitaPedidos &&
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
    setElementoSeleccionado(elementosVenta.find((e) => e.id === id) || null);
    setCarrito([]);
    setVentaCerrada(false);
    setErrorVenta("");
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
    setErrorVenta("");

    try {
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
    } catch {
      setErrorVenta("No se pudo registrar la venta completa. Revisa tu conexión y vuelve a intentarlo.");
      setCerrando(false);
      return;
    }

    const lineas = carrito.map(
      (i) =>
        `• ${i.articulo} — ${formatoMoneda(i.monto)} (${
          i.tipoPago === "liquidacion" ? "Liquidado" : "Abono"
        })`
    );
    const total = carrito.reduce((s, i) => s + i.monto, 0);
    // El aviso por WhatsApp es un paso aparte: se ofrece, no se manda solo.
    mostrarAviso({
      elemento: elementoSeleccionado,
      titulo: "Venta registrada",
      mensaje: `Hola ${elementoSeleccionado.nombre}, se registró tu compra:\n${lineas.join(
        "\n"
      )}\nTotal pagado hoy: ${formatoMoneda(total)}`,
    });

    setCarrito([]);
    setCerrando(false);
    setVentaCerrada(true);
  }

  const totalCarrito = carrito.reduce((s, i) => s + i.monto, 0);
  const paso = !elementoSeleccionado ? 1 : carrito.length === 0 ? 2 : 3;

  const tabs = [
    !soloLectura && ["venta", "Nueva venta"],
    !soloLectura && ["mensualidad", "Mensualidad"],
    ["elementos", "Por elemento"],
    ["cambios", `Cambios${cuenta(datosUniformidad?.cambios.length)}`],
    ["disponible", "Disponible"],
  ].filter(Boolean);

  return (
    <div className="page">
      <h1>Uniformes y Mensualidades</h1>

      {puedeElegirUnidad && (
        <div className="campo">
          <label htmlFor="unidad-uniformidad">Unidad</label>
          <select
            id="unidad-uniformidad"
            value={unidad}
            onChange={(e) => {
              setUnidad(e.target.value);
              setElementoSeleccionado(null);
              setElementoMensualidad(null);
              setCarrito([]);
            }}
          >
            <option value="">
              {vista === "venta" || vista === "mensualidad" ? "Selecciona una Unidad..." : "Todas las Unidades"}
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

      <p className="ayuda">{AYUDA[vista]}</p>

      {vista === "venta" && !soloLectura && (
        <>
          <ol className="pasos" aria-label="Pasos de la venta">
            {["Elemento", "Artículos", "Cobrar"].map((nombre, i) => (
              <li key={nombre} className={paso === i + 1 ? "actual" : paso > i + 1 ? "hecho" : ""}>
                <span className="paso-numero">{paso > i + 1 ? "✓" : i + 1}</span>
                {nombre}
              </li>
            ))}
          </ol>

          {!elementoSeleccionado && (
            <div className="card">
              <h2>¿A quién le vendes?</h2>
              {!unidad ? (
                <p className="nota">Primero elige una Unidad arriba.</p>
              ) : (
                <ListaElementosBuscable
                  elementos={elementosVenta}
                  onSeleccionar={elegirElemento}
                  vacio="Esta Unidad todavía no tiene elementos."
                />
              )}
            </div>
          )}

          {elementoSeleccionado && (
            <>
              <div className="venta-elemento">
                <span>
                  <span className="nota">Venta para</span>
                  <strong>{elementoSeleccionado.nombre}</strong>
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => {
                    setElementoSeleccionado(null);
                    setCarrito([]);
                    setVentaCerrada(false);
                  }}
                >
                  Cambiar
                </button>
              </div>

              {ventaCerrada && (
                <div className="success-msg">
                  ✅ Venta registrada.{" "}
                  <Link
                    to={`/elementos/${elementoSeleccionado.id}`}
                    state={{ unidad: elementoSeleccionado.unidad, ...desde }}
                  >
                    Ver perfil de {elementoSeleccionado.nombre}
                  </Link>
                </div>
              )}

              <div className="card">
                <h2>Agrega una pieza</h2>
                <SelectorBuscable
                  items={catalogo}
                  valorId={productoId}
                  obtenerTexto={(p) => `${p.nombre} — ${formatoMoneda(p.precio)}`}
                  onSeleccionar={onSeleccionarProducto}
                  placeholder="Elige el producto…"
                  placeholderBusqueda="Buscar producto…"
                />

                {producto?.colores?.length > 0 && (
                  <div className="campo">
                    <label htmlFor="venta-color">Color</label>
                    <select id="venta-color" value={color} onChange={(e) => setColor(e.target.value)}>
                      {producto.colores.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {producto?.tallaTipo === TALLA_TIPO.LISTA && (
                  <div className="campo">
                    <label htmlFor="venta-talla">Talla</label>
                    <select id="venta-talla" value={talla} onChange={(e) => setTalla(e.target.value)}>
                      <option value="">Elige la talla…</option>
                      {producto.tallas.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                )}

                {producto?.tallaTipo === TALLA_TIPO.LIBRE && (
                  <div className="campo">
                    <label htmlFor="venta-talla-libre">Talla</label>
                    <input
                      id="venta-talla-libre"
                      placeholder="Talla (a la medida)"
                      value={talla}
                      onChange={(e) => setTalla(e.target.value)}
                    />
                  </div>
                )}

                {producto && (
                  <>
                    <div className="campo">
                      <span className="etiqueta-grupo">¿Cómo paga?</span>
                      <div className="segmentos" role="group" aria-label="Forma de pago">
                        <button
                          type="button"
                          className={tipoPago === "liquidacion" ? "activo" : ""}
                          aria-pressed={tipoPago === "liquidacion"}
                          onClick={() => onCambiarTipoPago("liquidacion")}
                        >
                          Paga completo
                          <small>{formatoMoneda(producto.precio)}</small>
                        </button>
                        <button
                          type="button"
                          className={tipoPago === "abono" ? "activo" : ""}
                          aria-pressed={tipoPago === "abono"}
                          onClick={() => onCambiarTipoPago("abono")}
                        >
                          Deja un abono
                          <small>paga una parte</small>
                        </button>
                      </div>
                    </div>

                    {tipoPago === "abono" && (
                      <div className="campo">
                        <label htmlFor="venta-abono">¿Cuánto abona?</label>
                        <input
                          id="venta-abono"
                          placeholder="Monto ($)"
                          type="number"
                          inputMode="decimal"
                          min="1"
                          max={producto.precio}
                          value={monto}
                          onChange={(e) => setMonto(e.target.value)}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={agregarAlCarrito}
                      disabled={faltaTalla || !(Number(monto) > 0)}
                    >
                      + Agregar a la venta
                    </button>
                  </>
                )}
              </div>

              {carrito.length > 0 && (
                <div className="card">
                  <h2>Venta en curso</h2>
                  <ul className="carrito">
                    {carrito.map((item) => (
                      <li className="carrito-item" key={item.key}>
                        <span>
                          {item.articulo}
                          <span className="nota">
                            {formatoMoneda(item.monto)} ·{" "}
                            {item.tipoPago === "liquidacion" ? "paga completo" : "abono"}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => quitarDelCarrito(item.key)}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="carrito-total">
                    <span>Total a cobrar hoy</span>
                    <span>{formatoMoneda(totalCarrito)}</span>
                  </div>
                  {errorVenta && <p className="error">{errorVenta}</p>}
                  <button type="button" className="btn-primary" onClick={cerrarVenta} disabled={cerrando}>
                    {cerrando ? "Registrando…" : "Cobrar y registrar venta"}
                  </button>
                </div>
              )}
            </>
          )}

          {esAdmin(perfil) && (
            <p className="enlace-secundario">
              <Link to="/catalogo" state={desde}>
                Administrar catálogo de productos →
              </Link>
            </p>
          )}
        </>
      )}

      {vista === "mensualidad" && !soloLectura && (
        <>
          {!elementoMensualidad && (
            <div className="card">
              <h2>¿Quién paga mensualidad?</h2>
              {!unidad ? (
                <p className="nota">Primero elige una Unidad arriba.</p>
              ) : (
                <ListaElementosBuscable
                  elementos={elementosVenta}
                  onSeleccionar={(id) =>
                    setElementoMensualidad(elementosVenta.find((e) => e.id === id) || null)
                  }
                  vacio="Esta Unidad todavía no tiene elementos."
                />
              )}
            </div>
          )}
          {elementoMensualidad && (
            <>
              <div className="venta-elemento">
                <span>
                  <span className="nota">Mensualidad de</span>
                  <strong>{elementoMensualidad.nombre}</strong>
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => setElementoMensualidad(null)}
                >
                  Cambiar
                </button>
              </div>
              <CobrarMensualidad elemento={elementoMensualidad} />
            </>
          )}
        </>
      )}

      {vista === "disponible" && (
        <>
          {inventario === null && <p className="nota">Cargando…</p>}
          {inventario && (
            <UniformeRecibido
              inventario={inventario}
              puedeEditar={!soloLectura}
              varias={unidadesVisibles.length > 1}
            />
          )}
        </>
      )}

      {vista === "elementos" && (
        <>
          {cargandoUniformidad && <p className="nota">Cargando pedidos…</p>}
          {!cargandoUniformidad && datosUniformidad && (
            <RelacionPorElemento
              grupos={datosUniformidad.grupos}
              pedidosPorId={datosUniformidad.pedidosPorId}
              elementosPorId={datosUniformidad.elementosPorId}
            />
          )}
        </>
      )}

      {vista === "cambios" && (
        <>
          {cargandoUniformidad && <p className="nota">Cargando pedidos…</p>}
          {!cargandoUniformidad && datosUniformidad && (
            <CambiosPendientes
              cambios={datosUniformidad.cambios}
              pedidosPorId={datosUniformidad.pedidosPorId}
              elementosPorId={datosUniformidad.elementosPorId}
            />
          )}
        </>
      )}

    </div>
  );
}
