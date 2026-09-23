// Cifrado de los respaldos con la contraseña de respaldos (Web Crypto del
// navegador, sin librerías). La contraseña nunca se guarda: de ella se deriva
// una clave con PBKDF2 y los datos se cifran con AES-GCM, que además detecta
// si el archivo fue alterado o si la contraseña es incorrecta.

// Iteraciones de PBKDF2-SHA256 (recomendación de OWASP). Hace lento probar
// contraseñas a fuerza bruta; en un teléfono tarda alrededor de un segundo.
export const ITERACIONES = 600000;

const texto = new TextEncoder();

export function aBase64(bytes) {
  let binario = "";
  // Por partes: String.fromCharCode con millones de argumentos desborda la pila.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export function deBase64(cadena) {
  const binario = atob(cadena);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

const aleatorios = (n) => crypto.getRandomValues(new Uint8Array(n));

async function derivarBits(contrasena, sal, iteraciones) {
  const base = await crypto.subtle.importKey("raw", texto.encode(contrasena), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteraciones },
    base,
    256
  );
  return new Uint8Array(bits);
}

async function claveAes(contrasena, sal, iteraciones, usos) {
  const bits = await derivarBits(contrasena, sal, iteraciones);
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, usos);
}

// --- Verificador: permite comprobar la contraseña sin guardarla ---

export async function crearVerificador(contrasena, iteraciones = ITERACIONES) {
  const sal = aleatorios(16);
  const bits = await derivarBits(contrasena, sal, iteraciones);
  return { sal: aBase64(sal), verificador: aBase64(bits), iteraciones };
}

export async function contrasenaCorrecta(contrasena, { sal, verificador, iteraciones }) {
  const bits = await derivarBits(contrasena, deBase64(sal), iteraciones);
  const esperado = deBase64(verificador);
  if (bits.length !== esperado.length) return false;
  // Comparación sin cortar al primer byte distinto.
  let diferencia = 0;
  for (let i = 0; i < bits.length; i++) diferencia |= bits[i] ^ esperado[i];
  return diferencia === 0;
}

// --- Compresión (el JSON de un respaldo se reduce varias veces) ---

async function transformar(bytes, flujo) {
  const salida = new Blob([bytes]).stream().pipeThrough(flujo);
  return new Uint8Array(await new Response(salida).arrayBuffer());
}

// --- Cifrar / descifrar un texto ---

export async function cifrarTexto(contenido, contrasena, iteraciones = ITERACIONES) {
  const sal = aleatorios(16);
  const iv = aleatorios(12);
  const clave = await claveAes(contrasena, sal, iteraciones, ["encrypt"]);
  const comprimido = await transformar(texto.encode(contenido), new CompressionStream("gzip"));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, comprimido);
  return {
    algoritmo: "AES-GCM",
    derivacion: "PBKDF2-SHA256",
    compresion: "gzip",
    iteraciones,
    sal: aBase64(sal),
    iv: aBase64(iv),
    datos: aBase64(new Uint8Array(cifrado)),
  };
}

// Lanza un error con code "contrasena-incorrecta" si la contraseña no es la
// del archivo (o si el archivo se alteró).
export async function descifrarTexto(sobre, contrasena) {
  const clave = await claveAes(contrasena, deBase64(sobre.sal), sobre.iteraciones, ["decrypt"]);
  let comprimido;
  try {
    comprimido = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deBase64(sobre.iv) },
      clave,
      deBase64(sobre.datos)
    );
  } catch {
    throw Object.assign(new Error("Contraseña incorrecta"), { code: "contrasena-incorrecta" });
  }
  const bytes = await transformar(new Uint8Array(comprimido), new DecompressionStream("gzip"));
  return new TextDecoder().decode(bytes);
}
