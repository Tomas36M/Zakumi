import { describe, expect, it } from "vitest";
import { caraDe, cifrasCabecera, pestanaInicial } from "../prospeccion-caras";

describe("caraDe", () => {
  it("sin tab, abre en Territorio: el mapa es la puerta", () => {
    expect(caraDe(null)).toBe("territorio");
    expect(caraDe(undefined)).toBe("territorio");
    expect(caraDe("")).toBe("territorio");
  });

  it("un tab de leads abre la cara de leads", () => {
    expect(caraDe("leads")).toBe("leads");
    expect(caraDe("leads-lista")).toBe("leads");
  });

  it("un tab de territorio abre la cara de territorio", () => {
    expect(caraDe("territorio")).toBe("territorio");
    expect(caraDe("territorio-mapa")).toBe("territorio");
  });

  it("un tab desconocido no rompe: cae a territorio", () => {
    expect(caraDe("cualquier-cosa")).toBe("territorio");
  });
});

describe("pestanaInicial", () => {
  it("cada cara tiene su pestaña de entrada", () => {
    expect(pestanaInicial("territorio")).toBe("territorio");
    expect(pestanaInicial("leads")).toBe("leads");
  });

  it("la pestaña inicial de una cara vuelve a esa misma cara", () => {
    for (const cara of ["territorio", "leads"] as const) {
      expect(caraDe(pestanaInicial(cara))).toBe(cara);
    }
  });
});

describe("cifrasCabecera", () => {
  const BASE = {
    cargados: 900,
    sinWebCargados: 300,
    total: 2400,
    sinWebTotal: 610,
    fallaCargados: false,
  };

  it("con las cuentas de la base, las cifras son exactas aunque el mapa venga topado", () => {
    expect(cifrasCabecera(BASE)).toEqual({
      leads: { n: 2400, mas: false },
      sinWeb: { n: 610, mas: false },
    });
  });

  it("sin cuentas y con la lista en el tope: un piso («900+»), no un total", () => {
    expect(cifrasCabecera({ ...BASE, total: null, sinWebTotal: null })).toEqual({
      leads: { n: 900, mas: true },
      sinWeb: { n: 300, mas: true },
    });
  });

  it("sin cuentas pero con la lista completa: lo cargado es el total", () => {
    expect(
      cifrasCabecera({ ...BASE, cargados: 120, sinWebCargados: 40, total: null, sinWebTotal: null }),
    ).toEqual({ leads: { n: 120, mas: false }, sinWeb: { n: 40, mas: false } });
  });

  it("falla solo la cuenta de sin web con la lista recortada: piso de lo cargado", () => {
    expect(cifrasCabecera({ ...BASE, sinWebTotal: null })).toEqual({
      leads: { n: 2400, mas: false },
      sinWeb: { n: 300, mas: true },
    });
  });

  it("sin lista y sin cuentas no hay cifra: nunca un cero inventado", () => {
    expect(
      cifrasCabecera({ cargados: 0, sinWebCargados: 0, total: null, sinWebTotal: null, fallaCargados: true }),
    ).toEqual({ leads: null, sinWeb: null });
  });
});
