import { useEffect, useState } from "react";
import {
  listenUsuarios,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  cambiarActivo,
  ROLES,
} from "../lib/usuarios";
import { listenUnidades, crearUnidad } from "../lib/unidades";

const FORM_VACIO = { correo: "", nombre: "", rol: "operador", unidad: "", grado: "" };

export default function Usuarios() {
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
    } catch {
      setError("No se pudo guardar. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
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
                <button className="btn-secondary btn-small" onClick={() => onCambiarActivo(u)}>
                  {activo ? "Desactivar" : "Activar"}
                </button>
                <button className="btn-secondary btn-small" onClick={() => onEliminar(u.id)}>
                  Quitar
                </button>
              </span>
            </li>
          );
        })}
        {usuarios.length === 0 && <p>Sin usuarios todavía.</p>}
      </ul>
    </div>
  );
}
