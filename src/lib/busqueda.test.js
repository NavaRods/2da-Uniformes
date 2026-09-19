import { describe, it, expect } from "vitest";
import { buscar, normalizar, distancia } from "./busqueda";

const nombres = [
  "María Fernanda López Hernández",
  "José Luis Vázquez",
  "Marcos Ramírez",
  "Ximena Gutiérrez",
  "Ángel Bautista",
  "Yolanda Guzmán",
];
const hallar = (q) => buscar(nombres, q);

describe("normalizar", () => {
  it("ignora mayúsculas, acentos y signos", () => {
    expect(normalizar("  MaRÍa-Ñandú ")).toBe("maria nandu");
  });
});

describe("distancia", () => {
  it("cuenta ediciones y letras intercambiadas como 1", () => {
    expect(distancia("maria", "mraia")).toBe(1);
    expect(distancia("lopez", "lopes")).toBe(1);
    expect(distancia("abc", "xyz")).toBe(3);
  });
});

describe("buscar", () => {
  it("sin texto devuelve todo", () => {
    expect(hallar("  ")).toEqual(nombres);
  });

  it("ignora acentos y mayúsculas", () => {
    expect(hallar("maria")[0]).toContain("María");
    expect(hallar("JOSE LUIS")[0]).toContain("José");
  });

  it("no importa el orden de las palabras", () => {
    expect(hallar("lopez maria")).toEqual([nombres[0]]);
  });

  it("encuentra por cualquier parte del nombre", () => {
    expect(hallar("hernand")).toEqual([nombres[0]]);
    expect(hallar("nda")).toContain(nombres[0]); // "Fernanda"
  });

  it("perdona errores de ortografía y de tecleo", () => {
    expect(hallar("mraia")[0]).toBe(nombres[0]);
    expect(hallar("gutierres")).toEqual([nombres[3]]);
    expect(hallar("ramirs")).toEqual([nombres[2]]);
  });

  it("equivale letras que suenan igual", () => {
    expect(hallar("basques")).toEqual([nombres[1]]); // Vázquez
    expect(hallar("jimena")).toEqual([nombres[3]]); // Ximena
    expect(hallar("gusman")).toEqual([nombres[5]]); // Guzmán
    expect(hallar("bautista")).toEqual([nombres[4]]);
  });

  it("ordena lo más parecido primero", () => {
    const r = buscar(["Mariana Torres", "Marina Ruiz", "Mario Pérez"], "mari");
    expect(r[0]).toBe("Mariana Torres");
    expect(r).toHaveLength(3);
  });

  it("no devuelve resultados sin relación", () => {
    expect(hallar("zzzz")).toEqual([]);
    expect(hallar("pedro")).toEqual([]);
  });

  it("acepta una función para obtener el texto", () => {
    const els = [{ nombre: "Ana Ruiz" }, { nombre: "Luis Soto" }];
    expect(buscar(els, "soto", (e) => e.nombre)).toEqual([els[1]]);
  });
});
