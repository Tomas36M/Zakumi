import { describe, expect, it } from "vitest";
import {
  PESTANAS_CHAT,
  PESTANAS_VOZ,
  PESTANA_INICIAL,
  caraDe,
  esPestanaZak,
  pestanaInicial,
  subPestanaVoz,
} from "../zak-caras";

describe("caraDe", () => {
  it("manda a la cara de chat todo lo que no lleva prefijo", () => {
    for (const t of PESTANAS_CHAT) expect(caraDe(t)).toBe("chat");
  });

  it("manda a la cara de voz lo prefijado", () => {
    for (const t of PESTANAS_VOZ) expect(caraDe(t)).toBe("voz");
  });
});

describe("esPestanaZak", () => {
  it("acepta las pestañas de las dos caras", () => {
    expect(esPestanaZak("bandeja")).toBe(true);
    expect(esPestanaZak("voz-widget")).toBe(true);
  });

  it("rechaza basura de la URL", () => {
    expect(esPestanaZak("../../etc/passwd")).toBe(false);
    expect(esPestanaZak("")).toBe(false);
    expect(esPestanaZak(undefined)).toBe(false);
    expect(esPestanaZak(null)).toBe(false);
    expect(esPestanaZak(42)).toBe(false);
    // Parece de voz pero no existe: el prefijo solo no basta.
    expect(esPestanaZak("voz-inventada")).toBe(false);
  });
});

describe("pestanaInicial", () => {
  it("respeta un deep-link válido de cualquier cara", () => {
    expect(pestanaInicial("metricas")).toBe("metricas");
    expect(pestanaInicial("voz-llamadas")).toBe("voz-llamadas");
  });

  it("cae en la bandeja ante cualquier cosa rara", () => {
    expect(pestanaInicial("no-existe")).toBe("bandeja");
    expect(pestanaInicial(undefined)).toBe("bandeja");
  });
});

describe("subPestanaVoz", () => {
  it("quita el prefijo para los componentes de voz", () => {
    expect(subPestanaVoz("voz-config")).toBe("config");
    expect(subPestanaVoz("voz-widget")).toBe("widget");
  });

  it("cubre TODAS las pestañas de voz — si se añade una, este test lo caza", () => {
    for (const t of PESTANAS_VOZ) {
      const sub = subPestanaVoz(t);
      expect(sub).not.toBe("");
      expect(sub.startsWith("voz-")).toBe(false);
    }
  });
});

describe("PESTANA_INICIAL", () => {
  it("la pestaña por defecto de cada cara pertenece a esa cara", () => {
    expect(caraDe(PESTANA_INICIAL.chat)).toBe("chat");
    expect(caraDe(PESTANA_INICIAL.voz)).toBe("voz");
  });
});
