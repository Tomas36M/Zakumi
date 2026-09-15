import { describe, expect, it } from "vitest";
import { acotarPagina, paginaDesdeParam, rangoDePagina, totalDePaginas } from "../paginacion";

describe("paginaDesdeParam", () => {
  it("cae a la página 1 sin parámetro", () => {
    expect(paginaDesdeParam(undefined)).toBe(1);
  });

  it("cae a la página 1 con texto que no es un número", () => {
    expect(paginaDesdeParam("abc")).toBe(1);
  });

  it("cae a la página 1 con cero", () => {
    expect(paginaDesdeParam("0")).toBe(1);
  });

  it("cae a la página 1 con un número negativo", () => {
    expect(paginaDesdeParam("-3")).toBe(1);
  });

  it("cae a la página 1 con un decimal", () => {
    expect(paginaDesdeParam("2.5")).toBe(1);
  });

  it("acepta un entero positivo válido", () => {
    expect(paginaDesdeParam("3")).toBe(3);
  });

  it("acepta un entero positivo con ceros a la izquierda", () => {
    expect(paginaDesdeParam("007")).toBe(7);
  });
});

describe("rangoDePagina", () => {
  it("la página 1 empieza en 0", () => {
    expect(rangoDePagina(1, 25)).toEqual([0, 24]);
  });

  it("la página 2 continúa donde termina la 1", () => {
    expect(rangoDePagina(2, 25)).toEqual([25, 49]);
  });

  it("funciona con un tamaño de página distinto", () => {
    expect(rangoDePagina(3, 10)).toEqual([20, 29]);
  });
});

describe("totalDePaginas", () => {
  it("una lista vacía es una página (vacía), no cero páginas", () => {
    expect(totalDePaginas(0, 50)).toBe(1);
  });

  it("una página llena justa no abre otra", () => {
    expect(totalDePaginas(50, 50)).toBe(1);
  });

  it("una fila de más abre la siguiente", () => {
    expect(totalDePaginas(51, 50)).toBe(2);
  });
});

describe("acotarPagina", () => {
  it("una página que existe se respeta", () => {
    expect(acotarPagina(2, 120, 50)).toBe(2);
  });

  it("una página más allá de la última cae a la última", () => {
    expect(acotarPagina(9, 120, 50)).toBe(3);
  });

  it("sin filas, cualquier página cae a la 1", () => {
    expect(acotarPagina(4, 0, 50)).toBe(1);
  });
});
