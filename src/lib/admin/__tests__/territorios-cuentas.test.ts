import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bboxDeTerritorio, cuentasTerritoriosServidor } from "../territorios";

/** Supabase falso para conteos `head`: `eq()` responde el total y `.is()` el
 * de sin web. `falla` hace que todo responda con error. */
function supabaseFalso(
  cuentas: Record<string, { total: number; sinWeb: number }>,
  falla = false,
): SupabaseClient {
  const respuesta = (n: number) =>
    falla ? { count: null, error: { message: "boom" } } : { count: n, error: null };
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) =>
          Object.assign(Promise.resolve(respuesta(cuentas[id]?.total ?? 0)), {
            is: () => Promise.resolve(respuesta(cuentas[id]?.sinWeb ?? 0)),
          }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("cuentasTerritoriosServidor", () => {
  it("devuelve leads y sin web exactos por territorio, como objeto serializable", async () => {
    const cuentas = await cuentasTerritoriosServidor(
      supabaseFalso({ t1: { total: 71, sinWeb: 37 }, t2: { total: 4, sinWeb: 3 } }),
      [{ id: "t1" }, { id: "t2" }],
    );
    expect(cuentas).toEqual({ t1: { leads: 71, sinWeb: 37 }, t2: { leads: 4, sinWeb: 3 } });
  });

  it("un territorio sin negocios cuenta cero, no falta", async () => {
    const cuentas = await cuentasTerritoriosServidor(supabaseFalso({}), [{ id: "t9" }]);
    expect(cuentas).toEqual({ t9: { leads: 0, sinWeb: 0 } });
  });

  it("sin territorios no consulta nada", async () => {
    expect(await cuentasTerritoriosServidor(supabaseFalso({}), [])).toEqual({});
  });

  it("si una consulta falla devuelve null (la vista degrada con banner), no un cero que miente", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const cuentas = await cuentasTerritoriosServidor(supabaseFalso({}, true), [{ id: "t1" }]);
    expect(cuentas).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("bboxDeTerritorio", () => {
  it("traduce las cuatro columnas al literal que entiende fitBounds", () => {
    expect(
      bboxDeTerritorio({ bbox_sur: 4.7, bbox_norte: 4.75, bbox_oeste: -74.3, bbox_este: -74.25 }),
    ).toEqual({ south: 4.7, north: 4.75, west: -74.3, east: -74.25 });
  });
});
