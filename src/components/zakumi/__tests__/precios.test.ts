import { describe, expect, it } from "vitest";
import { CATALOGO_ZAKUMI } from "@/lib/catalogo";
import {
  COMBO_DESTACADO,
  COMBOS,
  cop,
  GRUPOS,
  MENSUALIDAD_ZAK,
  PARA_EMPRESAS,
  REGLAS,
  SEO,
  TARIFAS,
} from "../precios";

describe("cop", () => {
  it("formatea pesos colombianos con punto de miles y sin decimales", () => {
    expect(cop(590_000)).toBe("$590.000");
    expect(cop(1_190_000)).toBe("$1.190.000");
    expect(cop(49_900)).toBe("$49.900");
  });
});

describe("las tarifas salen del catálogo", () => {
  it("cada producto con precio del catálogo está en la página, con el mismo precio y montaje", () => {
    for (const s of CATALOGO_ZAKUMI) {
      const t = TARIFAS.find((x) => x.slug === s.slug);
      expect(t, s.slug).toBeDefined();
      expect(t!.precio).toBe(s.tarifaSugerida);
      expect(t!.montaje).toBe(s.montaje);
      expect(t!.cadencia).toBe(s.cicloSugerido === "mensual" ? "mes" : "unico");
    }
  });

  it("los grupos son el ritmo de cobro: al mes, una vez, desde", () => {
    expect(GRUPOS.map((g) => g.cadencia)).toEqual(["mes", "unico", "desde"]);
    expect(GRUPOS[0].tarifas).toHaveLength(4);
    expect(GRUPOS[1].tarifas).toHaveLength(3);
    expect(GRUPOS[2].tarifas).toHaveLength(3);
  });

  it("los «desde» son los aprobados el 15 sep", () => {
    const desde = Object.fromEntries(GRUPOS[2].tarifas.map((t) => [t.slug, t.precio]));
    expect(desde).toEqual({ automatizacion: 890_000, identidad: 890_000, "marca-estrategia": 1_990_000 });
  });
});

describe("combos", () => {
  it("son los cuatro aprobados y hay uno destacado", () => {
    expect(COMBOS.map((c) => [c.slug, c.precio])).toEqual([
      ["plan-completo", 690_000],
      ["domicilios-propios", 890_000],
      ["agenda-llena", 690_000],
      ["tienda-y-zak", 1_590_000],
    ]);
    // El destacado del hero es para cualquier negocio, no para un nicho.
    expect(COMBO_DESTACADO.slug).toBe("plan-completo");
    expect(COMBO_DESTACADO.incluye.join(" ")).toMatch(/Landing/);
    expect(COMBO_DESTACADO.incluye.join(" ")).toMatch(/WhatsApp/);
    expect(MENSUALIDAD_ZAK).toBe(129_900);
  });

  it("donde se dice cuánto se ahorra, las piezas sueltas cuestan más que el combo", () => {
    for (const c of COMBOS) {
      if (c.sueltos !== undefined) expect(c.sueltos, c.slug).toBeGreaterThan(c.precio);
    }
    // El plan completo y Agenda ahorran $99.900 frente a landing + montaje de Zak.
    const completo = COMBOS.find((c) => c.slug === "plan-completo")!;
    expect(completo.sueltos! - completo.precio).toBe(99_900);
  });
});

describe("copy", () => {
  const textos = [
    ...TARIFAS.flatMap((t) => [t.nombre, t.desc, t.waMsg]),
    ...COMBOS.flatMap((c) => [c.nombre, c.para, c.waMsg, ...c.incluye]),
    ...PARA_EMPRESAS.flatMap((p) => [p.nombre, p.desc]),
    ...REGLAS.flatMap((r) => [r.titulo, r.desc]),
    SEO.title,
    SEO.description,
  ];

  it("cada tarifa y cada combo abren WhatsApp con su nombre", () => {
    for (const t of TARIFAS) expect(t.waMsg).toContain(t.nombre);
    for (const c of COMBOS) expect(c.waMsg).toContain(c.nombre);
    for (const m of [...TARIFAS, ...COMBOS].map((x) => x.waMsg)) expect(m.startsWith("Hola Zakumi")).toBe(true);
  });

  it("nada de «stack» ni cifras en dólares", () => {
    for (const t of textos) {
      expect(t.toLowerCase(), t).not.toContain("stack");
      expect(t, t).not.toMatch(/US\$|USD/);
    }
  });
});

describe("brochure", () => {
  it("apunta a un PDF con fecha en el nombre, dentro de /folletos/", async () => {
    const { BROCHURE } = await import("../precios");
    expect(BROCHURE).toMatch(/^\/folletos\/.+\.pdf$/);
    // La fecha en el nombre es lo que evita que el PDF de un mes quede
    // cacheado como el del siguiente (en el navegador y en WhatsApp).
    expect(BROCHURE).toMatch(/\d{4}-\d{2}/);
  });
});
