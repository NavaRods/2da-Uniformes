import { describe, it, expect } from "vitest";
import {
  ROLES,
  etiquetaRol,
  requiereUnidad,
  esSuperAdmin,
  esAdmin,
  esEstadoMayor,
  veTodasLasUnidades,
  tieneUnidadFija,
  esSoloLectura,
  puedeEscribirEnUnidad,
  puedeGestionarUsuarios,
  puedeGestionarConfiguracion,
} from "./roles";

const superAdmin = { rol: "superadmin" };
const admin = { rol: "admin" };
const estadoMayor = { rol: "estado_mayor" };
const responsable = { rol: "responsable", unidad: "2a" };
const instructor = { rol: "instructor", unidad: "2a" };

describe("ROLES asignables desde la app", () => {
  it("no incluye superadmin: solo se asigna a mano en la base de datos", () => {
    expect(ROLES).not.toContain("superadmin");
    expect(ROLES).toEqual(["admin", "estado_mayor", "responsable", "instructor"]);
  });
});

describe("etiquetaRol", () => {
  it("da una etiqueta legible para cada rol, y el valor tal cual si no lo conoce", () => {
    expect(etiquetaRol("superadmin")).toBe("Super Admin");
    expect(etiquetaRol("responsable")).toBe("Responsable");
    expect(etiquetaRol("otro")).toBe("otro");
    expect(etiquetaRol(undefined)).toBe("");
  });
});

describe("requiereUnidad", () => {
  it("Responsable e Instructor sí; Super Admin, Admin y Estado Mayor no", () => {
    expect(requiereUnidad("responsable")).toBe(true);
    expect(requiereUnidad("instructor")).toBe(true);
    expect(requiereUnidad("superadmin")).toBe(false);
    expect(requiereUnidad("admin")).toBe(false);
    expect(requiereUnidad("estado_mayor")).toBe(false);
  });
});

describe("esSuperAdmin / esAdmin", () => {
  it("esSuperAdmin solo es true para superadmin", () => {
    expect(esSuperAdmin(superAdmin)).toBe(true);
    expect(esSuperAdmin(admin)).toBe(false);
    expect(esSuperAdmin(null)).toBe(false);
  });

  it("esAdmin es true para admin y superadmin, no para los demás", () => {
    expect(esAdmin(admin)).toBe(true);
    expect(esAdmin(superAdmin)).toBe(true);
    expect(esAdmin(estadoMayor)).toBe(false);
    expect(esAdmin(responsable)).toBe(false);
    expect(esAdmin(instructor)).toBe(false);
    expect(esAdmin(null)).toBe(false);
  });
});

describe("veTodasLasUnidades", () => {
  it("admin, superadmin y estado_mayor ven todas; responsable/instructor no", () => {
    expect(veTodasLasUnidades(admin)).toBe(true);
    expect(veTodasLasUnidades(superAdmin)).toBe(true);
    expect(veTodasLasUnidades(estadoMayor)).toBe(true);
    expect(veTodasLasUnidades(responsable)).toBe(false);
    expect(veTodasLasUnidades(instructor)).toBe(false);
  });
});

describe("tieneUnidadFija", () => {
  it("solo responsable e instructor", () => {
    expect(tieneUnidadFija(responsable)).toBe(true);
    expect(tieneUnidadFija(instructor)).toBe(true);
    expect(tieneUnidadFija(admin)).toBe(false);
    expect(tieneUnidadFija(estadoMayor)).toBe(false);
  });
});

describe("esSoloLectura", () => {
  it("solo estado_mayor es de solo lectura", () => {
    expect(esSoloLectura(estadoMayor)).toBe(true);
    expect(esSoloLectura(admin)).toBe(false);
    expect(esSoloLectura(responsable)).toBe(false);
  });
});

describe("puedeEscribirEnUnidad", () => {
  it("admin/superadmin pueden en cualquier Unidad", () => {
    expect(puedeEscribirEnUnidad(admin, "2a")).toBe(true);
    expect(puedeEscribirEnUnidad(superAdmin, "cualquiera")).toBe(true);
  });

  it("responsable/instructor solo en la suya", () => {
    expect(puedeEscribirEnUnidad(responsable, "2a")).toBe(true);
    expect(puedeEscribirEnUnidad(responsable, "3a")).toBe(false);
    expect(puedeEscribirEnUnidad(instructor, "2a")).toBe(true);
  });

  it("estado_mayor no puede escribir en ninguna", () => {
    expect(puedeEscribirEnUnidad(estadoMayor, "2a")).toBe(false);
  });
});

describe("puedeGestionarUsuarios / puedeGestionarConfiguracion", () => {
  it("solo admin y superadmin", () => {
    for (const fn of [puedeGestionarUsuarios, puedeGestionarConfiguracion]) {
      expect(fn(admin)).toBe(true);
      expect(fn(superAdmin)).toBe(true);
      expect(fn(estadoMayor)).toBe(false);
      expect(fn(responsable)).toBe(false);
      expect(fn(instructor)).toBe(false);
    }
  });
});
