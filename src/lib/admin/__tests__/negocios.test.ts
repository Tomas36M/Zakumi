import { describe, expect, it } from "vitest";
import { ciudadesDe, estadoCenso, ESTADOS, labelEstado, TOPE_LEADS } from "../negocios";
import type { EstadoNegocio, Negocio } from "../negocios";

function negocioCon(ciudad: string | null): Negocio {
  return {
    id: crypto.randomUUID(),
    nombre: "N",
    direccion: null,
    ciudad,
    lat: 4.7,
    lng: -74.2,
    categoria: null,
    rating: null,
    sitio_web: null,
    telefono: null,
    tipo_telefono: "desconocido",
    google_place_id: null,
    fuente: "manual",
    estado: "nuevo",
    territorio_id: null,
    creado_por: null,
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
}

describe("ESTADOS (pipeline de venta)", () => {
  it("cubre los 6 estados en orden de pipeline", () => {
    const orden: EstadoNegocio[] = [
      "nuevo",
      "contactado",
      "respondido",
      "interesado",
      "cliente",
      "descartado",
    ];
    expect(ESTADOS.map((e) => e.valor)).toEqual(orden);
  });

  it("cada estado tiene label es-CO no vacío", () => {
    for (const e of ESTADOS) {
      expect(e.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("labelEstado", () => {
  it("traduce el enum al label humano del pipeline", () => {
    expect(labelEstado("nuevo")).toBe("Nuevo");
    expect(labelEstado("respondido")).toBe("Respondió");
    expect(labelEstado("interesado")).toBe("Interesado");
  });
});

describe("ciudadesDe", () => {
  it("saca las ciudades presentes, sin repetir y ordenadas", () => {
    expect(
      ciudadesDe([negocioCon("Ubaté"), negocioCon("Madrid"), negocioCon("Ubaté")]),
    ).toEqual(["Madrid", "Ubaté"]);
  });

  it("ignora los negocios sin ciudad en vez de meter un hueco en el filtro", () => {
    expect(ciudadesDe([negocioCon(null), negocioCon("Madrid")])).toEqual(["Madrid"]);
  });

  it("sin negocios, sin ciudades", () => {
    expect(ciudadesDe([])).toEqual([]);
  });
});

describe("estadoCenso", () => {
  it("completo: la cuenta exacta coincide con lo cargado", () => {
    expect(estadoCenso(50, 50)).toEqual({ tipo: "completo" });
  });

  it("recortado: la cuenta exacta confirma que faltan filas, y dice cuántas hay", () => {
    expect(estadoCenso(900, 4312)).toEqual({ tipo: "recortado", total: 4312 });
  });

  it("recortado_sin_conteo: la cuenta falló (null) pero la lista llegó al tope", () => {
    expect(estadoCenso(TOPE_LEADS, null)).toEqual({ tipo: "recortado_sin_conteo" });
  });

  it("completo: la cuenta falló (null) pero la lista NO llegó al tope — no hay tope que la haya mordido", () => {
    expect(estadoCenso(TOPE_LEADS - 1, null)).toEqual({ tipo: "completo" });
  });

  it("REGRESIÓN: un `null > n` silencioso no puede volver a colarse como 'completo'", () => {
    // Este es exactamente el hueco del hallazgo: negociosTotal null Y la lista
    // en su tope. Antes del fix, `null > n` es `false` y no había ninguna
    // señal de recorte.
    const resultado = estadoCenso(TOPE_LEADS, null);
    expect(resultado.tipo).not.toBe("completo");
  });
});

describe("regla editorial del panel", () => {
  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    const copys = ESTADOS.map((e) => e.label).join(" ");
    expect(copys).not.toMatch(/\bstack\b/i);
  });
});
