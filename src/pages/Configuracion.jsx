import { useState } from "react";
import { Link } from "react-router-dom";
import { crearUnidad, eliminarUnidad } from "../lib/unidades";
import {
  contarDocs,
  crearGrado,
  editarGrado,
  eliminarGrado,
  intercambiarRango,
  sembrarGradosPredeterminados,
} from "../lib/gradosDb";
import { CATEGORIAS, ordenarGrados } from "../lib/grados";
import { editarProducto } from "../lib/catalogo";
import { useCatalogo, useGradosGuardados, useUnidades } from "../lib/fuentes";
import SeccionRespaldo from "../components/SeccionRespaldo";

// Configuración (solo Admin): Unidades, grados militares, acceso al catálogo
// y respaldos.
export default function Configuracion() {
  const [tab, setTab] = useState("unidades"); // unidades | grados | catalogo | respaldo

  return (
    <div className="page">
      <h1>Configuración</h1>

      <div className="tabs" role="tablist">
        {[
          ["unidades", "Unidades"],
          ["grados", "Grados"],
          ["catalogo", "Catálogo"],
          ["respaldo", "Respaldo"],
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

      {tab === "unidades" && <SeccionUnidades />}
      {tab === "grados" && <SeccionGrados />}
      {tab === "catalogo" && <SeccionCatalogo />}
      {tab === "respaldo" && <SeccionRespaldo />}
    </div>
  );
}

function SeccionCatalogo() {
  const productos = useCatalogo();
  const [precios, setPrecios] = useState({}); // productoId -> texto en edición
  const [guardandoId, setGuardandoId] = useState(null);
  const [guardadoId, setGuardadoId] = useState(null);
  const [error, setError] = useState("");

  function precioDe(p) {
    return precios[p.id] ?? String(p.precio);
  }

  function onCambiarPrecio(id, valor) {
    setPrecios((ps) => ({ ...ps, [id]: valor }));
    setGuardadoId(null);
  }

  async function onGuardarPrecio(p) {
    const nuevo = Number(precioDe(p));
    if (!(nuevo >= 0)) {
      setError(`El precio de "${p.nombre}" no es válido.`);
      return;
    }
    if (nuevo === p.precio) return;
    setError("");
    setGuardandoId(p.id);
    try {
      await editarProducto(p.id, { precio: nuevo });
      setGuardadoId(p.id);
    } catch {
      setError(`No se pudo guardar "${p.nombre}". Verifica tu conexión e inténtalo de nuevo.`);
    }
    setGuardandoId(null);
  }

  return (
    <div className="card">
      <h2>Precios del catálogo</h2>
      <p className="nota">
        Cambia el precio de un producto y presiona Guardar. Para agregar o quitar productos,
        tallas o colores, abre el catálogo completo.
      </p>

      {error && <p className="error">{error}</p>}

      {productos.length === 0 && (
        <p className="nota">Todavía no hay productos en el catálogo.</p>
      )}

      <ul className="lista">
        {productos.map((p) => {
          const cambiado = Number(precioDe(p)) !== p.precio;
          return (
            <li key={p.id} className="fila-baja">
              <span className="fila-lista">{p.nombre}</span>
              <span className="campo-precio">
                <span>$</span>
                <input
                  type="number"
                  min="0"
                  value={precioDe(p)}
                  onChange={(e) => onCambiarPrecio(p.id, e.target.value)}
                />
              </span>
              <button
                type="button"
                className="btn-primary btn-small"
                onClick={() => onGuardarPrecio(p)}
                disabled={!cambiado || guardandoId === p.id}
              >
                {guardandoId === p.id ? "Guardando..." : guardadoId === p.id ? "Guardado ✅" : "Guardar"}
              </button>
            </li>
          );
        })}
      </ul>

      <Link to="/catalogo" className="btn-secondary">
        Abrir el catálogo completo
      </Link>
    </div>
  );
}

function SeccionUnidades() {
  const unidades = useUnidades();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function onCrear(e) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;
    if (unidades.some((u) => u.nombre.toLowerCase() === limpio.toLowerCase())) {
      setError("Ya existe una Unidad con ese nombre.");
      return;
    }
    setOcupado(true);
    setError("");
    try {
      await crearUnidad(limpio);
      setNombre("");
    } catch {
      setError("No se pudo crear. Verifica tu conexión e inténtalo de nuevo.");
    }
    setOcupado(false);
  }

  async function onEliminar(u) {
    setError("");
    setOcupado(true);
    try {
      const [elementos, usuarios] = await Promise.all([
        contarDocs("elementos", "unidad", u.nombre),
        contarDocs("usuarios", "unidad", u.nombre),
      ]);
      if (elementos > 0 || usuarios > 0) {
        setError(
          `No se puede eliminar "${u.nombre}": la usan ${elementos} elemento(s) y ${usuarios} usuario(s).`
        );
      } else if (confirm(`¿Eliminar la Unidad "${u.nombre}"?`)) {
        await eliminarUnidad(u.id);
      }
    } catch {
      setError("No se pudo eliminar. Verifica tu conexión e inténtalo de nuevo.");
    }
    setOcupado(false);
  }

  return (
    <div className="card">
      <h2>Unidades</h2>
      <p className="nota">
        Una Unidad no se puede renombrar (los elementos, usuarios y asistencias se guardan con su
        nombre) ni eliminar mientras la use algún elemento o usuario.
      </p>

      <form onSubmit={onCrear} className="inline-form">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la Unidad nueva"
        />
        <button type="submit" className="btn-primary" disabled={ocupado || !nombre.trim()}>
          Agregar
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <ul className="lista">
        {unidades.map((u) => (
          <li key={u.id} className="fila-baja">
            <span className="fila-lista">{u.nombre}</span>
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => onEliminar(u)}
              disabled={ocupado}
            >
              Eliminar
            </button>
          </li>
        ))}
        {unidades.length === 0 && <p className="nota">Todavía no hay Unidades.</p>}
      </ul>
    </div>
  );
}

function SeccionGrados() {
  const grados = useGradosGuardados(); // null = cargando
  const [nuevo, setNuevo] = useState({ nombre: "", categoria: CATEGORIAS[CATEGORIAS.length - 1] });
  const [editando, setEditando] = useState(null); // { id, nombre, categoria, original }
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(accion, mensajeError) {
    setOcupado(true);
    setError("");
    try {
      await accion();
    } catch {
      setError(mensajeError);
    }
    setOcupado(false);
  }

  if (grados === null) return <p className="nota">Cargando...</p>;

  const ordenados = ordenarGrados(grados); // de mayor a menor jerarquía

  function nombreRepetido(nombre, idActual) {
    return grados.some(
      (g) => g.id !== idActual && g.nombre.toLowerCase() === nombre.trim().toLowerCase()
    );
  }

  async function onCrear(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    if (nombreRepetido(nuevo.nombre)) {
      setError("Ya existe un grado con ese nombre.");
      return;
    }
    // El grado nuevo entra como el más alto; se acomoda con las flechas.
    const rango = Math.max(0, ...grados.map((g) => g.rango ?? 0)) + 1;
    await ejecutar(async () => {
      await crearGrado({ ...nuevo, rango });
      setNuevo((n) => ({ ...n, nombre: "" }));
    }, "No se pudo crear. Verifica tu conexión e inténtalo de nuevo.");
  }

  async function onGuardarEdicion() {
    if (!editando.nombre.trim()) return;
    if (nombreRepetido(editando.nombre, editando.id)) {
      setError("Ya existe un grado con ese nombre.");
      return;
    }
    await ejecutar(async () => {
      await editarGrado(editando.original, editando);
      setEditando(null);
    }, "No se pudo guardar. Verifica tu conexión e inténtalo de nuevo.");
  }

  async function onEliminar(g) {
    await ejecutar(async () => {
      const usan = await contarDocs("elementos", "gradoMilitar", g.nombre);
      if (usan > 0) {
        setError(`No se puede eliminar "${g.nombre}": ${usan} elemento(s) tienen ese grado.`);
      } else if (confirm(`¿Eliminar el grado "${g.nombre}"?`)) {
        await eliminarGrado(g.id);
      }
    }, "No se pudo eliminar. Verifica tu conexión e inténtalo de nuevo.");
  }

  // "Subir" es intercambiar el rango con el grado de arriba en la lista.
  function mover(i, direccion) {
    const vecino = ordenados[i + direccion];
    if (!vecino) return;
    ejecutar(() => intercambiarRango(ordenados[i], vecino), "No se pudo mover el grado.");
  }

  return (
    <div className="card">
      <h2>Grados militares</h2>
      <p className="nota">
        Ordenados de mayor a menor jerarquía. La categoría define en qué renglón del Estado de Fuerza se
        cuenta cada grado.
      </p>

      {grados.length === 0 ? (
        <>
          <p className="nota">
            Se están usando los grados predeterminados. Cárgalos para poder editarlos.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={ocupado}
            onClick={() =>
              ejecutar(sembrarGradosPredeterminados, "No se pudieron cargar. Inténtalo de nuevo.")
            }
          >
            Cargar grados predeterminados
          </button>
        </>
      ) : (
        <>
          <form onSubmit={onCrear} className="inline-form">
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
              placeholder="Nombre del grado nuevo"
            />
            <select
              value={nuevo.categoria}
              onChange={(e) => setNuevo((n) => ({ ...n, categoria: e.target.value }))}
              aria-label="Categoría"
            >
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={ocupado || !nuevo.nombre.trim()}>
              Agregar
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          <ul className="lista">
            {ordenados.map((g, i) =>
              editando?.id === g.id ? (
                <li key={g.id} className="fila-baja">
                  <input
                    value={editando.nombre}
                    onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  />
                  <select
                    value={editando.categoria}
                    onChange={(e) => setEditando({ ...editando, categoria: e.target.value })}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-primary btn-small" onClick={onGuardarEdicion} disabled={ocupado}>
                    Guardar
                  </button>
                  <button type="button" className="btn-secondary btn-small" onClick={() => setEditando(null)}>
                    Cancelar
                  </button>
                </li>
              ) : (
                <li key={g.id} className="fila-baja">
                  <span className="fila-lista">
                    {g.nombre} <span className="tag">{g.categoria}</span>
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => mover(i, -1)}
                    disabled={ocupado || i === 0}
                    aria-label={`Subir ${g.nombre}`}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => mover(i, 1)}
                    disabled={ocupado || i === ordenados.length - 1}
                    aria-label={`Bajar ${g.nombre}`}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => setEditando({ ...g, original: g })}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => onEliminar(g)}
                    disabled={ocupado}
                  >
                    Eliminar
                  </button>
                </li>
              )
            )}
          </ul>
        </>
      )}
    </div>
  );
}
