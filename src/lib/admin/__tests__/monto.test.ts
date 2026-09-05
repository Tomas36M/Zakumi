import { describe, expect, it } from "vitest";
import { coincideMonto, montoEscrito } from "../monto";

describe("montoEscrito", () => {
  it("lee el monto tal como lo pinta el botón (es-CO)", () => {
    expect(montoEscrito("24,50")).toBe(24.5);
  });

  it("acepta el punto como decimal: el teclado numérico del celular a veces no tiene coma", () => {
    expect(montoEscrito("24.50")).toBe(24.5);
  });

  it("tolera la moneda y los espacios que vienen pegados desde el botón", () => {
    expect(montoEscrito("US$ 24,50")).toBe(24.5);
    expect(montoEscrito(" 24 , 50 ")).toBe(24.5);
  });

  it("un solo decimal vale", () => {
    expect(montoEscrito("24,5")).toBe(24.5);
  });

  it("con los dos separadores, el último es el decimal", () => {
    expect(montoEscrito("1.234,50")).toBe(1234.5);
    expect(montoEscrito("1,234.50")).toBe(1234.5);
  });

  it("un solo separador seguido de exactamente tres cifras es de miles", () => {
    expect(montoEscrito("1.000")).toBe(1000);
    expect(montoEscrito("1,000")).toBe(1000);
  });

  it("sin separador es un entero", () => {
    expect(montoEscrito("1000")).toBe(1000);
  });

  it("vacío o sin dígitos no es un monto", () => {
    expect(montoEscrito("")).toBeNull();
    expect(montoEscrito("US$")).toBeNull();
    expect(montoEscrito("abc")).toBeNull();
  });
});

describe("coincideMonto", () => {
  it("compara centavos, no bytes: 24.50 y 24,50 son el mismo monto", () => {
    expect(coincideMonto("24.50", 24.5)).toBe(true);
    expect(coincideMonto("24,50", 24.5)).toBe(true);
  });

  it("lo que se compara es lo que rotula el botón, ya redondeado a centavos", () => {
    // 701 llamadas × US$ 0,035 = 24,535 → el botón dice US$ 24,54.
    expect(coincideMonto("24,54", 701 * 0.035)).toBe(true);
    expect(coincideMonto("24,53", 701 * 0.035)).toBe(false);
  });

  it("otro monto no coincide", () => {
    expect(coincideMonto("2450", 24.5)).toBe(false);
    expect(coincideMonto("24", 24.5)).toBe(false);
  });

  it("vacío nunca coincide, ni con cero", () => {
    expect(coincideMonto("", 0)).toBe(false);
  });
});
