import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { listenUsuario } from "../lib/usuarios";
import { reiniciarFuentes } from "../lib/fuentes";
import { mensajeErrorAuth } from "../lib/autenticacion";

const AuthContext = createContext(/** @type {any} */ (null));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  // Correo cuyo perfil ya se resolvió (comparar con el usuario actual evita un
  // instante de "Sin acceso" al cambiar de cuenta en la misma pestaña).
  const [perfilDe, setPerfilDe] = useState(null);
  // Las cuentas de correo y contraseña nacen sin verificar: hasta que la
  // persona abra el enlace que se le manda, las reglas de Firestore no la
  // dejan leer nada (exigen correo verificado). Google ya llega verificado.
  const [verificado, setVerificado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setError(null);
      setUser(firebaseUser);
      setVerificado(!!firebaseUser?.emailVerified);
      setLoading(false);
      if (!firebaseUser) {
        setPerfil(null);
        setPerfilDe(null);
        reiniciarFuentes();
      }
    });
    return unsub;
  }, []);

  // El perfil (rol y unidad) vive en Firestore, dado de alta por un Admin.
  // Sin ese documento, el usuario está autenticado pero sin acceso a la app
  // (ver Privado en App.jsx). Solo se consulta con el correo verificado.
  useEffect(() => {
    if (!user?.email || !verificado) return;
    const correo = user.email;
    return listenUsuario(
      correo,
      (datos) => {
        setPerfil(datos);
        setPerfilDe(correo);
      },
      () => {
        setPerfil(null);
        setPerfilDe(correo);
      }
    );
  }, [user?.email, verificado]);

  // Google: el mensaje de error (si lo hay) se muestra en la pantalla de acceso.
  async function login() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      // Offline u otros errores de login: informar sin tronar la app.
      const mensaje = mensajeErrorAuth(e);
      if (mensaje) setError(mensaje);
    }
  }

  // Correo y contraseña. Las cuentas no se crean desde la app: el Super Admin
  // las da de alta (consola de Firebase) junto con su entrada en Usuarios.
  // Estas funciones lanzan un Error con el mensaje ya en español para que la
  // pantalla de acceso lo muestre junto al formulario.
  async function loginConCorreo(correo, contrasena) {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, correo.trim(), contrasena);
    } catch (e) {
      throw new Error(mensajeErrorAuth(e));
    }
  }

  async function recuperarContrasena(correo) {
    try {
      await sendPasswordResetEmail(auth, correo.trim());
    } catch (e) {
      // Con un correo sin cuenta no se avisa (no revelar quién tiene cuenta).
      if (e?.code === "auth/user-not-found") return;
      throw new Error(mensajeErrorAuth(e));
    }
  }

  async function reenviarVerificacion() {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (e) {
      throw new Error(mensajeErrorAuth(e));
    }
  }

  // "Ya verifiqué mi correo": vuelve a leer la cuenta y renueva el token (las
  // reglas leen la verificación del token, que no se actualiza solo).
  // Devuelve si ya está verificado.
  async function revisarVerificacion() {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    if (!auth.currentUser.emailVerified) return false;
    await auth.currentUser.getIdToken(true);
    setVerificado(true);
    return true;
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        perfil,
        verificado,
        // Cargando mientras se resuelve Firebase Auth o (si ya hay usuario) su
        // perfil. Sin verificar no hay perfil que esperar.
        loading: loading || (!!user && verificado && perfilDe !== user.email),
        error,
        login,
        loginConCorreo,
        recuperarContrasena,
        reenviarVerificacion,
        revisarVerificacion,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
