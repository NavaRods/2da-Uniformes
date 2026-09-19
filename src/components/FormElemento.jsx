import { useEffect, useState } from "react";
import { crearElemento } from "../lib/elementos";
import { listenUnidades } from "../lib/unidades";
import { useAuth } from "../auth/AuthContext";
import { TURNOS, FUENTES } from "../lib/opciones";

const FORM_VACIO = {
  unidad: "",
  grupo: "Varonil",
  nombre: "",
  edad: "",
  telefonos: [""],
  direccion: "",
  fechaNacimiento: "",
  escuela: "",
  turno: "",
  gradoEscolar: "",
  tutor: "",
  comoSeEntero: "",
  seguroSocial: "",
  alergias: "",
  pagaMensualidad: false,
  pagaInscripcion: false,
};

export default function FormElemento({ onCreado }) {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const [unidades, setUnidades] = useState([]);
  const [form, setForm] = useState(() => ({
    ...FORM_VACIO,
    unidad: esAdmin ? "" : perfil?.unidad || "",
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => listenUnidades(setUnidades), []);

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function setTelefono(i, valor) {
    setForm((f) => {
      const telefonos = [...f.telefonos];
      telefonos[i] = valor;
      return { ...f, telefonos };
    });
  }

  function agregarTelefono() {
    setForm((f) => ({ ...f, telefonos: [...f.telefonos, ""] }));
  }

  function quitarTelefono(i) {
    setForm((f) => ({
      ...f,
      telefonos: f.telefonos.filter((_, idx) => idx !== i),
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.unidad) return;
    setGuardando(true);
    setError("");
    try {
      await crearElemento(form);
      setForm({ ...FORM_VACIO, unidad: esAdmin ? "" : perfil?.unidad || "" });
      onCreado?.();
    } catch {
      setError("No se pudo guardar. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card form-grid">
      <h2>Dar de alta a un elemento</h2>

      <div className="campo">
        <label>Unidad *</label>
        <select
          value={form.unidad}
          onChange={(e) => setCampo("unidad", e.target.value)}
          disabled={!esAdmin}
          required
        >
          <option value="">Selecciona...</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.nombre}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="campo">
        <label>Nombre del elemento *</label>
        <input
          value={form.nombre}
          onChange={(e) => setCampo("nombre", e.target.value)}
          required
        />
      </div>

      <div className="campo">
        <label>Grupo *</label>
        <select
          value={form.grupo}
          onChange={(e) => setCampo("grupo", e.target.value)}
        >
          <option>Varonil</option>
          <option>Femenino</option>
        </select>
      </div>

      <div className="campo">
        <label>Edad</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.edad}
          onChange={(e) =>
            setCampo("edad", e.target.value.replace(/\D/g, ""))
          }
        />
      </div>

      <div className="campo">
        <label>Fecha de nacimiento</label>
        <input
          type="date"
          value={form.fechaNacimiento}
          onChange={(e) => setCampo("fechaNacimiento", e.target.value)}
        />
      </div>

      <div className="campo campo-ancho">
        <label>Teléfono(s)</label>
        {form.telefonos.map((tel, i) => (
          <div className="inline-form" key={i}>
            <input
              value={tel}
              placeholder="Número de teléfono"
              onChange={(e) => setTelefono(i, e.target.value)}
            />
            {form.telefonos.length > 1 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => quitarTelefono(i)}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={agregarTelefono}
        >
          + Agregar otro teléfono
        </button>
      </div>

      <div className="campo campo-ancho">
        <label>Dirección domiciliaria</label>
        <input
          value={form.direccion}
          onChange={(e) => setCampo("direccion", e.target.value)}
        />
      </div>

      <div className="campo">
        <label>Nombre de la escuela</label>
        <input
          value={form.escuela}
          onChange={(e) => setCampo("escuela", e.target.value)}
        />
      </div>

      <div className="campo">
        <label>Turno</label>
        <select
          value={form.turno}
          onChange={(e) => setCampo("turno", e.target.value)}
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
          value={form.gradoEscolar}
          onChange={(e) => setCampo("gradoEscolar", e.target.value)}
        />
      </div>

      <div className="campo">
        <label>Nombre del padre, madre o tutor</label>
        <input
          value={form.tutor}
          onChange={(e) => setCampo("tutor", e.target.value)}
        />
      </div>

      <div className="campo">
        <label>¿Cómo se enteró de nosotros?</label>
        <select
          value={form.comoSeEntero}
          onChange={(e) => setCampo("comoSeEntero", e.target.value)}
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
          value={form.seguroSocial}
          onChange={(e) => setCampo("seguroSocial", e.target.value)}
        />
      </div>

      <div className="campo campo-ancho">
        <label>Alergias o padecimientos médicos</label>
        <textarea
          value={form.alergias}
          onChange={(e) => setCampo("alergias", e.target.value)}
          rows={2}
        />
      </div>

      <div className="campo">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.pagaMensualidad}
            onChange={(e) => setCampo("pagaMensualidad", e.target.checked)}
          />
          Paga mensualidad
        </label>
      </div>

      <div className="campo">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.pagaInscripcion}
            onChange={(e) => setCampo("pagaInscripcion", e.target.checked)}
          />
          Paga inscripción
        </label>
      </div>

      {error && <p className="error campo-ancho">{error}</p>}

      <button type="submit" className="btn-primary campo-ancho" disabled={guardando}>
        {guardando ? "Guardando..." : "Registrar elemento"}
      </button>
    </form>
  );
}
