import { describe, expect, it } from "vitest";

import { mismoJson, noLeidos, sembrarVistos, type Visto } from "../vivo";

describe("noLeidos", () => {
  const conv = { phone: "573001", messages: 8, last_at: "2026-08-29T14:00:00+00:00" };

  it("sin registro de visto, todo el chat está sin leer (chat nuevo)", () => {
    expect(noLeidos(conv, undefined)).toBe(8);
  });

  it("visto DESPUÉS de la última actividad → 0 (aunque el conteo esté viejo)", () => {
    const visto: Visto = { at: "2026-08-29T15:00:00Z", messages: 3 };
    expect(noLeidos(conv, visto)).toBe(0);
  });

  it("actividad nueva después del visto → la diferencia de mensajes", () => {
    const visto: Visto = { at: "2026-08-29T13:00:00Z", messages: 5 };
    expect(noLeidos(conv, visto)).toBe(3);
  });

  it("tolera formatos ISO distintos (+00:00 del bot vs Z del browser)", () => {
    // Mismo instante escrito distinto: comparación por tiempo, no por string.
    const visto: Visto = { at: "2026-08-29T14:00:00Z", messages: 2 };
    expect(noLeidos(conv, visto)).toBe(0);
  });

  it("jamás negativo (chat borrado y reabierto encoge el conteo)", () => {
    const visto: Visto = { at: "2026-08-29T13:00:00Z", messages: 50 };
    expect(noLeidos(conv, visto)).toBe(0);
  });

  it("sin last_at no hay actividad que contar", () => {
    expect(noLeidos({ ...conv, last_at: null }, undefined)).toBe(0);
  });
});

describe("sembrarVistos", () => {
  it("la primera visita marca TODO lo existente como visto (cero ruido inicial)", () => {
    const vistos = sembrarVistos([
      { phone: "573001", messages: 8, last_at: "2026-08-29T14:00:00+00:00" },
      { phone: "573002", messages: 2, last_at: null },
    ]);
    expect(vistos["573001"]).toEqual({ at: "2026-08-29T14:00:00+00:00", messages: 8 });
    expect(vistos["573002"].messages).toBe(2);
    // A partir de ahí, cualquier actividad nueva sí cuenta.
    expect(noLeidos({ phone: "573001", messages: 9, last_at: "2026-08-29T15:00:00Z" }, vistos["573001"])).toBe(1);
  });
});

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
