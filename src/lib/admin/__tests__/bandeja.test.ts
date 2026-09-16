import { describe, expect, it } from "vitest";

import { FILTROS_BANDEJA, filtrarBandeja, pasaFiltro, type FiltroBandeja } from "../bandeja";
import type { FichaNegocio } from "../zak";
import type { Visto } from "../vivo";

function conv(extra: Partial<Parameters<typeof pasaFiltro>[0]> & { phone: string }) {
  return {
    messages: 1,
    messages_cliente: 0,
    ultimo_del_cliente: null as string | null,
    last_at: "2026-09-15T22:00:00+00:00",
    humano: null,
    contestadora: false,
    ...extra,
  };
}

function ficha(estado: FichaNegocio["estado"]): FichaNegocio {
  return {
    negocioId: "n-1",
    nombre: "Negocio",
    ciudad: "Bogotá",
    categoria: "restaurant",
    estado,
    telefono: "+573001112222",
    verticalSlug: "restaurante",
    verticalLabel: "Restaurante",
  };
}

describe("pasaFiltro", () => {
  it("«todos» no recorta nada", () => {
    expect(pasaFiltro(conv({ phone: "1" }), "todos", undefined, 0)).toBe(true);
  });

  it("«sin leer» mira el contador, no el estado", () => {
    const c = conv({ phone: "1", messages_cliente: 2 });
    expect(pasaFiltro(c, "sin_leer", undefined, 2)).toBe(true);
    expect(pasaFiltro(c, "sin_leer", undefined, 0)).toBe(false);
  });

  it("«respondieron» es que escribió el cliente, aunque haya sido su máquina", () => {
    expect(pasaFiltro(conv({ phone: "1", messages_cliente: 1 }), "respondieron", undefined, 0)).toBe(true);
    // Solo habló Zak: no respondió nadie.
    expect(pasaFiltro(conv({ phone: "2" }), "respondieron", undefined, 0)).toBe(false);
  });

  it("«interesados» sale del estado del CRM, y un número suelto no pasa", () => {
    const c = conv({ phone: "1" });
    expect(pasaFiltro(c, "interesados", ficha("interesado"), 0)).toBe(true);
    expect(pasaFiltro(c, "interesados", ficha("respondido"), 0)).toBe(false);
    expect(pasaFiltro(c, "interesados", undefined, 0)).toBe(false);
  });

  it("«contestadora» deja de aplicar en cuanto escribe una persona", () => {
    expect(
      pasaFiltro(conv({ phone: "1", contestadora: true, humano: false }), "contestadora", undefined, 0),
    ).toBe(true);
    expect(
      pasaFiltro(conv({ phone: "1", contestadora: true, humano: true }), "contestadora", undefined, 0),
    ).toBe(false);
    expect(pasaFiltro(conv({ phone: "1" }), "contestadora", undefined, 0)).toBe(false);
  });

  it("los cinco filtros de la UI están cubiertos", () => {
    const valores = FILTROS_BANDEJA.map((f) => f.valor);
    expect(valores).toEqual(["todos", "sin_leer", "respondieron", "interesados", "contestadora"]);
    const c = conv({ phone: "1" });
    for (const v of valores) {
      expect(typeof pasaFiltro(c, v as FiltroBandeja, undefined, 0)).toBe("boolean");
    }
  });
});

describe("filtrarBandeja", () => {
  const lista = [
    conv({ phone: "1", messages_cliente: 0 }), // solo habló Zak
    conv({ phone: "2", messages_cliente: 2, ultimo_del_cliente: "2026-09-15T22:10:00+00:00" }),
    conv({ phone: "3", messages_cliente: 1, ultimo_del_cliente: "2026-09-15T22:20:00+00:00", contestadora: true, humano: false }),
  ];
  const fichas = { "2": ficha("interesado"), "3": ficha("contactado") };
  const vistos: Record<string, Visto> = {
    // El 2 quedó leído; el 3 no.
    "2": { at: "2026-09-15T23:00:00Z", messages: 2 },
  };

  it("conserva el orden de la bandeja", () => {
    expect(filtrarBandeja(lista, "respondieron", fichas, vistos).map((c) => c.phone)).toEqual(["2", "3"]);
  });

  it("«todos» devuelve una copia, no la misma referencia", () => {
    const r = filtrarBandeja(lista, "todos", fichas, vistos);
    expect(r).toEqual(lista);
    expect(r).not.toBe(lista);
  });

  it("«sin leer» usa el visto de cada chat", () => {
    expect(filtrarBandeja(lista, "sin_leer", fichas, vistos).map((c) => c.phone)).toEqual(["3"]);
  });

  it("«interesados» y «contestadora» recortan por su señal", () => {
    expect(filtrarBandeja(lista, "interesados", fichas, vistos).map((c) => c.phone)).toEqual(["2"]);
    expect(filtrarBandeja(lista, "contestadora", fichas, vistos).map((c) => c.phone)).toEqual(["3"]);
  });
});
