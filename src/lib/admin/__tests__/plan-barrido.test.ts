import { describe, expect, it } from "vitest";
import { acumularResumen, hijasDe, planDeBarrido, type ResumenBarrido, type Trabajo } from "../plan-barrido";
import { claveTesela, claveTrabajo, teselar, PROFUNDIDAD_MAX } from "../barrido";
import type { ResumenTesela } from "../barrido-servidor";
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

const RESUMEN_CERO: ResumenBarrido = {
  encontrados: 0,
  fueraDelArea: 0,
  sinTelefono: 0,
  insertados: 0,
  saturadasAlFondo: 0,
  sinContabilizar: 0,
};

function resumenTesela(overrides: Partial<ResumenTesela> = {}): ResumenTesela {
  return {
    encontrados: 5,
    fueraDelArea: 1,
    sinTelefono: 2,
    insertados: 2,
    saturada: false,
    contabilizada: true,
    ...overrides,
  };
}

describe("acumularResumen", () => {
  it("suma cada campo del resultado de la tesela sobre el resumen previo", () => {
    const r = acumularResumen(RESUMEN_CERO, resumenTesela(), 0);
    expect(r).toEqual({
      encontrados: 5,
      fueraDelArea: 1,
      sinTelefono: 2,
      insertados: 2,
      saturadasAlFondo: 0,
      sinContabilizar: 0,
    });
  });

  it("acumula sobre un resumen previo no-cero, no lo reemplaza", () => {
    const previo = acumularResumen(RESUMEN_CERO, resumenTesela(), 0);
    const siguiente = acumularResumen(previo, resumenTesela(), 0);
    expect(siguiente.encontrados).toBe(10);
    expect(siguiente.insertados).toBe(4);
  });

  it("suma sinContabilizar exactamente cuando contabilizada es false", () => {
    const contabilizada = acumularResumen(RESUMEN_CERO, resumenTesela({ contabilizada: true }), 0);
    expect(contabilizada.sinContabilizar).toBe(0);

    const sinContabilizar = acumularResumen(
      RESUMEN_CERO,
      resumenTesela({ contabilizada: false }),
      0,
    );
    expect(sinContabilizar.sinContabilizar).toBe(1);
  });

  it("saturadasAlFondo solo sube si la tesela saturó Y está en el tope de partición", () => {
    const saturada = resumenTesela({ saturada: true });

    const enElFondo = acumularResumen(RESUMEN_CERO, saturada, PROFUNDIDAD_MAX);
    expect(enElFondo.saturadasAlFondo).toBe(1);

    const antesDelFondo = acumularResumen(RESUMEN_CERO, saturada, PROFUNDIDAD_MAX - 1);
    expect(antesDelFondo.saturadasAlFondo).toBe(0);

    const noSaturadaEnElFondo = acumularResumen(
      RESUMEN_CERO,
      resumenTesela({ saturada: false }),
      PROFUNDIDAD_MAX,
    );
    expect(noSaturadaEnElFondo.saturadasAlFondo).toBe(0);
  });
});

describe("hijasDe", () => {
  const tesela = teselar(POLIGONO)[0];

  function trabajo(profundidad: number): Trabajo {
    return {
      tesela,
      vertical: "ferreteria",
      profundidad,
      clave: claveTrabajo(tesela, "ferreteria"),
    };
  }

  it("parte una celda en 4 por debajo del tope de partición", () => {
    expect(hijasDe(trabajo(0))).toHaveLength(4);
    expect(hijasDe(trabajo(PROFUNDIDAD_MAX - 1))).toHaveLength(4);
  });

  it("no parte más allá del tope de partición", () => {
    expect(hijasDe(trabajo(PROFUNDIDAD_MAX))).toEqual([]);
  });

  it("las hijas heredan la vertical de la madre y suben una profundidad", () => {
    const hijas = hijasDe(trabajo(0));
    expect(hijas.every((h) => h.vertical === "ferreteria")).toBe(true);
    expect(hijas.every((h) => h.profundidad === 1)).toBe(true);
  });
});
