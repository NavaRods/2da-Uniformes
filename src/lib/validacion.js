// Validaciones y formatos del formulario de elementos. Cada validador devuelve
// un texto de error, o "" si el valor es correcto.

export function soloDigitos(texto) {
  return String(texto ?? "").replace(/\D/g, "");
}

// Deja un teléfono en sus 10 dígitos: quita espacios, guiones y paréntesis, y
// el código de país 52 si viene (12 dígitos, o 13 con el "1" antiguo de celular).
export function normalizarTelefono10(texto) {
  let digitos = soloDigitos(texto);
  if (digitos.length === 13 && digitos.startsWith("521")) digitos = digitos.slice(3);
  else if (digitos.length === 12 && digitos.startsWith("52")) digitos = digitos.slice(2);
  return digitos;
}

// "5512345678" -> "551 234 5678" (se va formando mientras se escribe).
export function formatearTelefono(digitos) {
  const d = soloDigitos(digitos).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function validarTelefono(digitos) {
  if (!digitos) return "";
  return /^\d{10}$/.test(digitos) ? "" : "El teléfono debe tener 10 dígitos.";
}

// Número de orden: V/F (grupo) + 2 dígitos de la unidad + 2 del año de
// ingreso + 3 del número de lista. Ej. V0218001. Es opcional.
export const PATRON_NUMERO_ORDEN = /^[VF]\d{7}$/;

export function normalizarNumeroOrden(texto) {
  return String(texto ?? "").toUpperCase().replace(/[^VF0-9]/g, "").slice(0, 8);
}

export function validarNumeroOrden(valor, grupo) {
  if (!valor) return "";
  if (!PATRON_NUMERO_ORDEN.test(valor)) {
    return "Formato: V o F, unidad (2), año (2) y lista (3). Ej. V0218001.";
  }
  const letra = grupo === "Femenino" ? "F" : "V";
  if (valor[0] !== letra) {
    return `Debe empezar con ${letra} porque el grupo es ${grupo === "Femenino" ? "Femenino" : "Varonil"}.`;
  }
  return "";
}

const PATRON_NOMBRE = /^[\p{L}][\p{L}\s.'-]*$/u;

export function validarNombre(nombre) {
  const texto = (nombre ?? "").trim();
  if (!texto) return "El nombre es obligatorio.";
  if (texto.length < 3) return "Escribe el nombre completo (mínimo 3 letras).";
  if (!PATRON_NOMBRE.test(texto)) return "El nombre solo puede llevar letras y espacios.";
  return "";
}

export function validarEdad(edad) {
  if (edad === "" || edad == null) return "";
  const n = Number(edad);
  return Number.isInteger(n) && n >= 3 && n <= 99 ? "" : "La edad debe estar entre 3 y 99.";
}

export function validarFechaNacimiento(fecha, hoy = new Date()) {
  if (!fecha) return "";
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Fecha inválida.";
  if (d > hoy) return "La fecha de nacimiento no puede ser futura.";
  if (d.getFullYear() < 1920) return "Fecha inválida.";
  return "";
}

// Valida todo el formulario. Antecedentes y deporte son opcionales; si se
// contesta "Sí" a alguna, sí se pide el detalle.
export function validarElemento(form, gradosValidos) {
  const errores = {};

  if (!form.unidad) errores.unidad = "Selecciona la Unidad.";

  const errNombre = validarNombre(form.nombre);
  if (errNombre) errores.nombre = errNombre;

  if (!form.gradoMilitar) errores.gradoMilitar = "Selecciona el grado militar.";
  else if (!gradosValidos.includes(form.gradoMilitar)) errores.gradoMilitar = "Grado no válido.";

  const errOrden = validarNumeroOrden(form.numeroOrden, form.grupo);
  if (errOrden) errores.numeroOrden = errOrden;

  const errEdad = validarEdad(form.edad);
  if (errEdad) errores.edad = errEdad;

  const errFecha = validarFechaNacimiento(form.fechaNacimiento);
  if (errFecha) errores.fechaNacimiento = errFecha;

  const errTelefonos = form.telefonos.map((t) => validarTelefono(t));
  if (errTelefonos.some(Boolean)) errores.telefonos = errTelefonos;

  if (form.antecedentes === "Sí" && !form.antecedentesDetalle.trim()) {
    errores.antecedentesDetalle = "Indica cuál institución.";
  }

  if (form.practicaDeporte === "Sí" && !form.deporte.trim()) {
    errores.deporte = "Indica cuál deporte.";
  }

  return errores;
}
