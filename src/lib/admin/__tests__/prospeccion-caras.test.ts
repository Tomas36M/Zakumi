import { describe, expect, it } from "vitest";
import { caraDe, pestanaInicial } from "../prospeccion-caras";

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
