import { describe, expect, it } from "vitest";
import {
  FILTRO_VACIO,
  categoriasDe,
  dominioDe,
  filtrarLeads,
  hayFiltro,
  type FiltroLeads,
} from "../filtros-leads";
import type { Negocio } from "../negocios";

function negocio(extra: Partial<Negocio>): Negocio {
  return {
    id: "n1",
    nombre: "Panadería La Espiga",
    direccion: null,
    ciudad: "Madrid",
    lat: 4.73,
    lng: -74.26,
    categoria: "bakery",
    rating: null,
    sitio_web: null,
    telefono: "+573101234567",
    tipo_telefono: "movil",
    google_place_id: null,
    territorio_id: "t1",
    fuente: "places",
    estado: "nuevo",
    creado_por: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...extra,
  };
}

const LISTA: Negocio[] = [
  negocio({ id: "a" }),
  negocio({
    id: "b",
    nombre: "El Tornillo",
    ciudad: "Ubaté",
    categoria: "hardware_store",
    sitio_web: "https://www.eltornillo.co",
    estado: "contactado",
    territorio_id: "t2",
  }),
  negocio({ id: "c", nombre: "Sin teléfono", telefono: null, tipo_telefono: "desconocido", estado: "interesado" }),
];

function con(parcial: Partial<FiltroLeads>): FiltroLeads {
  return { ...FILTRO_VACIO, ...parcial };
}

describe("filtrarLeads", () => {
  it("sin filtro devuelve todo, en el mismo orden", () => {
    expect(filtrarLeads(LISTA, FILTRO_VACIO).map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("el texto busca en el nombre sin importar mayúsculas", () => {
    expect(filtrarLeads(LISTA, con({ q: "tornillo" })).map((n) => n.id)).toEqual(["b"]);
    expect(filtrarLeads(LISTA, con({ q: "  ESPIGA " })).map((n) => n.id)).toEqual(["a"]);
  });

  it("estados: vacío es todos, varios se suman", () => {
    expect(filtrarLeads(LISTA, con({ estados: ["contactado"] })).map((n) => n.id)).toEqual(["b"]);
    expect(
      filtrarLeads(LISTA, con({ estados: ["contactado", "interesado"] })).map((n) => n.id),
    ).toEqual(["b", "c"]);
  });

  it("sin web usa la misma regla que el resto del panel (esSinWeb)", () => {
    expect(filtrarLeads(LISTA, con({ web: "sin" })).map((n) => n.id)).toEqual(["a", "c"]);
    expect(filtrarLeads(LISTA, con({ web: "con" })).map((n) => n.id)).toEqual(["b"]);
  });

  it("teléfono, ciudad, categoría y territorio", () => {
    expect(filtrarLeads(LISTA, con({ telefono: "sin" })).map((n) => n.id)).toEqual(["c"]);
    expect(filtrarLeads(LISTA, con({ telefono: "con" })).map((n) => n.id)).toEqual(["a", "b"]);
    expect(filtrarLeads(LISTA, con({ ciudad: "Ubaté" })).map((n) => n.id)).toEqual(["b"]);
    expect(filtrarLeads(LISTA, con({ categoria: "bakery" })).map((n) => n.id)).toEqual(["a", "c"]);
    expect(filtrarLeads(LISTA, con({ territorio: "t1" })).map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("los filtros se combinan con Y", () => {
    expect(
      filtrarLeads(LISTA, con({ territorio: "t1", web: "sin", telefono: "con" })).map((n) => n.id),
    ).toEqual(["a"]);
  });
});

describe("hayFiltro", () => {
  it("distingue el vacío de cualquier recorte", () => {
    expect(hayFiltro(FILTRO_VACIO)).toBe(false);
    expect(hayFiltro(con({ q: "  " }))).toBe(false);
    expect(hayFiltro(con({ estados: ["nuevo"] }))).toBe(true);
    expect(hayFiltro(con({ web: "sin" }))).toBe(true);
  });
});

describe("categoriasDe", () => {
  it("únicas, ordenadas y sin nulos", () => {
    expect(categoriasDe([...LISTA, negocio({ id: "d", categoria: null })])).toEqual([
      "bakery",
      "hardware_store",
    ]);
  });
});

describe("dominioDe", () => {
  it("deja solo el host sin www", () => {
    expect(dominioDe("https://www.eltornillo.co/tienda")).toBe("eltornillo.co");
    expect(dominioDe("no es url")).toBe("no es url");
  });
});
