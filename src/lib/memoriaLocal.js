// Marcas pequeñas en localStorage que dicen qué datos de Firestore ya están
// completos en la caché del dispositivo (y de qué versión), para leerlos de ahí
// sin pagar lecturas. Si localStorage no está disponible (modo privado, datos
// borrados), todo sigue funcionando: solo se vuelve a leer del servidor.
// Cada proyecto (y el emulador en desarrollo) guarda sus propias marcas.
const PREFIJO = `uniformes:${import.meta.env.VITE_FIREBASE_PROJECT_ID}:${import.meta.env.DEV ? "dev" : "prod"}:`;

export function leerMarca(clave) {
  try {
    const texto = localStorage.getItem(PREFIJO + clave);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function guardarMarca(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    // Sin espacio o sin permiso: la próxima vez se lee del servidor.
  }
}
