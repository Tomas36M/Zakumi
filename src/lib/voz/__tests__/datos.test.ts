import { describe, expect, it } from "vitest";
import { etiquetaDato, valorDato } from "../datos";
import { EXTRACCION_ZAK } from "../zak";

describe("etiquetaDato", () => {
  it("traduce las claves que extrae la voz de Zak", () => {
    expect(etiquetaDato("tiene_web")).toBe("Ya tiene página web");
    expect(etiquetaDato("le_hace_falta")).toBe("Le hace falta");
  });

  it("TODAS las claves estándar tienen etiqueta escrita a mano", () => {
    for (const campo of EXTRACCION_ZAK) {
      // Si alguien añade un campo a EXTRACCION_ZAK y olvida su etiqueta, el
      // fallback lo delataría aquí: saldría con guiones bajos por nombre.
      expect(etiquetaDato(campo.clave)).not.toContain("_");
    }
  });

  it("una clave escrita a mano en la ficha se limpia, no se esconde", () => {
    expect(etiquetaDato("presupuesto_estimado")).toBe("Presupuesto estimado");
    expect(etiquetaDato("")).toBe("");
  });
});

describe("valorDato", () => {
  it("los booleanos se leen como los diría una persona", () => {
    expect(valorDato(true)).toBe("Sí");
    expect(valorDato(false)).toBe("No");
  });

  it("lo demás sale tal cual", () => {
    expect(valorDato("mañana en la tarde")).toBe("mañana en la tarde");
    expect(valorDato(3)).toBe("3");
  });
});
