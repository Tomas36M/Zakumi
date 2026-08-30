import { describe, expect, it } from "vitest";
import { construirPrompt, validarSeccionesVoz, MAX_PRIMER_MENSAJE } from "../guias";
import {
  CAP_DIARIO_ZAK,
  EXTRACCION_ZAK,
  NOMBRE_AGENTE_ZAK,
  PRIMER_MENSAJE_ZAK,
  SECCIONES_ZAK,
} from "../zak";

const CLAVE = /^[a-z][a-z0-9_]{1,40}$/;

describe("la semilla de la voz de Zak", () => {
  it("las secciones pasan la validación de tamaño", () => {
    expect(validarSeccionesVoz(SECCIONES_ZAK)).toBeNull();
  });

  it("el primer mensaje cabe y se presenta como asistente virtual", () => {
    expect(PRIMER_MENSAJE_ZAK.length).toBeLessThanOrEqual(MAX_PRIMER_MENSAJE);
    expect(PRIMER_MENSAJE_ZAK.toLowerCase()).toContain("asistente virtual");
  });

  it("la extracción tiene claves válidas, sin repetir, y conserva las de lead", () => {
    const claves = EXTRACCION_ZAK.map((c) => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const c of EXTRACCION_ZAK) {
      expect(c.clave).toMatch(CLAVE);
      expect(c.descripcion.length).toBeGreaterThan(0);
      expect(c.descripcion.length).toBeLessThanOrEqual(500);
    }
    expect(claves).toEqual(expect.arrayContaining(["lead_nombre", "lead_telefono"]));
    expect(claves.length).toBeLessThanOrEqual(15);
  });

  it("el prompt final lleva el catálogo real y la dynamic variable del contacto", () => {
    const prompt = construirPrompt(NOMBRE_AGENTE_ZAK, SECCIONES_ZAK);
    expect(prompt).toContain("$150.000"); // bot de WhatsApp, precio de lista
    expect(prompt).toContain("{{nombre_contacto}}");
    expect(prompt).toContain("WhatsApp");
  });

  it("cap diario razonable para prospección", () => {
    expect(CAP_DIARIO_ZAK).toBeGreaterThan(0);
    expect(CAP_DIARIO_ZAK).toBeLessThanOrEqual(50);
  });
});
