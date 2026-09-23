import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  NOMBRES_PARTES,
  abrirRespaldo,
  crearArchivo,
  leerConfigContrasena,
  nombreArchivo,
  restaurar,
  reunirDatos,
  verificarContrasena,
} from "../lib/respaldo";
import { conectarDrive, descargarRespaldo, listarRespaldos, subirRespaldo } from "../lib/drive";
import DefinirContrasenaRespaldo from "./DefinirContrasenaRespaldo";

// Palabra que hay que escribir para confirmar una restauración.
const CONFIRMACION = "RESTAURAR";

const MENSAJES = {
  "contrasena-incorrecta": "Contraseña incorrecta.",
  "sin-contrasena": "Primero define la contraseña de respaldos.",
  "archivo-invalido": "El archivo no es un respaldo de esta app.",
  "drive-api-desactivada":
    "La API de Google Drive no está activada en el proyecto. Actívala en Google Cloud (ver README).",
  "drive-sin-permiso": "No se dio permiso para usar Google Drive. Inténtalo de nuevo.",
  "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de dar permiso.",
  "auth/cancelled-popup-request": "Se cerró la ventana de Google antes de dar permiso.",
  "auth/popup-blocked":
    "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para esta página.",
  "auth/user-mismatch": "Elige la misma cuenta de Google con la que iniciaste sesión.",
  unavailable: "Sin conexión: los respaldos necesitan internet.",
  "resource-exhausted": "Se agotó la cuota diaria de Firebase. Inténtalo mañana.",
};

const mensajeDe = (e) =>
  MENSAJES[e?.code] || "No se pudo completar. Verifica tu conexión e inténtalo de nuevo.";

const fechaLegible = (iso) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

const totalDe = (conteo) => Object.values(conteo || {}).reduce((s, n) => s + n, 0);

function descargarAlDispositivo(nombre, contenido) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "application/json" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Respaldo y restauración (solo Admin, en Configuración).
export default function SeccionRespaldo() {
  const { user } = useAuth();
  const [config, setConfig] = useState(undefined); // undefined = cargando, null = sin contraseña
  const [contrasena, setContrasena] = useState("");
  const [ocupado, setOcupado] = useState(""); // texto del paso en curso
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [enDrive, setEnDrive] = useState(null); // respaldos listados de Drive
  const [abierto, setAbierto] = useState(null); // respaldo descifrado, por confirmar
  const [confirmacion, setConfirmacion] = useState("");

  function cargarConfig() {
    leerConfigContrasena()
      .then(setConfig)
      .catch((e) => {
        setConfig(null);
        setAviso({ tipo: "error", texto: mensajeDe(e) });
      });
  }
  useEffect(cargarConfig, []);

  async function ejecutar(accion) {
    setAviso(null);
    try {
      await accion();
    } catch (e) {
      console.error("Respaldo:", e);
      setAviso({ tipo: "error", texto: mensajeDe(e) });
    }
    setOcupado("");
  }

  const respaldar = (destino) =>
    ejecutar(async () => {
      // Primero la ventana de Google: el navegador solo la permite justo tras el clic.
      if (destino === "drive") await conectarDrive();
      setOcupado("Verificando la contraseña…");
      if (!(await verificarContrasena(contrasena))) {
        throw Object.assign(new Error(), { code: "contrasena-incorrecta" });
      }
      const datos = await reunirDatos((parte) =>
        setOcupado(`Leyendo ${NOMBRES_PARTES[parte].toLowerCase()}…`)
      );
      setOcupado("Cifrando…");
      const contenido = await crearArchivo(datos, { contrasena, por: user.email });
      const nombre = nombreArchivo();
      const total = totalDe(datos.conteo);
      if (destino === "drive") {
        setOcupado("Subiendo a Google Drive…");
        await subirRespaldo(nombre, contenido);
        setAviso({
          tipo: "ok",
          texto: `Respaldo guardado en tu Google Drive, carpeta "Respaldos Uniformes": ${nombre} (${total} documentos).`,
        });
      } else {
        descargarAlDispositivo(nombre, contenido);
        setAviso({ tipo: "ok", texto: `Respaldo descargado: ${nombre} (${total} documentos).` });
      }
    });

  const verRespaldosDrive = () =>
    ejecutar(async () => {
      await conectarDrive();
      setOcupado("Buscando respaldos en Google Drive…");
      setEnDrive(await listarRespaldos());
    });

  async function abrir(obtenerTexto, nombre) {
    if (!contrasena) {
      setAviso({ tipo: "error", texto: "Escribe la contraseña con la que se hizo ese respaldo." });
      return;
    }
    await ejecutar(async () => {
      const texto = await obtenerTexto();
      setOcupado("Abriendo el respaldo…");
      const respaldo = await abrirRespaldo(texto, contrasena);
      setConfirmacion("");
      setAbierto({ ...respaldo, nombre });
    });
  }

  const abrirDeDrive = (archivo) =>
    abrir(async () => {
      setOcupado("Descargando de Google Drive…");
      return descargarRespaldo(archivo.id);
    }, archivo.name);

  function abrirDeArchivo(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (archivo) abrir(() => archivo.text(), archivo.name);
  }

  const restaurarAhora = () =>
    ejecutar(async () => {
      const { escritos, omitidos } = await restaurar(abierto, {
        por: user.email,
        nombre: abierto.nombre,
        alAvanzar: (n, total) => setOcupado(`Restaurando… ${n} de ${total}`),
      });
      setAbierto(null);
      setAviso({
        tipo: "ok",
        texto:
          omitidos.length === 0
            ? `Restauración terminada: ${escritos} documentos.`
            : `Restauración terminada: ${escritos} documentos. ${omitidos.length} no se restauraron:`,
        detalles: omitidos.map((o) => `${o.ruta} — ${o.motivo}`),
      });
    });

  if (config === undefined) return <p className="nota">Cargando...</p>;

  const sinContrasena = config === null;
  const bloqueado = !!ocupado || sinContrasena;

  return (
    <>
      {(ocupado || aviso) && (
        <div className="estado-respaldo" role="status" aria-live="polite">
          {ocupado && <p className="nota">⏳ {ocupado}</p>}
          {aviso && <p className={aviso.tipo === "ok" ? "success-msg" : "error"}>{aviso.texto}</p>}
          {aviso?.detalles?.length > 0 && (
            <ul className="nota lista-omitidos">
              {aviso.detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2>Respaldo</h2>
        <p className="nota">
          Copia completa de la app (elementos, pagos, pedidos, asistencia, catálogo, usuarios…),
          cifrada con la contraseña de respaldos. Se guarda en tu Google Drive (carpeta
          "Respaldos Uniformes") o en este dispositivo. Cada respaldo lee todos los documentos:
          úsalo de vez en cuando, no a diario.
        </p>

        {sinContrasena && (
          <p className="error">Aún no hay contraseña de respaldos: defínela abajo para empezar.</p>
        )}

        <div className="campo">
          <label htmlFor="contrasena-respaldo">Contraseña de respaldos</label>
          <input
            id="contrasena-respaldo"
            type="password"
            autoComplete="off"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            disabled={sinContrasena}
          />
        </div>

        <div className="inline-form acciones-pedido">
          <button
            type="button"
            className="btn-primary"
            disabled={bloqueado || !contrasena}
            onClick={() => respaldar("drive")}
          >
            ☁️ Respaldar en Google Drive
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={bloqueado || !contrasena}
            onClick={() => respaldar("dispositivo")}
          >
            💾 Descargar respaldo
          </button>
        </div>

      </div>

      <div className="card">
        <h2>Restaurar</h2>
        <p className="nota">
          Vuelve a poner cada dato como estaba en el respaldo. Lo que se registró después y no está en
          el respaldo se conserva. Usa arriba la contraseña con la que se hizo ese respaldo.
        </p>

        {!abierto && (
          <>
            <div className="inline-form acciones-pedido">
              <button
                type="button"
                className="btn-secondary"
                disabled={bloqueado}
                onClick={verRespaldosDrive}
              >
                ☁️ Ver respaldos en Google Drive
              </button>
              <label className={`btn-secondary btn-archivo ${bloqueado ? "deshabilitado" : ""}`}>
                📂 Abrir un archivo
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={abrirDeArchivo}
                  disabled={bloqueado}
                  hidden
                />
              </label>
            </div>

            {enDrive && (
              <ul className="lista">
                {enDrive.length === 0 && <p className="nota">No hay respaldos en tu Google Drive.</p>}
                {enDrive.map((a) => (
                  <li key={a.id} className="fila-baja">
                    <span className="fila-lista">
                      {a.name}
                      <span className="nota"> · {fechaLegible(a.createdTime)}</span>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      disabled={bloqueado}
                      onClick={() => abrirDeDrive(a)}
                    >
                      Abrir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {abierto && (
          <div className="confirmar-restauracion">
            <h3>{abierto.nombre}</h3>
            <p className="nota">
              Hecho el {fechaLegible(abierto.creado)} por {abierto.por}
            </p>
            <ul className="lista">
              {Object.entries(abierto.conteo || {}).map(([parte, n]) => (
                <li key={parte} className="fila-baja">
                  <span className="fila-lista">{NOMBRES_PARTES[parte] || parte}</span>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
            <p className="error">
              Los {totalDe(abierto.conteo)} documentos volverán a como estaban en esa fecha (los
              cambios que se les hicieron después se pierden). No se puede deshacer, salvo
              restaurando otro respaldo: considera respaldar antes.
            </p>
            <div className="campo">
              <label htmlFor="confirmar-restauracion">
                Escribe {CONFIRMACION} para confirmar
              </label>
              <input
                id="confirmar-restauracion"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="inline-form acciones-pedido">
              <button
                type="button"
                className="btn-secondary"
                disabled={!!ocupado}
                onClick={() => setAbierto(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-peligro"
                disabled={!!ocupado || confirmacion.trim().toUpperCase() !== CONFIRMACION}
                onClick={restaurarAhora}
              >
                Restaurar ahora
              </button>
            </div>
          </div>
        )}
      </div>

      <DefinirContrasenaRespaldo existe={!sinContrasena} onDefinida={cargarConfig} />
    </>
  );
}
