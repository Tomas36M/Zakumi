import { describe, expect, it } from "vitest";

import type { ProductoContratado } from "../cartera";
import { CATALOGO_ZAKUMI, mrrDeProductos, oportunidades } from "../upsell";

function producto(
  tipo: ProductoContratado["tipo"],
  extra: Partial<ProductoContratado> = {},
): ProductoContratado {
  return {
    id: `p-${tipo}`,
    cliente_id: "c-1",
    tipo,
    nombre: tipo,
    instancia_id: null,
    dominio: null,
    tarifa: 100_000,
    moneda: "COP",
    ciclo: "mensual",
    proxima_fecha: null,
    activo: true,
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

describe("oportunidades", () => {
  it("cliente sin nada: todo el catálogo menos mantenimiento (no hay web que mantener)", () => {
    const ops = oportunidades([]);
    const slugs = ops.map((o) => o.servicio.slug);
    expect(slugs).toContain("bot-whatsapp");
    expect(slugs).toContain("pagina-web");
    expect(slugs).toContain("crm");
    expect(slugs).toContain("agente-voz");
    expect(slugs).not.toContain("mantenimiento-web");
  });

  it("lo ya contratado no se vuelve a ofrecer", () => {
    const ops = oportunidades([producto("bot")]);
    expect(ops.map((o) => o.servicio.slug)).not.toContain("bot-whatsapp");
  });

  it("un producto INACTIVO sí se puede volver a vender", () => {
    const ops = oportunidades([producto("bot", { activo: false })]);
    expect(ops.map((o) => o.servicio.slug)).toContain("bot-whatsapp");
  });

  it("tiene bot sin web → la web sale con razón de siguiente paso", () => {
    const ops = oportunidades([producto("bot")]);
    const web = ops.find((o) => o.servicio.slug === "pagina-web");
    expect(web?.razon).toContain("Ya tiene bot");
  });

  it("tiene web sin mantenimiento → aparece mantenimiento con su razón", () => {
    const ops = oportunidades([producto("web")]);
    const mant = ops.find((o) => o.servicio.slug === "mantenimiento-web");
    expect(mant?.razon).toContain("web sin mantenimiento");
  });

  it("tiene bot → la voz sale como candidato natural", () => {
    const ops = oportunidades([producto("bot")]);
    const voz = ops.find((o) => o.servicio.slug === "agente-voz");
    expect(voz).toBeDefined();
    expect(voz?.servicio.disponible).toBe(true);
    expect(voz?.razon).toContain("candidato natural a voz");
  });

  it("cliente con todo: no queda nada que vender", () => {
    const ops = oportunidades([
      producto("bot"),
      producto("web"),
      producto("crm"),
      producto("voz"),
      producto("mantenimiento"),
    ]);
    expect(ops).toEqual([]);
  });

  it("ordena disponibles primero y por tarifa descendente", () => {
    const ops = oportunidades([]);
    const disponibles = ops.filter((o) => o.servicio.disponible);
    const proximamente = ops.filter((o) => !o.servicio.disponible);
    expect(ops).toEqual([...disponibles, ...proximamente]);
    const tarifas = disponibles.map((o) => o.servicio.tarifaSugerida);
    expect(tarifas).toEqual([...tarifas].toSorted((a, b) => b - a));
  });
});

describe("mrrDeProductos", () => {
  it("mensual suma directo, anual se divide entre 12, único no cuenta", () => {
    const mrr = mrrDeProductos([
      producto("bot", { tarifa: 150_000, ciclo: "mensual" }),
      producto("crm", { tarifa: 1_200_000, ciclo: "anual" }),
      producto("web", { tarifa: 900_000, ciclo: "unico" }),
    ]);
    expect(mrr).toBe(150_000 + 100_000);
  });

  it("ignora los inactivos", () => {
    expect(mrrDeProductos([producto("bot", { activo: false })])).toBe(0);
  });
});

describe("catálogo", () => {
  it("los slugs son únicos y todos los servicios tienen pitch", () => {
    const slugs = CATALOGO_ZAKUMI.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of CATALOGO_ZAKUMI) expect(s.pitch.length).toBeGreaterThan(10);
  });
});
