import { useState } from "react";
import { crearElemento, actualizarElemento } from "../lib/elementos";
import { useUnidades, useGrados } from "../lib/fuentes";
import { useAuth } from "../auth/AuthContext";
import { TURNOS, FUENTES } from "../lib/opciones";
import { fechaLocalISO } from "../lib/format";
import {
  formatearTelefono,
  normalizarNumeroOrden,
  normalizarTelefono10,
  soloDigitos,
  validarElemento,
} from "../lib/validacion";

const FORM_VACIO = {
  unidad: "",
  grupo: "Varonil",
  nombre: "",
  numeroOrden: "",
  gradoMilitar: "",
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
  antecedentes: "",
  antecedentesDetalle: "",
  practicaDeporte: "",
  deporte: "",
  pagaMensualidad: false,
  pagaInscripcion: false,
};

// Formulario de un elemento. Sin `elemento` da de alta uno nuevo; con
// `elemento` edita el existente. Se cierra con "Cancelar", con la ✕ o con Esc.
export default function FormElemento({ elemento, onGuardado, onCancelar }) {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === "admin";
  const modo = elemento ? "editar" : "crear";
  const grados = useGrados();
  const [form, setForm] = useState(() => formInicial(elemento, esAdmin, perfil));
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const unidades = useUnidades();

  const errores = validarElemento(form, grados.map((g) => g.nombre));
  const mostrar = (campo) => (intentado ? errores[campo] : "");

  function setCampo(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function setTelefono(i, valor) {
    setForm((f) => {
      const telefonos = [...f.telefonos];
      telefonos[i] = soloDigitos(valor).slice(0, 10);
      return { ...f, telefonos };
    });
  }

  function agregarTelefono() {
    setForm((f) => ({ ...f, telefonos: [...f.telefonos, ""] }));
  }

  function quitarTelefono(i) {
    setForm((f) => ({ ...f, telefonos: f.telefonos.filter((_, idx) => idx !== i) }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setIntentado(true);
    if (Object.keys(errores).length > 0) {
      // Lleva la vista al primer campo con error.
      setTimeout(() => document.querySelector(".campo-con-error")?.scrollIntoView({ block: "center" }), 0);
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const datos = {
        ...form,
        nombre: form.nombre.trim(),
        telefonos: form.telefonos.filter(Boolean),
        edad: form.edad || null,
        // Si contestó "No", no se guarda el detalle de una respuesta anterior.
        antecedentesDetalle: form.antecedentes === "Sí" ? form.antecedentesDetalle.trim() : "",
        deporte: form.practicaDeporte === "Sí" ? form.deporte.trim() : "",
      };
      if (modo === "editar") {
        // Los pagos de inscripción/mensualidad se manejan en la pestaña Cuotas.
        delete datos.pagaMensualidad;
        delete datos.pagaInscripcion;
        await actualizarElemento(elemento.id, datos);
      } else {
        await crearElemento(datos);
        setForm(formInicial(null, esAdmin, perfil));
        setIntentado(false);
      }
      onGuardado?.();
    } catch {
      setError("No se pudo guardar. Verifica tu conexión e inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => e.key === "Escape" && onCancelar?.()}
      className="card form-grid"
      noValidate
    >
      <div className="form-encabezado campo-ancho">
        <h2>{modo === "editar" ? "Editar elemento" : "Dar de alta a un elemento"}</h2>
        {onCancelar && (
          <button
            type="button"
            className="btn-cerrar"
            onClick={onCancelar}
            aria-label="Cerrar formulario"
            title="Cerrar"
          >
            ✕
          </button>
        )}
      </div>

      <Campo label="Unidad *" error={mostrar("unidad")}>
        <select
          value={form.unidad}
          onChange={(e) => setCampo("unidad", e.target.value)}
          disabled={!esAdmin}
        >
          <option value="">Selecciona...</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.nombre}>
              {u.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Nombre del elemento *" error={mostrar("nombre")}>
        <input
          value={form.nombre}
          onChange={(e) => setCampo("nombre", e.target.value)}
          autoComplete="off"
        />
      </Campo>

      <Campo label="Grupo *">
        <select value={form.grupo} onChange={(e) => setCampo("grupo", e.target.value)}>
          <option>Varonil</option>
          <option>Femenino</option>
        </select>
      </Campo>

      <Campo label="Grado militar *" error={mostrar("gradoMilitar")}>
        <select value={form.gradoMilitar} onChange={(e) => setCampo("gradoMilitar", e.target.value)}>
          <option value="">Selecciona...</option>
          {grados.map((g) => (
            <option key={g.nombre} value={g.nombre}>
              {g.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        label="Número de orden (opcional)"
        error={mostrar("numeroOrden")}
        ayuda="V/F (grupo) + Unidad (2 dígitos) + año de ingreso (2) + lista (3). Ej. V0218001"
      >
        <input
          value={form.numeroOrden}
          onChange={(e) => setCampo("numeroOrden", normalizarNumeroOrden(e.target.value))}
          placeholder="V0218001"
          maxLength={8}
          autoComplete="off"
        />
      </Campo>

      <Campo label="Edad" error={mostrar("edad")}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={form.edad}
          onChange={(e) => setCampo("edad", soloDigitos(e.target.value))}
        />
      </Campo>

      <Campo label="Fecha de nacimiento" error={mostrar("fechaNacimiento")}>
        <input
          type="date"
          value={form.fechaNacimiento}
          max={fechaLocalISO()}
          onChange={(e) => setCampo("fechaNacimiento", e.target.value)}
        />
      </Campo>

      <div className={`campo campo-ancho ${mostrar("telefonos") ? "campo-con-error" : ""}`}>
        <label>Teléfono(s)</label>
        {form.telefonos.map((tel, i) => (
          <div key={i}>
            <div className="inline-form">
              <input
                type="tel"
                inputMode="tel"
                value={formatearTelefono(tel)}
                placeholder="10 dígitos, ej. 551 234 5678"
                onChange={(e) => setTelefono(i, e.target.value)}
              />
              {form.telefonos.length > 1 && (
                <button type="button" className="btn-secondary" onClick={() => quitarTelefono(i)}>
                  Quitar
                </button>
              )}
            </div>
            {mostrar("telefonos")?.[i] && <p className="error-campo">{mostrar("telefonos")[i]}</p>}
          </div>
        ))}
        <button type="button" className="btn-secondary btn-small" onClick={agregarTelefono}>
          + Agregar otro teléfono
        </button>
      </div>

      <Campo label="Dirección domiciliaria" ancho>
        <input value={form.direccion} onChange={(e) => setCampo("direccion", e.target.value)} />
      </Campo>

      <Campo label="Nombre de la escuela">
        <input value={form.escuela} onChange={(e) => setCampo("escuela", e.target.value)} />
      </Campo>

      <Campo label="Turno">
        <select value={form.turno} onChange={(e) => setCampo("turno", e.target.value)}>
          <option value="">Selecciona...</option>
          {TURNOS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Campo>

      <Campo label="Grado escolar actual">
        <input value={form.gradoEscolar} onChange={(e) => setCampo("gradoEscolar", e.target.value)} />
      </Campo>

      <Campo label="Nombre del padre, madre o tutor">
        <input value={form.tutor} onChange={(e) => setCampo("tutor", e.target.value)} />
      </Campo>

      <Campo label="¿Cómo se enteró de nosotros?">
        <select value={form.comoSeEntero} onChange={(e) => setCampo("comoSeEntero", e.target.value)}>
          <option value="">Selecciona...</option>
          {FUENTES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </Campo>

      <Campo label="No. de Seguro Social o servicio médico">
        <input value={form.seguroSocial} onChange={(e) => setCampo("seguroSocial", e.target.value)} />
      </Campo>

      <Campo label="Alergias o padecimientos médicos" ancho>
        <textarea
          value={form.alergias}
          onChange={(e) => setCampo("alergias", e.target.value)}
          rows={2}
        />
      </Campo>

      <PreguntaSiNo
        etiqueta="Antecedentes: ¿ha estado en alguna institución deportiva o militar?"
        valor={form.antecedentes}
        error={mostrar("antecedentes")}
        onChange={(v) => setCampo("antecedentes", v)}
        detalle={form.antecedentesDetalle}
        errorDetalle={mostrar("antecedentesDetalle")}
        onDetalle={(v) => setCampo("antecedentesDetalle", v)}
        placeholderDetalle="¿Cuál institución?"
      />

      <PreguntaSiNo
        etiqueta="¿Ha practicado o practica algún deporte?"
        valor={form.practicaDeporte}
        error={mostrar("practicaDeporte")}
        onChange={(v) => setCampo("practicaDeporte", v)}
        detalle={form.deporte}
        errorDetalle={mostrar("deporte")}
        onDetalle={(v) => setCampo("deporte", v)}
        placeholderDetalle="¿Cuál deporte?"
      />

      {modo === "crear" && (
        <>
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
        </>
      )}

      {intentado && Object.keys(errores).length > 0 && (
        <p className="error campo-ancho">Revisa los campos marcados en rojo.</p>
      )}
      {error && <p className="error campo-ancho">{error}</p>}

      <div className="inline-form campo-ancho">
        {onCancelar && (
          <button type="button" className="btn-secondary" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={guardando}>
          {guardando ? "Guardando..." : modo === "editar" ? "Guardar cambios" : "Registrar elemento"}
        </button>
      </div>
    </form>
  );
}

function formInicial(elemento, esAdmin, perfil) {
  if (!elemento) return { ...FORM_VACIO, unidad: esAdmin ? "" : perfil?.unidad || "" };
  return {
    ...FORM_VACIO,
    unidad: elemento.unidad || "",
    grupo: elemento.grupo || "Varonil",
    nombre: elemento.nombre || "",
    numeroOrden: elemento.numeroOrden || "",
    gradoMilitar: elemento.gradoMilitar || "",
    edad: elemento.edad ? String(elemento.edad) : "",
    telefonos: elemento.telefonos?.length ? elemento.telefonos.map(normalizarTelefono10) : [""],
    direccion: elemento.direccion || "",
    fechaNacimiento: elemento.fechaNacimiento || "",
    escuela: elemento.escuela || "",
    turno: elemento.turno || "",
    gradoEscolar: elemento.gradoEscolar || "",
    tutor: elemento.tutor || "",
    comoSeEntero: elemento.comoSeEntero || "",
    seguroSocial: elemento.seguroSocial || "",
    alergias: elemento.alergias || "",
    antecedentes: elemento.antecedentes || "",
    antecedentesDetalle: elemento.antecedentesDetalle || "",
    practicaDeporte: elemento.practicaDeporte || "",
    deporte: elemento.deporte || "",
  };
}

function Campo({ label, error, ayuda, ancho, children }) {
  return (
    <div className={`campo ${ancho ? "campo-ancho" : ""} ${error ? "campo-con-error" : ""}`}>
      <label>{label}</label>
      {children}
      {ayuda && !error && <p className="nota">{ayuda}</p>}
      {error && <p className="error-campo">{error}</p>}
    </div>
  );
}

// Pregunta de Sí/No; si la respuesta es Sí pide el detalle (cuál institución,
// cuál deporte).
function PreguntaSiNo({
  etiqueta,
  valor,
  error,
  onChange,
  detalle,
  errorDetalle,
  onDetalle,
  placeholderDetalle,
}) {
  return (
    <div className={`campo campo-ancho ${error || errorDetalle ? "campo-con-error" : ""}`}>
      <label>{etiqueta}</label>
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecciona...</option>
        <option>Sí</option>
        <option>No</option>
      </select>
      {error && <p className="error-campo">{error}</p>}
      {valor === "Sí" && (
        <>
          <input
            value={detalle}
            placeholder={placeholderDetalle}
            onChange={(e) => onDetalle(e.target.value)}
          />
          {errorDetalle && <p className="error-campo">{errorDetalle}</p>}
        </>
      )}
    </div>
  );
}
