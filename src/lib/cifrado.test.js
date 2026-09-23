import { describe, it, expect } from "vitest";
import {
  aBase64,
  deBase64,
  cifrarTexto,
  descifrarTexto,
  crearVerificador,
  contrasenaCorrecta,
} from "./cifrado";

// Pocas iteraciones para que las pruebas sean rápidas (en la app son 600,000).
const RAPIDO = 1000;

describe("base64", () => {
  it("ida y vuelta, también con datos grandes", () => {
    const bytes = Uint8Array.from({ length: 200000 }, (_, i) => (i * 31) % 256);
    expect(deBase64(aBase64(bytes))).toEqual(bytes);
  });
});

describe("verificador de contraseña", () => {
  it("reconoce la contraseña correcta y rechaza otra", async () => {
    const v = await crearVerificador("Club2026!", RAPIDO);
    expect(await contrasenaCorrecta("Club2026!", v)).toBe(true);
    expect(await contrasenaCorrecta("club2026!", v)).toBe(false);
  });

  it("no guarda la contraseña en ninguna parte", async () => {
    const v = await crearVerificador("Club2026!", RAPIDO);
    expect(JSON.stringify(v)).not.toContain("Club2026");
  });

  it("la misma contraseña da verificadores distintos (sal aleatoria)", async () => {
    const a = await crearVerificador("Club2026!", RAPIDO);
    const b = await crearVerificador("Club2026!", RAPIDO);
    expect(a.verificador).not.toBe(b.verificador);
  });
});

describe("cifrar y descifrar", () => {
  const contenido = JSON.stringify({ nombre: "Ana Pérez", alergias: "Penicilina", n: 1 });

  it("con la contraseña correcta recupera el texto exacto", async () => {
    const sobre = await cifrarTexto(contenido, "secreta", RAPIDO);
    expect(await descifrarTexto(sobre, "secreta")).toBe(contenido);
  });

  it("el archivo cifrado no deja ver los datos", async () => {
    const sobre = await cifrarTexto(contenido, "secreta", RAPIDO);
    expect(JSON.stringify(sobre)).not.toContain("Ana");
    expect(JSON.stringify(sobre)).not.toContain("Penicilina");
  });

  it("con otra contraseña falla con un código propio", async () => {
    const sobre = await cifrarTexto(contenido, "secreta", RAPIDO);
    await expect(descifrarTexto(sobre, "otra")).rejects.toMatchObject({
      code: "contrasena-incorrecta",
    });
  });

  it("detecta un archivo alterado", async () => {
    const sobre = await cifrarTexto(contenido, "secreta", RAPIDO);
    const bytes = deBase64(sobre.datos);
    bytes[5] ^= 1;
    await expect(descifrarTexto({ ...sobre, datos: aBase64(bytes) }, "secreta")).rejects.toMatchObject(
      { code: "contrasena-incorrecta" }
    );
  });
});
