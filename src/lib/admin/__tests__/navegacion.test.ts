import { describe, expect, it } from "vitest";
import { seccionActiva } from "../navegacion";

describe("seccionActiva", () => {
  it("Encontrar clientes se marca en el mapa, no en la cara de Negocios", () => {
    expect(seccionActiva("/admin/prospeccion", "/admin/prospeccion", null)).toBe(true);
    expect(seccionActiva("/admin/prospeccion", "/admin/prospeccion", "territorio")).toBe(true);
    expect(seccionActiva("/admin/prospeccion", "/admin/prospeccion", "leads")).toBe(false);
  });

  it("Negocios se marca solo en la cara Leads de Encontrar clientes", () => {
    const negocios = "/admin/prospeccion?tab=leads";
    expect(seccionActiva(negocios, "/admin/prospeccion", "leads")).toBe(true);
    expect(seccionActiva(negocios, "/admin/prospeccion", null)).toBe(false);
    expect(seccionActiva(negocios, "/admin/territorios", "leads")).toBe(false);
  });

  it("el resto se marca por ruta, también en sus páginas hijas", () => {
    expect(seccionActiva("/admin/territorios", "/admin/territorios/abc", null)).toBe(true);
    expect(seccionActiva("/admin/zak", "/admin/territorios", null)).toBe(false);
  });
});
