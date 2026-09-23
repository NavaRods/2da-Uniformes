import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocsFromServer,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { marcarCambios, COLECCIONES_VERSIONADAS } from "./versiones";
import { normalizarCorreo } from "./usuarios";
import { cifrarTexto, contrasenaCorrecta, crearVerificador, descifrarTexto } from "./cifrado";

// Respaldo completo de la app (solo Admin): se leen todas las colecciones, se
// cifran con la contraseña de respaldos y el archivo se guarda en Google Drive
// o en el dispositivo. Restaurar vuelve a escribir cada documento tal como
// estaba en el respaldo; lo que se creó después y no está en el respaldo se
// conserva.

export const FORMATO = "uniformes-respaldo";

// Qué se respalda, en el orden en que se restaura. "asistencias" son los docs
// asistencias/{fecha}/porUnidad/{unidad}.
const PARTES = [
  ["unidades", () => collection(db, "unidades")],
  ["grados", () => collection(db, "grados")],
  ["catalogo", () => collection(db, "catalogo")],
  ["configuracion", () => collection(db, "configuracion")],
  ["usuarios", () => collection(db, "usuarios")],
  ["elementos", () => collection(db, "elementos")],
  ["pedidos", () => collectionGroup(db, "pedidos")],
  ["abonos", () => collectionGroup(db, "abonos")],
  ["cuotas", () => collectionGroup(db, "cuotas")],
  ["asistencias", () => collectionGroup(db, "porUnidad")],
];

export const NOMBRES_PARTES = {
  unidades: "Unidades",
  grados: "Grados",
  catalogo: "Productos del catálogo",
  configuracion: "Configuración",
  usuarios: "Usuarios",
  elementos: "Elementos",
  pedidos: "Pedidos",
  abonos: "Abonos",
  cuotas: "Mensualidades",
  asistencias: "Listas de asistencia",
};

// --- Valores de Firestore <-> JSON ---
// JSON no tiene fechas: los Timestamp se guardan como { __ts: [seg, nanoseg] }.

export function aJSON(valor) {
  if (valor instanceof Timestamp) return { __ts: [valor.seconds, valor.nanoseconds] };
  if (Array.isArray(valor)) return valor.map(aJSON);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, aJSON(v)]));
  }
  return valor;
}

export function desdeJSON(valor) {
  if (Array.isArray(valor)) return valor.map(desdeJSON);
  if (valor && typeof valor === "object") {
    if (Array.isArray(valor.__ts) && Object.keys(valor).length === 1) {
      return new Timestamp(valor.__ts[0], valor.__ts[1]);
    }
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, desdeJSON(v)]));
  }
  return valor;
}

// --- Contraseña de respaldos ---
// En Firestore solo se guarda un verificador (sal + derivación PBKDF2), nunca
// la contraseña. Solo los Admin pueden leerlo.

const contrasenaRef = () => doc(db, "meta", "respaldo");

export async function leerConfigContrasena() {
  const snap = await getDoc(contrasenaRef());
  return snap.exists() ? snap.data() : null;
}

export async function verificarContrasena(contrasena) {
  const config = await leerConfigContrasena();
  if (!config) throw Object.assign(new Error("Sin contraseña"), { code: "sin-contrasena" });
  return contrasenaCorrecta(contrasena, config);
}

// Opción temporal (se quitará de la interfaz). Si ya había contraseña, se
// exige la actual.
export async function definirContrasena({ actual, nueva, por }) {
  const config = await leerConfigContrasena();
  if (config && !(await contrasenaCorrecta(actual || "", config))) {
    throw Object.assign(new Error("Contraseña actual incorrecta"), { code: "contrasena-incorrecta" });
  }
  const verificador = await crearVerificador(nueva);
  await setDoc(contrasenaRef(), {
    ...verificador,
    por: normalizarCorreo(por),
    actualizadoEn: serverTimestamp(),
  });
}

// --- Crear un respaldo ---

// Lee todo del servidor (no de la caché, que puede estar incompleta).
// `alAvanzar(parte)` avisa qué se está leyendo.
export async function reunirDatos(alAvanzar = () => {}) {
  const registros = [];
  const conteo = {};
  for (const [parte, consulta] of PARTES) {
    alAvanzar(parte);
    const snap = await getDocsFromServer(consulta());
    conteo[parte] = snap.size;
    snap.docs.forEach((d) => registros.push({ parte, ruta: d.ref.path, datos: aJSON(d.data()) }));
  }
  return { registros, conteo };
}

export function nombreArchivo(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, "0");
  const dia = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
  const hora = `${dos(fecha.getHours())}${dos(fecha.getMinutes())}`;
  return `respaldo-uniformes-${dia}-${hora}.json`;
}

// Archivo final: los datos van cifrados; afuera solo quedan fecha, autor y
// cuántos documentos hay de cada tipo (sin datos personales).
export async function crearArchivo({ registros, conteo }, { contrasena, por, iteraciones }) {
  const creado = new Date().toISOString();
  const contenido = JSON.stringify({ registros });
  const cifrado = await cifrarTexto(contenido, contrasena, iteraciones);
  return JSON.stringify({ formato: FORMATO, version: 1, creado, por, conteo, cifrado });
}

// --- Restaurar ---

export function leerEncabezado(textoArchivo) {
  let archivo;
  try {
    archivo = JSON.parse(textoArchivo);
  } catch {
    archivo = null;
  }
  if (archivo?.formato !== FORMATO || !archivo.cifrado) {
    throw Object.assign(new Error("No es un respaldo de esta app"), { code: "archivo-invalido" });
  }
  return archivo;
}

export async function abrirRespaldo(textoArchivo, contrasena) {
  const archivo = leerEncabezado(textoArchivo);
  const { registros } = JSON.parse(await descifrarTexto(archivo.cifrado, contrasena));
  return { creado: archivo.creado, por: archivo.por, conteo: archivo.conteo, registros };
}

// Firestore admite 500 escrituras por lote; se dejan de margen las de control.
export const TAMANO_LOTE = 400;

// Vuelve a escribir cada documento del respaldo. Cada lote marca
// meta/restauracion (quién, cuándo, qué archivo): las reglas solo permiten
// reescribir pedidos, abonos y mensualidades tal cual si el lote lo trae.
// El usuario que restaura no se toca a sí mismo (no puede quitarse el acceso).
export async function restaurar({ registros }, { por, nombre, alAvanzar = () => {} }) {
  const propio = `usuarios/${normalizarCorreo(por)}`;
  const orden = PARTES.map(([parte]) => parte);
  const pendientes = registros
    .filter((r) => r.ruta !== propio)
    .sort((a, b) => orden.indexOf(a.parte) - orden.indexOf(b.parte));

  for (let i = 0; i < pendientes.length; i += TAMANO_LOTE) {
    const lote = writeBatch(db);
    const versionadas = new Set();
    for (const r of pendientes.slice(i, i + TAMANO_LOTE)) {
      const datos = desdeJSON(r.datos);
      const segmentos = r.ruta.split("/");
      // Un elemento restaurado cuenta como cambio: así los demás dispositivos
      // lo vuelven a descargar (ver sincronización por cambios en elementos.js).
      if (segmentos.length === 2 && segmentos[0] === "elementos") {
        datos.actualizadoEn = serverTimestamp();
      }
      if (segmentos.length === 2 && COLECCIONES_VERSIONADAS.includes(segmentos[0])) {
        versionadas.add(segmentos[0]);
      }
      lote.set(doc(db, r.ruta), datos);
    }
    marcarCambios(lote, [...versionadas]);
    lote.set(doc(db, "meta", "restauracion"), {
      en: serverTimestamp(),
      por: normalizarCorreo(por),
      respaldo: nombre || "",
    });
    await lote.commit();
    alAvanzar(Math.min(i + TAMANO_LOTE, pendientes.length), pendientes.length);
  }
  return pendientes.length;
}
