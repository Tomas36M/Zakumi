// src/components/zakumi/__tests__/services.test.ts
import { describe, expect, it } from "vitest";
import { SERVICIOS, SERVICE_SLUGS } from "../services";

const all = Object.values(SERVICIOS);
const copy = JSON.stringify(all);

describe("services", () => {
  it("hay 3 servicios con los slugs correctos", () => {
    expect(SERVICE_SLUGS).toEqual(["agentes-ia", "software", "marca"]);
    expect(Object.keys(SERVICIOS).sort()).toEqual([...SERVICE_SLUGS].sort());
  });

  it("cada servicio tiene todas las secciones del rediseño, no vacías", () => {
    for (const s of all) {
      expect(s.heroMeta.length).toBe(3);
      expect(s.stats.length).toBeGreaterThanOrEqual(3);
      expect(s.incluye.length).toBeGreaterThanOrEqual(4);
      expect(s.ejemplos.length).toBeGreaterThanOrEqual(2);
      expect(s.proceso.length).toBeGreaterThanOrEqual(3);
      expect(s.tech.items.length).toBeGreaterThanOrEqual(3);
      expect(s.porQue.length).toBeGreaterThanOrEqual(3);
      expect(s.planes.length).toBeGreaterThanOrEqual(3);
      expect(s.faq.length).toBeGreaterThanOrEqual(3);
      expect(s.ctaLabel.length).toBeGreaterThan(0);
      expect(s.seo.title.length).toBeGreaterThan(0);
      expect(s.seo.description.length).toBeGreaterThan(0);
    }
  });

  it("cada servicio tiene exactamente un plan destacado", () => {
    for (const s of all) {
      expect(s.planes.filter((p) => p.destacado).length).toBe(1);
    }
  });

  it("cada servicio tiene una sección estrella con kind válido", () => {
    const kinds = new Set(["chat", "producto", "marca"]);
    for (const s of all) expect(kinds.has(s.signature.kind)).toBe(true);
  });

  it("la estrella de agentes es un chat con cliente y agente", () => {
    const sig = SERVICIOS["agentes-ia"].signature;
    expect(sig.kind).toBe("chat");
    if (sig.kind === "chat") {
      expect(sig.guion.some((m) => m.from === "cliente")).toBe(true);
      expect(sig.guion.some((m) => m.from === "agente")).toBe(true);
    }
  });

  it("solo agentes usa CTA de whatsapp y trae waMsg", () => {
    expect(SERVICIOS["agentes-ia"].ctaTipo).toBe("whatsapp");
    expect(SERVICIOS["agentes-ia"].waMsg).toBeTruthy();
    expect(SERVICIOS["software"].ctaTipo).toBe("contacto");
    expect(SERVICIOS["marca"].ctaTipo).toBe("contacto");
  });

  it("cada servicio trae su acento como hex válido y son los tres distintos", () => {
    const acentos = all.map((s) => s.accent);
    for (const a of acentos) expect(a).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(new Set(acentos).size).toBe(3);
  });

  it("cada servicio tiene manifiesto con las cuatro partes", () => {
    for (const s of all) {
      for (const parte of [s.manifiesto.line1, s.manifiesto.line2, s.manifiesto.em, s.manifiesto.line3]) {
        expect(parte.trim().length).toBeGreaterThan(0);
      }
      // `em` es una sola palabra acentuada: el componente la envuelve en <em>.
      expect(s.manifiesto.em.trim().split(/\s+/).length).toBe(1);
    }
  });

  it("todas las rutas de imagen apuntan a /work", () => {
    for (const s of all) {
      const imgs = [s.heroImg, s.incluyeImg, s.porQueImg, ...s.ejemplos.map((e) => e.img)];
      for (const img of imgs) {
        if (img) expect(img).toMatch(/^\/work\/[a-z0-9.-]+\.webp$/);
      }
    }
  });

  it("el bento de 'por qué' tiene exactamente 4 garantías (media + 2x2)", () => {
    for (const s of all) expect(s.porQue.length).toBe(4);
  });

  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    expect(copy.toLowerCase()).not.toMatch(/\bstack\b/);
  });
});
