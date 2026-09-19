import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { listenUsuario } from "../lib/usuarios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [perfilCargado, setPerfilCargado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setError(null);
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) {
        setPerfil(null);
        setPerfilCargado(true);
      }
    });
    return unsub;
  }, []);

  // El perfil (rol y unidad) vive en Firestore, dado de alta por un Admin.
  // Sin ese documento, el usuario está autenticado con Google pero sin
  // acceso a la app (ver Privado en App.jsx).
  useEffect(() => {
    if (!user?.email) return;
    setPerfilCargado(false);
    return listenUsuario(
      user.email,
      (datos) => {
        setPerfil(datos);
        setPerfilCargado(true);
      },
      () => {
        setPerfil(null);
        setPerfilCargado(true);
      }
    );
  }, [user?.email]);

  async function login() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      // Offline u otros errores de login: informar sin tronar la app.
      setError("No se pudo iniciar sesión. Verifica tu conexión a internet.");
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        perfil,
        // Cargando mientras se resuelve Firebase Auth o (si ya hay usuario) su perfil.
        loading: loading || (!!user && !perfilCargado),
        error,
        login,
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
