import { describe, expect, it } from "vitest";
import { METROS_POR_GRADO_LAT } from "../barrido";
import {
  circuloDentroDelTerritorio,
  esErrorDeMigracion,
  filaDeConsultaSinAnotar,
  recortarAlArea,
} from "../barrido-servidor";
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
  teselas_saturadas: [],
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

  it("rechaza un centro justo más allá del margen bbox+radio en longitud", () => {
    // El margen de longitud se escala por cos(lat) — este test es el único
    // que ejercita esa cuenta del lado que rechaza, no solo del que acepta.
    const radio = 400;
    const lat = TERRITORIO.bbox_norte;
    const margenLng =
      radio / (METROS_POR_GRADO_LAT * Math.cos((lat * Math.PI) / 180));
    const justoEnElMargen = { lat, lng: TERRITORIO.bbox_este + margenLng };
    const unPocoMasAlla = { lat, lng: TERRITORIO.bbox_este + margenLng + 1e-6 };
    expect(circuloDentroDelTerritorio(justoEnElMargen, radio, TERRITORIO)).toBe(true);
    expect(circuloDentroDelTerritorio(unPocoMasAlla, radio, TERRITORIO)).toBe(false);
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

describe("esErrorDeMigracion", () => {
  it("PGRST202 es la firma del RPC que no existe: el SQL no se corrió antes del deploy", () => {
    expect(
      esErrorDeMigracion({ code: "PGRST202", message: "Could not find the function" }),
    ).toBe(true);
  });

  it("cualquier otro error del RPC no lo es", () => {
    expect(esErrorDeMigracion({ code: "P0002", message: "territorio no existe" })).toBe(false);
    expect(esErrorDeMigracion({ code: undefined, message: "x" })).toBe(false);
  });

  it("sin error no hay migración que falte", () => {
    expect(esErrorDeMigracion(null)).toBe(false);
  });
});

describe("filaDeConsultaSinAnotar", () => {
  it("registra el cobro de una tesela que NO se pudo anotar como hecha", () => {
    expect(filaDeConsultaSinAnotar("t1", "k#ferreteria", "ferreteria", 7)).toEqual({
      territorio_id: "t1",
      clave: "k#ferreteria",
      vertical: "ferreteria",
      resultados: 7,
      insertados: null,
      origen: "barrido",
    });
  });

  it("cuando Google respondió ilegible no se sabe cuántos resultados hubo", () => {
    expect(filaDeConsultaSinAnotar("t1", "k", "v", null).resultados).toBeNull();
  });
});
