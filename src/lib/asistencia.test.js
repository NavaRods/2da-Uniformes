import { describe, it, expect, vi, beforeEach } from "vitest";

const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn(async () => {}) };
const doc = vi.fn((...args) => ({ path: args.slice(1).join("/") }));

vi.mock("firebase/firestore", () => ({
  doc: (...args) => doc(...args),
  writeBatch: () => batch,
  deleteField: () => "DELETE_FIELD",
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  documentId: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock("../firebase", () => ({ db: {} }));

const {
  marcarAsistencia,
  normalizarEstado,
  visibleEnLista,
  estaDeBaja,
  fechaLocal,
} = await import("./asistencia");

beforeEach(() => {
  batch.set.mockClear();
  batch.update.mockClear();
  batch.commit.mockClear();
});

describe("estados", () => {
  it("convierte los registros viejos true/false", () => {
    expect(normalizarEstado(true)).toBe("asistencia");
    expect(normalizarEstado(false)).toBe("falta");
    expect(normalizarEstado(undefined)).toBe("");
    expect(normalizarEstado("justificada")).toBe("justificada");
  });

  it("fechaLocal usa el día local, no UTC", () => {
    expect(fechaLocal(new Date(2026, 8, 5, 23, 30))).toBe("2026-09-05");
  });
});

describe("bajas", () => {
  const el = { id: "a", fechaBaja: "2026-09-10" };

  it("aparece hasta el día de la baja y desaparece después", () => {
    expect(visibleEnLista(el, "2026-09-03")).toBe(true);
    expect(visibleEnLista(el, "2026-09-10")).toBe(true);
    expect(visibleEnLista(el, "2026-09-11")).toBe(false);
    expect(visibleEnLista({ id: "b" }, "2026-09-11")).toBe(true);
  });

  it("solo está de baja desde su fecha", () => {
    expect(estaDeBaja(el, "2026-09-09")).toBe(false);
    expect(estaDeBaja(el, "2026-09-10")).toBe(true);
  });
});

describe("marcarAsistencia", () => {
  it("guarda el estado del día", async () => {
    await marcarAsistencia("2026-09-10", { id: "a" }, "falta");
    expect(batch.set).toHaveBeenCalledWith(
      { path: "asistencias/2026-09-10" },
      { a: "falta" },
      { merge: true }
    );
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it("baja registra la fecha en el elemento", async () => {
    await marcarAsistencia("2026-09-10", { id: "a" }, "baja");
    expect(batch.update).toHaveBeenCalledWith(
      { path: "elementos/a" },
      { fechaBaja: "2026-09-10" }
    );
  });

  it("marcar otro estado después de una baja reactiva al elemento", async () => {
    await marcarAsistencia(
      "2026-09-17",
      { id: "a", fechaBaja: "2026-09-10" },
      "asistencia"
    );
    expect(batch.update).toHaveBeenCalledWith(
      { path: "elementos/a" },
      { fechaBaja: "DELETE_FIELD" }
    );
  });

  it("marcar un día anterior a la baja no la toca", async () => {
    await marcarAsistencia(
      "2026-09-03",
      { id: "a", fechaBaja: "2026-09-10" },
      "falta"
    );
    expect(batch.update).not.toHaveBeenCalled();
  });
});
