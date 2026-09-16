import { describe, expect, it } from "vitest";
import type { Negocio } from "../negocios";
import { estadoFicha, fichaConLista, type FichaFetch } from "../ficha-fetch";

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

describe("fichaConLista", () => {
  it("el lead está en la lista cargada: esa fila manda, sin esperar ningún fetch", () => {
    expect(fichaConLista("n1", negocio, null)).toEqual({ ...REPOSO, negocio });
  });

  it("la lista manda aunque haya un fetch viejo del mismo id", () => {
    const viejo = { ...negocio, nombre: "Nombre viejo" };
    expect(fichaConLista("n1", negocio, { leadId: "n1", negocio: viejo, fallo: false })).toEqual({
      ...REPOSO,
      negocio,
    });
  });

  it("no está en la lista: cargando mientras llega el fetch por id", () => {
    expect(fichaConLista("n1", null, null)).toEqual({ ...REPOSO, cargando: true });
  });

  it("una fila de la lista con OTRO id no se muestra nunca", () => {
    expect(fichaConLista("n1", { ...negocio, id: "n2" }, null)).toEqual({ ...REPOSO, cargando: true });
  });

  it("modal cerrado: reposo", () => {
    expect(fichaConLista(null, negocio, null)).toEqual(REPOSO);
  });

  it("el lead salió de la lista con la ficha abierta: sigue la última fila vista mientras llega el fetch", () => {
    // Un refresh empuja el lead más allá del tope: sin esto, la ficha volvía al
    // esqueleto y desmontaba el formulario con lo que se estaba escribiendo.
    expect(fichaConLista("n1", null, null, negocio)).toEqual({ ...REPOSO, negocio });
  });

  it("cuando llega el fetch por id, manda el fetch sobre la última fila vista", () => {
    const fresco = { ...negocio, nombre: "Panadería La Espiga 2" };
    expect(fichaConLista("n1", null, { leadId: "n1", negocio: fresco, fallo: false }, negocio)).toEqual({
      ...REPOSO,
      negocio: fresco,
    });
  });

  it("la última fila vista de OTRO lead no se muestra", () => {
    expect(fichaConLista("n1", null, null, { ...negocio, id: "n2" })).toEqual({ ...REPOSO, cargando: true });
  });
});
