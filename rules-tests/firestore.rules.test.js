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
  increment,
  Timestamp,
} from "firebase/firestore";

let env;

const SUPER = "super@club.mx";
const ADMIN = "admin@club.mx";
const EM = "coronel@club.mx"; // Estado Mayor: consulta todas, no escribe
const OP_A = "ana@club.mx"; // Responsable de la Unidad A
const OP_B = "beto@club.mx"; // Responsable de la Unidad B

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
    await setDoc(doc(db, "usuarios", SUPER), { rol: "superadmin", unidad: null });
    await setDoc(doc(db, "usuarios", ADMIN), { rol: "admin", unidad: null });
    await setDoc(doc(db, "usuarios", EM), { rol: "estado_mayor", unidad: null });
    await setDoc(doc(db, "usuarios", OP_A), { rol: "responsable", unidad: "A" });
    await setDoc(doc(db, "usuarios", OP_B), { rol: "responsable", unidad: "B" });
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
  batch.update(pedidoRef(db, pedido), {
    saldoPendiente: saldoNuevo,
    ultimoAbonoId: id,
    ...ahora(),
  });
  return batch.commit();
}

// Borrar un pedido junto con su baja, como hace eliminarPedido en la app.
function borrarPedido(db, id, { unidad = "A", conBaja = true } = {}) {
  const batch = writeBatch(db);
  batch.delete(pedidoRef(db, id));
  if (conBaja) {
    batch.set(doc(db, "bajasPedidos", `el1_${id}`), {
      unidad,
      elementoId: "el1",
      pedidoId: id,
      en: serverTimestamp(),
    });
  }
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

describe("Estado Mayor: consulta todas las Unidades, no escribe en ninguna", () => {
  it("lee elementos y pedidos de cualquier Unidad", async () => {
    const db = como(EM);
    await assertSucceeds(getDoc(doc(db, "elementos", "el1")));
    await assertSucceeds(getDoc(pedidoRef(db)));
  });

  it("no puede dar de alta un elemento ni abonar, aunque vea la Unidad", async () => {
    const db = como(EM);
    await assertFails(setDoc(doc(db, "elementos", "el2"), { ...elementoA, ...ahora() }));
    await assertFails(abonar(db, { monto: 50, saldoNuevo: 150 }));
  });
});

describe("Super Admin: nadie lo toca desde la app", () => {
  it("un Admin no puede editar ni borrar la cuenta de un Super Admin", async () => {
    const admin = como(ADMIN);
    await assertFails(
      conVersion(admin, "usuarios", (b) =>
        b.update(doc(admin, "usuarios", SUPER), { nombre: "Otro nombre" })
      )
    );
    await assertFails(
      conVersion(admin, "usuarios", (b) => b.delete(doc(admin, "usuarios", SUPER)))
    );
  });

  it("no se puede crear ni editar un usuario con rol superadmin desde la app", async () => {
    const admin = como(ADMIN);
    await assertFails(
      conVersion(admin, "usuarios", (b) =>
        b.set(doc(admin, "usuarios", "nuevo@club.mx"), { rol: "superadmin", unidad: null })
      )
    );
    await assertFails(
      conVersion(admin, "usuarios", (b) =>
        b.update(doc(admin, "usuarios", OP_A), { rol: "superadmin" })
      )
    );
  });

  it("un Super Admin administra igual que un Admin (Unidades, todas las Unidades)", async () => {
    const superAdmin = como(SUPER);
    await assertSucceeds(getDoc(doc(superAdmin, "elementos", "el1")));
    await assertSucceeds(
      conVersion(superAdmin, "unidades", (b) => b.set(doc(superAdmin, "unidades", "u1"), { nombre: "C" }))
    );
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
    await assertFails(updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 0, ...ahora() }));
  });

  it("bajar el saldo apuntando a un abono que no existe se rechaza", async () => {
    await assertFails(
      updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 100, ultimoAbonoId: "fantasma", ...ahora() })
    );
  });

  it("reutilizar un abono viejo para justificar otra baja de saldo se rechaza", async () => {
    await assertFails(
      updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 100, ultimoAbonoId: "ab0", ...ahora() })
    );
  });

  it("subir el saldo se rechaza", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A)), { saldoPendiente: 500, ...ahora() }));
  });

  it("un abono no se puede editar", async () => {
    await assertFails(updateDoc(abonoRef(como(ADMIN), "ab0"), { monto: 1 }));
  });
});

describe("pedidos: campos fijos", () => {
  it("no se puede cambiar el precio total", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A), "pedLimpio"), { precioTotal: 1, ...ahora() }));
  });

  it("no se puede cambiar creadoEn", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A), "pedLimpio"), { creadoEn: new Date(), ...ahora() }));
  });

  it("no se puede cambiar el artículo", async () => {
    await assertFails(updateDoc(pedidoRef(como(OP_A), "pedLimpio"), { articulo: "Otro", ...ahora() }));
  });

  // Deja pagado el pedido sin pagos (saldo 0), sin pasar por las reglas.
  const liquidarLimpio = () =>
    env.withSecurityRulesDisabled((ctx) =>
      updateDoc(pedidoRef(ctx.firestore(), "pedLimpio"), { saldoPendiente: 0 })
    );

  it("una pieza con saldo no se puede marcar como entregada", async () => {
    const db = como(OP_A);
    await assertFails(updateDoc(pedidoRef(db, "pedLimpio"), { entregado: true, ...ahora() }));
    await assertFails(updateDoc(pedidoRef(db, "ped1"), { entregado: true, ...ahora() }));
  });

  it("sí se puede marcar entregado y pedir un cambio", async () => {
    const db = como(OP_A);
    await liquidarLimpio();
    await assertSucceeds(
      updateDoc(pedidoRef(db, "pedLimpio"), { entregado: true, quienEntrego: "Ana", ...ahora() })
    );
    await assertSucceeds(
      updateDoc(pedidoRef(db, "pedLimpio"), { cambioPendiente: true, motivoCambio: "Talla", ...ahora() })
    );
  });

  it("un pedido nuevo debe nacer con saldo igual al precio", async () => {
    const db = como(OP_A);
    const nuevo = (extra) =>
      setDoc(doc(db, "elementos", "el1", "pedidos", "nuevo"), { ...pedidoBase, ...ahora(), ...extra });
    await assertSucceeds(nuevo({}));
    await assertFails(nuevo({ saldoPendiente: 0 }));
  });

  it("toda escritura en un pedido debe llevar la hora del servidor", async () => {
    const db = como(OP_A);
    await assertFails(updateDoc(pedidoRef(db, "pedLimpio"), { entregado: true }));
    await assertFails(
      updateDoc(pedidoRef(db, "pedLimpio"), { entregado: true, actualizadoEn: Timestamp.fromMillis(0) })
    );
    await assertFails(setDoc(doc(db, "elementos", "el1", "pedidos", "otro"), pedidoBase));
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
    await assertFails(borrarPedido(como(OP_A), "ped1"));
    await assertSucceeds(borrarPedido(como(ADMIN), "ped1"));
  });

  it("un Operador sí borra un pedido sin pagos de su Unidad", async () => {
    await assertSucceeds(borrarPedido(como(OP_A), "pedLimpio"));
  });

  it("un Operador de otra Unidad NO borra un pedido sin pagos", async () => {
    await assertFails(borrarPedido(como(OP_B), "pedLimpio"));
  });

  it("borrar un pedido sin dejar su baja se rechaza", async () => {
    await assertFails(borrarPedido(como(ADMIN), "pedLimpio", { conBaja: false }));
    await assertFails(deleteDoc(pedidoRef(como(ADMIN), "pedLimpio")));
  });

  it("una baja solo vale junto con el borrado real del pedido", async () => {
    const db = como(OP_A);
    await assertFails(
      setDoc(doc(db, "bajasPedidos", "el1_pedLimpio"), {
        unidad: "A",
        elementoId: "el1",
        pedidoId: "pedLimpio",
        en: serverTimestamp(),
      })
    );
    // La Unidad de la baja debe ser la del elemento.
    await assertFails(borrarPedido(como(ADMIN), "pedLimpio", { unidad: "B" }));
  });

  it("las bajas se leen por Unidad", async () => {
    await borrarPedido(como(OP_A), "pedLimpio");
    await assertSucceeds(getDoc(doc(como(OP_A), "bajasPedidos", "el1_pedLimpio")));
    await assertFails(getDoc(doc(como(OP_B), "bajasPedidos", "el1_pedLimpio")));
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
    const nuevo = { rol: "responsable", unidad: "A", nombre: "Carla" };
    await assertFails(setDoc(doc(admin, "usuarios", "carla@club.mx"), nuevo));
    await assertSucceeds(
      conVersion(admin, "usuarios", (b) => b.set(doc(admin, "usuarios", "carla@club.mx"), nuevo))
    );
  });
});

describe("respaldos: contraseña y restauración", () => {
  const verificador = (extra = {}) => ({
    sal: "c2Fs",
    verificador: "dmVy",
    iteraciones: 600000,
    por: ADMIN,
    actualizadoEn: serverTimestamp(),
    ...extra,
  });

  it("solo un Admin lee y define el verificador de la contraseña", async () => {
    await assertFails(setDoc(doc(como(OP_A), "meta", "respaldo"), verificador({ por: OP_A })));
    await assertSucceeds(setDoc(doc(como(ADMIN), "meta", "respaldo"), verificador()));
    await assertSucceeds(getDoc(doc(como(ADMIN), "meta", "respaldo")));
    await assertFails(getDoc(doc(como(OP_A), "meta", "respaldo")));
  });

  it("rechaza un verificador débil, ajeno o con campos de más", async () => {
    const ref = doc(como(ADMIN), "meta", "respaldo");
    await assertFails(setDoc(ref, verificador({ iteraciones: 1000 })));
    await assertFails(setDoc(ref, verificador({ por: OP_A })));
    await assertFails(setDoc(ref, verificador({ contrasena: "secreta" })));
  });

  // Lote de restauración como el de restaurar() en src/lib/respaldo.js.
  function restauracion(db, por, escribir) {
    const batch = writeBatch(db);
    escribir(batch);
    batch.set(doc(db, "meta", "restauracion"), { en: serverTimestamp(), por, respaldo: "r.json" });
    return batch.commit();
  }

  it("un Admin restaura pedidos y abonos tal como estaban (saldo incluido)", async () => {
    const db = como(ADMIN);
    await assertSucceeds(
      restauracion(db, ADMIN, (b) => {
        b.set(pedidoRef(db), { ...pedidoBase, saldoPendiente: 50, ultimoAbonoId: "abX" });
        b.set(abonoRef(db, "abX"), { unidad: "A", monto: 250, fechaLocal: "2026-09-01" });
        b.set(doc(db, "elementos", "el1", "cuotas", "cu9"), { tipo: "mensualidad", meses: ["2026-08"] });
      })
    );
  });

  it("sin marcar meta/restauracion, esas escrituras siguen prohibidas", async () => {
    const db = como(ADMIN);
    await assertFails(setDoc(pedidoRef(db), { ...pedidoBase, saldoPendiente: 50 }));
  });

  it("un Operador no puede restaurar", async () => {
    const db = como(OP_A);
    await assertFails(
      restauracion(db, OP_A, (b) => b.set(pedidoRef(db), { ...pedidoBase, saldoPendiente: 0 }))
    );
  });

  it("la marca debe ser del propio Admin y con la hora del servidor", async () => {
    const db = como(ADMIN);
    await assertFails(
      setDoc(doc(db, "meta", "restauracion"), { en: serverTimestamp(), por: OP_A, respaldo: "" })
    );
    await assertFails(
      setDoc(doc(db, "meta", "restauracion"), { en: Timestamp.fromMillis(0), por: ADMIN, respaldo: "" })
    );
  });

  it("un lote grande (400 pedidos de elementos distintos) no rebasa los límites de las reglas", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const b = writeBatch(ctx.firestore());
      for (let i = 0; i < 400; i++) b.set(doc(ctx.firestore(), "elementos", `r${i}`), elementoA);
      await b.commit();
    });
    const db = como(ADMIN);
    await assertSucceeds(
      restauracion(db, ADMIN, (b) => {
        for (let i = 0; i < 400; i++) {
          b.set(doc(db, "elementos", `r${i}`, "pedidos", "p"), { ...pedidoBase, saldoPendiente: 10 });
        }
      })
    );
  });
});

describe("uniforme recibido (inventario)", () => {
  const inv = (db, id = "A~Gorra~5~") => doc(db, "inventario", id);
  const datos = (extra) => ({
    unidad: "A", productoNombre: "Gorra", talla: "5", color: "", cantidad: 3,
    actualizadoEn: serverTimestamp(), ...extra,
  });

  it("el Responsable registra lo recibido de su Unidad, no de otra", async () => {
    await assertSucceeds(setDoc(inv(como(OP_A)), datos()));
    await assertFails(setDoc(inv(como(OP_B), "B"), datos()));
  });

  it("Estado Mayor lo consulta pero no lo cambia", async () => {
    await setDoc(inv(como(OP_A)), datos());
    await assertSucceeds(getDoc(inv(como(EM))));
    await assertFails(setDoc(inv(como(EM)), datos({ cantidad: 9 })));
  });

  it("la cantidad no queda negativa ni cambia de Unidad o producto", async () => {
    const db = como(OP_A);
    await setDoc(inv(db), datos());
    await assertSucceeds(setDoc(inv(db), { cantidad: increment(-3) }, { merge: true }));
    await assertFails(setDoc(inv(db), { cantidad: increment(-1) }, { merge: true }));
    await assertFails(setDoc(inv(db), { productoNombre: "Botas" }, { merge: true }));
    await assertFails(setDoc(inv(db), datos({ cantidad: 1.5 })));
  });

  it("entregar un pedido descuenta del inventario en el mismo lote", async () => {
    const db = como(OP_A);
    await env.withSecurityRulesDisabled((ctx) =>
      updateDoc(pedidoRef(ctx.firestore(), "pedLimpio"), { saldoPendiente: 0 })
    );
    await setDoc(inv(db), datos());
    const lote = writeBatch(db);
    lote.update(pedidoRef(db, "pedLimpio"), { entregado: true, descontoInventario: true, ...ahora() });
    lote.set(inv(db), { cantidad: increment(-1), ...ahora() }, { merge: true });
    await assertSucceeds(lote.commit());
  });
});

describe("pedidos: cambios de talla/color", () => {
  const pedirCambio = (db, extra = {}) =>
    updateDoc(pedidoRef(db, "pedLimpio"), {
      cambioPendiente: true,
      motivoCambio: "Le queda chica",
      cambioTalla: "12",
      cambioColor: "",
      ...ahora(),
      ...extra,
    });

  it("se puede pedir un cambio con la talla nueva, pero la talla no cambia todavía", async () => {
    const db = como(OP_A);
    await assertSucceeds(pedirCambio(db));
    await assertFails(updateDoc(pedidoRef(db, "pedLimpio"), { talla: "12", ...ahora() }));
  });

  it("al resolverlo la pieza pasa exactamente a la talla pedida", async () => {
    const db = como(OP_A);
    await assertSucceeds(pedirCambio(db));
    const resolver = (extra) =>
      updateDoc(pedidoRef(db, "pedLimpio"), {
        cambioPendiente: false,
        motivoCambio: "",
        cambioTalla: deleteField(),
        cambioColor: deleteField(),
        articulo: "Pantalón — talla 12",
        ...ahora(),
        ...extra,
      });
    // Una talla distinta a la que traía el cambio se rechaza.
    await assertFails(resolver({ talla: "14" }));
    await assertSucceeds(resolver({ talla: "12", color: "" }));
  });

  it("sin un cambio pendiente no se puede tocar la talla ni el artículo", async () => {
    const db = como(OP_A);
    await assertFails(
      updateDoc(pedidoRef(db, "pedLimpio"), {
        talla: "12",
        articulo: "Otro",
        cambioPendiente: false,
        ...ahora(),
      })
    );
  });

  it("resolver un cambio no permite cambiar el precio", async () => {
    const db = como(OP_A);
    await assertSucceeds(pedirCambio(db));
    await assertFails(
      updateDoc(pedidoRef(db, "pedLimpio"), {
        cambioPendiente: false,
        talla: "12",
        color: "",
        precioTotal: 1,
        ...ahora(),
      })
    );
  });

  it("Estado Mayor no pide cambios", async () => {
    await assertFails(pedirCambio(como(EM)));
  });
});

describe("relaciones de pagos validadas", () => {
  const rel = (db, id = "A~2026-09-20") => doc(db, "relaciones", id);
  const datos = (extra) => ({
    unidad: "A",
    fecha: "2026-09-20",
    total: 340,
    piezas: [{ productoNombre: "Gorra", talla: "5", color: "", cantidad: 2, total: 340, recibido: 0 }],
    mensualidades: [],
    entregadoPor: "Ana",
    entregadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    ...extra,
  });

  it("el Responsable valida la relación de su Unidad, no la de otra", async () => {
    await assertSucceeds(setDoc(rel(como(OP_A)), datos()));
    await assertFails(setDoc(rel(como(OP_A), "B~2026-09-20"), datos({ unidad: "B" })));
  });

  it("Estado Mayor la consulta pero no la escribe", async () => {
    await setDoc(rel(como(OP_A)), datos());
    await assertSucceeds(getDoc(rel(como(EM))));
    await assertFails(setDoc(rel(como(EM)), datos()));
  });

  it("otra Unidad no la lee", async () => {
    await setDoc(rel(como(OP_A)), datos());
    await assertFails(getDoc(rel(como(OP_B))));
  });

  it("marcar piezas recibidas actualiza la relación sin cambiar Unidad ni día", async () => {
    const db = como(OP_A);
    await setDoc(rel(db), datos());
    const piezas = [{ productoNombre: "Gorra", talla: "5", color: "", cantidad: 2, total: 340, recibido: 1 }];
    await assertSucceeds(updateDoc(rel(db), { piezas, ...ahora() }));
    await assertFails(updateDoc(rel(db), { unidad: "B", ...ahora() }));
    await assertFails(updateDoc(rel(db), { fecha: "2026-09-21", ...ahora() }));
  });

  it("guarda los abonos del día como lista", async () => {
    const db = como(OP_A);
    const abono = { nombre: "Ana", pedidoId: "p1", monto: 100, saldo: 150 };
    await assertSucceeds(setDoc(rel(db), datos({ abonos: [abono], totalAbonos: 100 })));
    await assertFails(setDoc(rel(db), datos({ abonos: "no" })));
  });

  it("no acepta campos ajenos y solo un Admin la borra", async () => {
    const db = como(OP_A);
    await assertFails(setDoc(rel(db), datos({ extra: 1 })));
    await setDoc(rel(db), datos());
    await assertFails(deleteDoc(rel(db)));
    await assertSucceeds(deleteDoc(rel(como(ADMIN))));
  });
});
