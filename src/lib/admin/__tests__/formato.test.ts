import { describe, expect, it } from "vitest";
import { fechaCorta, horaBogota, horaDeIso, hoyBogota } from "../formato";

describe("horaDeIso", () => {
  it("la hora de Bogotá de un ISO del bot", () => {
    expect(horaDeIso("2026-08-22T15:30:00Z")).toContain("10:30");
  });

  it("null, undefined o basura → undefined (bots viejos sin hora)", () => {
    expect(horaDeIso(null)).toBeUndefined();
    expect(horaDeIso(undefined)).toBeUndefined();
    expect(horaDeIso("no-es-fecha")).toBeUndefined();
  });
});

describe("fechaCorta", () => {
  it("devuelve vacío con null", () => {
    expect(fechaCorta(null)).toBe("");
  });

  it("devuelve el input crudo si no es fecha", () => {
    expect(fechaCorta("no-es-fecha")).toBe("no-es-fecha");
  });

  it("formatea en es-CO zona Bogotá (UTC-5)", () => {
    const r = fechaCorta("2026-08-22T15:30:00Z");
    expect(r).toContain("22");
    expect(r.toLowerCase()).toContain("ago");
    expect(r).toContain("10:30");
  });
});

describe("horaBogota", () => {
  it("convierte a hora de Bogotá", () => {
    expect(horaBogota(new Date("2026-08-22T15:30:00Z"))).toContain("10:30");
  });
});

describe("hoyBogota", () => {
  it("devuelve YYYY-MM-DD", () => {
    expect(hoyBogota()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
