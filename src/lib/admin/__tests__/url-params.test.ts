import { describe, expect, it } from "vitest";
import { conParametro } from "../url-params";

describe("conParametro", () => {
  it("añade la clave a una búsqueda vacía, con o sin signo de interrogación", () => {
    expect(conParametro("", "tab", "leads")).toBe("?tab=leads");
    expect(conParametro("?", "tab", "leads")).toBe("?tab=leads");
  });

  it("preserva los demás parámetros al poner uno", () => {
    expect(conParametro("?telefono=573001112233&tab=bandeja", "tab", "tandas")).toBe(
      "?telefono=573001112233&tab=tandas",
    );
  });

  it("quita la clave con null o vacío y deja el resto", () => {
    expect(conParametro("?tab=leads&lead=abc", "lead", null)).toBe("?tab=leads");
    expect(conParametro("?tab=leads&lead=abc", "lead", "")).toBe("?tab=leads");
  });

  it("devuelve cadena vacía cuando no queda nada", () => {
    expect(conParametro("?lead=abc", "lead", null)).toBe("");
  });

  it("escapa valores raros para que no rompan la URL", () => {
    const s = conParametro("", "q", "a b&c=d");
    expect(new URLSearchParams(s).get("q")).toBe("a b&c=d");
  });
});
