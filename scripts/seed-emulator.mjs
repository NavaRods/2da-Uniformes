// Da de alta un usuario Super Admin y una Unidad en el emulador de Firestore,
// para no tener que crearlos a mano cada vez que se reinicia sin datos
// guardados. Usa el Admin SDK (se salta las reglas), apuntado al emulador
// local — nunca toca producción. Súper Admin porque ese rol nunca se puede
// crear desde la app (ver firestore.rules): así se prueba la app en local
// exactamente igual que en producción, donde tu cuenta también es Super Admin.
//
// Uso: node scripts/seed-emulator.mjs [correo] [unidad]
// (con el emulador ya corriendo: npm run emulators, en otra terminal)

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "da-unidad-6c88d";
const correo = (process.argv[2] || "admin@local.test").trim().toLowerCase();
const unidad = process.argv[3] || "2da Unidad";

initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

async function main() {
  await db.collection("usuarios").doc(correo).set({
    nombre: "Super Admin local",
    rol: "superadmin",
    unidad: null,
    grado: "",
    activo: true,
    creadoEn: FieldValue.serverTimestamp(),
  });

  await db.collection("unidades").add({
    nombre: unidad,
    creadoEn: FieldValue.serverTimestamp(),
  });

  console.log(`Listo:`);
  console.log(`  Super Admin: ${correo}`);
  console.log(`  Unidad: ${unidad}`);
  console.log("");
  console.log(
    "Inicia sesión en la app (npm run dev) con ese correo — el emulador de " +
      "Auth deja crear una cuenta de prueba con cualquier correo, no necesita " +
      "ser una cuenta real de Google."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("No se pudo sembrar el emulador:", err.message);
    console.error("¿Está corriendo `npm run emulators` en otra terminal?");
    process.exit(1);
  });
