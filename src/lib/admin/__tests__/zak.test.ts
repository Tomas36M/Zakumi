import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Negocio } from "../negocios";
import {
  VERTICAL_GENERICO,
  VERTICALES_PROSPECCION,
  agruparPorVertical,
  avancesDeEstado,
  componentesSaludo,
  contactables,
  fueraDeVentana,
  verticalPara,
} from "../zak";
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
  it("manda el folleto del vertical como header de imagen (URL absoluta)", () => {
    const [header] = componentesSaludo(verticalPara("bakery")) as {
      type: string;
      parameters: { type: string; image: { link: string } }[];
    }[];
    expect(header.type).toBe("header");
    expect(header.parameters).toHaveLength(1);
    expect(header.parameters[0].type).toBe("image");
    expect(header.parameters[0].image.link).toMatch(
      /^https:\/\/.+\/folletos\/panaderia\.png$/,
    );
  });

  it("el genérico también lleva su folleto", () => {
    const [header] = componentesSaludo(VERTICAL_GENERICO) as {
      parameters: { image: { link: string } }[];
    }[];
    expect(header.parameters[0].image.link).toMatch(/\/folletos\/generico\.png$/);
  });

  it("cada folleto del catálogo existe en public/folletos/", () => {
    for (const v of [...VERTICALES_PROSPECCION, VERTICAL_GENERICO]) {
      const ruta = path.join(process.cwd(), "public", "folletos", v.folleto);
      expect(existsSync(ruta), `falta public/folletos/${v.folleto} (${v.slug})`).toBe(true);
    }
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

describe("verticalPara", () => {
  it("mapea las categorías reales de Google al vertical correcto", () => {
    expect(verticalPara("restaurant").slug).toBe("restaurante");
    expect(verticalPara("family restaurant").slug).toBe("restaurante");
    expect(verticalPara("bakery").slug).toBe("panaderia");
    expect(verticalPara("hardware store").slug).toBe("ferreteria");
    expect(verticalPara("building materials store").slug).toBe("ferreteria");
    expect(verticalPara("veterinary care").slug).toBe("veterinaria");
    expect(verticalPara("pharmacy").slug).toBe("farmacia");
    expect(verticalPara("beauty salon").slug).toBe("belleza");
    expect(verticalPara("car repair").slug).toBe("taller");
    expect(verticalPara("furniture store").slug).toBe("hogar");
    expect(verticalPara("home goods store").slug).toBe("hogar");
    expect(verticalPara("clothing store").slug).toBe("moda");
    expect(verticalPara("convenience store").slug).toBe("comercio");
  });

  it("lo desconocido cae al genérico (saludo_zakumi)", () => {
    expect(verticalPara("manufacturer").plantilla).toBe("saludo_zakumi");
    expect(verticalPara("bank").slug).toBe("generico");
    expect(verticalPara(null).slug).toBe("generico");
  });

  it("'comercio' no le roba el match a los específicos (orden del catálogo)", () => {
    // "hardware store" contiene "store" pero ferretería va primero.
    expect(verticalPara("hardware store").slug).toBe("ferreteria");
    expect(verticalPara("pet store").slug).toBe("veterinaria");
  });
});

describe("agruparPorVertical", () => {
  it("una tanda por plantilla, con los negocios correctos en cada una", () => {
    const grupos = agruparPorVertical([
      negocio({ id: "r1", categoria: "restaurant" }),
      negocio({ id: "f1", categoria: "hardware store" }),
      negocio({ id: "r2", categoria: "family restaurant" }),
      negocio({ id: "x1", categoria: "manufacturer" }),
    ]);
    const porSlug = new Map(grupos.map((g) => [g.vertical.slug, g.negocios.map((n) => n.id)]));
    expect(porSlug.get("restaurante")).toEqual(["r1", "r2"]);
    expect(porSlug.get("ferreteria")).toEqual(["f1"]);
    expect(porSlug.get("generico")).toEqual(["x1"]);
  });
});
