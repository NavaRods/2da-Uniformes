import { describe, it, expect } from "vitest";
import {
  CATEGORIAS,
  GRADOS_PREDETERMINADOS,
  categoriaDeGrado,
  comparadorPorJerarquia,
  estadoDeFuerza,
  ordenarGrados,
} from "./grados";

const G = GRADOS_PREDETERMINADOS;

describe("grados", () => {
  it("cada grado predeterminado pertenece a una categoría del Estado de Fuerza", () => {
    for (const g of G) expect(CATEGORIAS).toContain(g.categoria);
  });

  it("agrupa los grados según la jerarquía pedida", () => {
    expect(categoriaDeGrado(G, "Cabo")).toBe("Clases");
    expect(categoriaDeGrado(G, "Sargento 1ero")).toBe("Clases");
    expect(categoriaDeGrado(G, "Sub Teniente")).toBe("Oficiales");
    expect(categoriaDeGrado(G, "Capitán 1ero")).toBe("Oficiales");
    expect(categoriaDeGrado(G, "Teniente Coronel")).toBe("Jefes");
    expect(categoriaDeGrado(G, "Recluta")).toBe("Reclutas");
    expect(categoriaDeGrado(G, "Tropa")).toBe("Tropas");
    expect(categoriaDeGrado(G, "Cadete")).toBe("Cadetes");
    expect(categoriaDeGrado(G, "General")).toBe("");
  });

  it("ordena de mayor a menor jerarquía", () => {
    const orden = ordenarGrados(G).map((g) => g.nombre);
    expect(orden[0]).toBe("Coronel");
    expect(orden.at(-1)).toBe("Recluta");
  });

  it("ordena elementos por jerarquía y luego por nombre; sin grado al final", () => {
    const els = [
      { nombre: "Zoe", grupo: "Varonil", gradoMilitar: "Cadete" },
      { nombre: "Ana", grupo: "Varonil", gradoMilitar: "Cadete" },
      { nombre: "Sin grado", grupo: "Varonil" },
      { nombre: "Beto", grupo: "Varonil", gradoMilitar: "Capitán 2do" },
    ];
    expect(els.sort(comparadorPorJerarquia(G)).map((e) => e.nombre)).toEqual([
      "Beto",
      "Ana",
      "Zoe",
      "Sin grado",
    ]);
  });

  it("ordena primero Varonil y luego Femenino, cada uno por jerarquía", () => {
    const els = [
      { nombre: "Diana", grupo: "Femenino", gradoMilitar: "Capitán 2do" },
      { nombre: "Carlos", grupo: "Varonil", gradoMilitar: "Cadete" },
      { nombre: "Elena", grupo: "Femenino", gradoMilitar: "Cadete" },
      { nombre: "Beto", grupo: "Varonil", gradoMilitar: "Capitán 2do" },
    ];
    expect(els.sort(comparadorPorJerarquia(G)).map((e) => e.nombre)).toEqual([
      "Beto",
      "Carlos",
      "Diana",
      "Elena",
    ]);
  });
});

describe("estadoDeFuerza", () => {
  const el = (grupo, gradoMilitar) => ({ grupo, gradoMilitar });

  it("reproduce el ejemplo: conteo por grupo, total por grupo y total general", () => {
    const varonil = [
      ...Array(2).fill(el("Varonil", "Cabo")),
      ...Array(4).fill(el("Varonil", "Cadete")),
      ...Array(3).fill(el("Varonil", "Recluta")),
    ];
    const femenino = [
      ...Array(3).fill(el("Femenino", "Sargento 2do")),
      el("Femenino", "Cadete"),
      ...Array(2).fill(el("Femenino", "Tropa")),
      ...Array(3).fill(el("Femenino", "Recluta")),
    ];
    const f = estadoDeFuerza([...varonil, ...femenino], G);

    expect(f.Varonil).toMatchObject({ Oficiales: 0, Clases: 2, Cadetes: 4, Tropas: 0, Reclutas: 3, total: 9 });
    expect(f.Femenino).toMatchObject({ Oficiales: 0, Clases: 3, Cadetes: 1, Tropas: 2, Reclutas: 3, total: 9 });
    expect(f.totalGeneral).toBe(18);
  });

  it("los elementos sin grado válido se cuentan aparte pero entran en el total", () => {
    const f = estadoDeFuerza([el("Varonil", ""), el("Femenino", "General"), el("Varonil", "Cadete")], G);
    expect(f.Varonil.sinGrado).toBe(1);
    expect(f.Femenino.sinGrado).toBe(1);
    expect(f.Varonil.total).toBe(2);
    expect(f.totalGeneral).toBe(3);
  });

  it("sin elementos, todo en cero", () => {
    const f = estadoDeFuerza([], G);
    expect(f.totalGeneral).toBe(0);
    expect(f.Varonil.Jefes).toBe(0);
  });
});
