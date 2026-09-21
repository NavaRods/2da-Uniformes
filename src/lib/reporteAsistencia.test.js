import { describe, it, expect, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  writeBatch: vi.fn(),
  deleteField: vi.fn(),
  onSnapshot: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("../firebase", () => ({ db: {} }));

const { cabecerasReporte, filasReporte, filaComoLista, LEYENDA } = await import("./reporteAsistencia");
const { GRADOS_PREDETERMINADOS } = await import("./grados");
const { domingosDelMes } = await import("./asistencia");

describe("domingosDelMes", () => {
  it("devuelve solo los domingos", () => {
    expect(domingosDelMes("2026-09")).toEqual(["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
  });

  it("un mes con cinco domingos", () => {
    expect(domingosDelMes("2026-11")).toEqual([
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
      "2026-11-22",
      "2026-11-29",
    ]);
  });
});

describe("reporte de asistencia", () => {
  const domingos = ["2026-09-06", "2026-09-13", "2026-09-20"];
  const elementos = [
    { id: "a", unidad: "2da", nombre: "Zoe", gradoMilitar: "Cadete", numeroOrden: "F0218002" },
    { id: "b", unidad: "2da", nombre: "Ana", gradoMilitar: "Cabo", numeroOrden: "F0218001" },
    { id: "c", unidad: "2da", nombre: "Beto", gradoMilitar: "Cadete", fechaBaja: "2026-09-13" },
    { id: "d", unidad: "2da", nombre: "Viejo", gradoMilitar: "Cadete", fechaBaja: "2026-08-10" },
  ];
  const asistencias = {
    "2026-09-06": { a: "asistencia", b: "falta", c: "justificada" },
    "2026-09-13": { a: "falta", b: "asistencia", c: "baja" },
    "2026-09-20": { a: true },
  };

  const filas = filasReporte({ elementos, asistencias, domingos, mes: "2026-09", grados: GRADOS_PREDETERMINADOS });

  it("las columnas son Unidad, No. de orden, Grado, Nombre y los domingos", () => {
    expect(cabecerasReporte(domingos)).toEqual(["Unidad", "No. de orden", "Grado", "Nombre", "06", "13", "20"]);
  });

  it("ordena por jerarquía y deja fuera las bajas de meses anteriores", () => {
    expect(filas.map((f) => f.nombre)).toEqual(["Ana", "Beto", "Zoe"]);
  });

  it("usa las marcas A, F, FJ y B", () => {
    expect(filas.find((f) => f.nombre === "Ana").marcas).toEqual(["F", "A", ""]);
    expect(filas.find((f) => f.nombre === "Zoe").marcas).toEqual(["A", "F", "A"]);
    expect(LEYENDA).toMatch(/A = Asistencia.*F = Falta.*FJ = Falta justificada.*B = Baja/);
  });

  it("desde la fecha de baja el elemento queda con B", () => {
    expect(filas.find((f) => f.nombre === "Beto").marcas).toEqual(["FJ", "B", "B"]);
  });

  it("cada fila se arma como Unidad, orden, grado, nombre y marcas", () => {
    expect(filaComoLista(filas[0])).toEqual(["2da", "F0218001", "Cabo", "Ana", "F", "A", ""]);
  });
});
