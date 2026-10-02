import { describe, it, expect } from "vitest";
import { mensajeErrorAuth, validarCredenciales } from "./autenticacion";

describe("validarCredenciales", () => {
  it("acepta un correo válido con contraseña", () => {
    expect(validarCredenciales({ correo: "ana@club.mx", contrasena: "x" })).toBe("");
  });

  it("rechaza correos mal escritos o vacíos", () => {
    for (const correo of ["", "   ", "ana", "ana@", "ana@club", "a na@club.mx"]) {
      expect(validarCredenciales({ correo, contrasena: "12345678" })).toMatch(/correo válido/);
    }
  });

  it("ignora espacios alrededor del correo", () => {
    expect(validarCredenciales({ correo: "  ana@club.mx ", contrasena: "x" })).toBe("");
  });

  it("pide la contraseña", () => {
    expect(validarCredenciales({ correo: "ana@club.mx", contrasena: "" })).toMatch(/contraseña/);
  });
});

describe("mensajeErrorAuth", () => {
  it("no distingue entre correo inexistente y contraseña incorrecta", () => {
    const a = mensajeErrorAuth({ code: "auth/user-not-found" });
    const b = mensajeErrorAuth({ code: "auth/wrong-password" });
    const c = mensajeErrorAuth({ code: "auth/invalid-credential" });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("avisa cuando no hay conexión", () => {
    expect(mensajeErrorAuth({ code: "auth/network-request-failed" })).toMatch(/conexión/);
  });

  it("no muestra nada si el usuario cancela la ventana a medias", () => {
    expect(mensajeErrorAuth({ code: "auth/cancelled-popup-request" })).toBe("");
  });

  it("da un mensaje genérico con códigos desconocidos o sin código", () => {
    expect(mensajeErrorAuth({ code: "auth/algo-raro" })).toMatch(/Inténtalo de nuevo/);
    expect(mensajeErrorAuth(new Error("boom"))).toMatch(/Inténtalo de nuevo/);
    expect(mensajeErrorAuth(undefined)).toMatch(/Inténtalo de nuevo/);
  });
});
