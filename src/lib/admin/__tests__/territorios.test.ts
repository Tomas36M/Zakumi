import { describe, expect, it } from "vitest";
import { filasDeTerritorio, poligonoValido } from "../territorios";
import type { Punto } from "../barrido";

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
