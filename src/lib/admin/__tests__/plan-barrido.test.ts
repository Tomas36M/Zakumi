import { describe, expect, it } from "vitest";
import { planDeBarrido } from "../plan-barrido";
import { claveTesela, claveTrabajo, teselar } from "../barrido";
import type { Territorio } from "../territorios";

const POLIGONO = [
  { lat: 4.72, lng: -74.28 },
  { lat: 4.72, lng: -74.26 },
  { lat: 4.74, lng: -74.26 },
  { lat: 4.74, lng: -74.28 },
];

function territorioCon(teselasHechas: string[]): Territorio {
  return {
    id: "t1",
    nombre: "Madrid centro",
    poligono: POLIGONO,
    bbox_sur: 4.72,
    bbox_norte: 4.74,
    bbox_oeste: -74.28,
    bbox_este: -74.26,
    verticales: [],
    teselas_hechas: teselasHechas,
    llamadas: 0,
    ultimo_barrido: null,
    creado_por: null,
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
}

describe("planDeBarrido", () => {
  it("un trabajo por tesela y vertical", () => {
    const teselas = teselar(POLIGONO).length;
    expect(planDeBarrido(territorioCon([]), ["ferreteria", "panaderia"])).toHaveLength(
      teselas * 2,
    );
  });

  it("salta lo ya barrido: reanudar no vuelve a pagarle a Google", () => {
    const teselas = teselar(POLIGONO);
    const yaHecha = claveTrabajo(teselas[0], "ferreteria");
    const plan = planDeBarrido(territorioCon([yaHecha]), ["ferreteria"]);
    expect(plan).toHaveLength(teselas.length - 1);
    expect(plan.some((t) => t.clave === yaHecha)).toBe(false);
  });

  it("una vertical ya barrida no bloquea otra vertical en la misma tesela", () => {
    const teselas = teselar(POLIGONO);
    const plan = planDeBarrido(
      territorioCon([claveTrabajo(teselas[0], "ferreteria")]),
      ["ferreteria", "panaderia"],
    );
    expect(plan.some((t) => t.clave === claveTrabajo(teselas[0], "panaderia"))).toBe(
      true,
    );
  });

  it("los trabajos del plan arrancan en profundidad 0", () => {
    expect(planDeBarrido(territorioCon([]), ["ferreteria"]).every((t) => t.profundidad === 0)).toBe(
      true,
    );
  });

  it("sin verticales no hay plan", () => {
    expect(planDeBarrido(territorioCon([]), [])).toEqual([]);
  });

  it("la clave del trabajo usa la clave estable de la tesela", () => {
    const plan = planDeBarrido(territorioCon([]), ["ferreteria"]);
    const t = plan[0];
    expect(t.clave).toBe(`${claveTesela(t.tesela.centro, t.tesela.radio)}#ferreteria`);
  });
});
