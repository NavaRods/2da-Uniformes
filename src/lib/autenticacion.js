// Lógica pura del acceso con correo y contraseña (sin Firebase): validar lo
// que se escribe y explicar en español los errores de Firebase Auth.

export const LARGO_MINIMO_CONTRASENA = 8;

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve el mensaje del primer problema, o "" si todo está bien.
// `confirmacion` solo se pide al crear una cuenta (undefined = no se revisa).
export function validarCredenciales({ correo, contrasena, confirmacion }) {
  if (!CORREO_VALIDO.test((correo || "").trim())) return "Escribe un correo válido.";
  if (!contrasena) return "Escribe tu contraseña.";
  if (confirmacion !== undefined) {
    if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
      return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
    }
    if (contrasena !== confirmacion) return "Las contraseñas no coinciden.";
  }
  return "";
}

// Firebase Auth responde con códigos (auth/…); aquí se traducen. Los de
// "usuario no encontrado" y "contraseña incorrecta" se dicen igual a propósito:
// así nadie puede averiguar qué correos tienen cuenta.
const MENSAJES = {
  "auth/invalid-email": "Escribe un correo válido.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/invalid-login-credentials": "Correo o contraseña incorrectos.",
  "auth/email-already-in-use":
    "Ese correo ya tiene cuenta. Inicia sesión, o toca “Olvidé mi contraseña” para crear una contraseña.",
  "auth/weak-password": `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "auth/network-request-failed": "No hay conexión a internet. Verifica tu red e inténtalo de nuevo.",
  "auth/user-disabled": "Esta cuenta está desactivada. Contacta a un administrador.",
  "auth/operation-not-allowed":
    "El acceso con correo y contraseña no está activado. Avisa a un administrador.",
  "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
  "auth/cancelled-popup-request": "",
};

export function mensajeErrorAuth(error) {
  const codigo = error?.code;
  if (codigo && codigo in MENSAJES) return MENSAJES[codigo];
  return "No se pudo completar la acción. Inténtalo de nuevo.";
}
