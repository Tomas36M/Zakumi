import { describe, expect, it } from "vitest";
import { VERTICALES_PROSPECCION } from "../zak";
import { TIPOS_POR_VERTICAL, tiposDeVertical } from "../verticales-places";

describe("TIPOS_POR_VERTICAL", () => {
  it("toda vertical del catálogo tiene al menos un tipo de Google", () => {
    for (const v of VERTICALES_PROSPECCION) {
      expect(tiposDeVertical(v.slug), `vertical sin tipos: ${v.slug}`).not.toHaveLength(0);
    }
  });

  it("no inventa verticales que el catálogo no tenga", () => {
    const slugs = new Set(VERTICALES_PROSPECCION.map((v) => v.slug));
    for (const slug of Object.keys(TIPOS_POR_VERTICAL)) {
      expect(slugs.has(slug), `vertical fantasma: ${slug}`).toBe(true);
    }
  });

  it("los tipos son identificadores de Google, no prosa", () => {
    for (const tipos of Object.values(TIPOS_POR_VERTICAL)) {
      for (const t of tipos) {
        expect(t, `tipo mal formado: ${t}`).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("una vertical desconocida devuelve vacío en vez de romper el barrido", () => {
    expect(tiposDeVertical("no-existe")).toEqual([]);
  });
});
