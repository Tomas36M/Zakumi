import { describe, expect, it } from "vitest";
import {
  cuentasPorTerritorio,
  filasDeTerritorio,
  poligonoValido,
  resumenDeTerritorio,
  LADO_MAX_GRADOS,
  VERTICES_MAX,
} from "../territorios";
import { PRECIO_POR_LLAMADA_USD, type Punto } from "../barrido";
import { esSinWeb, type Negocio } from "../negocios";

const CUADRADO: Punto[] = [
  { lat: 4.72, lng: -74.28 },
  { lat: 4.72, lng: -74.26 },
  { lat: 4.74, lng: -74.26 },
  { lat: 4.74, lng: -74.28 },
];

describe("poligonoValido", () => {
  it("un cuadrado sirve", () => {
    expect(poligonoValido(CUADRADO)).toBe(true);
  });

  it("menos de 3 puntos no es un área", () => {
    expect(poligonoValido(CUADRADO.slice(0, 2))).toBe(false);
  });

  it("coordenadas fuera del planeta no sirven", () => {
    expect(poligonoValido([...CUADRADO, { lat: 91, lng: 0 }])).toBe(false);
    expect(poligonoValido([...CUADRADO, { lat: 0, lng: 181 }])).toBe(false);
  });

  it("un polígono absurdamente grande no sirve: barrerlo cuesta una fortuna", () => {
    expect(
      poligonoValido([
        { lat: -4, lng: -80 },
        { lat: -4, lng: -66 },
        { lat: 12, lng: -66 },
        { lat: 12, lng: -80 },
      ]),
    ).toBe(false);
  });

  it("acepta un territorio justo por debajo del lado máximo", () => {
    const casi = [
      { lat: 4, lng: -74 },
      { lat: 4, lng: -74 + LADO_MAX_GRADOS * 0.99 },
      { lat: 4 + LADO_MAX_GRADOS * 0.99, lng: -74 + LADO_MAX_GRADOS * 0.99 },
      { lat: 4 + LADO_MAX_GRADOS * 0.99, lng: -74 },
    ];
    expect(poligonoValido(casi)).toBe(true);
  });

  it("rechaza apenas pasado el lado máximo: el umbral es el que dice ser", () => {
    const pasado = [
      { lat: 4, lng: -74 },
      { lat: 4, lng: -74 + LADO_MAX_GRADOS * 1.01 },
      { lat: 4 + LADO_MAX_GRADOS * 1.01, lng: -74 + LADO_MAX_GRADOS * 1.01 },
      { lat: 4 + LADO_MAX_GRADOS * 1.01, lng: -74 },
    ];
    expect(poligonoValido(pasado)).toBe(false);
  });

  it("rechaza un trazo con demasiados vértices: el barrido lo recorre una vez por tesela", () => {
    const muchos = Array.from({ length: VERTICES_MAX + 1 }, (_, i) => ({
      lat: 4.72 + (i % 100) * 0.0001,
      lng: -74.28 + (i % 100) * 0.0001,
    }));
    expect(poligonoValido(muchos)).toBe(false);
  });

  it("acepta justo en el tope de vértices", () => {
    const justos = Array.from({ length: VERTICES_MAX }, (_, i) => ({
      lat: 4.72 + (i % 100) * 0.0001,
      lng: -74.28 + (i % 100) * 0.0001,
    }));
    expect(poligonoValido(justos)).toBe(true);
  });
});

describe("filasDeTerritorio", () => {
  it("desnormaliza la caja envolvente junto al polígono", () => {
    expect(filasDeTerritorio(CUADRADO, "Madrid centro")).toEqual({
      nombre: "Madrid centro",
      poligono: CUADRADO,
      bbox_sur: 4.72,
      bbox_norte: 4.74,
      bbox_oeste: -74.28,
      bbox_este: -74.26,
    });
  });

  it("recorta el nombre a lo que aguanta la columna", () => {
    expect(filasDeTerritorio(CUADRADO, "x".repeat(200)).nombre).toHaveLength(120);
  });
});

// Un censo pequeño con las tres situaciones que importan: un territorio con
// leads, otro con leads y sin nada sin web, y negocios huérfanos.
const CENSO: Pick<Negocio, "territorio_id" | "sitio_web">[] = [
  { territorio_id: "t1", sitio_web: null },
  { territorio_id: "t1", sitio_web: "https://uno.co" },
  { territorio_id: "t1", sitio_web: "" },
  { territorio_id: "t2", sitio_web: "https://dos.co" },
  // Importados a mano o de un territorio ya borrado: no son de nadie.
  { territorio_id: null, sitio_web: null },
  { territorio_id: null, sitio_web: "https://tres.co" },
];

describe("cuentasPorTerritorio", () => {
  it("cuenta leads y sin web por territorio", () => {
    const cuentas = cuentasPorTerritorio(CENSO);
    expect(cuentas.get("t1")).toEqual({ leads: 3, sinWeb: 2 });
    expect(cuentas.get("t2")).toEqual({ leads: 1, sinWeb: 0 });
  });

  it("un territorio sin negocios no aparece en el mapa", () => {
    expect(cuentasPorTerritorio(CENSO).has("t3")).toBe(false);
    expect(cuentasPorTerritorio([]).size).toBe(0);
  });

  it("los negocios sin territorio no se le filtran a ninguno", () => {
    const cuentas = cuentasPorTerritorio(CENSO);
    const total = [...cuentas.values()].reduce((n, c) => n + c.leads, 0);
    // Seis negocios, dos huérfanos: si se colaran, este total sería 6.
    expect(total).toBe(4);
    expect(cuentas.has("")).toBe(false);
  });

  it("«sin web» cuenta lo mismo que el filtro de la lista de leads", () => {
    // La regresión que esta extracción existe para evitar: la lista filtra con
    // `esSinWeb` y el territorio contaba por su cuenta. Para el MISMO conjunto
    // los dos números tienen que coincidir, territorio por territorio.
    const cuentas = cuentasPorTerritorio(CENSO);
    for (const id of ["t1", "t2"]) {
      const comoLaLista = CENSO.filter(
        (n) => n.territorio_id === id && esSinWeb(n),
      ).length;
      expect(cuentas.get(id)?.sinWeb).toBe(comoLaLista);
    }
  });
});

describe("resumenDeTerritorio", () => {
  const base = { id: "t1", llamadas: 200, ultimo_barrido: "2026-08-31T15:00:00Z" };

  it("junta el censo del territorio con lo que costó barrerlo", () => {
    expect(resumenDeTerritorio(base, cuentasPorTerritorio(CENSO))).toEqual({
      leads: 3,
      sinWeb: 2,
      llamadas: 200,
      costoUsd: 200 * PRECIO_POR_LLAMADA_USD,
      barrido: true,
    });
  });

  it("un territorio sin barrer no inventa números", () => {
    const resumen = resumenDeTerritorio(
      { id: "t3", llamadas: 0, ultimo_barrido: null },
      cuentasPorTerritorio(CENSO),
    );
    expect(resumen).toEqual({
      leads: 0,
      sinWeb: 0,
      llamadas: 0,
      costoUsd: 0,
      barrido: false,
    });
  });

  it("la cuenta vacía es compartida y no se puede ensuciar", () => {
    // Dos territorios vacíos leen el MISMO objeto congelado: si alguien le
    // sumara un lead, se lo sumaría a todos los territorios vacíos del panel.
    const cuentas = cuentasPorTerritorio(CENSO);
    const a = resumenDeTerritorio({ id: "x", llamadas: 0, ultimo_barrido: null }, cuentas);
    resumenDeTerritorio({ id: "y", llamadas: 0, ultimo_barrido: null }, cuentas);
    expect(a.leads).toBe(0);
    // Y el resumen es un objeto nuevo: mutarlo no toca el mapa de cuentas.
    a.leads = 9;
    expect(cuentas.get("t1")).toEqual({ leads: 3, sinWeb: 2 });
  });
});
