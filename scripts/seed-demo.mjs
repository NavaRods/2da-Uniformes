// Datos de demostración para el emulador de Firestore: Unidades, catálogo,
// elementos, pedidos con abonos, inventario y un cambio pendiente. Sirve para
// ver y presentar la app con información realista sin tocar producción.
// Usa el Admin SDK apuntado al emulador local (se salta las reglas).
//
// Uso (con el emulador corriendo y el Super Admin ya sembrado):
//   node scripts/seed-demo.mjs
// Es repetible: borra lo demo anterior de esas colecciones antes de crearlo.

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp({ projectId: "da-unidad-6c88d" });
const db = getFirestore();
const ahora = () => FieldValue.serverTimestamp();

async function vaciar(coleccion) {
  const snap = await db.collection(coleccion).get();
  for (const d of snap.docs) await db.recursiveDelete(d.ref);
}

const hoy = new Date().toISOString().slice(0, 10);
const idInventario = (unidad, v) =>
  [unidad, v.productoNombre, v.talla, v.color].map((p) => encodeURIComponent(p || "")).join("~");

const CATALOGO = [
  { nombre: "Playera", precio: 180, tallaTipo: "lista", tallas: ["Ch", "M", "G"], colores: ["Blanca", "Negra"] },
  { nombre: "Pantalón", precio: 350, tallaTipo: "lista", tallas: ["28", "30", "32", "34"], colores: [] },
  { nombre: "Gorra", precio: 190, tallaTipo: "ninguna", tallas: [], colores: [] },
  { nombre: "Botas Negras", precio: 420, tallaTipo: "lista", tallas: ["5", "6", "7", "8"], colores: [] },
];

const ELEMENTOS = [
  { unidad: "2a", nombre: "Alan Gael Flores Retenguin", grupo: "Varonil", gradoMilitar: "Cadete" },
  { unidad: "2a", nombre: "Alexa Rubí Agredano Martínez", grupo: "Femenino", gradoMilitar: "Cadete" },
  { unidad: "2a", nombre: "Andrea Carolina Salcedo Pacheco", grupo: "Femenino", gradoMilitar: "Cabo" },
  { unidad: "2a", nombre: "Bruno Emiliano Torres Ríos", grupo: "Varonil", gradoMilitar: "Recluta" },
  { unidad: "2a", nombre: "Carla Daniela Ochoa Vega", grupo: "Femenino", gradoMilitar: "Recluta" },
  { unidad: "2a", nombre: "Diego Armando Luna Soto", grupo: "Varonil", gradoMilitar: "Sargento 2do" },
  { unidad: "3a", nombre: "Emilio Santos Mora", grupo: "Varonil", gradoMilitar: "Cadete" },
  { unidad: "3a", nombre: "Fernanda Lozano Cruz", grupo: "Femenino", gradoMilitar: "Cadete" },
];

// [índice de elemento, producto, talla, color, abonado, entregado, cambioPendiente]
const PEDIDOS = [
  [0, "Playera", "M", "Blanca", 180, true, false],
  [0, "Pantalón", "30", "", 100, false, false],
  [1, "Playera", "Ch", "Negra", 180, false, false],
  [1, "Gorra", "", "", 190, true, false],
  [2, "Pantalón", "28", "", 350, true, true],
  [3, "Botas Negras", "7", "", 0, false, false],
  [3, "Playera", "G", "Blanca", 90, false, false],
  [4, "Gorra", "", "", 190, true, false],
  [6, "Playera", "M", "Negra", 180, false, false],
];

async function main() {
  for (const c of ["elementos", "catalogo", "inventario", "bajasPedidos", "asistencias", "unidades"]) {
    await vaciar(c);
  }

  const versiones = {};
  for (const nombre of ["2a", "3a"]) await db.collection("unidades").add({ nombre, creadoEn: ahora() });
  versiones.unidades = ahora();

  const productos = {};
  for (const p of CATALOGO) {
    const ref = await db.collection("catalogo").add(p);
    productos[p.nombre] = { id: ref.id, ...p };
  }
  versiones.catalogo = ahora();
  await db.doc("meta/versiones").set(versiones, { merge: true });

  const elementos = [];
  for (const e of ELEMENTOS) {
    const ref = await db.collection("elementos").add({
      ...e,
      edad: 15,
      telefonos: ["5512345678"],
      pagaMensualidad: true,
      pagaInscripcion: false,
      antecedentes: "",
      practicaDeporte: "",
      creadoEn: ahora(),
      actualizadoEn: ahora(),
    });
    elementos.push({ id: ref.id, ...e });
  }

  for (const [i, producto, talla, color, abonado, entregado, cambio] of PEDIDOS) {
    const el = elementos[i];
    const cat = productos[producto];
    const articulo = [producto, color, talla && `talla ${talla}`].filter(Boolean).join(" — ");
    const pedidoRef = await db.collection(`elementos/${el.id}/pedidos`).add({
      unidad: el.unidad,
      articulo,
      productoNombre: producto,
      talla,
      color,
      cantidad: 1,
      precioTotal: cat.precio,
      saldoPendiente: cat.precio - abonado,
      entregado,
      fechaEntrega: entregado ? ahora() : null,
      quienEntrego: entregado ? "Super Admin local" : "",
      cambioPendiente: cambio,
      motivoCambio: cambio ? "Talla equivocada, le queda grande" : "",
      fechaCambioSolicitado: cambio ? ahora() : null,
      creadoEn: ahora(),
      actualizadoEn: ahora(),
    });
    if (abonado > 0) {
      await pedidoRef.collection("abonos").add({
        unidad: el.unidad,
        monto: abonado,
        quienRecibio: "Super Admin local",
        fecha: ahora(),
        fechaLocal: hoy,
        horaLocal: "10:30",
        elementoNombre: el.nombre,
        articulo,
        productoNombre: producto,
        talla,
        color,
        saldoTras: cat.precio - abonado,
      });
    }
  }

  // Uniforme recibido: algunas piezas ya llegaron.
  for (const [unidad, v, cantidad] of [
    ["2a", { productoNombre: "Playera", talla: "Ch", color: "Negra" }, 1],
    ["2a", { productoNombre: "Pantalón", talla: "30", color: "" }, 1],
  ]) {
    await db.collection("inventario").doc(idInventario(unidad, v)).set({
      unidad,
      ...v,
      cantidad,
      actualizadoEn: ahora(),
    });
  }

  console.log(`Datos demo listos: ${elementos.length} elementos, ${PEDIDOS.length} pedidos, catálogo de ${CATALOGO.length}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("No se pudo sembrar la demo:", err.message);
    process.exit(1);
  });
