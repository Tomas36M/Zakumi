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

import { fusionarExtraccion, EXTRACCION_ZAK as ZAK } from "../zak";

describe("fusionarExtraccion", () => {
  it("añade las claves estándar que faltan", () => {
    const r = fusionarExtraccion([{ clave: "lead_nombre", tipo: "string", descripcion: "x" }], ZAK);
    expect(r.map((c) => c.clave)).toEqual(expect.arrayContaining(["cita_fecha_hora", "cita_confirmada"]));
  });

  it("NO pisa lo que Tomás escribió a mano", () => {
    const mia = { clave: "lead_nombre", tipo: "string" as const, descripcion: "MI TEXTO" };
    const r = fusionarExtraccion([mia], ZAK);
    expect(r.find((c) => c.clave === "lead_nombre")?.descripcion).toBe("MI TEXTO");
  });

  it("conserva los campos propios que no están en el estándar", () => {
    const propio = { clave: "presupuesto", tipo: "integer" as const, descripcion: "cuánto" };
    const r = fusionarExtraccion([propio], ZAK);
    expect(r.some((c) => c.clave === "presupuesto")).toBe(true);
  });

  it("es idempotente", () => {
    const una = fusionarExtraccion([], ZAK);
    expect(fusionarExtraccion(una, ZAK)).toEqual(una);
  });
});

describe("EXTRACCION_ZAK", () => {
  it("trae los campos de cita", () => {
    const claves = ZAK.map((c) => c.clave);
    expect(claves).toContain("cita_fecha_hora");
    expect(claves).toContain("cita_confirmada");
  });
});
