import { describe, expect, it } from "vitest";
import { mezclarLeads, type LeadOverride } from "../leads-overrides";
import type { Lead } from "@/lib/bots/tipos";

function lead(extra: Partial<Lead>): Lead {
  return { phone: "573001112233", datos: { nombre: "Ana" }, ...extra };
}

function override(extra: Partial<LeadOverride>): LeadOverride {
  return {
    instancia_id: 1,
    telefono: "573001112233",
    datos_editados: null,
    negocio_id: null,
    borrado: false,
    ...extra,
  };
}

describe("mezclarLeads", () => {
  it("un lead sin override pasa igual, con negocioId null", () => {
    const r = mezclarLeads([lead({})], []);
    expect(r).toEqual([{ phone: "573001112233", datos: { nombre: "Ana" }, negocioId: null }]);
  });

  it("un lead con datos_editados usa los editados, no los originales", () => {
    const r = mezclarLeads(
      [lead({ datos: { nombre: "Ana", necesidad: "web" } })],
      [override({ datos_editados: { nombre: "Ana María" } })],
    );
    expect(r[0]!.datos).toEqual({ nombre: "Ana María" });
  });

  it("un lead con borrado:true se excluye del resultado", () => {
    const r = mezclarLeads(
      [lead({ phone: "a" }), lead({ phone: "b" })],
      [override({ telefono: "a", borrado: true })],
    );
    expect(r.map((l) => l.phone)).toEqual(["b"]);
  });

  it("un lead con negocio_id trae negocioId en el resultado", () => {
    const r = mezclarLeads(
      [lead({})],
      [override({ negocio_id: "11111111-1111-1111-1111-111111111111" })],
    );
    expect(r[0]!.negocioId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("un override de un teléfono que no está en leads no genera nada", () => {
    const r = mezclarLeads([lead({ phone: "a" })], [override({ telefono: "z" })]);
    expect(r).toHaveLength(1);
    expect(r[0]!.phone).toBe("a");
  });
});
