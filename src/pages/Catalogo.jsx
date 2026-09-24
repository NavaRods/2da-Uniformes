import { useState } from "react";
import {
  sembrarCatalogoInicial,
  guardarCambiosCatalogo,
  eliminarProducto,
  vaciarCatalogo,
  TALLA_TIPO,
} from "../lib/catalogo";
import { useCatalogo } from "../lib/fuentes";
import BotonVolver from "../components/BotonVolver";
import { useAuth } from "../auth/AuthContext";
import { esAdmin as puedeAdministrar } from "../lib/roles";

const NUEVO_VACIO = {
  nombre: "",
  precio: "",
  tallaTipo: TALLA_TIPO.NINGUNA,
};

export default function Catalogo() {
  const { perfil } = useAuth();
  const esAdmin = puedeAdministrar(perfil);
  const [modo, setModo] = useState(null); // null | "editar" | "nuevo"
  const [productoId, setProductoId] = useState("");

  const [precioEditado, setPrecioEditado] = useState("");
  const [tallasNuevas, setTallasNuevas] = useState([]);
  const [tallaEnCurso, setTallaEnCurso] = useState("");

  const [nuevoProducto, setNuevoProducto] = useState(NUEVO_VACIO);

  const [pendientes, setPendientes] = useState([]);
  const [editandoKey, setEditandoKey] = useState(null); // cambio pendiente que se está reeditando
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [vaciando, setVaciando] = useState(false);

  const productos = useCatalogo();

  const producto = productos.find((p) => p.id === productoId);

  async function onSembrar() {
    const hecho = await sembrarCatalogoInicial();
    if (!hecho) alert("El catálogo ya tiene productos, no se volvió a cargar.");
  }

  async function onEliminarProducto(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}" del catálogo? Esto no borra pedidos ya creados.`)) {
      return;
    }
    await eliminarProducto(id);
  }

  async function onVaciarCatalogo() {
    if (
      !confirm(
        `Esto eliminará los ${productos.length} productos del catálogo (no borra pedidos ni elementos ya registrados). ¿Continuar?`
      )
    ) {
      return;
    }
    setVaciando(true);
    await vaciarCatalogo();
    setVaciando(false);
    cancelar();
    setPendientes([]);
  }

  function iniciarEdicion(id) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    setProductoId(id);
    setPrecioEditado(String(p.precio));
    setTallasNuevas([]);
    setTallaEnCurso("");
    setModo("editar");
    setGuardado(false);
  }

  function iniciarNuevo() {
    setNuevoProducto(NUEVO_VACIO);
    setModo("nuevo");
    setGuardado(false);
  }

  function cancelar() {
    setModo(null);
    setProductoId("");
    setEditandoKey(null);
  }

  // Guarda un cambio en la lista: si se estaba reeditando uno, lo reemplaza en
  // su lugar (o lo quita si `cambio` es null); si no, lo agrega al final.
  function guardarPendiente(cambio) {
    setPendientes((lista) => {
      if (editandoKey === null) return cambio ? [...lista, cambio] : lista;
      return cambio
        ? lista.map((c) => (c.key === editandoKey ? cambio : c))
        : lista.filter((c) => c.key !== editandoKey);
    });
  }

  function reeditarPendiente(cambio) {
    if (cambio.tipo === "nuevo") {
      setNuevoProducto(cambio.datos);
      setModo("nuevo");
    } else {
      const p = productos.find((x) => x.id === cambio.productoId);
      if (!p) return;
      setProductoId(p.id);
      setPrecioEditado(String(cambio.precioNuevo ?? p.precio));
      setTallasNuevas(cambio.tallasNuevas);
      setTallaEnCurso("");
      setModo("editar");
    }
    setEditandoKey(cambio.key);
    setGuardado(false);
  }

  function agregarTallaEnCurso() {
    if (!tallaEnCurso.trim()) return;
    setTallasNuevas((t) => [...t, tallaEnCurso.trim()]);
    setTallaEnCurso("");
  }

  function quitarTallaEnCurso(i) {
    setTallasNuevas((t) => t.filter((_, idx) => idx !== i));
  }

  function confirmarCambioProducto() {
    if (!producto) return;
    const precioCambio =
      precioEditado !== "" && Number(precioEditado) !== producto.precio
        ? Number(precioEditado)
        : null;

    if (precioCambio === null && tallasNuevas.length === 0) {
      // Sin cambios reales: si venía de la lista, ya no hay nada que guardar.
      guardarPendiente(null);
      cancelar();
      return;
    }

    guardarPendiente({
      key: editandoKey ?? crypto.randomUUID(),
      tipo: "editar",
      productoId: producto.id,
      nombreProducto: producto.nombre,
      precioAnterior: producto.precio,
      precioNuevo: precioCambio,
      tallasNuevas,
    });

    cancelar();
  }

  function confirmarNuevoProducto() {
    if (!nuevoProducto.nombre.trim() || !nuevoProducto.precio) return;
    guardarPendiente({
      key: editandoKey ?? crypto.randomUUID(),
      tipo: "nuevo",
      datos: { ...nuevoProducto },
    });
    cancelar();
  }

  function quitarPendiente(key) {
    setPendientes((p) => p.filter((c) => c.key !== key));
  }

  async function guardarTodo() {
    setGuardando(true);
    try {
      await guardarCambiosCatalogo(pendientes);
      setPendientes([]);
      setGuardado(true);
    } finally {
      setGuardando(false);
    }
  }

  function descripcionCambio(c) {
    if (c.tipo === "nuevo") {
      return `Nuevo producto — ${c.datos.nombre} — $${c.datos.precio}`;
    }
    const partes = [];
    if (c.precioNuevo !== null) {
      partes.push(`Precio: $${c.precioAnterior} → $${c.precioNuevo}`);
    }
    if (c.tallasNuevas.length > 0) {
      partes.push(`Tallas nuevas: ${c.tallasNuevas.join(", ")}`);
    }
    return `${c.nombreProducto} — ${partes.join(" · ")}`;
  }

  return (
    <div className="page">
      <BotonVolver porDefecto="/configuracion" etiquetaPorDefecto="Configuración" />
      <h1>Catálogo</h1>

      {!esAdmin && <p className="nota">Solo un Admin puede editar el catálogo.</p>}

      {esAdmin && productos.length === 0 && (
        <button className="btn-primary" onClick={onSembrar}>
          Cargar catálogo inicial
        </button>
      )}

      {esAdmin && productos.length > 0 && (
        <button
          className="btn-secondary"
          onClick={onVaciarCatalogo}
          disabled={vaciando}
        >
          {vaciando
            ? "Eliminando..."
            : `🗑️ Eliminar todos los productos (${productos.length})`}
        </button>
      )}

      {guardado && <p className="success-msg">✅ Cambios guardados.</p>}

      {esAdmin && modo === null && (
        <div className="card">
          <h2>Buscar producto para editar</h2>
          <select value="" onChange={(e) => e.target.value && iniciarEdicion(e.target.value)}>
            <option value="">Selecciona un producto...</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — ${p.precio}
              </option>
            ))}
          </select>

          {productos.length > 0 && (
            <details className="desplegable">
              <summary>Eliminar un producto individual</summary>
              <ul className="lista desplegable-contenido">
                {productos.map((p) => (
                  <li key={p.id} className="carrito-item">
                    <span>
                      {p.nombre} — ${p.precio}
                    </span>
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => onEliminarProducto(p.id, p.nombre)}
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button className="btn-secondary" onClick={iniciarNuevo}>
            + Dar de alta un producto nuevo
          </button>
        </div>
      )}

      {esAdmin && modo === "editar" && producto && (
        <div className="card">
          <h2>Editando: {producto.nombre}</h2>
          <p className="ficha-etiqueta">
            Tallas actuales: {producto.tallas?.join(", ") || "—"}
          </p>

          <div className="campo">
            <label>Precio</label>
            <input
              type="number"
              value={precioEditado}
              onChange={(e) => setPrecioEditado(e.target.value)}
            />
          </div>

          {producto.tallaTipo === TALLA_TIPO.LISTA && (
            <div className="campo">
              <label>Agregar talla(s) nueva(s)</label>
              <div className="inline-form">
                <input
                  placeholder="Nueva talla"
                  value={tallaEnCurso}
                  onChange={(e) => setTallaEnCurso(e.target.value)}
                />
                <button type="button" className="btn-secondary" onClick={agregarTallaEnCurso}>
                  Agregar
                </button>
              </div>
              {tallasNuevas.length > 0 && (
                <div className="etiquetas">
                  {tallasNuevas.map((t, i) => (
                    <span className="tag" key={i}>
                      {t}{" "}
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => quitarTallaEnCurso(i)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="inline-form">
            <button className="btn-secondary" onClick={cancelar}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmarCambioProducto}>
              {editandoKey ? "Actualizar cambio" : "Agregar cambio"}
            </button>
          </div>
        </div>
      )}

      {esAdmin && modo === "nuevo" && (
        <div className="card">
          <h2>Nuevo producto</h2>
          <div className="campo">
            <label>Nombre</label>
            <input
              value={nuevoProducto.nombre}
              onChange={(e) =>
                setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })
              }
            />
          </div>
          <div className="campo">
            <label>Precio</label>
            <input
              type="number"
              value={nuevoProducto.precio}
              onChange={(e) =>
                setNuevoProducto({ ...nuevoProducto, precio: e.target.value })
              }
            />
          </div>
          <div className="campo">
            <label>Tipo de talla</label>
            <select
              value={nuevoProducto.tallaTipo}
              onChange={(e) =>
                setNuevoProducto({ ...nuevoProducto, tallaTipo: e.target.value })
              }
            >
              <option value={TALLA_TIPO.NINGUNA}>Sin talla</option>
              <option value={TALLA_TIPO.LISTA}>Talla de lista (editable después)</option>
              <option value={TALLA_TIPO.LIBRE}>Talla libre (a la medida)</option>
            </select>
          </div>

          <div className="inline-form">
            <button className="btn-secondary" onClick={cancelar}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmarNuevoProducto}>
              {editandoKey ? "Actualizar cambio" : "Agregar cambio"}
            </button>
          </div>
        </div>
      )}

      {esAdmin && pendientes.length > 0 && (
        <div className="card">
          <h2>Cambios pendientes</h2>
          {pendientes.map((c) => (
            <div className="carrito-item" key={c.key}>
              <span>{descripcionCambio(c)}</span>
              <span className="etiquetas">
                <button
                  className="btn-secondary"
                  onClick={() => reeditarPendiente(c)}
                  disabled={editandoKey !== null}
                >
                  {editandoKey === c.key ? "Editando..." : "Editar"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => quitarPendiente(c.key)}
                  disabled={editandoKey !== null}
                >
                  Quitar
                </button>
              </span>
            </div>
          ))}
          <button className="btn-primary" onClick={guardarTodo} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar todos los cambios"}
          </button>
        </div>
      )}
    </div>
  );
}
