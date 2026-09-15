import { describe, expect, it } from "vitest";
import type { Negocio } from "../negocios";
import { estadoFicha, type FichaFetch } from "../ficha-fetch";

const negocio = { id: "n1", nombre: "Panadería La Espiga" } as Negocio;
const REPOSO = { negocio: null, cargando: false, fallo: false, noExiste: false };

describe("estadoFicha", () => {
  it("modal cerrado: todo en reposo, aunque quede el último fetch en memoria", () => {
    const ultimo: FichaFetch = { leadId: "n1", negocio, fallo: false };
    expect(estadoFicha(null, ultimo)).toEqual(REPOSO);
  });

  it("abierto y sin fetch terminado: cargando", () => {
    expect(estadoFicha("n1", null)).toEqual({ ...REPOSO, cargando: true });
  });

  it("abierto con el fetch de OTRO negocio: cargando, y nunca muestra el otro", () => {
    const ultimo: FichaFetch = { leadId: "n2", negocio: { ...negocio, id: "n2" }, fallo: false };
    expect(estadoFicha("n1", ultimo)).toEqual({ ...REPOSO, cargando: true });
  });

  it("fetch terminado con el negocio: lo muestra", () => {
    expect(estadoFicha("n1", { leadId: "n1", negocio, fallo: false })).toEqual({
      ...REPOSO,
      negocio,
    });
  });

  it("fetch fallido (red, 5xx): fallo, no «ya no existe»", () => {
    expect(estadoFicha("n1", { leadId: "n1", negocio: null, fallo: true })).toEqual({
      ...REPOSO,
      fallo: true,
    });
  });

  it("fetch que respondió bien pero sin negocio (200 con null): ya no existe", () => {
    expect(estadoFicha("n1", { leadId: "n1", negocio: null, fallo: false })).toEqual({
      ...REPOSO,
      noExiste: true,
    });
  });
});
