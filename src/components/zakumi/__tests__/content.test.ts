import { describe, expect, it } from "vitest";
import { PILARES, STATS, CHAT_GUION, TECNOLOGIAS, HERO, CRM, CONTACTO, PROYECTOS } from "../content";

const allCopy = JSON.stringify([PILARES, STATS, CHAT_GUION, TECNOLOGIAS, HERO, CRM, CONTACTO, PROYECTOS]);

describe("content", () => {
  it("hay exactamente 3 pilares y 4 stats", () => {
    expect(PILARES).toHaveLength(3);
    expect(STATS).toHaveLength(4);
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
