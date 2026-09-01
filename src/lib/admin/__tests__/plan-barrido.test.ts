import { describe, expect, it } from "vitest";
import {
  acumularFallida,
  acumularResumen,
  hijasDe,
  planDeBarrido,
  type ResumenBarrido,
  type Trabajo,
} from "../plan-barrido";
import { claveTesela, claveTrabajo, subdividir, teselar, PROFUNDIDAD_MAX } from "../barrido";
import type { ResumenTesela } from "../barrido-servidor";
import type { Territorio } from "../territorios";

const POLIGONO = [
  { lat: 4.72, lng: -74.28 },
  { lat: 4.72, lng: -74.26 },
  { lat: 4.74, lng: -74.26 },
  { lat: 4.74, lng: -74.28 },
];

function territorioCon(teselasHechas: string[], teselasSaturadas: string[] = []): Territorio {
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
    teselas_saturadas: teselasSaturadas,
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

  it("con la rejilla ya calculada produce exactamente el mismo plan", () => {
    // El diálogo de estimación pasa su rejilla memoizada para contar lo que va
    // a comprar. Si contara distinto que el plan que corre, el consentimiento
    // que el usuario da no sería el gasto que ocurre.
    const t = territorioCon([]);
    expect(planDeBarrido(t, ["ferreteria"], teselar(POLIGONO))).toEqual(
      planDeBarrido(t, ["ferreteria"]),
    );
  });

  it("la clave del trabajo usa la clave estable de la tesela", () => {
    const plan = planDeBarrido(territorioCon([]), ["ferreteria"]);
    const t = plan[0];
    expect(t.clave).toBe(`${claveTesela(t.tesela.centro, t.tesela.radio)}#ferreteria`);
  });
});

// La subdivisión adaptativa vivía SOLO en la cola del navegador: una recarga a
// mitad de barrido perdía las hijas de las celdas saturadas para siempre,
// porque la madre ya contaba como barrida. `teselas_saturadas` las hace
// durables y el plan tiene que saber bajar por ellas.
describe("planDeBarrido y las celdas saturadas", () => {
  const teselas = teselar(POLIGONO);
  const madre = teselas[0];
  const claveMadre = claveTrabajo(madre, "ferreteria");
  const hijas = subdividir(madre).map((t) => claveTrabajo(t, "ferreteria"));

  it("una madre saturada cuyas hijas faltan las vuelve a emitir", () => {
    const plan = planDeBarrido(
      territorioCon([claveMadre], [claveMadre]),
      ["ferreteria"],
    );
    const claves = plan.map((t) => t.clave);
    expect(claves).not.toContain(claveMadre);
    for (const hija of hijas) expect(claves).toContain(hija);
    // El resto del territorio sigue en el plan: una tesela menos (la madre),
    // cuatro hijas más.
    expect(plan).toHaveLength(teselas.length - 1 + 4);
  });

  it("las hijas emitidas van a profundidad 1 y con la vertical de la madre", () => {
    const plan = planDeBarrido(
      territorioCon([claveMadre], [claveMadre]),
      ["ferreteria"],
    );
    const emitidas = plan.filter((t) => hijas.includes(t.clave));
    expect(emitidas).toHaveLength(4);
    expect(emitidas.every((t) => t.profundidad === 1)).toBe(true);
    expect(emitidas.every((t) => t.vertical === "ferreteria")).toBe(true);
    expect(emitidas.every((t) => t.tesela.radio === madre.radio / 2)).toBe(true);
  });

  it("una madre saturada con TODAS sus hijas hechas no produce nada", () => {
    const plan = planDeBarrido(
      territorioCon([claveMadre, ...hijas], [claveMadre]),
      ["ferreteria"],
    );
    expect(plan.map((t) => t.clave)).not.toContain(claveMadre);
    for (const hija of hijas) expect(plan.map((t) => t.clave)).not.toContain(hija);
    expect(plan).toHaveLength(teselas.length - 1);
  });

  it("solo re-emite las hijas que faltan: reanudar no vuelve a pagar las hechas", () => {
    const plan = planDeBarrido(
      territorioCon([claveMadre, hijas[0], hijas[1]], [claveMadre]),
      ["ferreteria"],
    );
    const claves = plan.map((t) => t.clave);
    expect(claves).not.toContain(hijas[0]);
    expect(claves).not.toContain(hijas[1]);
    expect(claves).toContain(hijas[2]);
    expect(claves).toContain(hijas[3]);
  });

  it("baja otro nivel si una hija también saturó", () => {
    const hija0 = subdividir(madre)[0];
    const nietas = subdividir(hija0).map((t) => claveTrabajo(t, "ferreteria"));
    const plan = planDeBarrido(
      territorioCon([claveMadre, hijas[0]], [claveMadre, hijas[0]]),
      ["ferreteria"],
    );
    const claves = plan.map((t) => t.clave);
    for (const nieta of nietas) expect(claves).toContain(nieta);
    expect(plan.filter((t) => nietas.includes(t.clave)).every((t) => t.profundidad === 2)).toBe(
      true,
    );
  });

  it("una saturada en el tope de partición no emite nada nuevo", () => {
    // Al fondo no hay hijas que emitir: la saturación se reporta, no se resuelve.
    const hija0 = subdividir(madre)[0];
    const nietas = subdividir(hija0);
    const claveNieta = claveTrabajo(nietas[0], "ferreteria");
    const hechas = [claveMadre, hijas[0], ...nietas.map((t) => claveTrabajo(t, "ferreteria"))];
    const plan = planDeBarrido(
      territorioCon(hechas, [claveMadre, hijas[0], claveNieta]),
      ["ferreteria"],
    );
    expect(plan.map((t) => t.clave)).not.toContain(claveNieta);
    expect(plan).toHaveLength(teselas.length - 1 + 3);
  });

  it("una vertical saturada no arrastra a las demás", () => {
    const plan = planDeBarrido(
      territorioCon([claveMadre], [claveMadre]),
      ["ferreteria", "panaderia"],
    );
    expect(plan.map((t) => t.clave)).toContain(claveTrabajo(madre, "panaderia"));
  });

  it("sin teselas_saturadas el plan se comporta como antes", () => {
    const plan = planDeBarrido(territorioCon([claveMadre]), ["ferreteria"]);
    expect(plan).toHaveLength(teselas.length - 1);
  });
});

const RESUMEN_CERO: ResumenBarrido = {
  encontrados: 0,
  fueraDelArea: 0,
  sinTelefono: 0,
  insertados: 0,
  saturadasAlFondo: 0,
  sinContabilizar: 0,
  fallidas: 0,
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
      fallidas: 0,
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

  it("una tesela que respondió no cuenta como fallida ni borra las previas", () => {
    const conFallida = acumularFallida(RESUMEN_CERO);
    const despues = acumularResumen(conFallida, resumenTesela(), 0);
    expect(despues.fallidas).toBe(1);
  });
});

describe("acumularFallida", () => {
  it("cuenta la tesela perdida sin tocar los demás contadores", () => {
    const previo = acumularResumen(RESUMEN_CERO, resumenTesela(), 0);
    const r = acumularFallida(previo);
    expect(r.fallidas).toBe(1);
    expect(r.encontrados).toBe(previo.encontrados);
    expect(r.insertados).toBe(previo.insertados);
    expect(r.sinContabilizar).toBe(0);
  });

  it("acumula fallidas una sobre otra", () => {
    expect(acumularFallida(acumularFallida(RESUMEN_CERO)).fallidas).toBe(2);
  });

  it("una fallida que YA se le cobró a Google también es un cobro sin contabilizar", () => {
    const r = acumularFallida(RESUMEN_CERO, true);
    expect(r.fallidas).toBe(1);
    expect(r.sinContabilizar).toBe(1);
  });

  it("una fallida sin cobro no infla el gasto no contabilizado", () => {
    expect(acumularFallida(RESUMEN_CERO, false).sinContabilizar).toBe(0);
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
