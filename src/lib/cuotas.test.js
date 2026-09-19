import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "c1" }));
const collection = vi.fn((...args) => ({ path: args.slice(1) }));

vi.mock("firebase/firestore", () => ({
  collection: (...args) => collection(...args),
  addDoc: (...args) => addDoc(...args),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => "SERVER_TIMESTAMP",
}));
vi.mock("../firebase", () => ({ db: {} }));

const {
  registrarMensualidad,
  mesesPagados,
  pagosPorMes,
  resumenCuotas,
  etiquetaMes,
  claveMes,
  MENSUALIDAD_DEFAULT,
} =
  await import("./cuotas");

beforeEach(() => addDoc.mockClear());

describe("registrarMensualidad", () => {
  it("guarda los meses ordenados y el total = meses × precio", async () => {
    await registrarMensualidad("el1", {
      meses: ["2026-10", "2026-09"],
      montoPorMes: "50",
      quienRecibio: "Ana",
    });
    const [ref, datos] = addDoc.mock.calls[0];
    expect(ref).toEqual({ path: ["elementos", "el1", "cuotas"] });
    expect(datos).toMatchObject({
      tipo: "mensualidad",
      meses: ["2026-09", "2026-10"],
      montoPorMes: 50,
      total: 100,
      quienRecibio: "Ana",
      fecha: "SERVER_TIMESTAMP",
    });
    expect(datos.fechaLocal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("el precio por defecto es $60", () => {
    expect(MENSUALIDAD_DEFAULT).toBe(60);
  });
});

describe("meses", () => {
  it("junta los meses ya pagados de todos los cobros", () => {
    const pagados = mesesPagados([
      { tipo: "mensualidad", meses: ["2026-01", "2026-02"] },
      { tipo: "mensualidad", meses: ["2026-02", "2026-03"] },
    ]);
    expect([...pagados].sort()).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("arma claves y etiquetas", () => {
    expect(claveMes(2026, 8)).toBe("2026-09");
    expect(etiquetaMes("2026-09")).toBe("Sep 2026");
  });
});

describe("resumen de cuotas", () => {
  const cuotas = [
    { tipo: "mensualidad", meses: ["2025-12", "2026-01"], montoPorMes: 50 },
    { tipo: "mensualidad", meses: ["2026-03"], montoPorMes: 60 },
  ];

  it("guarda lo pagado por cada mes", () => {
    expect(pagosPorMes(cuotas)).toEqual({ "2025-12": 50, "2026-01": 50, "2026-03": 60 });
  });

  it("cuenta y suma solo el año pedido y da el último mes pagado", () => {
    expect(resumenCuotas(cuotas, 2026)).toEqual({
      mesesAnio: 2,
      totalAnio: 110,
      ultimoMes: "2026-03",
    });
  });

  it("sin pagos no hay último mes", () => {
    expect(resumenCuotas([], 2026)).toEqual({ mesesAnio: 0, totalAnio: 0, ultimoMes: null });
  });
});
