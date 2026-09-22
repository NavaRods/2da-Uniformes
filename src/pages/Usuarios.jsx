import { useEffect, useState } from "react";
import {
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  cambiarActivo,
  ROLES,
} from "../lib/usuarios";
import {
  crearUnidad,
  eliminarUnidad,
  eliminarUnidades,
  existeUnidad,
  usoDeUnidades,
} from "../lib/unidades";
import { contarElementosPorUnidad } from "../lib/elementos";
import { useUnidades, useGrados, useUsuarios } from "../lib/fuentes";
import { migrarDatosAnteriores } from "../lib/migracion";
import { useAuth } from "../auth/AuthContext";

const FORM_VACIO = { correo: "", nombre: "", rol: "operador", unidad: "", grado: "" };

export default function Usuarios() {
  const { user } = useAuth();
  const yo = (user?.email || "").toLowerCase();
  const [migrando, setMigrando] = useState(false);
  const [resultadoMigracion, setResultadoMigracion] = useState("");
  const [conteos, setConteos] = useState({}); // elementos por Unidad; null = no se pudo contar
  const [nombreUnidad, setNombreUnidad] = useState("");
  const [errorUnidades, setErrorUnidades] = useState("");
  const [trabajandoUnidades, setTrabajandoUnidades] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [editando, setEditando] = useState(null); // correo del usuario en edición, o null
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarNuevaUnidad, setMostrarNuevaUnidad] = useState(false);
  const [nuevaUnidadForm, setNuevaUnidadForm] = useState("");
  const [creandoUnidad, setCreandoUnidad] = useState(false);

  const usuarios = useUsuarios();
  const unidades = useUnidades();
  const grados = useGrados();
  // Solo se cuentan (no se descargan) los elementos de cada Unidad; se vuelve a
  // contar cuando cambia la lista de Unidades.
  const nombresUnidades = unidades.map((u) => u.nombre).join("|");
  useEffect(() => {
    let cancelado = false;
    contarElementosPorUnidad(nombresUnidades ? nombresUnidades.split("|") : []).then((r) => {
      if (!cancelado) setConteos(r);
    });
    return () => {
      cancelado = true;
    };
  }, [nombresUnidades]);

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

  // Si el conteo de una Unidad no está listo o falló, cuenta como "en uso"
  // (así nunca se avisa de menos al quitarla).
  const uso = usoDeUnidades(unidades, [], usuarios);
  for (const nombre of Object.keys(uso)) {
    const n = conteos[nombre];
    uso[nombre].elementos = n ?? 0;
    uso[nombre].desconocido = n == null;
  }

  async function onAgregarUnidad(e) {
    e.preventDefault();
    const nombre = nombreUnidad.trim();
    if (!nombre) return;
    if (existeUnidad(unidades, nombre)) {
      setErrorUnidades(`La Unidad "${nombre}" ya está en la lista.`);
      return;
    }
    setTrabajandoUnidades(true);
    setErrorUnidades("");
    try {
      await crearUnidad(nombre);
      setNombreUnidad("");
    } catch {
      setErrorUnidades("No se pudo agregar la Unidad. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setTrabajandoUnidades(false);
    }
  }

  // Quitar una Unidad de la lista no borra elementos ni usuarios: siguen
  // guardados con su nombre, solo dejan de poder elegirse en los selectores.
  function avisoDeUso(nombre) {
    const { elementos: e, usuarios: u, desconocido } = uso[nombre] || { elementos: 0, usuarios: 0 };
    if (desconocido) return " No se pudo comprobar si la usan elementos; podrían usarla y seguirían guardados con ese nombre.";
    if (!e && !u) return "";
    const partes = [];
    if (e) partes.push(`${e} ${e === 1 ? "elemento" : "elementos"}`);
    if (u) partes.push(`${u} ${u === 1 ? "usuario" : "usuarios"}`);
    return ` La usan ${partes.join(" y ")}; seguirán guardados con ese nombre, pero no podrás elegirla en los selectores hasta volver a agregarla.`;
  }

  async function onEliminarUnidad(u) {
    if (!confirm(`¿Quitar la Unidad "${u.nombre}" de la lista?${avisoDeUso(u.nombre)}`)) return;
    setTrabajandoUnidades(true);
    setErrorUnidades("");
    try {
      await eliminarUnidad(u.id);
    } catch {
      setErrorUnidades("No se pudo quitar la Unidad. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setTrabajandoUnidades(false);
    }
  }

  async function onEliminarTodasUnidades() {
    const enUso = unidades.filter((u) => uso[u.nombre]?.elementos || uso[u.nombre]?.usuarios || uso[u.nombre]?.desconocido);
    const aviso = enUso.length
      ? ` ${enUso.length} de ellas las usan elementos o usuarios (${enUso.map((u) => u.nombre).join(", ")}); seguirán guardados con ese nombre, pero no podrás elegirlas en los selectores hasta volver a agregarlas.`
      : "";
    if (!confirm(`¿Quitar las ${unidades.length} Unidades de la lista?${aviso} No se borra ningún elemento ni usuario.`)) {
      return;
    }
    setTrabajandoUnidades(true);
    setErrorUnidades("");
    try {
      await eliminarUnidades(unidades.map((u) => u.id));
    } catch {
      setErrorUnidades("No se pudieron quitar las Unidades. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setTrabajandoUnidades(false);
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
          <select value={form.grado} onChange={(e) => setCampo("grado", e.target.value)}>
            <option value="">Sin grado</option>
            {grados.map((g) => (
              <option key={g.nombre} value={g.nombre}>
                {g.nombre}
              </option>
            ))}
          </select>
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
        <h2>Unidades</h2>
        <form onSubmit={onAgregarUnidad} className="inline-form">
          <input
            placeholder="Nombre de la Unidad (ej. 1a)"
            value={nombreUnidad}
            onChange={(e) => setNombreUnidad(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={trabajandoUnidades || !nombreUnidad.trim()}>
            Agregar
          </button>
        </form>
        {errorUnidades && <p className="error">{errorUnidades}</p>}

        {unidades.length === 0 && <p className="nota">Todavía no hay Unidades en la lista.</p>}
        <ul className="lista">
          {unidades.map((u) => {
            const { elementos: e, usuarios: us, desconocido } = uso[u.nombre];
            return (
              <li key={u.id} className="carrito-item">
                <span>
                  <strong>{u.nombre}</strong>
                  <span className="nota">
                    {" "}
                    · {desconocido ? "…" : e} {e === 1 ? "elemento" : "elementos"} · {us} {us === 1 ? "usuario" : "usuarios"}
                  </span>
                </span>
                <button
                  className="btn-secondary btn-small"
                  onClick={() => onEliminarUnidad(u)}
                  disabled={trabajandoUnidades}
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
        {unidades.length > 1 && (
          <button className="btn-secondary" onClick={onEliminarTodasUnidades} disabled={trabajandoUnidades}>
            Quitar todas las Unidades ({unidades.length})
          </button>
        )}
      </div>

      <div className="card">
        <h2>Mantenimiento</h2>
        <p className="nota">
          Si la app tenía datos antes de que existieran las Unidades, este botón les asigna la de su
          elemento y pasa la asistencia anterior al formato nuevo. Solo hace falta una vez.
        </p>
        <button className="btn-secondary" onClick={onMigrar} disabled={migrando}>
          {migrando ? "Actualizando..." : "Actualizar datos anteriores"}
        </button>
        {resultadoMigracion && <p className="nota">{resultadoMigracion}</p>}
      </div>
    </div>
  );
}
