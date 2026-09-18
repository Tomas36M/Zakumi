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
    // Bot de WhatsApp con los precios del catálogo (los del 15 sep 2026): mensualidad y montaje.
    expect(prompt).toContain("$129.900 al mes");
    expect(prompt).toContain("$199.900 de montaje");
    expect(prompt).not.toContain("$150.000");
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

describe("el guion de Zak al llamar (2026-09-12)", () => {
  it("el saludo dice en una frase qué es Zakumi y pide el nombre", () => {
    expect(PRIMER_MENSAJE_ZAK).toMatch(/estudio colombiano/i);
    expect(PRIMER_MENSAJE_ZAK).toMatch(/con quién tengo el gusto/i);
  });

  it("pregunta por el negocio antes de ofrecer, y ofrece antes de pedir la solicitud", () => {
    const g = SECCIONES_ZAK.guion;
    const pregunta = g.indexOf("Pregunta por el negocio");
    const conecta = g.indexOf("Conecta UN solo servicio");
    const solicitud = g.indexOf("propuesta o demo");
    expect(pregunta).toBeGreaterThan(-1);
    expect(pregunta).toBeLessThan(conecta);
    expect(conecta).toBeLessThan(solicitud);
  });

  it("vende también web, tienda con catálogo y pasarela de pagos, sin inventarles precio", () => {
    const negocio = SECCIONES_ZAK.negocio.toLowerCase();
    for (const s of ["página web", "tienda en línea", "catálogo de productos", "pasarela de pagos"]) {
      expect(negocio).toContain(s);
    }
    expect(negocio).toContain("a la medida");
    expect(SECCIONES_ZAK.noDecir.toLowerCase()).toContain("pasarela");
  });

  it("si piden una persona, contacta alguien del equipo — no Tomás por nombre", () => {
    expect(SECCIONES_ZAK.guion).toContain("alguien del equipo");
    expect(SECCIONES_ZAK.guion).not.toContain("Tomás");
    expect(PRIMER_MENSAJE_ZAK).not.toContain("Tomás");
  });
});

describe("la voz verifica qué TIENE el negocio (2026-09-18)", () => {
  it("el guion averigua web, bot y software antes de ofrecer nada", () => {
    const g = SECCIONES_ZAK.guion;
    const averigua = g.indexOf("TRES cosas concretas");
    const conecta = g.indexOf("Conecta UN solo servicio");
    expect(averigua).toBeGreaterThan(-1);
    expect(averigua).toBeLessThan(conecta);
    for (const cosa of ["PÁGINA WEB", "BOT", "SOFTWARE"]) {
      expect(g).toContain(cosa);
    }
  });

  it("una pregunta a la vez: el guion prohíbe soltar las tres seguidas", () => {
    expect(SECCIONES_ZAK.guion).toMatch(/no dispares las tres seguidas/i);
  });

  it("lo averiguado queda en campos, no solo en la transcripción", () => {
    const claves = ZAK.map((c) => c.clave);
    expect(claves).toEqual(
      expect.arrayContaining(["tiene_web", "tiene_bot", "tiene_software", "le_hace_falta"]),
    );
    for (const clave of ["tiene_web", "tiene_bot", "tiene_software"]) {
      expect(ZAK.find((c) => c.clave === clave)?.tipo).toBe("boolean");
    }
    expect(ZAK.find((c) => c.clave === "le_hace_falta")?.tipo).toBe("string");
  });

  it("si no se habló del tema el campo va null — nunca un false inventado", () => {
    for (const clave of ["tiene_web", "tiene_bot", "tiene_software", "le_hace_falta"]) {
      expect(ZAK.find((c) => c.clave === clave)?.descripcion).toMatch(/null/);
    }
  });

  it("llegan a la voz que YA existe por «Poner al día los campos»", () => {
    const comoEstabaAntes = ZAK.filter(
      (c) => !c.clave.startsWith("tiene_") && c.clave !== "le_hace_falta",
    );
    const r = fusionarExtraccion(comoEstabaAntes, ZAK);
    expect(r.map((c) => c.clave)).toEqual(
      expect.arrayContaining(["tiene_web", "tiene_bot", "tiene_software", "le_hace_falta"]),
    );
  });
});
