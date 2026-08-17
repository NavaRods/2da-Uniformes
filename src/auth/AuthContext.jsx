import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider, ALLOWED_EMAILS } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && !isAllowed(firebaseUser.email)) {
        setError("Este correo no tiene acceso a la app.");
        signOut(auth);
        setUser(null);
      } else {
        setError(null);
        setUser(firebaseUser);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  function isAllowed(email) {
    if (!email) return false;
    if (ALLOWED_EMAILS.length === 0) return true;
    return ALLOWED_EMAILS.includes(email.toLowerCase());
  }

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
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
