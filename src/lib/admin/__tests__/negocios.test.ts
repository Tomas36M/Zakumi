import { describe, expect, it } from "vitest";
import { CIUDADES, ESTADOS, labelEstado } from "../negocios";
import type { EstadoNegocio } from "../negocios";

describe("ESTADOS (pipeline de venta)", () => {
  it("cubre los 6 estados en orden de pipeline", () => {
    const orden: EstadoNegocio[] = [
      "nuevo",
      "contactado",
      "respondido",
      "interesado",
      "cliente",
      "descartado",
    ];
    expect(ESTADOS.map((e) => e.valor)).toEqual(orden);
  });

  it("cada estado tiene label es-CO no vacío", () => {
    for (const e of ESTADOS) {
      expect(e.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("labelEstado", () => {
  it("traduce el enum al label humano del pipeline", () => {
    expect(labelEstado("nuevo")).toBe("Nuevo");
    expect(labelEstado("respondido")).toBe("Respondió");
    expect(labelEstado("interesado")).toBe("Interesado");
  });
});

describe("CIUDADES (zonas de prospección)", () => {
  it("son Madrid, Ubaté y Bogotá con sus tildes", () => {
    expect(CIUDADES.map((c) => c.label)).toEqual(["Madrid", "Ubaté", "Bogotá"]);
  });

  it("los centros caen en la sabana de Bogotá y el valle de Ubaté", () => {
    for (const c of CIUDADES) {
      expect(c.centro.lat).toBeGreaterThan(4);
      expect(c.centro.lat).toBeLessThan(6);
      expect(c.centro.lng).toBeGreaterThan(-75);
      expect(c.centro.lng).toBeLessThan(-73);
    }
  });

  it("cada ciudad tiene radio de búsqueda positivo", () => {
    for (const c of CIUDADES) {
      expect(c.radio).toBeGreaterThan(0);
    }
  });
});

describe("regla editorial del panel", () => {
  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    const copys = [
      ...ESTADOS.map((e) => e.label),
      ...CIUDADES.map((c) => c.label),
    ].join(" ");
    expect(copys).not.toMatch(/\bstack\b/i);
  });
});
