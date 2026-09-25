import { describe, it, expect, vi, beforeEach } from "vitest";

const lote = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
const setDoc = vi.fn(async () => {});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: (...args) => ({ __doc: args.slice(1) }),
  increment: (n) => ({ __inc: n }),
  onSnapshot: vi.fn(() => () => {}),
  query: vi.fn(),
  serverTimestamp: () => "TS",
  setDoc: (...args) => setDoc(...args),
  where: vi.fn(),
  writeBatch: () => lote,
}));
vi.mock("../firebase", () => ({ db: {} }));

const {
  estadoRecepcion,
  fusionarPiezas,
  recibirDeRelacion,
  relacionDesactualizada,
  validarRelacionDia,
} = await import("./relaciones");

const gorra = { productoNombre: "Gorra", talla: "5", color: "", cantidad: 3, total: 255 };

beforeEach(() => vi.clearAllMocks());

describe("fusionarPiezas", () => {
  it("empieza sin nada recibido", () => {
    expect(fusionarPiezas([gorra])[0]).toMatchObject({ cantidad: 3, recibido: 0 });
  });

  it("al volver a validar conserva lo ya recibido", () => {
    const previas = [{ ...gorra, cantidad: 2, recibido: 2 }];
    expect(fusionarPiezas([gorra], previas)[0]).toMatchObject({ cantidad: 3, recibido: 2 });
  });

  it("no pierde una pieza ya recibida cuyo pago desapareció", () => {
    const previas = [{ ...gorra, recibido: 1 }];
    const piezas = fusionarPiezas([], previas);
    expect(piezas).toHaveLength(1);
    expect(piezas[0]).toMatchObject({ cantidad: 1, recibido: 1 });
  });
});

describe("estadoRecepcion", () => {
  it("distingue pendiente, parcial y completo", () => {
    expect(estadoRecepcion([{ cantidad: 3, recibido: 0 }]).estado).toBe("pendiente");
    expect(estadoRecepcion([{ cantidad: 3, recibido: 1 }]).estado).toBe("parcial");
    expect(estadoRecepcion([{ cantidad: 3, recibido: 3 }]).estado).toBe("completo");
    expect(estadoRecepcion([]).estado).toBe("sin-piezas");
  });

  it("suma esperadas, recibidas y faltantes", () => {
    const e = estadoRecepcion([
      { cantidad: 3, recibido: 1 },
      { cantidad: 2, recibido: 2 },
    ]);
    expect(e).toMatchObject({ esperadas: 5, recibidas: 3, faltan: 2 });
  });
});

describe("relacionDesactualizada", () => {
  const resumen = { total: 255, general: [{ cantidad: 3 }] };
  it("avisa cuando hay pagos nuevos después de validar", () => {
    const rel = { total: 255, piezas: [{ cantidad: 3, recibido: 0 }] };
    expect(relacionDesactualizada(rel, resumen)).toBe(false);
    expect(relacionDesactualizada({ ...rel, total: 170 }, resumen)).toBe(true);
  });
});

describe("validarRelacionDia", () => {
  it("guarda el resumen del día en relaciones/{unidad~fecha}", async () => {
    await validarRelacionDia({
      unidad: "2a",
      fecha: "2026-09-20",
      quien: "Ana",
      resumen: {
        total: 255,
        totalUniformes: 255,
        totalMensualidades: 0,
        mesesCobrados: 0,
        general: [gorra],
        mensualidades: [],
      },
    });
    const [ref, datos] = setDoc.mock.calls[0];
    expect(ref.__doc).toEqual(["relaciones", "2a~2026-09-20"]);
    expect(datos).toMatchObject({ unidad: "2a", fecha: "2026-09-20", total: 255, entregadoPor: "Ana" });
    expect(datos.piezas[0]).toMatchObject({ productoNombre: "Gorra", cantidad: 3, recibido: 0 });
  });

  it("exige una Unidad", () => {
    expect(() => validarRelacionDia({ fecha: "2026-09-20", resumen: {} })).toThrow(/Unidad/);
  });
});

describe("recibirDeRelacion", () => {
  const relacion = {
    unidad: "2a",
    fecha: "2026-09-20",
    piezas: [{ ...gorra, recibido: 1 }],
  };

  it("suma a Uniformidad disponible y marca lo recibido en el mismo lote", async () => {
    await recibirDeRelacion(relacion, new Map([[0, 2]]));
    expect(lote.set).toHaveBeenCalledTimes(1);
    expect(lote.set.mock.calls[0][1]).toMatchObject({ unidad: "2a", productoNombre: "Gorra", cantidad: { __inc: 2 } });
    expect(lote.update.mock.calls[0][1].piezas[0].recibido).toBe(3);
    expect(lote.commit).toHaveBeenCalled();
  });

  it("no acepta más de lo que falta", () => {
    expect(() => recibirDeRelacion(relacion, new Map([[0, 3]]))).toThrow(/Solo faltan 2/);
  });

  it("pide indicar cuántas", () => {
    expect(() => recibirDeRelacion(relacion, new Map([[0, 0]]))).toThrow(/Indica cuántas/);
  });
});

describe("agruparPorPieza", () => {
  const botas = (fecha, cantidad, recibido) => ({
    unidad: "2a",
    fecha,
    piezas: [{ productoNombre: "Botas", talla: "4", color: "", cantidad, total: 0, recibido }],
  });
  const relaciones = [botas("2026-09-13", 1, 0), botas("2026-09-06", 3, 1)];

  it("junta la misma pieza de varios días y conserva cada fecha", async () => {
    const { agruparPorPieza } = await import("./relaciones");
    const [botasSin] = agruparPorPieza(relaciones, "sin-recibir");
    expect(botasSin.total).toBe(3);
    const v = botasSin.variantes[0];
    expect(v.fechas.map((f) => [f.fecha, f.cantidad])).toEqual([
      ["2026-09-06", 2],
      ["2026-09-13", 1],
    ]);
  });

  it("separa lo recibido de lo que falta", async () => {
    const { agruparPorPieza } = await import("./relaciones");
    const [recibido] = agruparPorPieza(relaciones, "recibido");
    expect(recibido.total).toBe(1);
    expect(recibido.variantes[0].fechas).toHaveLength(1);
    expect(agruparPorPieza([botas("2026-09-06", 2, 2)], "sin-recibir")).toEqual([]);
  });

  it("fechaCorta da día/mes/año", async () => {
    const { fechaCorta } = await import("./relaciones");
    expect(fechaCorta("2026-09-06")).toBe("6/09/2026");
  });
});

describe("agruparAbonos", () => {
  it("acumula los abonos de cada pieza y detecta cuándo se liquidó", async () => {
    const { agruparAbonos } = await import("./relaciones");
    const ab = (monto, saldo, pedidoId = "p1", nombre = "Ana") => ({
      nombre, pedidoId, elementoId: "e1", productoNombre: "Botas", talla: "7", color: "", monto, saldo,
    });
    const relaciones = [
      { unidad: "2a", fecha: "2026-09-06", piezas: [], abonos: [ab(100, 150), ab(50, 200, "p2", "Luis")] },
      { unidad: "2a", fecha: "2026-09-13", piezas: [], abonos: [ab(100, 50)] },
      {
        unidad: "2a",
        fecha: "2026-09-20",
        piezas: [{ elementos: [{ pedidoId: "p1", nombre: "Ana" }] }],
        abonos: [],
      },
    ];
    const [luis, ana] = agruparAbonos(relaciones);
    expect(luis).toMatchObject({ nombre: "Luis", total: 50, saldo: 200, liquidadaEl: null });
    expect(ana).toMatchObject({ nombre: "Ana", total: 200, saldo: 50, liquidadaEl: "2026-09-20" });
    expect(ana.pagos.map((p) => p.fecha)).toEqual(["2026-09-06", "2026-09-13"]);
  });
});

describe("conAbonosPendientes", () => {
  it("suma a Sin recibir los abonos sin liquidar, aunque la pieza aún no cuente", async () => {
    const { conAbonosPendientes, agruparPorPieza } = await import("./relaciones");
    const relaciones = [
      {
        unidad: "2a",
        fecha: "2026-09-24",
        piezas: [],
        abonos: [{ nombre: "Alexa", pedidoId: "p9", elementoId: "e9", productoNombre: "Botas", talla: "5", color: "", monto: 90, saldo: 330 }],
      },
    ];
    const grupos = conAbonosPendientes(agruparPorPieza(relaciones, "sin-recibir"), relaciones);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].total).toBe(0);
    expect(grupos[0].variantes[0].abonos[0]).toMatchObject({ nombre: "Alexa", total: 90, saldo: 330 });
  });
});
