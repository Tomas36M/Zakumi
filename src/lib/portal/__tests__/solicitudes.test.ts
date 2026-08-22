import { describe, expect, it } from "vitest";

import {
  ESTADOS_EN_CURSO,
  ESTADOS_SOLICITUD,
  esTerminal,
  labelEstado,
  puedeTransicionar,
  type EstadoSolicitud,
} from "../solicitudes";

describe("puedeTransicionar", () => {
  it("recorre el camino feliz completo", () => {
    expect(puedeTransicionar("nueva", "cotizada")).toBe(true);
    expect(puedeTransicionar("cotizada", "link_enviado")).toBe(true);
    expect(puedeTransicionar("link_enviado", "pagada")).toBe(true);
    expect(puedeTransicionar("pagada", "activa")).toBe(true);
  });

  it("permite el paso único del admin: link_enviado → activa", () => {
    expect(puedeTransicionar("link_enviado", "activa")).toBe(true);
  });

  it("no permite saltarse la cotización", () => {
    expect(puedeTransicionar("nueva", "link_enviado")).toBe(false);
    expect(puedeTransicionar("nueva", "activa")).toBe(false);
    expect(puedeTransicionar("cotizada", "activa")).toBe(false);
  });

  it("no permite retroceder", () => {
    expect(puedeTransicionar("cotizada", "nueva")).toBe(false);
    expect(puedeTransicionar("pagada", "link_enviado")).toBe(false);
  });

  it("rechazada es alcanzable desde todo estado no terminal y solo desde ahí", () => {
    for (const { valor } of ESTADOS_SOLICITUD) {
      expect(puedeTransicionar(valor, "rechazada")).toBe(!esTerminal(valor));
    }
  });

  it("los terminales no salen a ningún lado", () => {
    for (const destino of ESTADOS_SOLICITUD.map((e) => e.valor)) {
      expect(puedeTransicionar("activa", destino)).toBe(false);
      expect(puedeTransicionar("rechazada", destino)).toBe(false);
    }
  });
});

describe("esTerminal / estados en curso", () => {
  it("solo activa y rechazada son terminales", () => {
    const terminales = ESTADOS_SOLICITUD.filter((e) => esTerminal(e.valor)).map(
      (e) => e.valor,
    );
    expect(terminales).toEqual(["activa", "rechazada"]);
  });

  it("en curso = todos los no terminales", () => {
    const noTerminales = ESTADOS_SOLICITUD.filter((e) => !esTerminal(e.valor)).map(
      (e) => e.valor,
    );
    expect([...ESTADOS_EN_CURSO]).toEqual(noTerminales);
  });
});

describe("labelEstado", () => {
  it("todo estado tiene label propio", () => {
    for (const { valor, label } of ESTADOS_SOLICITUD) {
      expect(labelEstado(valor)).toBe(label);
      expect(label).not.toBe(valor as string);
    }
  });

  it("un estado desconocido cae al literal (defensa)", () => {
    expect(labelEstado("otra_cosa" as EstadoSolicitud)).toBe("otra_cosa");
  });
});
