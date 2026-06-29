import { describe, expect, it } from "vitest";
import { STATS, CHAT_GUION, TECNOLOGIAS, HERO, CONTACTO, PROYECTOS } from "../content";
import { HERO_SLIDES } from "../content";

const allCopy = JSON.stringify([STATS, CHAT_GUION, TECNOLOGIAS, HERO, CONTACTO, PROYECTOS]);

describe("content", () => {
  it("hay exactamente 4 stats", () => {
    expect(STATS).toHaveLength(4);
  });
  it("cada slide del hero enlaza a una ruta de servicio", () => {
    expect(HERO_SLIDES.map((s) => s.href)).toEqual(["/agentes-ia", "/software", "/marca"]);
  });
  it("el guion del chat incluye cliente y agente", () => {
    expect(CHAT_GUION.some((m) => m.from === "cliente")).toBe(true);
    expect(CHAT_GUION.some((m) => m.from === "agente")).toBe(true);
  });
  it("las tecnologías incluyen los 3 modelos de IA y el núcleo web", () => {
    for (const t of ["Anthropic", "Gemini", "OpenAI", "Next.js", "React", "Postgres"]) {
      expect(TECNOLOGIAS).toContain(t);
    }
  });
  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    expect(allCopy.toLowerCase()).not.toMatch(/\bstack\b/);
  });
});
