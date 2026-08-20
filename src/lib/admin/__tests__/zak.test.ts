import { describe, expect, it } from "vitest";

import type { Negocio } from "../negocios";
import { avancesDeEstado, componentesSaludo, contactables, fueraDeVentana } from "../zak";
import type { Prospecto } from "@/lib/bots/tipos";

function negocio(extra: Partial<Negocio>): Negocio {
  return {
    id: "n-1",
    nombre: "Panadería La Espiga",
    direccion: null,
    ciudad: "ubate",
    lat: 5.3,
    lng: -73.8,
    categoria: "bakery",
    rating: null,
    sitio_web: null,
    telefono: "+573101234567",
    tipo_telefono: "movil",
    google_place_id: null,
    fuente: "manual",
    estado: "nuevo",
    creado_por: null,
    created_at: "",
    updated_at: "",
    ...extra,
  } as Negocio;
}

function prospecto(extra: Partial<Prospecto>): Prospecto {
  return {
    id: 1,
    tanda_id: 1,
    telefono: "573101234567",
    negocio_id: "n-1",
    contexto: { nombre: "Panadería La Espiga" },
    estado_envio: "pendiente",
    interesado: false,
    interes_resumen: null,
    error: null,
    creado_en: "",
    actualizado_en: null,
    ...extra,
  };
}

describe("contactables", () => {
  it("exige celular real y excluye clientes y descartados", () => {
    const lista = [
      negocio({ id: "ok" }),
      negocio({ id: "sin-tel", telefono: null }),
      negocio({ id: "fijo", tipo_telefono: "fijo" }),
      negocio({ id: "cliente", estado: "cliente" }),
      negocio({ id: "descartado", estado: "descartado" }),
      negocio({ id: "ya-contactado", estado: "contactado" }),
    ];
    expect(contactables(lista).map((n) => n.id)).toEqual(["ok", "ya-contactado"]);
  });
});

describe("componentesSaludo", () => {
  it("saludo_zakumi no tiene variables: null (el bot omite components)", () => {
    expect(componentesSaludo(negocio({}))).toBeNull();
  });
});

describe("avancesDeEstado", () => {
  it("respondido avanza desde nuevo/contactado; interesado desde donde sea", () => {
    const avances = avancesDeEstado(
      [
        prospecto({ negocio_id: "a", estado_envio: "respondido" }),
        prospecto({ negocio_id: "b", estado_envio: "leido", interesado: true }),
        prospecto({ negocio_id: "c", estado_envio: "respondido", interesado: true }),
      ],
      [
        { id: "a", estado: "contactado" },
        { id: "b", estado: "nuevo" },
        { id: "c", estado: "respondido" },
      ],
    );
    expect(avances).toEqual([
      { id: "a", a: "respondido" },
      { id: "b", a: "interesado" },
      { id: "c", a: "interesado" },
    ]);
  });

  it("forward-only: no retrocede ni repite", () => {
    const avances = avancesDeEstado(
      [
        // Ya interesado en el CRM: el respondido del funnel no lo baja.
        prospecto({ negocio_id: "a", estado_envio: "respondido" }),
        // Ya interesado en ambos lados: nada que hacer.
        prospecto({ negocio_id: "b", interesado: true }),
      ],
      [
        { id: "a", estado: "interesado" },
        { id: "b", estado: "interesado" },
      ],
    );
    expect(avances).toEqual([]);
  });

  it("jamás toca cliente ni descartado, ni negocios sin prospecto", () => {
    const avances = avancesDeEstado(
      [
        prospecto({ negocio_id: "a", interesado: true }),
        prospecto({ negocio_id: "b", estado_envio: "respondido" }),
        prospecto({ negocio_id: null, estado_envio: "respondido" }),
      ],
      [
        { id: "a", estado: "cliente" },
        { id: "b", estado: "descartado" },
        { id: "sin-prospecto", estado: "nuevo" },
      ],
    );
    expect(avances).toEqual([]);
  });
});

describe("fueraDeVentana", () => {
  const ahora = Date.parse("2026-08-20T12:00:00Z");

  it("sin mensaje del cliente no hay ventana (número nuevo)", () => {
    expect(fueraDeVentana(null, ahora)).toBe(true);
  });

  it("dentro de las 24h se puede escribir libre", () => {
    expect(fueraDeVentana("2026-08-20T11:00:00Z", ahora)).toBe(false);
    expect(fueraDeVentana("2026-08-19T12:00:01Z", ahora)).toBe(false);
  });

  it("pasadas las 24h la ventana se cierra (y una fecha rota también)", () => {
    expect(fueraDeVentana("2026-08-19T11:59:00Z", ahora)).toBe(true);
    expect(fueraDeVentana("no-es-fecha", ahora)).toBe(true);
  });
});
