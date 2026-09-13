import { describe, expect, it } from "vitest";
import { lineasDeResultado } from "../resultado";

describe("lineasDeResultado", () => {
  it("un error es una sola línea en rojo", () => {
    expect(lineasDeResultado({ error: "No se encontró la solicitud." })).toEqual([
      { texto: "No se encontró la solicitud.", variante: "error" },
    ]);
  });

  it("el camino feliz son dos líneas tranquilas", () => {
    const l = lineasDeResultado({ ok: true, google: "ok", aviso: "enviado", choque: false });
    expect(l).toHaveLength(2);
    expect(l.every((x) => x.variante === "aviso")).toBe(true);
  });

  it("lo que salió mal se marca en rojo y el choque añade una línea", () => {
    const l = lineasDeResultado({ ok: true, google: "fallo", aviso: "fallo", choque: true });
    expect(l).toHaveLength(3);
    expect(l[0].variante).toBe("error");
    expect(l[1].variante).toBe("error");
    expect(l[2].texto).toMatch(/choca/);
  });
});
