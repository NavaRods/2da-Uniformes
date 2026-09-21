import { describe, it, expect, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  deleteField: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDoc: vi.fn(),
  collectionGroup: vi.fn(),
}));
vi.mock("../firebase", () => ({ db: {} }));

const { agruparAsistenciaAnterior } = await import("./migracion");

describe("agruparAsistenciaAnterior", () => {
  const unidades = new Map([
    ["e1", "U1"],
    ["e2", "U1"],
    ["e3", "U2"],
  ]);

  it("reparte los estados por la Unidad de cada elemento", () => {
    const { porUnidad, sinUnidad } = agruparAsistenciaAnterior(
      "2026-09-01",
      { e1: "falta", e2: "justificada", e3: "asistencia" },
      unidades
    );
    expect(sinUnidad).toBe(0);
    expect(porUnidad.U1).toEqual({
      unidad: "U1",
      fecha: "2026-09-01",
      estados: { e1: "falta", e2: "justificada" },
    });
    expect(porUnidad.U2.estados).toEqual({ e3: "asistencia" });
  });

  it("convierte los valores viejos true/false", () => {
    const { porUnidad } = agruparAsistenciaAnterior("2026-09-01", { e1: true, e2: false }, unidades);
    expect(porUnidad.U1.estados).toEqual({ e1: "asistencia", e2: "falta" });
  });

  it("cuenta aparte los elementos que ya no existen", () => {
    const { porUnidad, sinUnidad } = agruparAsistenciaAnterior(
      "2026-09-01",
      { e1: true, fantasma: true },
      unidades
    );
    expect(sinUnidad).toBe(1);
    expect(Object.keys(porUnidad)).toEqual(["U1"]);
  });
});
