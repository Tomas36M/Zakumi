import { describe, expect, it } from "vitest";
import { normalizarTelefonoCO, waMeUrl } from "../telefono";

describe("normalizarTelefonoCO", () => {
  it("celular nacional de 10 dígitos → +57 y tipo móvil", () => {
    expect(normalizarTelefonoCO("310 1234567")).toEqual({
      telefono: "+573101234567",
      tipo: "movil",
    });
  });

  it("fijo de Bogotá (601) → +57 y tipo fijo", () => {
    expect(normalizarTelefonoCO("601 7430000")).toEqual({
      telefono: "+576017430000",
      tipo: "fijo",
    });
  });

  it("internacional +57 con espacios → mismo resultado que el nacional", () => {
    expect(normalizarTelefonoCO("+57 310 123 4567")).toEqual({
      telefono: "+573101234567",
      tipo: "movil",
    });
  });

  it("acepta paréntesis y guiones", () => {
    expect(normalizarTelefonoCO("(601) 743-0000")).toEqual({
      telefono: "+576017430000",
      tipo: "fijo",
    });
  });

  it("57 pegado sin + (12 dígitos) → se trata como indicativo de país", () => {
    expect(normalizarTelefonoCO("573101234567")).toEqual({
      telefono: "+573101234567",
      tipo: "movil",
    });
  });

  it("corta extensiones tipo 'ext. 12' y 'x123'", () => {
    expect(normalizarTelefonoCO("601 743 0000 ext. 12")).toEqual({
      telefono: "+576017430000",
      tipo: "fijo",
    });
    expect(normalizarTelefonoCO("6017430000 x123")).toEqual({
      telefono: "+576017430000",
      tipo: "fijo",
    });
  });

  it("número de otro país con + se conserva en E.164 con tipo desconocido", () => {
    expect(normalizarTelefonoCO("+34 91 123 4567")).toEqual({
      telefono: "+34911234567",
      tipo: "desconocido",
    });
  });

  it("vacío, null y undefined → sin teléfono", () => {
    const sinTelefono = { telefono: null, tipo: "desconocido" };
    expect(normalizarTelefonoCO("")).toEqual(sinTelefono);
    expect(normalizarTelefonoCO("   ")).toEqual(sinTelefono);
    expect(normalizarTelefonoCO(null)).toEqual(sinTelefono);
    expect(normalizarTelefonoCO(undefined)).toEqual(sinTelefono);
  });

  it("7 dígitos sin indicativo → null (no inventamos indicativo)", () => {
    expect(normalizarTelefonoCO("7430000")).toEqual({
      telefono: null,
      tipo: "desconocido",
    });
  });

  it("basura sin dígitos suficientes → null", () => {
    expect(normalizarTelefonoCO("# 5")).toEqual({
      telefono: null,
      tipo: "desconocido",
    });
  });

  it("10 dígitos que no empiezan por 3 ni 60 → +57 pero tipo desconocido", () => {
    expect(normalizarTelefonoCO("9101234567")).toEqual({
      telefono: "+579101234567",
      tipo: "desconocido",
    });
  });

  it("INVARIANTE: todo teléfono no nulo cumple el CHECK de Postgres", () => {
    const entradas = [
      "310 1234567",
      "601 7430000",
      "+57 310 123 4567",
      "(601) 743-0000",
      "573101234567",
      "+34 91 123 4567",
      "601 743 0000 ext. 12",
      "9101234567",
    ];
    for (const bruto of entradas) {
      const { telefono } = normalizarTelefonoCO(bruto);
      if (telefono !== null) {
        expect(telefono).toMatch(/^\+[1-9][0-9]{6,14}$/);
      }
    }
  });
});

describe("waMeUrl", () => {
  it("arma el enlace wa.me sin el signo +", () => {
    expect(waMeUrl("+573101234567")).toBe("https://wa.me/573101234567");
  });
});
