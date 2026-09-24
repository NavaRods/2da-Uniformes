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
