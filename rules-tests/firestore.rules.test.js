import { readFileSync } from "node:fs";
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  collection,
  deleteField,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

let env;

const ADMIN = "admin@club.mx";
const OP_A = "ana@club.mx"; // Operador de la Unidad A
const OP_B = "beto@club.mx"; // Operador de la Unidad B

// Contexto autenticado con Google y correo verificado.
const como = (correo) =>
  env.authenticatedContext(correo, { email: correo, email_verified: true }).firestore();

const elementoA = { unidad: "A", grupo: "Varonil", nombre: "Luis" };
const pedidoBase = {
  unidad: "A",
  articulo: "Pantalón — talla 10",
  productoNombre: "Pantalón",
  talla: "10",
  color: "",
  cantidad: 1,
  precioTotal: 300,
  saldoPendiente: 300,
  entregado: false,
  cambioPendiente: false,
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-uniformes-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(() => env.cleanup());

// Estado inicial de cada prueba, escrito sin pasar por las reglas.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usuarios", ADMIN), { rol: "admin", unidad: null });
    await setDoc(doc(db, "usuarios", OP_A), { rol: "operador", unidad: "A" });
    await setDoc(doc(db, "usuarios", OP_B), { rol: "operador", unidad: "B" });
    await setDoc(doc(db, "elementos", "el1"), elementoA);
    // Pedido de 300 con un abono de 100 ya registrado (saldo 200).
    await setDoc(doc(db, "elementos", "el1", "pedidos", "ped1"), {
      ...pedidoBase,
      saldoPendiente: 200,
      ultimoAbonoId: "ab0",
    });
    await setDoc(doc(db, "elementos", "el1", "pedidos", "ped1", "abonos", "ab0"), {
      monto: 100,
      fechaLocal: "2026-09-01",
    });
    // Pedido sin pagos.
    await setDoc(doc(db, "elementos", "el1", "pedidos", "pedLimpio"), pedidoBase);
    await setDoc(doc(db, "elementos", "el1", "cuotas", "cu1"), {
      tipo: "mensualidad",
      meses: ["2026-09"],
      montoPorMes: 60,
      total: 60,
      fechaLocal: "2026-09-01",
    });
  });
});

const pedidoRef = (db, id = "ped1") => doc(db, "elementos", "el1", "pedidos", id);
const abonoRef = (db, id, pedido = "ped1") =>
  doc(db, "elementos", "el1", "pedidos", pedido, "abonos", id);

// Escritura en una colección versionada junto con su versión en
// meta/versiones, como hace escribirConVersion en la app.
function conVersion(db, coleccion, escribir) {
  const batch = writeBatch(db);
  escribir(batch);
  batch.set(doc(db, "meta", "versiones"), { [coleccion]: serverTimestamp() }, { merge: true });
  return batch.commit();
}

const ahora = () => ({ actualizadoEn: serverTimestamp() });

// Abono + nuevo saldo en un solo batch, como hace registrarAbono en la app.
async function abonar(db, { monto, saldoNuevo, id = "ab1", pedido = "ped1" }) {
  const batch = writeBatch(db);
  batch.set(abonoRef(db, id, pedido), {
    unidad: "A",
    monto,
    quienRecibio: "Ana",
    fechaLocal: "2026-09-02",
  });
  batch.update(pedidoRef(db, pedido), { saldoPendiente: saldoNuevo, ultimoAbonoId: id });
  return batch.commit();
}

describe("acceso y unidades", () => {
  it("un Operador lee los elementos de su Unidad", async () => {
    await assertSucceeds(getDoc(doc(como(OP_A), "elementos", "el1")));
  });

  it("un Operador NO lee los de otra Unidad", async () => {
    await assertFails(getDoc(doc(como(OP_B), "elementos", "el1")));
  });

  it("un Operador de otra Unidad NO lee ni abona los pedidos", async () => {
    const db = como(OP_B);
    await assertFails(getDoc(pedidoRef(db)));
    await assertFails(abonar(db, { monto: 50, saldoNuevo: 150 }));
  });

  it("sin sesión no se lee nada", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "elementos", "el1")));
  });

  it("un correo no dado de alta en usuarios queda fuera", async () => {
    await assertFails(getDoc(doc(como("intruso@x.com"), "elementos", "el1")));
  });
});

describe("abonos: el dinero no se puede manipular", () => {
  it("un abono válido con su descuento exacto en el saldo pasa", async () => {
    await assertSucceeds(abonar(como(OP_A), { monto: 50, saldoNuevo: 150 }));
  });

  it("un abono de monto 0 se rechaza", async () => {
    await assertFails(abonar(como(OP_A), { monto: 0, saldoNuevo: 200 }));
  });

  it("un abono de monto negativo se rechaza (subiría el saldo)", async () => {
    await assertFails(abonar(como(OP_A), { monto: -50, saldoNuevo: 250 }));
  });

  it("un abono sin tocar el saldo se rechaza", async () => {
    await assertFails(setDoc(abonoRef(como(OP_A), "ab1"), { unidad: "A", monto: 50, fechaLocal: "2026-09-02" }));
  });

  it("un abono cuyo descuento no coincide con el monto se rechaza", async () => {
    await assertFails(abonar(como(OP_A), { monto: 50, saldoNuevo: 100 }));
  });

  it("bajar el saldo a mano, sin abono, se rechaza", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 0 }));
  });

  it("bajar el saldo apuntando a un abono que no existe se rechaza", async () => {
    await assertFails(
      updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 100, ultimoAbonoId: "fantasma" })
    );
  });

  it("reutilizar un abono viejo para justificar otra baja de saldo se rechaza", async () => {
    await assertFails(
      updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 100, ultimoAbonoId: "ab0" })
    );
  });

  it("subir el saldo se rechaza", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 500 }));
  });

  it("un abono no se puede editar", async () => {
    await assertFails(updateDoc(abonoRef(como(ADMIN), "ab0"), { monto: 1 }));
  });
});

describe("pedidos: campos fijos", () => {
  it("no se puede cambiar el precio total", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A), "pedLimpio"), { precioTotal: 1 }));
  });

  it("no se puede cambiar creadoEn", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A), "pedLimpio"), { creadoEn: new Date() }));
  });

  it("no se puede cambiar el artículo", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A), "pedLimpio"), { articulo: "Otro" }));
  });

  it("sí se puede marcar entregado y pedir un cambio", async () => {
    const db = como(OP_A);
    await assertSucceeds(
      updateDoc(pedidoRef(db, "pedLimpio"), { entregado: true, quienEntrego: "Ana" })
    );
    await assertSucceeds(
      updateDoc(pedidoRef(db, "pedLimpio"), { cambioPendiente: true, motivoCambio: "Talla" })
    );
  });

  it("un pedido nuevo debe nacer con saldo igual al precio", async () => {
    const db = como(OP_A);
    const nuevo = (extra) =>
      setDoc(doc(db, "elementos", "el1", "pedidos", "nuevo"), { ...pedidoBase, ...extra });
    await assertSucceeds(nuevo({}));
    await assertFails(nuevo({ saldoPendiente: 0 }));
  });
});

describe("borrados", () => {
  it("un Operador NO borra un abono", async () => {
    await assertFails(deleteDoc(abonoRef(como(OP_A), "ab0")));
  });

  it("un Admin sí borra un abono", async () => {
    await assertSucceeds(deleteDoc(abonoRef(como(ADMIN), "ab0")));
  });

  it("un Operador NO borra una mensualidad; un Admin sí", async () => {
    const cuota = (db) => doc(db, "elementos", "el1", "cuotas", "cu1");
    await assertFails(deleteDoc(cuota(como(OP_A))));
    await assertSucceeds(deleteDoc(cuota(como(ADMIN))));
  });

  it("un Operador NO borra un pedido que ya tiene pagos; un Admin sí", async () => {
    await assertFails(deleteDoc(pedidoRef(como(OP_A), "ped1")));
    await assertSucceeds(deleteDoc(pedidoRef(como(ADMIN), "ped1")));
  });

  it("un Operador sí borra un pedido sin pagos de su Unidad", async () => {
    await assertSucceeds(deleteDoc(pedidoRef(como(OP_A), "pedLimpio")));
  });

  it("un Operador de otra Unidad NO borra un pedido sin pagos", async () => {
    await assertFails(deleteDoc(pedidoRef(como(OP_B), "pedLimpio")));
  });

  it("un Operador NO borra un elemento; un Admin sí", async () => {
    await assertFails(deleteDoc(doc(como(OP_A), "elementos", "el1")));
    await assertSucceeds(deleteDoc(doc(como(ADMIN), "elementos", "el1")));
  });
});

describe("mensualidades", () => {
  const cuota = (db, datos) =>
    setDoc(doc(collection(db, "elementos", "el1", "cuotas")), {
      tipo: "mensualidad",
      unidad: "A",
      meses: ["2026-10", "2026-11"],
      montoPorMes: 60,
      total: 120,
      fechaLocal: "2026-09-02",
      ...datos,
    });

  it("un cobro con total coherente pasa", async () => {
    await assertSucceeds(cuota(como(OP_A), {}));
  });

  it("un total que no cuadra con meses x monto se rechaza", async () => {
    await assertFails(cuota(como(OP_A), { total: 1 }));
  });

  it("un monto por mes de 0 se rechaza", async () => {
    await assertFails(cuota(como(OP_A), { montoPorMes: 0, total: 0 }));
  });
});

describe("elementos: campos nuevos y bajas", () => {
  const nuevoElemento = (db, extra = {}) =>
    setDoc(doc(collection(db, "elementos")), { ...elementoA, ...ahora(), ...extra });

  it("acepta grado militar, número de orden y antecedentes", async () => {
    await assertSucceeds(
      nuevoElemento(como(OP_A), {
        gradoMilitar: "Cadete",
        numeroOrden: "V0218001",
        antecedentes: "Sí",
        antecedentesDetalle: "Cadetes",
        practicaDeporte: "No",
        deporte: "",
      })
    );
  });

  it("el número de orden es opcional (vacío o ausente pasa)", async () => {
    await assertSucceeds(nuevoElemento(como(OP_A), { numeroOrden: "" }));
    await assertSucceeds(nuevoElemento(como(OP_A)));
  });

  it("rechaza un número de orden con formato incorrecto", async () => {
    await assertFails(nuevoElemento(como(OP_A), { numeroOrden: "V021800" }));
    await assertFails(nuevoElemento(como(OP_A), { numeroOrden: "X0218001" }));
    await assertFails(nuevoElemento(como(OP_A), { numeroOrden: "v0218001" }));
  });

  it("rechaza respuestas de antecedentes que no sean Sí/No", async () => {
    await assertFails(nuevoElemento(como(OP_A), { antecedentes: "Tal vez" }));
    await assertFails(nuevoElemento(como(OP_A), { practicaDeporte: "quizá" }));
  });

  it("un Operador puede dar de baja y reactivar a un elemento de su Unidad", async () => {
    const ref = doc(como(OP_A), "elementos", "el1");
    await assertSucceeds(updateDoc(ref, { fechaBaja: "2026-09-10", ...ahora() }));
    await assertSucceeds(updateDoc(ref, { fechaBaja: deleteField(), ...ahora() }));
  });

  it("un Operador de otra Unidad NO puede dar de baja", async () => {
    await assertFails(
      updateDoc(doc(como(OP_B), "elementos", "el1"), { fechaBaja: "2026-09-10", ...ahora() })
    );
  });
});

describe("elementos: actualizadoEn (sincronización por cambios)", () => {
  it("crear o editar sin actualizadoEn se rechaza", async () => {
    await assertFails(setDoc(doc(collection(como(OP_A), "elementos")), elementoA));
    await assertFails(updateDoc(doc(como(OP_A), "elementos", "el1"), { nombre: "Luis R." }));
  });

  it("actualizadoEn debe ser la hora del servidor, no una elegida", async () => {
    const vieja = Timestamp.fromMillis(Date.UTC(2020, 0, 1));
    await assertFails(
      updateDoc(doc(como(OP_A), "elementos", "el1"), { nombre: "Luis R.", actualizadoEn: vieja })
    );
    await assertSucceeds(
      updateDoc(doc(como(OP_A), "elementos", "el1"), { nombre: "Luis R.", ...ahora() })
    );
  });
});

describe("grados militares", () => {
  const grado = { nombre: "Cadete", categoria: "Cadetes", rango: 3 };

  it("cualquier usuario autorizado los lee", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "grados", "g1"), grado));
    await assertSucceeds(getDoc(doc(como(OP_A), "grados", "g1")));
  });

  const grados = (db, escribir) => conVersion(db, "grados", escribir);

  it("solo un Admin los crea, edita y borra", async () => {
    const op = como(OP_A);
    const admin = como(ADMIN);
    await assertFails(grados(op, (b) => b.set(doc(op, "grados", "g1"), grado)));
    await assertSucceeds(grados(admin, (b) => b.set(doc(admin, "grados", "g1"), grado)));
    await assertFails(grados(op, (b) => b.update(doc(op, "grados", "g1"), { rango: 9 })));
    await assertSucceeds(grados(admin, (b) => b.update(doc(admin, "grados", "g1"), { rango: 9 })));
    await assertFails(grados(op, (b) => b.delete(doc(op, "grados", "g1"))));
    await assertSucceeds(grados(admin, (b) => b.delete(doc(admin, "grados", "g1"))));
  });

  it("sin actualizar su versión, ni un Admin puede cambiarlos", async () => {
    await assertFails(setDoc(doc(como(ADMIN), "grados", "g1"), grado));
  });

  it("rechaza una categoría que no existe en el Estado de Fuerza", async () => {
    const admin = como(ADMIN);
    await assertFails(
      grados(admin, (b) => b.set(doc(admin, "grados", "g2"), { ...grado, categoria: "Generales" }))
    );
  });
});

describe("unidades (Configuración)", () => {
  it("solo un Admin crea y borra Unidades; todos las leen", async () => {
    const op = como(OP_A);
    const admin = como(ADMIN);
    const unidades = (db, escribir) => conVersion(db, "unidades", escribir);
    const nueva = { nombre: "3ra Unidad" };
    await assertFails(unidades(op, (b) => b.set(doc(op, "unidades", "u1"), nueva)));
    await assertSucceeds(unidades(admin, (b) => b.set(doc(admin, "unidades", "u1"), nueva)));
    await assertSucceeds(getDoc(doc(op, "unidades", "u1")));
    await assertFails(unidades(op, (b) => b.delete(doc(op, "unidades", "u1"))));
    await assertFails(deleteDoc(doc(admin, "unidades", "u1"))); // sin versión
    await assertSucceeds(unidades(admin, (b) => b.delete(doc(admin, "unidades", "u1"))));
  });
});

describe("versiones (meta/versiones)", () => {
  const versiones = (db) => doc(db, "meta", "versiones");

  it("todos los usuarios con acceso la leen; sin acceso no", async () => {
    await assertSucceeds(getDoc(versiones(como(OP_A))));
    await assertFails(getDoc(versiones(como("intruso@x.com"))));
  });

  it("un Operador no la cambia", async () => {
    await assertFails(setDoc(versiones(como(OP_A)), { catalogo: serverTimestamp() }));
  });

  it("solo acepta la hora del servidor y colecciones conocidas", async () => {
    const admin = como(ADMIN);
    await assertSucceeds(setDoc(versiones(admin), { catalogo: serverTimestamp() }));
    await assertFails(setDoc(versiones(admin), { catalogo: Timestamp.fromMillis(0) }, { merge: true }));
    await assertFails(setDoc(versiones(admin), { otra: serverTimestamp() }, { merge: true }));
  });

  it("dar de alta un usuario exige actualizar la versión de usuarios", async () => {
    const admin = como(ADMIN);
    const nuevo = { rol: "operador", unidad: "A", nombre: "Carla" };
    await assertFails(setDoc(doc(admin, "usuarios", "carla@club.mx"), nuevo));
    await assertSucceeds(
      conVersion(admin, "usuarios", (b) => b.set(doc(admin, "usuarios", "carla@club.mx"), nuevo))
    );
  });
});
