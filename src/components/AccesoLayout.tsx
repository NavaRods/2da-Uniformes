import type { ReactNode } from "react";

// Marco de las pantallas de acceso (iniciar sesión, verificar correo): un panel
// con la marca y otro con el contenido. En celular queda en una sola columna.
export default function AccesoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="acceso">
      <aside className="acceso-marca">
        <div className="acceso-logo">
          <span className="acceso-logo-icono" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
            </svg>
          </span>
          <span className="acceso-logo-nombre">Uniformes</span>
        </div>

        <div className="acceso-mensaje">
          <h1>Pedidos, pagos y entregas, en un solo lugar.</h1>
          <p>
            Lleva el control de la uniformidad de cada Unidad: lo que se vende, lo que se cobra y
            lo que ya se entregó.
          </p>
        </div>

        <ul className="acceso-puntos">
          <li>Cobros y mensualidades al día</li>
          <li>Uniformes recibidos y por entregar</li>
          <li>Funciona también sin internet</li>
        </ul>
      </aside>

      <main className="acceso-panel">
        <div className="acceso-tarjeta">{children}</div>
      </main>
    </div>
  );
}
