// Roles de la app y sus permisos. Único punto de verdad: toda pantalla que
// necesite saber qué puede hacer un usuario importa de aquí, en vez de
// comparar perfil.rol a mano.
//
// - "superadmin": todo el poder. Nunca se crea, edita, ni se borra desde la
//   app (ni siquiera otro Admin puede tocarlo) — se da de alta a mano en
//   Firestore, igual que el primer Admin de antes (ver README). No aparece
//   en la lista de la pantalla Usuarios.
// - "admin": mueve Configuración (Unidades, grados, catálogo) y da de alta o
//   edita usuarios. Ve y opera en todas las Unidades.
// - "estado_mayor": consulta los datos de todas las Unidades, pero no da de
//   alta ni edita nada (ni siquiera en una Unidad ajena): es de solo lectura.
// - "responsable": a cargo de una sola Unidad (la suya), con control total
//   sobre ella.
// - "instructor": ayudante de un responsable, con una sola Unidad asignada y
//   el mismo alcance operativo que un responsable dentro de ella.
//
// Los roles con una sola Unidad la traen precargada y fija (no la eligen);
// los demás ven un selector de Unidad o, en el caso de Admin/Super Admin,
// trabajan con todas.

// Roles que se pueden asignar desde la pantalla de Usuarios. "superadmin" no
// está aquí a propósito: solo se asigna a mano en la base de datos.
export const ROLES = ["admin", "estado_mayor", "responsable", "instructor"];

export const ETIQUETA_ROL = {
  superadmin: "Super Admin",
  admin: "Admin",
  estado_mayor: "Estado Mayor",
  responsable: "Responsable",
  instructor: "Instructor",
};

export function etiquetaRol(rol) {
  return ETIQUETA_ROL[rol] || rol || "";
}

// Roles que ven y trabajan con todas las Unidades, sin tener una fija.
const SIN_UNIDAD_FIJA = ["superadmin", "admin", "estado_mayor"];

export function requiereUnidad(rol) {
  return !SIN_UNIDAD_FIJA.includes(rol);
}

export function esSuperAdmin(perfil) {
  return perfil?.rol === "superadmin";
}

// Admin y Super Admin: mismo nivel para administrar la app (usuarios,
// Configuración, todas las Unidades). Se diferencian solo en que a un
// Super Admin nadie (ni otro Admin) puede tocarle su cuenta desde la app.
export function esAdmin(perfil) {
  return perfil?.rol === "admin" || esSuperAdmin(perfil);
}

export function esEstadoMayor(perfil) {
  return perfil?.rol === "estado_mayor";
}

// Ve todas las Unidades (sin tener que elegir la suya, porque no tiene):
// Admin/Super Admin para administrar, Estado Mayor para consultar.
export function veTodasLasUnidades(perfil) {
  return esAdmin(perfil) || esEstadoMayor(perfil);
}

// Responsable e Instructor: una sola Unidad fija (la de su perfil).
export function tieneUnidadFija(perfil) {
  return requiereUnidad(perfil?.rol);
}

// Estado Mayor es de solo lectura: consulta todas las Unidades pero no da de
// alta, edita, marca asistencia ni registra pagos en ninguna.
export function esSoloLectura(perfil) {
  return esEstadoMayor(perfil);
}

// Puede dar de alta/editar datos (elementos, asistencia, pagos, uniformidad)
// en esa Unidad: Admin/Super Admin en cualquiera, Responsable/Instructor
// solo en la suya. Estado Mayor no puede en ninguna.
export function puedeEscribirEnUnidad(perfil, unidad) {
  if (esAdmin(perfil)) return true;
  return tieneUnidadFija(perfil) && !!unidad && unidad === perfil?.unidad;
}

export function puedeGestionarUsuarios(perfil) {
  return esAdmin(perfil);
}

export function puedeGestionarConfiguracion(perfil) {
  return esAdmin(perfil);
}
