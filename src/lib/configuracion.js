import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { vigilar } from "./estadoFirestore";

// Ajustes compartidos por todos los usuarios de la app (un solo documento).
const configRef = () => doc(db, "configuracion", "general");

export function listenConfiguracion(callback, onError) {
  return onSnapshot(
    configRef(),
    (snap) => callback(snap.exists() ? snap.data() : {}),
    vigilar(onError)
  );
}

// Número de WhatsApp que recibe la Relación de pagos. Se guarda ya
// normalizado (solo dígitos, con código de país).
export async function guardarNumeroWhatsapp(numero) {
  return setDoc(configRef(), { whatsappNumero: numero }, { merge: true });
}
