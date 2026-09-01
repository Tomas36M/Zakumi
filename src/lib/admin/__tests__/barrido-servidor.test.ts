import { describe, expect, it } from "vitest";
import { circuloDentroDelTerritorio, recortarAlArea } from "../barrido-servidor";
import type { Territorio } from "../territorios";
import type { ResultadoPlace } from "../places";

const TERRITORIO: Territorio = {
  id: "t1",
  nombre: "Madrid centro",
  poligono: [
    { lat: 4.72, lng: -74.28 },
    { lat: 4.72, lng: -74.26 },
    { lat: 4.74, lng: -74.26 },
    { lat: 4.74, lng: -74.28 },
  ],
  bbox_sur: 4.72,
  bbox_norte: 4.74,
  bbox_oeste: -74.28,
  bbox_este: -74.26,
  verticales: [],
  teselas_hechas: [],
  llamadas: 0,
  ultimo_barrido: null,
  creado_por: null,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

function resultadoEn(lat: number, lng: number): ResultadoPlace {
  return {
    placeId: `${lat},${lng}`,
    nombre: "N",
    direccion: null,
    lat,
    lng,
    categoria: null,
    rating: null,
    sitioWeb: null,
    telefono: "+573001112233",
    tipoTelefono: "movil",
    ciudad: "Madrid",
    operativo: true,
    yaImportado: false,
  };
}

describe("circuloDentroDelTerritorio", () => {
  it("acepta un círculo dentro del área", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.73, lng: -74.27 }, 400, TERRITORIO)).toBe(
      true,
    );
  });

  it("acepta un círculo sobre el borde: las teselas se desbordan por diseño", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.74, lng: -74.27 }, 400, TERRITORIO)).toBe(
      true,
    );
  });

  it("rechaza barrer Bogotá desde un territorio de Madrid", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.711, lng: -74.07 }, 400, TERRITORIO)).toBe(
      false,
    );
  });

  it("rechaza un radio fuera de rango: el endpoint no es un proxy abierto", () => {
    expect(circuloDentroDelTerritorio({ lat: 4.73, lng: -74.27 }, 49_000, TERRITORIO)).toBe(
      false,
    );
    expect(circuloDentroDelTerritorio({ lat: 4.73, lng: -74.27 }, 0, TERRITORIO)).toBe(
      false,
    );
  });
});

describe("recortarAlArea", () => {
  it("bota lo que el círculo trajo de fuera del polígono", () => {
    const dentro = resultadoEn(4.73, -74.27);
    const fuera = resultadoEn(4.75, -74.27);
    expect(recortarAlArea([dentro, fuera], TERRITORIO.poligono)).toEqual([dentro]);
  });

  it("sin resultados devuelve vacío", () => {
    expect(recortarAlArea([], TERRITORIO.poligono)).toEqual([]);
  });
});
