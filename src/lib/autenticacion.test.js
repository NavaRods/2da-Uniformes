import { describe, it, expect } from "vitest";
import {
  LARGO_MINIMO_CONTRASENA,
  mensajeErrorAuth,
  validarCredenciales,
} from "./autenticacion";

describe("validarCredenciales", () => {
  it("acepta un correo válido con contraseña (iniciar sesión)", () => {
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

  describe("al crear cuenta (con confirmación)", () => {
    const base = { correo: "ana@club.mx" };

    it("exige el largo mínimo", () => {
      const corta = "a".repeat(LARGO_MINIMO_CONTRASENA - 1);
      expect(validarCredenciales({ ...base, contrasena: corta, confirmacion: corta })).toMatch(
        new RegExp(String(LARGO_MINIMO_CONTRASENA))
      );
    });

    it("exige que coincidan", () => {
      expect(
        validarCredenciales({ ...base, contrasena: "12345678", confirmacion: "12345679" })
      ).toMatch(/no coinciden/);
    });

    it("acepta contraseñas largas que coinciden", () => {
      expect(
        validarCredenciales({ ...base, contrasena: "12345678", confirmacion: "12345678" })
      ).toBe("");
    });
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

  it("explica un correo que ya tiene cuenta", () => {
    expect(mensajeErrorAuth({ code: "auth/email-already-in-use" })).toMatch(/ya tiene cuenta/);
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
