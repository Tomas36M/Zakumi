import { describe, expect, it } from "vitest";
import { FILTRO_VACIO, type FiltroLeads } from "../filtros-leads";
import { filtroDesdeParams, paramsDeFiltro } from "../leads-consulta";
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
