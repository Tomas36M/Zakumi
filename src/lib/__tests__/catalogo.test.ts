import { describe, expect, it } from "vitest";
import { servicioDelSlug, slugDeInteres, SLUG_POR_DEFINIR } from "../catalogo";

// Los precios oficiales son los aprobados el 15 sep 2026 para PyMEs (spec
// 2026-09-15-zak-vendedor § 4.10): brochure nuevo y página de precios dicen lo
// mismo que esto. Zak no los dice en el chat.
describe("precios oficiales del catálogo", () => {
  it("el bot de WhatsApp cobra montaje de $199.900 y $129.900 al mes", () => {
    const bot = servicioDelSlug("bot-whatsapp");
    expect(bot?.tarifaSugerida).toBe(129_900);
    expect(bot?.cicloSugerido).toBe("mensual");
    expect(bot?.montaje).toBe(199_900);
  });

  it("landing $590.000, página web $1.190.000 y tienda online $1.490.000, pago único", () => {
    expect(servicioDelSlug("landing")?.tarifaSugerida).toBe(590_000);
    expect(servicioDelSlug("landing")?.cicloSugerido).toBe("unico");
    expect(servicioDelSlug("pagina-web")?.tarifaSugerida).toBe(1_190_000);
    expect(servicioDelSlug("pagina-web")?.montaje).toBeUndefined();
    expect(servicioDelSlug("tienda-online")?.tarifaSugerida).toBe(1_490_000);
    expect(servicioDelSlug("tienda-online")?.tipo).toBe("web");
  });

  it("mantenimiento $49.900, CRM $99.900 y voz $249.900 + $199.900 de montaje", () => {
    expect(servicioDelSlug("mantenimiento-web")?.tarifaSugerida).toBe(49_900);
    expect(servicioDelSlug("crm")?.tarifaSugerida).toBe(99_900);
    expect(servicioDelSlug("agente-voz")?.tarifaSugerida).toBe(249_900);
    expect(servicioDelSlug("agente-voz")?.montaje).toBe(199_900);
  });
});

describe("slugDeInteres", () => {
  it("reconoce lo que el agente dice tal cual", () => {
    expect(slugDeInteres("bot de WhatsApp")).toBe("bot-whatsapp");
    expect(slugDeInteres("Página web")).toBe("pagina-web");
    expect(slugDeInteres("mantenimiento")).toBe("mantenimiento-web");
    expect(slugDeInteres("CRM")).toBe("crm");
    expect(slugDeInteres("agente de voz")).toBe("agente-voz");
  });

  it("ignora tildes y mayúsculas", () => {
    expect(slugDeInteres("PAGINA WEB")).toBe("pagina-web");
    expect(slugDeInteres("whatsapp")).toBe("bot-whatsapp");
  });

  it("acepta el slug exacto", () => {
    expect(slugDeInteres("bot-whatsapp")).toBe("bot-whatsapp");
  });

  it("cae en 'por-definir' cuando no reconoce nada", () => {
    expect(slugDeInteres("algo raro")).toBe(SLUG_POR_DEFINIR);
    expect(slugDeInteres(null)).toBe(SLUG_POR_DEFINIR);
    expect(slugDeInteres("")).toBe(SLUG_POR_DEFINIR);
  });

  it("reconoce los productos nuevos antes que página web", () => {
    expect(slugDeInteres("menú con QR para el restaurante")).toBe("landing");
    expect(slugDeInteres("una landing")).toBe("landing");
    expect(slugDeInteres("tienda online con pagos")).toBe("tienda-online");
    expect(slugDeInteres("carrito de compras")).toBe("tienda-online");
    expect(slugDeInteres("página web")).toBe("pagina-web");
  });

  // 'mantenimiento web' contiene 'web': el orden de las reglas importa.
  it("no confunde mantenimiento con página web", () => {
    expect(slugDeInteres("mantenimiento web")).toBe("mantenimiento-web");
  });
});
