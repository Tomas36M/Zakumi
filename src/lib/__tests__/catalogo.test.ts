import { describe, expect, it } from "vitest";
import { servicioDelSlug, slugDeInteres, SLUG_POR_DEFINIR } from "../catalogo";

// Los precios oficiales son los del brochure y los folletos que ya circulan:
// el catálogo no puede contradecir lo que el prospecto tiene en la mano.
describe("precios oficiales del catálogo", () => {
  it("el bot de WhatsApp cobra montaje de $300.000 y $129.900 al mes", () => {
    const bot = servicioDelSlug("bot-whatsapp");
    expect(bot?.tarifaSugerida).toBe(129_900);
    expect(bot?.cicloSugerido).toBe("mensual");
    expect(bot?.montaje).toBe(300_000);
  });

  it("la página web cuesta $1.200.000 de pago único, sin montaje aparte", () => {
    const web = servicioDelSlug("pagina-web");
    expect(web?.tarifaSugerida).toBe(1_200_000);
    expect(web?.cicloSugerido).toBe("unico");
    expect(web?.montaje).toBeUndefined();
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

  // 'mantenimiento web' contiene 'web': el orden de las reglas importa.
  it("no confunde mantenimiento con página web", () => {
    expect(slugDeInteres("mantenimiento web")).toBe("mantenimiento-web");
  });
});
