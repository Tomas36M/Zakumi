import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pago } from "../cartera";
import type { Nota } from "../negocios";
import { notasDeNegocio, pagosRecientesDeCliente } from "../fichas-servidor";

type Respuesta = { data: unknown; error: { message: string } | null };
type Llamada = { tabla: string; metodo: string; args: unknown[] };

const METODOS = ["select", "eq", "in", "order", "limit"] as const;

/**
 * Supabase falso: `from(tabla)` devuelve un eslabón encadenable que anota
 * cada llamada (select, eq, in, order, limit) y que, al esperarlo, resuelve
 * lo configurado para esa tabla. Una tabla SIN respuesta configurada
 * responde con error: si el código la consulta cuando no debía, el test lo
 * ve en el resultado y en `llamadas`.
 */
function supabaseFalso(respuestas: Partial<Record<string, Respuesta>>) {
  const llamadas: Llamada[] = [];
  const cliente = {
    from(tabla: string): unknown {
      const respuesta: Respuesta = respuestas[tabla] ?? {
        data: null,
        error: { message: `consulta inesperada a ${tabla}` },
      };
      const eslabon = (): unknown =>
        Object.assign(
          Promise.resolve(respuesta),
          Object.fromEntries(
            METODOS.map(
              (metodo) =>
                [
                  metodo,
                  (...args: unknown[]) => {
                    llamadas.push({ tabla, metodo, args });
                    return eslabon();
                  },
                ] as const,
            ),
          ),
        );
      return eslabon();
    },
  };
  return { cliente: cliente as unknown as SupabaseClient, llamadas };
}

/** Las llamadas hechas sobre una tabla, como [método, ...args]. */
function deTabla(llamadas: Llamada[], tabla: string): unknown[][] {
  return llamadas.filter((l) => l.tabla === tabla).map((l) => [l.metodo, ...l.args]);
}

function nota(extra: Partial<Nota> = {}): Nota {
  return {
    id: "nt1",
    negocio_id: "n1",
    texto: "Llamé, no contestó",
    automatica: false,
    autor: null,
    created_at: "2026-09-14T15:00:00Z",
    ...extra,
  };
}

function pago(extra: Partial<Pago> = {}): Pago {
  return {
    id: "pg1",
    producto_id: "p1",
    fecha: "2026-09-01",
    monto: 150000,
    moneda: "COP",
    nota: null,
    registrado_por: null,
    created_at: "2026-09-01T12:00:00Z",
    ...extra,
  };
}

describe("notasDeNegocio", () => {
  it("trae las notas del negocio, las más nuevas primero", async () => {
    const filas = [nota({ id: "nt2" }), nota()];
    const { cliente, llamadas } = supabaseFalso({ notas: { data: filas, error: null } });

    expect(await notasDeNegocio(cliente, "n1")).toEqual(filas);
    expect(deTabla(llamadas, "notas")).toEqual([
      ["select", "*"],
      ["eq", "negocio_id", "n1"],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("si la consulta falla devuelve null (la ficha avisa), no una lista vacía que miente", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente } = supabaseFalso({ notas: { data: null, error: { message: "boom" } } });

    expect(await notasDeNegocio(cliente, "n1")).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("pagosRecientesDeCliente", () => {
  it("trae los últimos 20 pagos de TODOS los productos del cliente, los más recientes primero", async () => {
    const filas = [pago({ id: "pg2", producto_id: "p2" }), pago()];
    const { cliente, llamadas } = supabaseFalso({
      productos_contratados: { data: [{ id: "p1" }, { id: "p2" }], error: null },
      pagos: { data: filas, error: null },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toEqual(filas);
    // Los productos salen del cliente EN EL SERVIDOR, no de ids del navegador.
    expect(deTabla(llamadas, "productos_contratados")).toEqual([
      ["select", "id"],
      ["eq", "cliente_id", "c1"],
    ]);
    expect(deTabla(llamadas, "pagos")).toEqual([
      ["select", "*"],
      ["in", "producto_id", ["p1", "p2"]],
      ["order", "fecha", { ascending: false }],
      ["limit", 20],
    ]);
  });

  it("un cliente sin productos no consulta pagos y devuelve lista vacía", async () => {
    const { cliente, llamadas } = supabaseFalso({
      productos_contratados: { data: [], error: null },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toEqual([]);
    expect(deTabla(llamadas, "pagos")).toEqual([]);
  });

  it("si falla la lectura de productos devuelve null y no consulta pagos", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente, llamadas } = supabaseFalso({
      productos_contratados: { data: null, error: { message: "boom" } },
      pagos: { data: [pago()], error: null },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toBeNull();
    expect(deTabla(llamadas, "pagos")).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("si falla la lectura de pagos devuelve null, no una lista vacía que miente", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente } = supabaseFalso({
      productos_contratados: { data: [{ id: "p1" }], error: null },
      pagos: { data: null, error: { message: "boom" } },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
