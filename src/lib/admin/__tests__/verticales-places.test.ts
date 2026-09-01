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

  it("no confunde lo heredado de Object.prototype con una vertical", () => {
    // Con un acceso pelado por corchetes, estos nombres devolvían la función
    // heredada del prototipo. Su `.length` no es cero, así que colaba por la
    // guarda `tipos.length === 0` del handler; después JSON.stringify la
    // descartaba y Google corría una búsqueda de cercanía SIN tipos —
    // facturada— devolviendo cualquier cosa.
    for (const nombre of [
      "constructor",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "__proto__",
    ]) {
      expect(tiposDeVertical(nombre), `heredado de Object: ${nombre}`).toEqual([]);
    }
  });
});
