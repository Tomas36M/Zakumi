import { describe, expect, it } from "vitest";
import { slugDeInteres, SLUG_POR_DEFINIR } from "../catalogo";

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
