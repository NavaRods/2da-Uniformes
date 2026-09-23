import { GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { auth } from "../firebase";

// Respaldos en el Google Drive del Admin. Se pide el permiso "drive.file":
// la app solo ve y crea SUS propios archivos, no el resto del Drive.
const ALCANCE = "https://www.googleapis.com/auth/drive.file";
const CARPETA = "Respaldos Uniformes";
const API = "https://www.googleapis.com/drive/v3";
const SUBIDA = "https://www.googleapis.com/upload/drive/v3";

// El permiso de Google dura 1 hora y Firebase no lo renueva: se guarda en
// memoria un poco menos y después se vuelve a pedir.
const VIGENCIA_MS = 50 * 60 * 1000;
let permiso = null; // { token, vence }

// Abre la ventana de Google (debe llamarse directo desde un clic, o el
// navegador la bloquea). Es la misma cuenta con la que se inició sesión.
export async function conectarDrive() {
  if (permiso && Date.now() < permiso.vence) return permiso.token;
  const proveedor = new GoogleAuthProvider();
  proveedor.addScope(ALCANCE);
  proveedor.setCustomParameters({ login_hint: auth.currentUser?.email || "" });
  const resultado = await reauthenticateWithPopup(auth.currentUser, proveedor);
  const token = GoogleAuthProvider.credentialFromResult(resultado)?.accessToken;
  if (!token) throw Object.assign(new Error("Sin permiso de Drive"), { code: "drive-sin-permiso" });
  permiso = { token, vence: Date.now() + VIGENCIA_MS };
  return token;
}

export const driveConectado = () => !!permiso && Date.now() < permiso.vence;

async function llamar(url, opciones = {}) {
  if (!driveConectado()) {
    throw Object.assign(new Error("Conecta Google Drive"), { code: "drive-sin-permiso" });
  }
  const respuesta = await fetch(url, {
    ...opciones,
    headers: { Authorization: `Bearer ${permiso.token}`, ...opciones.headers },
  });
  if (respuesta.ok) return respuesta;

  const detalle = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401) {
    permiso = null;
    throw Object.assign(new Error("El permiso de Drive venció"), { code: "drive-sin-permiso" });
  }
  const razon = detalle?.error?.errors?.[0]?.reason || detalle?.error?.status;
  if (razon === "accessNotConfigured" || razon === "SERVICE_DISABLED") {
    throw Object.assign(new Error("La API de Google Drive no está activada"), {
      code: "drive-api-desactivada",
    });
  }
  throw Object.assign(new Error(detalle?.error?.message || `Drive respondió ${respuesta.status}`), {
    code: "drive-error",
  });
}

async function idCarpeta() {
  const q = encodeURIComponent(
    `name = '${CARPETA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const lista = await (await llamar(`${API}/files?q=${q}&fields=files(id)&spaces=drive`)).json();
  if (lista.files?.length) return lista.files[0].id;
  const creada = await llamar(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: CARPETA, mimeType: "application/vnd.google-apps.folder" }),
  });
  return (await creada.json()).id;
}

export async function subirRespaldo(nombre, contenido) {
  const carpeta = await idCarpeta();
  const limite = `respaldo-${crypto.randomUUID()}`;
  const metadatos = { name: nombre, parents: [carpeta], mimeType: "application/json" };
  const cuerpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadatos)}\r\n` +
    `--${limite}\r\nContent-Type: application/json\r\n\r\n${contenido}\r\n--${limite}--`;
  const respuesta = await llamar(`${SUBIDA}/files?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  return respuesta.json();
}

// Respaldos de la carpeta, del más nuevo al más viejo.
export async function listarRespaldos() {
  const carpeta = await idCarpeta();
  const q = encodeURIComponent(`'${carpeta}' in parents and trashed = false`);
  const campos = encodeURIComponent("files(id,name,createdTime,size)");
  const lista = await (
    await llamar(`${API}/files?q=${q}&orderBy=createdTime desc&fields=${campos}&pageSize=50`)
  ).json();
  return lista.files || [];
}

export async function descargarRespaldo(id) {
  return (await llamar(`${API}/files/${id}?alt=media`)).text();
}
