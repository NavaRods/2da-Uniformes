// Carga datos de prueba realistas en el EMULADOR de Firestore (nunca en
// producción): Unidades 1a-3a, grados, catálogo, usuarios de cada rol,
// elementos (algunos de baja), pedidos con sus abonos en todos los estados
// (liquidados, con abonos, sin pagar, entregados o no, con cambio pendiente),
// mensualidades y listas de asistencia de los últimos domingos. Algunos pagos
// quedan con fecha de hoy para ver la Relación de pagos del día.
//
// Los IDs son fijos y el azar usa siempre la misma semilla: correrlo de nuevo
// reescribe los mismos documentos (no duplica). No toca a tu Super Admin.
//
// Uso (con el emulador corriendo: npm run emulators):
//   npm run seed:pruebas

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { GRADOS_PREDETERMINADOS } from "../src/lib/grados.js";
import { TURNOS, FUENTES } from "../src/lib/opciones.js";

const PROJECT_ID = "da-unidad-6c88d";
initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

// Contraseña de las cuentas de prueba (solo existe en el emulador de Auth): con
// ella se entra con correo y contraseña sin pasar por el correo de verificación.
const CONTRASENA_PRUEBA = "prueba-uniformes-1";

const UNIDADES = ["1a", "2a", "3a"];
const ELEMENTOS_POR_UNIDAD = { "1a": 38, "2a": 34, "3a": 30 };
const MENSUALIDAD = 60;

// --- Azar reproducible (mulberry32) ---
let semilla = 20260923;
function azar() {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entero = (min, max) => min + Math.floor(azar() * (max - min + 1));
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
const probable = (p) => azar() < p;
function elegirPonderado(pares) {
  const total = pares.reduce((s, [, peso]) => s + peso, 0);
  let r = azar() * total;
  for (const [valor, peso] of pares) {
    r -= peso;
    if (r < 0) return valor;
  }
  return pares[pares.length - 1][0];
}

// --- Fechas ---
const dos = (n) => String(n).padStart(2, "0");
const fechaLocal = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const horaLocal = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
const HOY = new Date();
const haceDias = (n, hora = entero(9, 19), minuto = entero(0, 59)) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  d.setHours(hora, minuto, 0, 0);
  return d;
};
const ts = (d) => Timestamp.fromDate(d);

// --- Catálogo (el mismo que siembra la app) ---
const rango1a10 = Array.from({ length: 10 }, (_, i) => String(i + 1));
const CATALOGO = [
  ["pantalon", "Pantalón", 350, "lista", ["6", "8", "10", "12", "14", "16", "28", "30", "32", "34", "36"]],
  ["camisola", "Camisola", 350, "libre", []],
  ["falda", "Falda", 320, "libre", []],
  ["insignias", "Insignias", 80, "ninguna", []],
  ["sector", "Sector y Contra sector", 90, "ninguna", []],
  ["corbata", "Corbata", 40, "ninguna", []],
  ["botas", "Botas Negras", 420, "lista", rango1a10],
  ["cintas", "Cintas Blancas", 60, "ninguna", []],
  ["fajilla", "Fajilla con chapetón", 170, "lista", ["Ch", "M", "G"]],
  ["gorra-vanguardista", "Gorra tipo Vanguardista", 190, "lista", rango1a10],
  ["gorra-campo", "Gorra de Campo con Insignia", 190, "lista", rango1a10],
  ["zapatillas", "Zapatillas", 395, "libre", []],
  ["camisa-negra", "Camisa Negra", 320, "ninguna", []],
  ["playera", "Playera", 150, "lista", ["6-8", "8-10", "10-12", "12-14", "Ch de adulto", "Mediana de adulto"], ["Blanca", "Negra"]],
].map(([id, nombre, precio, tallaTipo, tallas, colores = []]) => ({ id, nombre, precio, tallaTipo, tallas, colores }));

// --- Nombres ---
const NOMBRES_V = ["Luis", "Carlos", "Jorge", "Miguel", "José", "Diego", "Fernando", "Ángel", "Iván", "Emiliano", "Santiago", "Mateo", "Héctor", "Ricardo", "Uriel", "Axel", "Brandon", "Kevin"];
const NOMBRES_F = ["Ana", "María", "Fernanda", "Valeria", "Sofía", "Daniela", "Ximena", "Camila", "Andrea", "Regina", "Paola", "Itzel", "Guadalupe", "Renata"];
const APELLIDOS = ["García", "Hernández", "López", "Martínez", "González", "Pérez", "Rodríguez", "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez", "Reyes", "Jiménez", "Torres", "Díaz", "Mendoza", "Ruiz", "Aguilar", "Ortiz", "Castillo", "Romero"];
const ESCUELAS = ["Sec. Técnica 12", "Sec. Federal 5", "Prim. Benito Juárez", "Prepa 7", "CBTIS 38", "Sec. Diurna 21"];
const COLONIAS = ["Centro", "Las Águilas", "Del Valle", "San Rafael", "Jardines", "La Loma", "El Rosario"];

const GRADOS_POR_PESO = [
  ["Recluta", 30], ["Tropa", 25], ["Cadete", 18], ["Cabo", 8], ["Sargento 2do", 6],
  ["Sargento 1ero", 4], ["Sub Teniente", 3], ["Teniente", 2], ["Capitán 2do", 1], ["", 3],
];

const escritor = db.bulkWriter();
const cuenta = {};
function escribir(ruta, datos) {
  cuenta[ruta.split("/").at(-2)] = (cuenta[ruta.split("/").at(-2)] || 0) + 1;
  escritor.set(db.doc(ruta), datos);
}

// Piezas sin entregar por Unidad y variante: parte de ellas se carga como
// "Uniforme recibido" (inventario/{id}, mismo ID que src/lib/inventario.js).
const sinEntregar = new Map();
const idInventario = (unidad, v) =>
  [unidad, v.productoNombre, v.talla, v.color].map((p) => encodeURIComponent(p || "")).join("~");

async function unidadesExistentes() {
  const snap = await db.collection("unidades").get();
  return new Set(snap.docs.map((d) => d.data().nombre));
}

async function main() {
  // Unidades (sin duplicar las que ya existan con ese nombre).
  const existentes = await unidadesExistentes();
  for (const nombre of UNIDADES) {
    if (!existentes.has(nombre)) {
      escribir(`unidades/unidad-${nombre}`, { nombre, creadoEn: FieldValue.serverTimestamp() });
    }
  }

  GRADOS_PREDETERMINADOS.forEach((g, i) =>
    escribir(`grados/grado-${dos(i + 1)}`, { ...g, creadoEn: FieldValue.serverTimestamp() })
  );

  for (const { id, ...producto } of CATALOGO) escribir(`catalogo/prod-${id}`, producto);

  // Usuarios de cada rol (el Super Admin se queda como está).
  const usuario = (correo, rol, unidad, nombre) =>
    escribir(`usuarios/${correo}`, {
      nombre, rol, unidad, grado: "", activo: true, creadoEn: FieldValue.serverTimestamp(),
    });
  usuario("admin@prueba.test", "admin", null, "Admin de prueba");
  usuario("estadomayor@prueba.test", "estado_mayor", null, "Estado Mayor de prueba");
  for (const u of UNIDADES) {
    usuario(`responsable.${u}@prueba.test`, "responsable", u, `Responsable ${u}`);
    usuario(`instructor.${u}@prueba.test`, "instructor", u, `Instructor ${u}`);
  }

  // Cuentas en el emulador de Auth, ya verificadas, para entrar con correo y
  // contraseña. Si ya existen, se les restablece la contraseña.
  const correosDePrueba = [
    "admin@prueba.test",
    "estadomayor@prueba.test",
    ...UNIDADES.flatMap((u) => [`responsable.${u}@prueba.test`, `instructor.${u}@prueba.test`]),
  ];
  for (const email of correosDePrueba) {
    const datos = { email, password: CONTRASENA_PRUEBA, emailVerified: true };
    try {
      await auth.createUser(datos);
    } catch (err) {
      if (err.code !== "auth/email-already-exists") throw err;
      await auth.updateUser((await auth.getUserByEmail(email)).uid, datos);
    }
  }

  const sinPedidos = [];
  UNIDADES.forEach((unidad, iUnidad) => {
    const activos = [];
    for (let n = 1; n <= ELEMENTOS_POR_UNIDAD[unidad]; n++) {
      const id = `prueba-${unidad}-${String(n).padStart(3, "0")}`;
      const femenino = probable(0.4);
      const nombre = `${elegir(femenino ? NOMBRES_F : NOMBRES_V)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
      const edad = entero(8, 17);
      const baja = probable(0.06) ? fechaLocal(haceDias(entero(3, 40))) : null;
      const pagaMensualidad = probable(0.7);
      const elemento = {
        unidad,
        grupo: femenino ? "Femenino" : "Varonil",
        nombre,
        numeroOrden: probable(0.8)
          ? `${femenino ? "F" : "V"}${dos(iUnidad + 1)}${elegir(["24", "25", "26"])}${String(n).padStart(3, "0")}`
          : "",
        gradoMilitar: elegirPonderado(GRADOS_POR_PESO),
        edad,
        telefonos: [`550000${String(entero(1000, 9999))}`],
        direccion: `Calle ${entero(1, 99)} #${entero(1, 400)}, Col. ${elegir(COLONIAS)}`,
        fechaNacimiento: `${HOY.getFullYear() - edad}-${dos(entero(1, 12))}-${dos(entero(1, 28))}`,
        escuela: elegir(ESCUELAS),
        turno: elegir(TURNOS),
        gradoEscolar: `${entero(1, 6)}°`,
        tutor: `${elegir(femenino ? NOMBRES_V : NOMBRES_F)} ${nombre.split(" ")[1]}`,
        comoSeEntero: elegir(FUENTES),
        seguroSocial: elegir(["IMSS", "ISSSTE", "Ninguno", ""]),
        alergias: probable(0.15) ? elegir(["Penicilina", "Asma", "Polen"]) : "",
        antecedentes: elegir(["", "No", "Sí"]),
        antecedentesDetalle: "",
        practicaDeporte: elegir(["", "No", "Sí"]),
        deporte: "",
        pagaMensualidad,
        pagaInscripcion: probable(0.8),
        creadoEn: ts(haceDias(entero(60, 300))),
        actualizadoEn: FieldValue.serverTimestamp(),
        ...(baja ? { fechaBaja: baja } : {}),
      };
      if (elemento.antecedentes === "Sí") elemento.antecedentesDetalle = "Escolta escolar";
      if (elemento.practicaDeporte === "Sí") elemento.deporte = elegir(["Fútbol", "Box", "Natación"]);
      escribir(`elementos/${id}`, elemento);
      if (!baja) activos.push(id);

      crearPedidos(id, elemento, sinPedidos);
      if (pagaMensualidad) crearCuotas(id, elemento);
    }
    crearAsistencias(unidad, activos);
  });

  // Uniforme recibido: de lo que se debe, llegó más o menos la mitad.
  for (const v of sinEntregar.values()) {
    const cantidad = Math.round(v.piezas * elegir([0, 0.5, 0.5, 1]));
    if (cantidad === 0) continue;
    const { piezas: _piezas, ...variante } = v;
    escribir(`inventario/${idInventario(v.unidad, v)}`, {
      ...variante,
      cantidad,
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  }

  // Versiones: que los dispositivos vuelvan a leer catálogo, grados, etc.
  escritor.set(
    db.doc("meta/versiones"),
    Object.fromEntries(["catalogo", "grados", "unidades", "usuarios"].map((c) => [c, FieldValue.serverTimestamp()])),
    { merge: true }
  );

  await escritor.close();
  console.log("Datos de prueba cargados en el emulador:");
  for (const [coleccion, n] of Object.entries(cuenta)) console.log(`  ${coleccion}: ${n}`);
  console.log(`  (elementos sin ningún pedido: ${sinPedidos.length})`);
  console.log("");
  console.log("Usuarios para probar permisos (correo y contraseña; la contraseña es");
  console.log("CONTRASENA_PRUEBA, al inicio de scripts/datos-prueba-emulador.mjs):");
  console.log("  admin@prueba.test, estadomayor@prueba.test,");
  console.log("  responsable.1a@prueba.test, instructor.1a@prueba.test (igual para 2a y 3a)");
}

function crearPedidos(elementoId, elemento, sinPedidos) {
  const piezas = elegirPonderado([[0, 15], [1, 25], [2, 30], [3, 20], [4, 10]]);
  if (piezas === 0) sinPedidos.push(elementoId);
  const quien = `Responsable ${elemento.unidad}`;

  for (let p = 1; p <= piezas; p++) {
    const producto = elegir(CATALOGO);
    const talla =
      producto.tallaTipo === "lista" ? elegir(producto.tallas)
      : producto.tallaTipo === "libre" ? `${entero(28, 42)} a la medida`
      : "";
    const color = producto.colores.length ? elegir(producto.colores) : "";
    const partes = [producto.nombre, color, talla && `talla ${talla}`].filter(Boolean);
    const articulo = partes.join(" — ");
    const precio = producto.precio;

    // Estado del pedido: cuánto se ha pagado y si ya se entregó.
    const caso = elegirPonderado([
      ["liquidado-entregado", 40], ["liquidado-sin-entregar", 18],
      ["abonos-sin-entregar", 22], ["abonos-entregado", 8], ["sin-pagos", 12],
    ]);
    const liquidado = caso.startsWith("liquidado");
    const conAbonos = liquidado || caso.startsWith("abonos");
    const entregado = caso.endsWith("-entregado");

    const diasCreado = entero(1, 75);
    const creado = haceDias(diasCreado);
    // Montos de los abonos: si liquida, suman el precio; si no, algo menos.
    const montos = [];
    if (conAbonos) {
      const pagado = liquidado ? precio : Math.max(20, Math.round((precio * entero(20, 80)) / 1000) * 10);
      const n = liquidado ? elegirPonderado([[1, 55], [2, 30], [3, 15]]) : elegirPonderado([[1, 60], [2, 40]]);
      let resto = pagado;
      for (let i = 0; i < n; i++) {
        const monto = i === n - 1 ? resto : Math.max(10, Math.round(resto / (n - i) / 10) * 10);
        montos.push(monto);
        resto -= monto;
      }
    }

    const pedidoId = `p${p}`;
    const rutaPedido = `elementos/${elementoId}/pedidos/${pedidoId}`;
    let saldo = precio;
    let ultimoAbonoId;
    // El primer abono, el día del pedido; los demás, después y en orden
    // (algunos hoy, para ver la Relación de pagos del día).
    const diasAbonos = [
      diasCreado,
      ...montos
        .slice(1)
        .map(() => (probable(0.25) ? 0 : entero(0, Math.max(0, diasCreado - 1))))
        .sort((a, b) => b - a),
    ];
    // Fechas en orden (también la hora, si caen el mismo día).
    const fechas = diasAbonos
      .map((dias, i) => (i === 0 ? creado : haceDias(dias)))
      .sort((a, b) => a - b);
    montos.forEach((monto, i) => {
      const fecha = fechas[i];
      saldo -= monto;
      ultimoAbonoId = `a${i + 1}`;
      escribir(`${rutaPedido}/abonos/${ultimoAbonoId}`, {
        unidad: elemento.unidad,
        monto,
        quienRecibio: quien,
        fecha: ts(fecha),
        fechaLocal: fechaLocal(fecha),
        horaLocal: horaLocal(fecha),
        elementoNombre: elemento.nombre,
        articulo,
        productoNombre: producto.nombre,
        talla,
        color,
        saldoTras: saldo,
      });
    });

    if (!entregado) {
      const clave = [elemento.unidad, producto.nombre, talla, color].join("|");
      if (!sinEntregar.has(clave)) {
        sinEntregar.set(clave, { unidad: elemento.unidad, productoNombre: producto.nombre, talla: talla || "", color: color || "", piezas: 0 });
      }
      sinEntregar.get(clave).piezas += 1;
    }
    const cambio = entregado && probable(0.12);
    escribir(rutaPedido, {
      unidad: elemento.unidad,
      articulo,
      productoNombre: producto.nombre,
      talla,
      color,
      cantidad: 1,
      precioTotal: precio,
      saldoPendiente: saldo,
      entregado,
      fechaEntrega: entregado ? ts(haceDias(entero(0, diasCreado))) : null,
      quienEntrego: entregado ? quien : "",
      cambioPendiente: cambio,
      motivoCambio: cambio ? elegir(["Talla chica", "Talla grande", "Costura defectuosa"]) : "",
      fechaCambioSolicitado: cambio ? ts(haceDias(entero(0, 10))) : null,
      creadoEn: ts(creado),
      actualizadoEn: FieldValue.serverTimestamp(),
      ...(ultimoAbonoId ? { ultimoAbonoId } : {}),
    });
  }
}

function crearCuotas(elementoId, elemento) {
  // Meses del año pagados hasta algún mes reciente (los más recientes a veces no).
  const mesActual = HOY.getMonth(); // 0-11
  const hasta = mesActual - entero(0, 2);
  const meses = [];
  for (let m = Math.max(0, mesActual - 5); m <= hasta; m++) meses.push(`${HOY.getFullYear()}-${dos(m + 1)}`);
  // En 1 a 3 cobros.
  const cobros = Math.min(meses.length, entero(1, 3));
  const porCobro = Math.ceil(meses.length / Math.max(cobros, 1));
  for (let c = 0; c < cobros; c++) {
    const deEste = meses.slice(c * porCobro, (c + 1) * porCobro);
    if (deEste.length === 0) continue;
    const fecha = c === cobros - 1 && probable(0.2) ? haceDias(0) : haceDias(entero(1, 150));
    escribir(`elementos/${elementoId}/cuotas/c${c + 1}`, {
      unidad: elemento.unidad,
      elementoNombre: elemento.nombre,
      tipo: "mensualidad",
      meses: deEste,
      montoPorMes: MENSUALIDAD,
      total: MENSUALIDAD * deEste.length,
      quienRecibio: `Responsable ${elemento.unidad}`,
      fecha: ts(fecha),
      fechaLocal: fechaLocal(fecha),
      horaLocal: horaLocal(fecha),
    });
  }
}

function crearAsistencias(unidad, activos) {
  // Últimos 8 domingos (sin contar hoy si es domingo: ese se pasa en la app).
  const d = new Date(HOY);
  d.setDate(d.getDate() - (d.getDay() === 0 ? 7 : d.getDay()));
  for (let s = 0; s < 8; s++) {
    const fecha = fechaLocal(d);
    const estados = {};
    for (const id of activos) {
      estados[id] = elegirPonderado([["asistencia", 80], ["falta", 12], ["justificada", 8]]);
    }
    escribir(`asistencias/${fecha}/porUnidad/${unidad}`, { unidad, fecha, estados });
    d.setDate(d.getDate() - 7);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("No se pudieron cargar los datos de prueba:", err.message);
    console.error("¿Está corriendo `npm run emulators` en otra terminal?");
    process.exit(1);
  });
