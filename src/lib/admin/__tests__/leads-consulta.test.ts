import { describe, expect, it } from "vitest";
import { FILTRO_VACIO, type FiltroLeads } from "../filtros-leads";
import {
  aplicarFiltros,
  filtroDesdeParams,
  opcionesDe,
  paramsDeFiltro,
  rangoEnPantalla,
  totalDeConteos,
} from "../leads-consulta";
import { conteoPorEstado } from "../negocios";
import { LEADS_POR_PAGINA } from "../paginacion";
import { TANDA_MAX_BOT } from "../zak";

const TERRITORIO = "3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69";

const COMPLETO: FiltroLeads = {
  q: "el tornillo",
  ciudad: "Bogotá",
  estados: ["respondido"],
  categoria: "ferreteria",
  telefono: "con",
  web: "sin",
  territorio: TERRITORIO,
};

describe("filtroDesdeParams", () => {
  it("sin parámetros es el filtro vacío en la página 1", () => {
    expect(filtroDesdeParams(new URLSearchParams())).toEqual({ filtro: FILTRO_VACIO, pagina: 1 });
  });

  it("lee cada filtro válido y la página", () => {
    const params = new URLSearchParams({
      q: "el tornillo",
      estado: "respondido",
      ciudad: "Bogotá",
      categoria: "ferreteria",
      telefono: "con",
      web: "sin",
      territorio: TERRITORIO,
      pagina: "3",
    });
    expect(filtroDesdeParams(params)).toEqual({ filtro: COMPLETO, pagina: 3 });
  });

  it("descarta un estado que no existe en el pipeline", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ estado: "vip" }));
    expect(filtro.estados).toEqual([]);
  });

  it("teléfono y web fuera de su dominio caen a «todos»", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ telefono: "fijo", web: "quizas" }));
    expect(filtro.telefono).toBe("todos");
    expect(filtro.web).toBe("todos");
  });

  it("recorta el texto: sin espacios de sobra y como mucho 80 caracteres", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ q: `  ${"a".repeat(100)}  ` }));
    expect(filtro.q).toBe("a".repeat(80));
  });

  it("un territorio que no es un id válido cae a «todos»", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ territorio: "no-es-un-id" }));
    expect(filtro.territorio).toBe("todos");
  });

  it("una página inválida cae a la 1", () => {
    expect(filtroDesdeParams(new URLSearchParams({ pagina: "-2" })).pagina).toBe(1);
  });
});

describe("paramsDeFiltro", () => {
  it("el filtro vacío en la página 1 no manda nada", () => {
    expect(paramsDeFiltro(FILTRO_VACIO, 1).toString()).toBe("");
  });

  it("solo manda lo que se aparta de los valores por defecto", () => {
    expect(paramsDeFiltro({ ...FILTRO_VACIO, web: "sin" }, 2).toString()).toBe("web=sin&pagina=2");
  });

  it("manda el texto sin espacios de sobra", () => {
    expect(paramsDeFiltro({ ...FILTRO_VACIO, q: "  el tornillo " }, 1).get("q")).toBe("el tornillo");
  });

  it("ida y vuelta con filtroDesdeParams sin perder nada", () => {
    expect(filtroDesdeParams(paramsDeFiltro(COMPLETO, 4))).toEqual({ filtro: COMPLETO, pagina: 4 });
  });
});

describe("LEADS_POR_PAGINA", () => {
  it("una página es exactamente una tanda de Zak: «seleccionar la página» cabe en un envío", () => {
    expect(LEADS_POR_PAGINA).toBe(TANDA_MAX_BOT);
  });
});

/** Consulta falsa: registra cada condición que se le aplica, en orden, y se
 * devuelve a sí misma como el query builder de Supabase. */
function consultaFalsa() {
  const llamadas: unknown[][] = [];
  const consulta = {
    eq(columna: string, valor: unknown) {
      llamadas.push(["eq", columna, valor]);
      return consulta;
    },
    neq(columna: string, valor: unknown) {
      llamadas.push(["neq", columna, valor]);
      return consulta;
    },
    in(columna: string, valores: unknown) {
      llamadas.push(["in", columna, valores]);
      return consulta;
    },
    is(columna: string, valor: unknown) {
      llamadas.push(["is", columna, valor]);
      return consulta;
    },
    not(columna: string, operador: string, valor: unknown) {
      llamadas.push(["not", columna, operador, valor]);
      return consulta;
    },
    or(condiciones: string) {
      llamadas.push(["or", condiciones]);
      return consulta;
    },
    ilike(columna: string, patron: string) {
      llamadas.push(["ilike", columna, patron]);
      return consulta;
    },
  };
  return { consulta: consulta as never, llamadas };
}

describe("aplicarFiltros", () => {
  it("el filtro vacío no toca la consulta", () => {
    const { consulta, llamadas } = consultaFalsa();
    expect(aplicarFiltros(consulta, FILTRO_VACIO)).toBe(consulta);
    expect(llamadas).toEqual([]);
  });

  it("traduce cada filtro a su condición en la base, en orden", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, COMPLETO);
    expect(llamadas).toEqual([
      ["eq", "ciudad", "Bogotá"],
      ["eq", "categoria", "ferreteria"],
      ["eq", "territorio_id", TERRITORIO],
      ["in", "estado", ["respondido"]],
      ["not", "telefono", "is", null],
      ["or", 'sitio_web.is.null,sitio_web.eq.""'],
      ["ilike", "nombre", "%el tornillo%"],
    ]);
  });

  it("sinEstado deja fuera solo el filtro de estado (los conteos de la franja)", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, COMPLETO, { sinEstado: true });
    expect(llamadas).toHaveLength(6);
    expect(llamadas.filter((l) => l[1] === "estado")).toEqual([]);
  });

  it("«sin web» es nulo o texto vacío, lo mismo que esSinWeb en la pantalla", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, { ...FILTRO_VACIO, web: "sin" });
    expect(llamadas).toEqual([["or", 'sitio_web.is.null,sitio_web.eq.""']]);
  });

  it("sin teléfono y con web son las condiciones contrarias", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, { ...FILTRO_VACIO, telefono: "sin", web: "con" });
    expect(llamadas).toEqual([
      ["is", "telefono", null],
      ["not", "sitio_web", "is", null],
      ["neq", "sitio_web", ""],
    ]);
  });

  it("escapa los comodines del texto: «50%» busca el porcentaje literal", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, { ...FILTRO_VACIO, q: "50%" });
    expect(llamadas).toEqual([["ilike", "nombre", "%50\\%%"]]);
  });
});

describe("totalDeConteos", () => {
  const conteos = { ...conteoPorEstado([]), nuevo: 30, contactado: 12, respondido: 5, descartado: 3 };

  it("sin estado elegido, el total es la suma de los seis", () => {
    expect(totalDeConteos(conteos, [])).toBe(50);
  });

  it("con un estado elegido, el total es el de ese estado", () => {
    expect(totalDeConteos(conteos, ["contactado"])).toBe(12);
  });
});

describe("opcionesDe", () => {
  it("ciudades y categorías sin repetir, sin vacíos y en orden alfabético", () => {
    expect(
      opcionesDe([
        { ciudad: "Chía", categoria: "ferreteria" },
        { ciudad: "Bogotá", categoria: null },
        { ciudad: "Chía", categoria: "belleza" },
        { ciudad: null, categoria: "ferreteria" },
      ]),
    ).toEqual({ ciudades: ["Bogotá", "Chía"], categorias: ["belleza", "ferreteria"] });
  });
});

describe("rangoEnPantalla", () => {
  it("la primera página llena va del 1 al 50", () => {
    expect(rangoEnPantalla(1, 50, 50)).toEqual({ desde: 1, hasta: 50 });
  });

  it("la última página corta termina en la última fila", () => {
    expect(rangoEnPantalla(3, 12, 50)).toEqual({ desde: 101, hasta: 112 });
  });

  it("sin filas no hay tramo", () => {
    expect(rangoEnPantalla(1, 0, 50)).toBeNull();
  });
});
