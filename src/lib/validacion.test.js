import { describe, it, expect } from "vitest";
import {
  formatearTelefono,
  normalizarNumeroOrden,
  normalizarTelefono10,
  validarElemento,
  validarNumeroOrden,
  validarTelefono,
  validarNombre,
  validarEdad,
  validarFechaNacimiento,
} from "./validacion";

const GRADOS = ["Recluta", "Cadete", "Cabo"];

const formValido = {
  unidad: "2da Unidad",
  grupo: "Varonil",
  nombre: "Juan Pérez",
  numeroOrden: "",
  gradoMilitar: "Cadete",
  edad: "15",
  telefonos: ["5512345678"],
  fechaNacimiento: "2010-05-01",
  antecedentes: "No",
  antecedentesDetalle: "",
  practicaDeporte: "No",
  deporte: "",
};

describe("teléfono", () => {
  it("se da formato mientras se escribe", () => {
    expect(formatearTelefono("5")).toBe("5");
    expect(formatearTelefono("55123")).toBe("551 23");
    expect(formatearTelefono("5512345678")).toBe("551 234 5678");
    expect(formatearTelefono("551-234-5678 99")).toBe("551 234 5678");
  });

  it("acepta solo 10 dígitos (vacío es válido: es opcional)", () => {
    expect(validarTelefono("")).toBe("");
    expect(validarTelefono("5512345678")).toBe("");
    expect(validarTelefono("551234567")).not.toBe("");
    expect(validarTelefono("55123456789")).not.toBe("");
  });

  it("normaliza teléfonos viejos con lada de país", () => {
    expect(normalizarTelefono10("(551) 234-5678")).toBe("5512345678");
    expect(normalizarTelefono10("+52 551 234 5678")).toBe("5512345678");
    expect(normalizarTelefono10("5215512345678")).toBe("5512345678");
  });
});

describe("número de orden", () => {
  it("es opcional", () => {
    expect(validarNumeroOrden("", "Varonil")).toBe("");
  });

  it("acepta V/F + 7 dígitos que coincidan con el grupo", () => {
    expect(validarNumeroOrden("V0218001", "Varonil")).toBe("");
    expect(validarNumeroOrden("F0218001", "Femenino")).toBe("");
  });

  it("rechaza formato incorrecto", () => {
    expect(validarNumeroOrden("V021800", "Varonil")).not.toBe("");
    expect(validarNumeroOrden("X0218001", "Varonil")).not.toBe("");
    expect(validarNumeroOrden("V02180012", "Varonil")).not.toBe("");
  });

  it("rechaza una letra que no corresponde al grupo", () => {
    expect(validarNumeroOrden("F0218001", "Varonil")).toMatch(/V/);
    expect(validarNumeroOrden("V0218001", "Femenino")).toMatch(/F/);
  });

  it("al escribir pasa a mayúsculas y quita lo que sobra", () => {
    expect(normalizarNumeroOrden("v02-18 001x")).toBe("V0218001");
  });
});

describe("campos sueltos", () => {
  it("nombre", () => {
    expect(validarNombre("")).not.toBe("");
    expect(validarNombre("Al")).not.toBe("");
    expect(validarNombre("Juan123")).not.toBe("");
    expect(validarNombre("María José O'Brien-Ruiz")).toBe("");
  });

  it("edad", () => {
    expect(validarEdad("")).toBe("");
    expect(validarEdad("15")).toBe("");
    expect(validarEdad("2")).not.toBe("");
    expect(validarEdad("150")).not.toBe("");
  });

  it("fecha de nacimiento no puede ser futura", () => {
    const hoy = new Date(2026, 8, 21);
    expect(validarFechaNacimiento("", hoy)).toBe("");
    expect(validarFechaNacimiento("2010-05-01", hoy)).toBe("");
    expect(validarFechaNacimiento("2027-01-01", hoy)).not.toBe("");
  });
});

describe("validarElemento", () => {
  it("un formulario completo no tiene errores", () => {
    expect(validarElemento(formValido, GRADOS)).toEqual({});
  });

  it("exige unidad, nombre y grado militar", () => {
    const errores = validarElemento({ ...formValido, unidad: "", nombre: "", gradoMilitar: "" }, GRADOS);
    expect(Object.keys(errores)).toEqual(expect.arrayContaining(["unidad", "nombre", "gradoMilitar"]));
  });

  it("rechaza un grado que no está en la lista", () => {
    expect(validarElemento({ ...formValido, gradoMilitar: "General" }, GRADOS).gradoMilitar).toBeTruthy();
  });

  it("marca qué teléfono está mal", () => {
    const errores = validarElemento({ ...formValido, telefonos: ["5512345678", "123"] }, GRADOS);
    expect(errores.telefonos[0]).toBe("");
    expect(errores.telefonos[1]).toBeTruthy();
  });

  it("al crear exige contestar antecedentes y deporte; al editar no", () => {
    const sinRespuesta = { ...formValido, antecedentes: "", practicaDeporte: "" };
    expect(Object.keys(validarElemento(sinRespuesta, GRADOS, "crear"))).toEqual(
      expect.arrayContaining(["antecedentes", "practicaDeporte"])
    );
    expect(validarElemento(sinRespuesta, GRADOS, "editar")).toEqual({});
  });

  it("si contesta Sí pide el detalle", () => {
    const errores = validarElemento({ ...formValido, antecedentes: "Sí", practicaDeporte: "Sí" }, GRADOS);
    expect(errores.antecedentesDetalle).toBeTruthy();
    expect(errores.deporte).toBeTruthy();
    expect(
      validarElemento(
        { ...formValido, antecedentes: "Sí", antecedentesDetalle: "Cadetes", practicaDeporte: "Sí", deporte: "Fútbol" },
        GRADOS
      )
    ).toEqual({});
  });
});
