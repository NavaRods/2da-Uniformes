import { useEffect, useState } from "react";
import {
  listenUsuarios,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  cambiarActivo,
  ROLES,
} from "../lib/usuarios";
import {
  listenUnidades,
  crearUnidad,
  cargarUnidadesIniciales,
  UNIDADES_INICIALES,
  RENOMBRES,
} from "../lib/unidades";
import { migrarDatosAnteriores } from "../lib/migracion";
import { useAuth } from "../auth/AuthContext";

const FORM_VACIO = { correo: "", nombre: "", rol: "operador", unidad: "", grado: "" };

export default function Usuarios() {
  const { user } = useAuth();
  const yo = (user?.email || "").toLowerCase();
  const [migrando, setMigrando] = useState(false);
  const [resultadoMigracion, setResultadoMigracion] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null); // correo del usuario en edición, o null
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarNuevaUnidad, setMostrarNuevaUnidad] = useState(false);
  const [nuevaUnidadForm, setNuevaUnidadForm] = useState("");
  const [creandoUnidad, setCreandoUnidad] = useState(false);

  useEffect(() => listenUsuarios(setUsuarios), []);
  useEffect(() => listenUnidades(setUnidades), []);

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function iniciarEdicion(u) {
    setEditando(u.id);
    setForm({
      correo: u.id,
      nombre: u.nombre || "",
      rol: u.rol,
      unidad: u.unidad || "",
      grado: u.grado || "",
    });
    setError("");
  }

  function cancelar() {
    setEditando(null);
    setForm(FORM_VACIO);
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.correo.trim()) return;
    if (form.rol === "operador" && !form.unidad) {
      setError("Selecciona una Unidad para este usuario.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      if (editando) {
        await editarUsuario(editando, form);
      } else {
        await crearUsuario(form);
      }
      cancelar();
    } catch (e) {
      setError(
        e?.code === "ya-existe"
          ? "Ese correo ya tiene acceso. Búscalo en la lista y usa Editar."
          : "No se pudo guardar. Verifica tu conexión e inténtalo de nuevo."
      );
    } finally {
      setGuardando(false);
    }
  }

  async function onCargarUnidades() {
    const [[desde, hacia]] = Object.entries(RENOMBRES);
    if (
      !confirm(
        `Se crearán las Unidades que falten de la lista (${UNIDADES_INICIALES.length} en total), ` +
          `los elementos que hoy están en "${desde}" pasarán a "${hacia}", y después se actualizarán ` +
          "pedidos, pagos, mensualidades y asistencia anterior. Se puede repetir sin problema. ¿Continuar?"
      )
    ) {
      return;
    }
    setMigrando(true);
    setResultadoMigracion("");
    try {
      const u = await cargarUnidadesIniciales();
      const r = await migrarDatosAnteriores();
      setResultadoMigracion(
        `Listo. Unidades creadas: ${u.creadas} (ya existían ${u.yaExistian}). ` +
          `Elementos pasados de "${desde}" a "${hacia}": ${u.renombrados}. ` +
          `Actualizados: ${r.pedidos} pedidos, ${r.abonos} abonos, ${r.cuotas} mensualidades. ` +
          `Días de asistencia anterior migrados: ${r.asistencias}` +
          (r.omitidos ? ` (${r.omitidos} registros sin Unidad se dejaron sin tocar).` : ".")
      );
    } catch (e) {
      console.error("Carga de Unidades:", e);
      setResultadoMigracion("No se pudo completar. Inténtalo de nuevo; lo ya hecho no se repite.");
    } finally {
      setMigrando(false);
    }
  }

  async function onMigrar() {
    if (
      !confirm(
        "Esto actualiza datos creados antes de las Unidades (pedidos, pagos, mensualidades y asistencia anterior). No borra nada que no se haya copiado y se puede repetir sin problema. ¿Continuar?"
      )
    ) {
      return;
    }
    setMigrando(true);
    setResultadoMigracion("");
    try {
      const r = await migrarDatosAnteriores();
      setResultadoMigracion(
        `Listo. Actualizados: ${r.pedidos} pedidos, ${r.abonos} abonos, ${r.cuotas} mensualidades. ` +
          `Días de asistencia anterior migrados: ${r.asistencias}` +
          (r.omitidos ? ` (${r.omitidos} registros sin Unidad se dejaron sin tocar).` : ".")
      );
    } catch (e) {
      console.error("Migración:", e);
      setResultadoMigracion("No se pudo completar la actualización. Inténtalo de nuevo; lo ya hecho no se repite.");
    } finally {
      setMigrando(false);
    }
  }

  async function onEliminar(correo) {
    if (!confirm(`¿Quitar el acceso de ${correo}?`)) return;
    await eliminarUsuario(correo);
    if (editando === correo) cancelar();
  }

  async function onCambiarActivo(u) {
    await cambiarActivo(u.id, !(u.activo ?? true));
  }

  // Atajo desde el propio formulario de usuario: crea la Unidad y la deja
  // seleccionada, sin tener que bajar a la sección "Unidades".
  async function onAgregarUnidadDesdeForm(e) {
    e.preventDefault();
    if (!nuevaUnidadForm.trim()) return;
    setCreandoUnidad(true);
    try {
      await crearUnidad(nuevaUnidadForm);
      setCampo("unidad", nuevaUnidadForm.trim());
      setNuevaUnidadForm("");
      setMostrarNuevaUnidad(false);
    } finally {
      setCreandoUnidad(false);
    }
  }

  return (
    <div className="page">
      <h1>Usuarios</h1>

      <form onSubmit={onSubmit} className="card form-grid">
        <h2>{editando ? `Editando: ${editando}` : "Dar de alta un usuario"}</h2>

        <div className="campo">
          <label>Correo *</label>
          <input
            type="email"
            value={form.correo}
            onChange={(e) => setCampo("correo", e.target.value)}
            disabled={!!editando}
            required
          />
        </div>

        <div className="campo">
          <label>Nombre</label>
          <input value={form.nombre} onChange={(e) => setCampo("nombre", e.target.value)} />
        </div>

        <div className="campo">
          <label>Grado</label>
          <input
            placeholder="Ej. Capitán, Instructor..."
            value={form.grado}
            onChange={(e) => setCampo("grado", e.target.value)}
          />
        </div>

        <div className="campo">
          <label>Rol *</label>
          <select value={form.rol} onChange={(e) => setCampo("rol", e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "admin" ? "Admin" : "Operador"}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label>Unidad {form.rol === "operador" && "*"}</label>
          <select
            value={form.unidad}
            onChange={(e) => setCampo("unidad", e.target.value)}
            disabled={form.rol === "admin"}
          >
            <option value="">Selecciona...</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nombre}>
                {u.nombre}
              </option>
            ))}
          </select>
          {form.rol === "admin" && <p className="nota">Un Admin ve todas las Unidades.</p>}
          {form.rol === "operador" && !mostrarNuevaUnidad && (
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => setMostrarNuevaUnidad(true)}
            >
              + Nueva Unidad
            </button>
          )}
          {form.rol === "operador" && mostrarNuevaUnidad && (
            <div className="inline-form">
              <input
                placeholder="Nombre de la Unidad nueva"
                value={nuevaUnidadForm}
                onChange={(e) => setNuevaUnidadForm(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={onAgregarUnidadDesdeForm}
                disabled={creandoUnidad}
              >
                {creandoUnidad ? "Creando..." : "Crear"}
              </button>
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => {
                  setMostrarNuevaUnidad(false);
                  setNuevaUnidadForm("");
                }}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {error && <p className="error campo-ancho">{error}</p>}

        <div className="inline-form campo-ancho">
          {editando && (
            <button type="button" className="btn-secondary" onClick={cancelar}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Dar de alta"}
          </button>
        </div>
      </form>

      <ul className="lista">
        {usuarios.map((u) => {
          const activo = u.activo ?? true;
          return (
            <li key={u.id} className="carrito-item">
              <span>
                <strong>{u.nombre || u.id}</strong> — {u.id}
                <span className="etiquetas">
                  <span className="tag">{u.rol === "admin" ? "Admin" : "Operador"}</span>
                  {u.unidad && <span className="tag">{u.unidad}</span>}
                  {u.grado && <span className="tag">{u.grado}</span>}
                  {!activo && <span className="tag tag-baja">Inactivo</span>}
                </span>
              </span>
              <span className="etiquetas">
                <button className="btn-secondary btn-small" onClick={() => iniciarEdicion(u)}>
                  Editar
                </button>
                {/* Nadie se quita el acceso a sí mismo: así siempre queda un Admin. */}
                {u.id !== yo && (
                  <>
                    <button className="btn-secondary btn-small" onClick={() => onCambiarActivo(u)}>
                      {activo ? "Desactivar" : "Activar"}
                    </button>
                    <button className="btn-secondary btn-small" onClick={() => onEliminar(u.id)}>
                      Quitar
                    </button>
                  </>
                )}
              </span>
            </li>
          );
        })}
        {usuarios.length === 0 && <p>Sin usuarios todavía.</p>}
      </ul>

      <div className="card">
        <h2>Mantenimiento</h2>
        <p className="nota">
          <strong>Cargar lista de Unidades</strong> crea las {UNIDADES_INICIALES.length} Unidades del
          club ({UNIDADES_INICIALES.join(", ")}), pasa los elementos que estaban en "2da Unidad" a
          "2a" y actualiza los datos anteriores. Solo hace falta una vez.
        </p>
        <div className="inline-form">
          <button className="btn-primary" onClick={onCargarUnidades} disabled={migrando}>
            {migrando ? "Trabajando..." : "Cargar lista de Unidades"}
          </button>
          <button className="btn-secondary" onClick={onMigrar} disabled={migrando}>
            Solo actualizar datos anteriores
          </button>
        </div>
        {resultadoMigracion && <p className="nota">{resultadoMigracion}</p>}
      </div>
    </div>
  );
}
