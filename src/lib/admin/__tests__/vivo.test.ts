import { describe, expect, it } from "vitest";

import { mismoJson, noLeidos, sembrarVistos, type Visto } from "../vivo";

describe("noLeidos", () => {
  // 8 mensajes del cliente; el total de turnos (con los de Zak) no importa.
  const conv = {
    phone: "573001",
    messages_cliente: 8,
    ultimo_del_cliente: "2026-08-29T14:00:00+00:00",
  };

  it("sin registro de visto, todo lo del cliente está sin leer (chat nuevo)", () => {
    expect(noLeidos(conv, undefined)).toBe(8);
  });

  it("visto DESPUÉS del último mensaje del cliente → 0 (aunque el conteo esté viejo)", () => {
    const visto: Visto = { at: "2026-08-29T15:00:00Z", messages: 3 };
    expect(noLeidos(conv, visto)).toBe(0);
  });

  it("mensajes nuevos del cliente después del visto → la diferencia", () => {
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

  // El bug que llenaba la bandeja de badges: al mandar una tanda, cada chat
  // tenía UN mensaje —el saludo de Zak— y salía «1 sin leer».
  it("un chat donde solo escribió Zak no tiene nada sin leer", () => {
    expect(
      noLeidos({ phone: "573001", messages_cliente: 0, ultimo_del_cliente: null }, undefined),
    ).toBe(0);
  });

  it("un «visto» de la versión vieja (contaba los turnos de Zak) no inventa badges", () => {
    // La versión anterior guardaba el total de turnos: la resta sale negativa.
    const vistoViejo: Visto = { at: "2026-08-29T13:00:00Z", messages: 14 };
    expect(noLeidos(conv, vistoViejo)).toBe(0);
  });
});

describe("sembrarVistos", () => {
  it("la primera visita marca TODO lo existente como visto (cero ruido inicial)", () => {
    const vistos = sembrarVistos([
      { phone: "573001", messages_cliente: 8, ultimo_del_cliente: "2026-08-29T14:00:00+00:00" },
      { phone: "573002", messages_cliente: 2, ultimo_del_cliente: null },
    ]);
    expect(vistos["573001"]).toEqual({ at: "2026-08-29T14:00:00+00:00", messages: 8 });
    expect(vistos["573002"].messages).toBe(2);
    // A partir de ahí, cualquier mensaje nuevo del cliente sí cuenta.
    expect(
      noLeidos(
        { phone: "573001", messages_cliente: 9, ultimo_del_cliente: "2026-08-29T15:00:00Z" },
        vistos["573001"],
      ),
    ).toBe(1);
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
