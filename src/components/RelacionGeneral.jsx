import { useEffect, useState } from "react";
import {
  agruparAbonos,
  agruparPorPieza,
  conAbonosPendientes,
  fechaCorta,
  listenRelaciones,
  recibirDeRelacion,
} from "../lib/relaciones";
import { formatoMoneda } from "../lib/format";
import { buscar } from "../lib/busqueda";

// [clave, botón, qué muestra]
const VISTAS = [
  [
    "sin-recibir",
    "Sin recibir",
    "Lo que ya pagaste al proveedor (relaciones validadas) y todavía no te entrega. Cuando llegue, toca Recibir: pasa a Uniformidad disponible.",
  ],
  ["recibido", "Recibido", "Lo que el proveedor ya te entregó, con la fecha en que se pagó cada pieza."],
  [
    "abonos",
    "Abonos",
    "Piezas que se están pagando poco a poco: los abonos se acumulan y la pieza no se entrega ni se cuenta hasta que se liquida.",
  ],
];

// El producto ya es el título de la tarjeta: aquí solo talla y color.
const etiquetaVariante = ({ talla, color }) =>
  [talla && `Talla ${talla}`, color].filter(Boolean).join(" · ") || "Única";

const etiquetaPieza = ({ productoNombre, talla, color }) =>
  [productoNombre, talla && `talla ${talla}`, color].filter(Boolean).join(" — ");

// ¿El texto coincide con lo buscado? (sin acentos, mayúsculas ni orden de palabras)
const coincide = (texto, busqueda) => !busqueda.trim() || buscar([texto], busqueda).length > 0;

const piezas = (n) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

// Una fecha de pago de una pieza. En Sin recibir se puede marcar lo recibido.
function FilaFecha({ entrada, modo, puedeRecibir }) {
  const [abierta, setAbierta] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function recibir(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      await recibirDeRelacion(entrada.relacion, new Map([[entrada.indice, cantidad]]));
      setAbierta(false);
    } catch (err) {
      setError(err.message || "No se pudo guardar. Inténtalo de nuevo.");
    }
    setGuardando(false);
  }

  return (
    <li>
      <div className="rg-fila">
        <span className="rg-fecha">
          <span className="nota">Se pagó el</span>
          <strong>{fechaCorta(entrada.fecha)}</strong>
        </span>
        <span className="rg-cantidad">{piezas(entrada.cantidad)}</span>
        {modo === "sin-recibir" && puedeRecibir && (
          <button
            type="button"
            className="btn-secondary btn-small"
            aria-expanded={abierta}
            onClick={() => {
              setCantidad(String(entrada.cantidad));
              setError("");
              setAbierta(!abierta);
            }}
          >
            Recibir
          </button>
        )}
      </div>
      {entrada.elementos?.length > 0 && (
        <p className="nota rg-de">De: {entrada.elementos.map((e) => e.nombre).join(", ")}</p>
      )}
      {abierta && (
        <form className="recibir-form" onSubmit={recibir}>
          <label>
            ¿Cuántas te entregaron?
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={entrada.cantidad}
              step="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" className="btn-primary btn-small" disabled={guardando}>
            Guardar
          </button>
          <button type="button" className="btn-secondary btn-small" onClick={() => setAbierta(false)}>
            Cancelar
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </li>
  );
}

function BloqueVariante({ variante, modo, puedeRecibir, mostrarUnidad }) {
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function recibirTodo() {
    setError("");
    setGuardando(true);
    try {
      // Una escritura por relación (cada fecha es un documento distinto).
      for (const f of variante.fechas) {
        await recibirDeRelacion(f.relacion, new Map([[f.indice, f.cantidad]]));
      }
    } catch (err) {
      setError(err.message || "No se pudo guardar. Inténtalo de nuevo.");
    }
    setGuardando(false);
  }

  return (
    <li className="rg-variante">
      <div className="rg-variante-cab">
        <span className="rg-variante-nombre">
          {etiquetaVariante(variante)}
          {mostrarUnidad && <span className="nota">Unidad {variante.unidad}</span>}
        </span>
        <span className="rg-total">
          {variante.fechas.length === 0 ? "Solo abonos" : `Total: ${variante.total}`}
        </span>
      </div>
      <ul className="rg-fechas">
        {variante.fechas.map((f) => (
          <FilaFecha key={`${f.relacion.unidad}~${f.fecha}`} entrada={f} modo={modo} puedeRecibir={puedeRecibir} />
        ))}
      </ul>
      {variante.abonos?.length > 0 && (
        <div className="rg-abonos">
          <p className="rg-abonos-titulo">Abonos — aún sin liquidar</p>
          {variante.abonos.map((a) => (
            <div key={a.id} className="rg-abono">
              <div className="rg-abono-cab">
                <strong>{a.nombre || "?"}</strong>
                <span className="insignia insignia-abono">
                  {a.saldo > 0 ? `Le resta ${formatoMoneda(a.saldo)}` : "Abonando"}
                </span>
              </div>
              <ul className="rg-fechas">
                {a.pagos.map((pago, i) => (
                  <li key={`${pago.fecha}-${i}`} className="rg-fila rg-fila-abono">
                    <span>
                      <span className="nota">Abono del </span>
                      <strong>{fechaCorta(pago.fecha)}</strong>
                    </span>
                    <strong>{formatoMoneda(pago.monto)}</strong>
                  </li>
                ))}
              </ul>
              <p className="nota rg-de">Abonado en total = {formatoMoneda(a.total)}</p>
            </div>
          ))}
        </div>
      )}
      {modo === "sin-recibir" && puedeRecibir && variante.fechas.length > 1 && (
        <button type="button" className="btn-secondary btn-small rg-todas" onClick={recibirTodo} disabled={guardando}>
          {guardando ? "Guardando…" : `Recibir las ${variante.total}`}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </li>
  );
}

// Relación General: lo de todas las relaciones de pagos validadas, junto por
// pieza (producto, talla y color) pero conservando la fecha en que se pagó
// cada una. Se divide en Sin recibir (falta que el proveedor lo entregue) y
// Recibido; al recibir, la pieza pasa a "Uniformidad disponible" (en Uniformes
// y Mensualidades), de donde se descuenta al entregarla a cada elemento.
// `unidad` vacío = todas las Unidades visibles. `puedeRecibir`: false en solo
// lectura.
export default function RelacionGeneral({ unidad, puedeRecibir }) {
  const [relaciones, setRelaciones] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("sin-recibir");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setRelaciones(null);
    setError("");
    return listenRelaciones(unidad, setRelaciones, () =>
      setError("No se pudieron cargar las relaciones. Verifica tu conexión e inténtalo de nuevo.")
    );
  }, [unidad]);

  const sinRecibir = conAbonosPendientes(agruparPorPieza(relaciones, "sin-recibir"), relaciones);
  const recibido = agruparPorPieza(relaciones, "recibido");
  const abonos = agruparAbonos(relaciones);
  const abonosPendientes = abonos.filter((a) => !a.liquidadaEl).length;
  // Sin recibir y Recibido se buscan por uniforme; Abonos, por uniforme o elemento.
  const porUniforme = (lista) =>
    lista
      .map((p) => ({
        ...p,
        variantes: p.variantes.filter((v) =>
          coincide(`${v.productoNombre} ${v.talla} ${v.color}`, busqueda)
        ),
      }))
      .filter((p) => p.variantes.length > 0);
  const grupos = porUniforme(vista === "sin-recibir" ? sinRecibir : recibido);
  const abonosVisibles = abonos.filter((a) =>
    coincide(`${a.nombre} ${a.productoNombre} ${a.talla} ${a.color}`, busqueda)
  );
  const suma = (lista) => lista.reduce((s, p) => s + p.total, 0);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {!error && relaciones === null && <p className="nota">Cargando relaciones…</p>}

      {relaciones && (
        <>
          <div className="tarjetas-resumen">
            <div className="card tarjeta-total">
              <span className="ficha-etiqueta">Sin recibir</span>
              <span className="total-monto">{suma(sinRecibir)}</span>
              <span className="nota">del proveedor</span>
            </div>
            <div className="card">
              <span className="ficha-etiqueta">Recibido</span>
              <span className="total-sub">{suma(recibido)}</span>
              <span className="nota">ya entregado</span>
            </div>
          </div>

          <div className="filtros">
            {VISTAS.map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                className={`chip ${vista === clave ? "activo" : ""}`}
                aria-pressed={vista === clave}
                onClick={() => setVista(clave)}
              >
                {etiqueta} (
                {clave === "abonos" ? abonosPendientes : suma(clave === "sin-recibir" ? sinRecibir : recibido)})
              </button>
            ))}
          </div>
          <p className="ayuda">{VISTAS.find(([clave]) => clave === vista)[2]}</p>

          {relaciones.length === 0 && (
            <p className="nota">
              Todavía no hay relaciones validadas. En <strong>Del día</strong>, toca “Validar entrega del
              dinero” para guardar la de un día.
            </p>
          )}
          {relaciones.length > 0 && (
            <input
              type="search"
              className="buscador"
              placeholder={vista === "abonos" ? "Buscar uniforme o elemento…" : "Buscar uniforme…"}
              aria-label="Buscar"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          )}
          {vista === "abonos" && relaciones.length > 0 && abonos.length === 0 && (
            <p className="nota">No hay abonos en las relaciones validadas.</p>
          )}
          {vista === "abonos" && abonos.length > 0 && abonosVisibles.length === 0 && (
            <p className="nota">Ningún abono coincide con la búsqueda.</p>
          )}
          {vista === "abonos" && (
            <ul className="lista-tarjetas">
              {abonosVisibles.map((a) => (
                <li key={a.id} className="tarjeta-cambio">
                  <div className="tarjeta-cambio-cabecera">
                    <strong>{a.nombre || "?"}</strong>
                    {a.liquidadaEl ? (
                      <span className="insignia insignia-ok">Liquidada el {fechaCorta(a.liquidadaEl)}</span>
                    ) : (
                      <span className="insignia insignia-abono">
                        {a.saldo > 0 ? `Le resta ${formatoMoneda(a.saldo)}` : "Abonando"}
                      </span>
                    )}
                  </div>
                  <p className="nota">{etiquetaPieza(a)}</p>
                  <ul className="rg-fechas">
                    {a.pagos.map((pago, i) => (
                      <li key={`${pago.fecha}-${i}`}>
                        <div className="rg-fila rg-fila-abono">
                          <span className="rg-fecha">
                            <span className="nota">Abono del</span>
                            <strong>{fechaCorta(pago.fecha)}</strong>
                          </span>
                          <strong>{formatoMoneda(pago.monto)}</strong>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="variante-total">
                    <strong>Abonado en total = {formatoMoneda(a.total)}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {vista !== "abonos" && relaciones.length > 0 && grupos.length === 0 && (
            <p className="nota">
              {busqueda.trim()
                ? "Ningún uniforme coincide con la búsqueda."
                : vista === "sin-recibir"
                  ? "No falta recibir ninguna pieza."
                  : "Todavía no has recibido piezas."}
            </p>
          )}

          <div className="uniformidad-lista">
            {(vista === "abonos" ? [] : grupos).map((p) => (
              <section key={p.producto} className="uniformidad-producto">
                <header className="uniformidad-cabecera">
                  <span className="pago-nombre">{p.producto}</span>
                  <strong>{p.total > 0 ? piezas(p.total) : "Solo abonos"}</strong>
                </header>
                <ul className="rg-variantes">
                  {p.variantes.map((v) => (
                    <BloqueVariante
                      key={v.clave}
                      variante={v}
                      modo={vista}
                      puedeRecibir={puedeRecibir}
                      mostrarUnidad={!unidad}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
