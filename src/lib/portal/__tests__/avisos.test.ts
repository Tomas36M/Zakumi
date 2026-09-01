import { describe, expect, it } from "vitest";
import { destinatarios } from "../avisos";

describe("destinatarios", () => {
  it("parte por comas y limpia espacios", () => {
    expect(destinatarios(" 573007970810 , 573007909522 ")).toEqual([
      "573007970810",
      "573007909522",
    ]);
  });

  it("acepta el formato viejo de un solo número", () => {
    expect(destinatarios("573007970810")).toEqual(["573007970810"]);
  });

  it("descarta vacíos y duplicados", () => {
    expect(destinatarios("573007970810,,573007970810, ")).toEqual(["573007970810"]);
  });

  it("sin valor devuelve lista vacía", () => {
    expect(destinatarios(undefined)).toEqual([]);
    expect(destinatarios("")).toEqual([]);
  });
});
