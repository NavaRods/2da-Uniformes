import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { actualizarElemento } from "../lib/elementos";
import {
  listenPedidosDeElemento,
  crearPedido,
  registrarAbono,
} from "../lib/pedidos";
import { requiereTalla, TALLA_TIPO } from "../lib/catalogo";
import { useElementos, useCatalogo } from "../lib/fuentes";
import { vigilar } from "../lib/estadoFirestore";
import { TURNOS, FUENTES, GRUPOS_ELEMENTO } from "../lib/opciones";
import { useAuth } from "../auth/AuthContext";
import CuotaMensualidad from "../components/CuotaMensualidad";
import { listenCuotas, resumenCuotas, etiquetaMes } from "../lib/cuotas";
import PedidoCard from "../components/PedidoCard";

export default function ElementoPerfil() {
  const { elementoId } = useParams();
  const { user, perfil } = useAuth();
  const { state } = useLocation();
  const [directo, setDirecto] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const catalogo = useCatalogo();
  const [productoId, setProductoId] = useState("");
  const [talla, setTalla] = useState("");
  const [color, setColor] = useState("");
  const [tipoPago, setTipoPago] = useState("liquidacion"); // liquidacion | abono
  const [montoAbono, setMontoAbono] = useState("");
  const [guardandoPedido, setGuardandoPedido] = useState(false);
  const [errorPedido, setErrorPedido] = useState("");
  const [tab, setTab] = useState("uniformes"); // uniformes | cuotas | informacion
  const [cuotas, setCuotas] = useState([]);

  const [editando, setEditando] = useState(false);
  const [formEdicion, setFormEdicion] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // El elemento sale de la lista ya cargada de su Unidad (0 lecturas). Solo si
  // no está ahí (enlace directo, o Admin sin saber la Unidad) se lee su documento.
  const unidadDeLista = state?.unidad || (perfil?.rol === "admin" ? "" : perfil?.unidad || "");
  const enLista = useElementos(unidadDeLista).find((e) => e.id === elementoId) || null;
  const buscarDirecto = !enLista;
  useEffect(() => {
    if (!buscarDirecto) return;
    return onSnapshot(
      doc(db, "elementos", elementoId),
      (snap) => {
        setDirecto(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      },
      vigilar()
    );
  }, [elementoId, buscarDirecto]);
  const elemento = enLista ?? (directo?.id === elementoId ? directo : null);

  useEffect(() => listenPedidosDeElemento(elementoId, setPedidos), [elementoId]);
  useEffect(() => listenCuotas(elementoId, setCuotas), [elementoId]);

  const producto = catalogo.find((p) => p.id === productoId);
  const faltaTalla = requiereTalla(producto) && !talla.trim();

  function onSeleccionarProducto(id) {
    setProductoId(id);
    const p = catalogo.find((x) => x.id === id);
    setTalla("");
    setColor(p?.colores?.[0] || "");
    setTipoPago("liquidacion");
    setMontoAbono("");
  }

  async function onNuevoPedido(e) {
    e.preventDefault();
    if (!producto) return;
    if (!(producto.precio > 0)) {
      setErrorPedido("Este producto no tiene precio. Ponlo en el Catálogo.");
      return;
    }
    if (faltaTalla) return;

    const precioTotal = producto.precio;
    // Cuánto se cobra ahora: todo o un abono.
    const pagoInicial = tipoPago === "liquidacion" ? precioTotal : Number(montoAbono);
    if (tipoPago === "abono" && !(pagoInicial > 0 && pagoInicial <= precioTotal)) {
      setErrorPedido("El abono debe ser mayor a $0 y no mayor al precio total.");
      return;
    }

    const partes = [producto.nombre];
    if (color) partes.push(color);
    if (talla) partes.push(`talla ${talla}`);

    setGuardandoPedido(true);
    setErrorPedido("");
    try {
      const pedidoRef = await crearPedido(elementoId, {
        articulo: partes.join(" — "),
        precioTotal,
        productoNombre: producto.nombre,
        talla,
        color,
        cantidad: 1,
        unidad: elemento.unidad,
      });
      await registrarAbono(elementoId, pedidoRef.id, {
        monto: pagoInicial,
        quienRecibio: user?.displayName || user?.email,
        unidad: elemento.unidad,
        elementoNombre: elemento.nombre,
        pedido: {
          articulo: partes.join(" — "),
          productoNombre: producto.nombre,
          talla,
          color,
          saldoPendiente: precioTotal,
        },
      });
    } catch {
      setErrorPedido("No se pudo guardar el pedido. Verifica tu conexión e inténtalo de nuevo.");
      setGuardandoPedido(false);
      return;
    }

    limpiarPedido();
    setGuardandoPedido(false);
  }

  function limpiarPedido() {
    setProductoId("");
    setTalla("");
    setColor("");
    setTipoPago("liquidacion");
    setMontoAbono("");
    setErrorPedido("");
  }

  function iniciarEdicion() {
    setFormEdicion({
      unidad: elemento.unidad || "",
      grupo: elemento.grupo || "Varonil",
      nombre: elemento.nombre || "",
      edad: elemento.edad || "",
      telefonos: elemento.telefonos?.length ? [...elemento.telefonos] : [""],
      direccion: elemento.direccion || "",
      fechaNacimiento: elemento.fechaNacimiento || "",
      escuela: elemento.escuela || "",
      turno: elemento.turno || "",
      gradoEscolar: elemento.gradoEscolar || "",
      tutor: elemento.tutor || "",
      comoSeEntero: elemento.comoSeEntero || "",
      seguroSocial: elemento.seguroSocial || "",
      alergias: elemento.alergias || "",
    });
    setEditando(true);
  }

  function cancelarEdicion() {
    setEditando(false);
    setFormEdicion(null);
  }

  function setCampoEdicion(campo, valor) {
    setFormEdicion((f) => ({ ...f, [campo]: valor }));
  }

  function setTelefonoEdicion(i, valor) {
    setFormEdicion((f) => {
      const telefonos = [...f.telefonos];
      telefonos[i] = valor;
      return { ...f, telefonos };
    });
  }

  function agregarTelefonoEdicion() {
    setFormEdicion((f) => ({ ...f, telefonos: [...f.telefonos, ""] }));
  }

  function quitarTelefonoEdicion(i) {
    setFormEdicion((f) => ({
      ...f,
      telefonos: f.telefonos.filter((_, idx) => idx !== i),
    }));
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    if (!formEdicion.nombre.trim()) return;
    setGuardandoEdicion(true);
    await actualizarElemento(elementoId, {
      ...formEdicion,
      edad: formEdicion.edad || null,
      telefonos: formEdicion.telefonos.filter(Boolean),
    });
    setGuardandoEdicion(false);
    setEditando(false);
    setFormEdicion(null);
  }

  if (!elemento) return <p className="page">Cargando...</p>;

  const datos = [
    ["Unidad", elemento.unidad],
    ["Grupo", elemento.grupo],
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
  ];

  const totalPedidos = pedidos.reduce((s, p) => s + (p.precioTotal || 0), 0);
  const totalAdeudado = pedidos.reduce(
    (s, p) => s + Math.max(p.saldoPendiente || 0, 0),
    0
  );
  const totalPagado = totalPedidos - totalAdeudado;
  const pendientesEntrega = pedidos.filter((p) => !p.entregado).length;
  const cambiosPendientes = pedidos.filter((p) => p.cambioPendiente).length;
  const anioActual = new Date().getFullYear();
  const resumenMens = resumenCuotas(cuotas, anioActual);

  return (
    <div className="page">
      <Link to="/elementos" className="volver">← Volver</Link>
      <h1>{elemento.nombre}</h1>

      <div className="resumenes">
        <div className="card resumen-uniformidad">
          <h2>Uniformidad</h2>
          <div className="ficha">
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Pagado</span>
              <span className="ficha-valor">${totalPagado}</span>
            </div>
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Adeudado</span>
              <span className="ficha-valor">${totalAdeudado}</span>
            </div>
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Piezas por entregar</span>
              <span className="ficha-valor">{pendientesEntrega}</span>
            </div>
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Cambios pendientes</span>
              <span className="ficha-valor">{cambiosPendientes}</span>
            </div>
          </div>
        </div>

        <div className="card resumen-cuotas">
          <h2>Cuotas</h2>
          <div className="ficha">
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Mensualidades {anioActual}</span>
              <span className="ficha-valor">{resumenMens.mesesAnio} de 12</span>
            </div>
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Cobrado {anioActual}</span>
              <span className="ficha-valor">${resumenMens.totalAnio}</span>
            </div>
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Último mes pagado</span>
              <span className="ficha-valor">
                {resumenMens.ultimoMes ? etiquetaMes(resumenMens.ultimoMes) : "—"}
              </span>
            </div>
            <div className="ficha-fila">
              <span className="ficha-etiqueta">Inscripción</span>
              <span className="ficha-valor">
                {elemento.pagaInscripcion ? "Pagada" : "Pendiente"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {[
          ["uniformes", "Uniformes"],
          ["cuotas", "Cuotas"],
          ["informacion", "Información"],
        ].map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={tab === clave}
            className={`tab ${tab === clave ? "activo" : ""}`}
            onClick={() => setTab(clave)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {tab === "informacion" && (
      <div className="card">
        <h2>Información del elemento</h2>

        {!editando && (
          <>
            <div className="ficha">
              {datos.map(([etiqueta, valor]) => (
                <div className="ficha-fila" key={etiqueta}>
                  <span className="ficha-etiqueta">{etiqueta}</span>
                  <span className="ficha-valor">{valor || "—"}</span>
                </div>
              ))}
            </div>
            <button className="btn-secondary btn-small" onClick={iniciarEdicion}>
              ✏️ Editar
            </button>
          </>
        )}

        {editando && formEdicion && (
          <form onSubmit={guardarEdicion} className="form-grid desplegable-contenido">
            <div className="campo">
              <label>Unidad</label>
              <input
                value={formEdicion.unidad}
                onChange={(e) => setCampoEdicion("unidad", e.target.value)}
              />
            </div>

            <div className="campo">
              <label>Nombre del elemento *</label>
              <input
                value={formEdicion.nombre}
                onChange={(e) => setCampoEdicion("nombre", e.target.value)}
                required
              />
            </div>

            <div className="campo">
              <label>Grupo *</label>
              <select
                value={formEdicion.grupo}
                onChange={(e) => setCampoEdicion("grupo", e.target.value)}
              >
                {GRUPOS_ELEMENTO.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>Edad</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formEdicion.edad}
                onChange={(e) =>
                  setCampoEdicion("edad", e.target.value.replace(/\D/g, ""))
                }
              />
            </div>

            <div className="campo">
              <label>Fecha de nacimiento</label>
              <input
                type="date"
                value={formEdicion.fechaNacimiento}
                onChange={(e) => setCampoEdicion("fechaNacimiento", e.target.value)}
              />
            </div>

            <div className="campo campo-ancho">
              <label>Teléfono(s)</label>
              {formEdicion.telefonos.map((tel, i) => (
                <div className="inline-form" key={i}>
                  <input
                    value={tel}
                    placeholder="Número de teléfono"
                    onChange={(e) => setTelefonoEdicion(i, e.target.value)}
                  />
                  {formEdicion.telefonos.length > 1 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => quitarTelefonoEdicion(i)}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={agregarTelefonoEdicion}
              >
                + Agregar otro teléfono
              </button>
            </div>

            <div className="campo campo-ancho">
              <label>Dirección domiciliaria</label>
              <input
                value={formEdicion.direccion}
                onChange={(e) => setCampoEdicion("direccion", e.target.value)}
              />
            </div>

            <div className="campo">
              <label>Nombre de la escuela</label>
              <input
                value={formEdicion.escuela}
                onChange={(e) => setCampoEdicion("escuela", e.target.value)}
              />
            </div>

            <div className="campo">
              <label>Turno</label>
              <select
                value={formEdicion.turno}
                onChange={(e) => setCampoEdicion("turno", e.target.value)}
              >
                <option value="">Selecciona...</option>
                {TURNOS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>Grado escolar actual</label>
              <input
                value={formEdicion.gradoEscolar}
                onChange={(e) => setCampoEdicion("gradoEscolar", e.target.value)}
              />
            </div>

            <div className="campo">
              <label>Nombre del padre, madre o tutor</label>
              <input
                value={formEdicion.tutor}
                onChange={(e) => setCampoEdicion("tutor", e.target.value)}
              />
            </div>

            <div className="campo">
              <label>¿Cómo se enteró de nosotros?</label>
              <select
                value={formEdicion.comoSeEntero}
                onChange={(e) => setCampoEdicion("comoSeEntero", e.target.value)}
              >
                <option value="">Selecciona...</option>
                {FUENTES.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label>No. de Seguro Social o servicio médico</label>
              <input
                value={formEdicion.seguroSocial}
                onChange={(e) => setCampoEdicion("seguroSocial", e.target.value)}
              />
            </div>

            <div className="campo campo-ancho">
              <label>Alergias o padecimientos médicos</label>
              <textarea
                value={formEdicion.alergias}
                onChange={(e) => setCampoEdicion("alergias", e.target.value)}
                rows={2}
              />
            </div>

            <div className="inline-form campo-ancho">
              <button type="button" className="btn-secondary" onClick={cancelarEdicion}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={guardandoEdicion}>
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}
      </div>
      )}

      {tab === "cuotas" && (
        <>
          <div className="card">
            <h2>Inscripción</h2>
            <button
              type="button"
              className={`btn-toggle ${elemento.pagaInscripcion ? "activo" : ""}`}
              aria-pressed={!!elemento.pagaInscripcion}
              onClick={() =>
                actualizarElemento(elementoId, { pagaInscripcion: !elemento.pagaInscripcion })
              }
            >
              {elemento.pagaInscripcion ? "✓ Inscripción pagada" : "Marcar inscripción como pagada"}
            </button>
          </div>

          <CuotaMensualidad elemento={elemento} cuotas={cuotas} />
        </>
      )}

      {tab === "uniformes" && (
        <>
      <form onSubmit={onNuevoPedido} className="card">
        <h2>Nuevo pedido</h2>
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
                  onChange={() => setTipoPago("liquidacion")}
                />
                Liquidación (${producto.precio})
              </label>
              <label className="checkbox">
                <input
                  type="radio"
                  name="tipoPago"
                  checked={tipoPago === "abono"}
                  onChange={() => setTipoPago("abono")}
                />
                Abono
              </label>
            </div>

            {tipoPago === "abono" && (
              <input
                placeholder="Monto del abono"
                type="number"
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
              />
            )}
          </>
        )}

        {errorPedido && <p className="error">{errorPedido}</p>}

        <div className="inline-form acciones-pedido">
          {producto && (
            <button
              type="button"
              className="btn-secondary"
              onClick={limpiarPedido}
              disabled={guardandoPedido}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={!producto || faltaTalla || guardandoPedido}
          >
            {guardandoPedido ? "Guardando..." : "Agregar pedido"}
          </button>
        </div>
      </form>

      <h2>Pedidos</h2>
      {pedidos.length === 0 && <p>Sin pedidos todavía.</p>}
      {pedidos.map((p) => (
        <PedidoCard key={p.id} cliente={elemento} pedido={p} />
      ))}
        </>
      )}
    </div>
  );
}
