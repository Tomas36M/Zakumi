import { describe, expect, it } from "vitest";
import { VERTICALES_PROSPECCION } from "../zak";
import { REPERTORIO, repertorioPara } from "../zak-repertorio";

describe("repertorioPara", () => {
  it("cada vertical de nicho tiene señal y tres ganchos con texto", () => {
    for (const v of VERTICALES_PROSPECCION) {
      const r = repertorioPara(v.slug);
      expect(r, v.slug).not.toBeNull();
      expect(r!.senal.length).toBeGreaterThan(10);
      expect(r!.ganchos).toHaveLength(3);
      for (const g of r!.ganchos) expect(g.trim().length).toBeGreaterThan(5);
    }
  });

  it("el genérico no tiene repertorio: Zak pregunta primero", () => {
    expect(repertorioPara("generico")).toBeNull();
    expect(repertorioPara("no-existe")).toBeNull();
  });

  // Decisión del 15 sep: solo lo del brochure, y Zak no dice precios.
  it("ningún gancho promete redes sociales ni da precios", () => {
    for (const r of Object.values(REPERTORIO)) {
      for (const g of [r.senal, ...r.ganchos]) {
        // «precio» sí puede aparecer (responder los precios DEL negocio); lo que no va es una cifra nuestra.
        expect(g.toLowerCase()).not.toMatch(/redes|instagram|\$|\d{3}\.\d{3}/);
      }
    }
  });

  it("no hay repertorios de verticales que no existen", () => {
    const slugs = new Set(VERTICALES_PROSPECCION.map((v) => v.slug));
    for (const slug of Object.keys(REPERTORIO)) expect(slugs.has(slug), slug).toBe(true);
  });
});
