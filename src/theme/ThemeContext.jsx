import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

function temaInicial() {
  const guardado = localStorage.getItem("tema");
  if (guardado) return guardado;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("tema", tema);
  }, [tema]);

  function alternar() {
    setTema((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ tema, alternar }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
