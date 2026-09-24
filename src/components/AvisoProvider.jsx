import { createContext, useCallback, useContext, useMemo, useState } from "react";
import AvisoWhatsapp from "./AvisoWhatsapp";

const AvisoContext = createContext(() => {});

// Un solo lugar donde se muestra el aviso de WhatsApp. Quien registra algo
// (pago, entrega, cambio, venta) llama a mostrarAviso({ elemento, titulo,
// mensaje }): así el aviso no se pierde aunque la pantalla que lo pidió
// desaparezca (p. ej. una pieza entregada que sale de un filtro).
export function AvisoProvider({ children }) {
  const [aviso, setAviso] = useState(null);
  const mostrarAviso = useCallback((datos) => setAviso(datos), []);
  const valor = useMemo(() => mostrarAviso, [mostrarAviso]);

  return (
    <AvisoContext.Provider value={valor}>
      {children}
      {aviso && (
        <AvisoWhatsapp
          key={aviso.mensaje}
          elemento={aviso.elemento}
          titulo={aviso.titulo}
          mensaje={aviso.mensaje}
          onCerrar={() => setAviso(null)}
        />
      )}
    </AvisoContext.Provider>
  );
}

export const useAviso = () => useContext(AvisoContext);
