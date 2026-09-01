import { describe, expect, it } from "vitest";
import { CUOTA_GRATIS_MENSUAL, estadoDeCuota, restanteDeCuota } from "../barrido";

describe("restanteDeCuota", () => {
  it("sin consumo, queda la cuota entera", () => {
    expect(restanteDeCuota(0)).toBe(CUOTA_GRATIS_MENSUAL);
  });

  it("descuenta lo consumido", () => {
    expect(restanteDeCuota(300)).toBe(CUOTA_GRATIS_MENSUAL - 300);
  });

  it("nunca devuelve negativo: pasarse de la cuota deja cero, no deuda", () => {
    expect(restanteDeCuota(CUOTA_GRATIS_MENSUAL + 500)).toBe(0);
  });

  it("justo en el tope deja cero", () => {
    expect(restanteDeCuota(CUOTA_GRATIS_MENSUAL)).toBe(0);
  });
});

describe("estadoDeCuota", () => {
  it("no está agotada mientras quede una", () => {
    expect(estadoDeCuota(CUOTA_GRATIS_MENSUAL - 1)).toEqual({
      consumidas: CUOTA_GRATIS_MENSUAL - 1,
      restantes: 1,
      agotada: false,
    });
  });

  it("agotada exactamente en el tope", () => {
    expect(estadoDeCuota(CUOTA_GRATIS_MENSUAL).agotada).toBe(true);
  });

  it("un consumo negativo o basura se trata como cero, no rompe la pantalla", () => {
    expect(estadoDeCuota(-5).restantes).toBe(CUOTA_GRATIS_MENSUAL);
    expect(estadoDeCuota(Number.NaN).restantes).toBe(CUOTA_GRATIS_MENSUAL);
  });
});
