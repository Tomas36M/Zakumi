import { describe, expect, it } from "vitest";

import { mismoJson } from "../vivo";

describe("mismoJson", () => {
  it("estructuras iguales → true (el poll no re-renderiza nada)", () => {
    const a = { messages: [{ role: "user", content: "hola", creado_en: null }], paused: false };
    const b = { messages: [{ role: "user", content: "hola", creado_en: null }], paused: false };
    expect(mismoJson(a, b)).toBe(true);
  });

  it("cualquier cambio real → false: mensaje nuevo, pausa, orden de la lista", () => {
    expect(mismoJson({ paused: false }, { paused: true })).toBe(false);
    expect(mismoJson([{ phone: "1" }, { phone: "2" }], [{ phone: "2" }, { phone: "1" }])).toBe(false);
    expect(mismoJson([], [{ phone: "1" }])).toBe(false);
  });

  it("null y vacío no son lo mismo (skeleton vs lista vacía)", () => {
    expect(mismoJson(null, [])).toBe(false);
  });
});
