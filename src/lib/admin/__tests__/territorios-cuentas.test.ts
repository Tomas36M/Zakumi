import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bboxDeTerritorio, cuentasTerritoriosServidor } from "../territorios";

/** Supabase falso para la RPC cuentas_por_territorio: devuelve una fila por
 * cada id pedido que tenga cuentas — como el GROUP BY real, un territorio
 * sin negocios NO aparece. `falla` hace que responda con error. */
function supabaseFalso(
  cuentas: Record<string, { total: number; sinWeb: number }>,
  falla = false,
) {
  const rpc = vi.fn((_fn: string, args: { p_ids: string[] }) =>
    Promise.resolve(
      falla
        ? { data: null, error: { message: "boom" } }
        : {
            data: args.p_ids
              .filter((id) => id in cuentas)
              .map((id) => ({ territorio_id: id, leads: cuentas[id].total, sin_web: cuentas[id].sinWeb })),
            error: null,
          },
    ),
  );
  return { cliente: { rpc } as unknown as SupabaseClient, rpc };
}

describe("cuentasTerritoriosServidor", () => {
  it("devuelve leads y sin web exactos por territorio, como objeto serializable", async () => {
    const { cliente, rpc } = supabaseFalso({ t1: { total: 71, sinWeb: 37 }, t2: { total: 4, sinWeb: 3 } });
    const cuentas = await cuentasTerritoriosServidor(cliente, [{ id: "t1" }, { id: "t2" }]);
    expect(cuentas).toEqual({ t1: { leads: 71, sinWeb: 37 }, t2: { leads: 4, sinWeb: 3 } });
    // UNA consulta agrupada para toda la página, no dos por territorio.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("cuentas_por_territorio", { p_ids: ["t1", "t2"] });
  });

  it("un territorio sin negocios cuenta cero, no falta", async () => {
    // El GROUP BY no devuelve fila para t9: la rellena cuentasDesdeFilas.
    const { cliente } = supabaseFalso({});
    const cuentas = await cuentasTerritoriosServidor(cliente, [{ id: "t9" }]);
    expect(cuentas).toEqual({ t9: { leads: 0, sinWeb: 0 } });
  });

  it("sin territorios no consulta nada", async () => {
    const { cliente, rpc } = supabaseFalso({});
    expect(await cuentasTerritoriosServidor(cliente, [])).toEqual({});
    expect(rpc).not.toHaveBeenCalled();
  });

  it("si la consulta falla devuelve null (la vista degrada con banner), no un cero que miente", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente } = supabaseFalso({}, true);
    const cuentas = await cuentasTerritoriosServidor(cliente, [{ id: "t1" }]);
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
