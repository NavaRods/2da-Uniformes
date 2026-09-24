import { useState } from "react";
import { linkWhatsapp, normalizarTelefono, telefonoValido } from "../lib/whatsapp";
import { formatearTelefono, normalizarTelefono10 } from "../lib/validacion";

// Aviso por WhatsApp como un paso aparte y voluntario: se muestra DESPUÉS de
// registrar algo (pago, entrega, cambio, venta) con el mensaje ya redactado.
// La persona revisa a quién se envía y qué dice, y solo si toca "Enviar" se
// abre WhatsApp. Nada se manda solo.
export default function AvisoWhatsapp({ elemento, titulo, mensaje, onCerrar }) {
  const telefonos = (elemento?.telefonos || []).filter(Boolean);
  const [destino, setDestino] = useState(telefonos.length ? "0" : "otro");
  const [otro, setOtro] = useState("");
  const [texto, setTexto] = useState(mensaje);

  const numero = normalizarTelefono(destino === "otro" ? otro : telefonos[Number(destino)]);
  const valido = telefonoValido(numero);

  function enviar() {
    window.open(linkWhatsapp(numero, texto), "_blank");
    onCerrar();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="modal modal-aviso">
        <h2>{titulo || "¿Avisar por WhatsApp?"}</h2>
        <p className="nota">
          Ya quedó registrado. Si quieres, avisa a {elemento?.nombre || "la persona"}: revisa el
          mensaje y toca Enviar.
        </p>

        <div className="campo">
          <label htmlFor="aviso-destino">Enviar a</label>
          <select id="aviso-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
            {telefonos.map((t, i) => (
              <option key={i} value={String(i)}>
                {formatearTelefono(normalizarTelefono10(t))}
              </option>
            ))}
            <option value="otro">Otro número…</option>
          </select>
          {destino === "otro" && (
            <input
              type="tel"
              inputMode="tel"
              placeholder="10 dígitos, ej. 55 1234 5678"
              value={otro}
              onChange={(e) => setOtro(e.target.value)}
              autoFocus
            />
          )}
          {!valido && (
            <p className="nota">
              {telefonos.length === 0 && destino !== "otro"
                ? "Este elemento no tiene teléfono guardado."
                : "Escribe un número válido de 10 dígitos."}
            </p>
          )}
        </div>

        <div className="campo">
          <label htmlFor="aviso-mensaje">Mensaje</label>
          <textarea
            id="aviso-mensaje"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        <div className="modal-acciones">
          <button type="button" className="btn-secondary" onClick={onCerrar}>
            Ahora no
          </button>
          <button type="button" className="btn-primary" onClick={enviar} disabled={!valido || !texto.trim()}>
            📲 Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
