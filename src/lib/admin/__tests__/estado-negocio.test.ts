import { describe, expect, it } from "vitest";
import { avanzarEstadoNegocio, avanzarEstadosNegocio } from "../estado-negocio";

type Filtro = [string, unknown];

/** Supabase falso: solo entiende la cadena que usa el helper
 * (`update().in()/.eq(...).eq(...).lt(...)`), y guarda cada llamada
 * completa (los campos del update + todos los filtros, en orden) para
 * poder inspeccionarla en el assert. */
function supabaseFalso(error: { message: string } | null = null) {
  const llamadas: { campos: Record<string, unknown>; filtros: Filtro[] }[] = [];
  const cliente = {
    from() {
      return {
        update(campos: Record<string, unknown>) {
          const filtros: Filtro[] = [];
          const encadenable = {
            eq(col: string, val: unknown) {
              filtros.push([col, val]);
              return encadenable;
            },
            in(col: string, val: unknown) {
              filtros.push([col, val]);
              return encadenable;
            },
            async lt(col: string, val: unknown) {
              filtros.push([col, val]);
              llamadas.push({ campos, filtros });
              return { error };
            },
          };
          return encadenable;
        },
      };
    },
  };
  return { cliente: cliente as never, llamadas };
}

describe("avanzarEstadosNegocio", () => {
  it("actualiza con el candado y el avance forward-only correctos", async () => {
    const { cliente, llamadas } = supabaseFalso();

    const r = await avanzarEstadosNegocio(cliente, ["n-1", "n-2"], "contactado");

    expect(r).toEqual({ error: null });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]!.campos).toEqual({ estado: "contactado" });
    expect(llamadas[0]!.filtros).toEqual([
      ["id", ["n-1", "n-2"]],
      ["estado_fijado_manual", false],
      ["estado", "contactado"],
    ]);
  });

  it("con una lista vacía no llama a Supabase para nada", async () => {
    const { cliente, llamadas } = supabaseFalso();

    const r = await avanzarEstadosNegocio(cliente, [], "contactado");

    expect(r).toEqual({ error: null });
    expect(llamadas).toHaveLength(0);
  });

  it("un error de Supabase se devuelve, nunca se lanza", async () => {
    const { cliente } = supabaseFalso({ message: "conexión perdida" });

    const r = await avanzarEstadosNegocio(cliente, ["n-1"], "contactado");

    expect(r).toEqual({ error: "conexión perdida" });
  });
});

describe("avanzarEstadoNegocio", () => {
  it("es azúcar de avanzarEstadosNegocio con un solo id envuelto en array", async () => {
    const { cliente, llamadas } = supabaseFalso();

    await avanzarEstadoNegocio(cliente, "n-1", "respondido");

    expect(llamadas[0]!.filtros[0]).toEqual(["id", ["n-1"]]);
  });
});
