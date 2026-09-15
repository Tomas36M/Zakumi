import { describe, expect, it } from "vitest";

import type { Negocio } from "../negocios";
import { VERTICAL_GENERICO, VERTICALES_PROSPECCION, verticalPorSlug } from "../zak";
import {
  MODO_POR_DEFECTO,
  gruposParaEnvio,
  modoDesdeCliente,
  previsualizarEnvio,
  prospectoParaTanda,
} from "../envio";

const CATALOGO = { verticales: VERTICALES_PROSPECCION, generico: VERTICAL_GENERICO };

function negocio(extra: Partial<Negocio>): Negocio {
  return {
    id: "n-1",
    nombre: "Panadería La Espiga",
    direccion: null,
    ciudad: "Ubaté",
    lat: 5.3,
    lng: -73.8,
    categoria: "bakery",
    rating: null,
    sitio_web: null,
    telefono: "+573101234567",
    tipo_telefono: "movil",
    google_place_id: null,
    territorio_id: null,
    fuente: "manual",
    estado: "nuevo",
    creado_por: null,
    created_at: "",
    updated_at: "",
    ...extra,
  } as Negocio;
}

const varios = (categoria: string, n: number, prefijo: string) =>
  Array.from({ length: n }, (_, i) => negocio({ id: `${prefijo}${i}`, categoria }));

describe("MODO_POR_DEFECTO", () => {
  it("por ahora se manda la plantilla genérica", () => {
    expect(MODO_POR_DEFECTO).toEqual({ tipo: "una", slug: "generico" });
  });
});

describe("gruposParaEnvio", () => {
  const lista = [
    negocio({ id: "r1", categoria: "restaurant" }),
    negocio({ id: "f1", categoria: "hardware store" }),
    negocio({ id: "r2", categoria: "family restaurant" }),
  ];

  it("con una sola plantilla, todos van en un grupo con ella", () => {
    const grupos = gruposParaEnvio(lista, { tipo: "una", slug: "generico" }, CATALOGO);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].vertical.slug).toBe("generico");
    expect(grupos[0].negocios.map((n) => n.id)).toEqual(["r1", "f1", "r2"]);
  });

  it("una plantilla de nicho también puede ir para todos", () => {
    const grupos = gruposParaEnvio(lista, { tipo: "una", slug: "ferreteria" }, CATALOGO);
    expect(grupos.map((g) => g.vertical.slug)).toEqual(["ferreteria"]);
  });

  it("según el tipo de negocio, cada uno con la plantilla de su vertical", () => {
    const grupos = gruposParaEnvio(lista, { tipo: "nicho" }, CATALOGO);
    const porSlug = new Map(grupos.map((g) => [g.vertical.slug, g.negocios.map((n) => n.id)]));
    expect(porSlug.get("restaurante")).toEqual(["r1", "r2"]);
    expect(porSlug.get("ferreteria")).toEqual(["f1"]);
  });

  it("sin negocios, sin grupos", () => {
    expect(gruposParaEnvio([], { tipo: "una", slug: "generico" }, CATALOGO)).toEqual([]);
  });

  // La tanda se corta en los primeros 50: si los ya contactados van adelante,
  // reenviar la misma selección repite a esos y los nuevos nunca salen.
  it("en cada grupo van primero los que siguen en Nuevo", () => {
    const mezcla = [
      negocio({ id: "c1", estado: "contactado", categoria: "restaurant" }),
      negocio({ id: "n1", categoria: "restaurant" }),
      negocio({ id: "c2", estado: "contactado", categoria: "restaurant" }),
      negocio({ id: "n2", categoria: "restaurant" }),
    ];
    const una = gruposParaEnvio(mezcla, { tipo: "una", slug: "generico" }, CATALOGO);
    expect(una[0].negocios.map((n) => n.id)).toEqual(["n1", "n2", "c1", "c2"]);
    const porNicho = gruposParaEnvio(mezcla, { tipo: "nicho" }, CATALOGO);
    expect(porNicho[0].negocios.map((n) => n.id)).toEqual(["n1", "n2", "c1", "c2"]);
  });
});

describe("prospectoParaTanda", () => {
  it("el saludo es el de la plantilla enviada; el ángulo, el del tipo de negocio", () => {
    const brasa = negocio({
      id: "r1",
      nombre: "La Brasa",
      categoria: "restaurant",
      ciudad: "Bogotá",
      telefono: "+573101234567",
    });
    const p = prospectoParaTanda(brasa, VERTICAL_GENERICO, CATALOGO);
    expect(p.telefono).toBe("573101234567");
    expect(p.negocio_id).toBe("r1");
    expect(p.contexto.nombre).toBe("La Brasa");
    expect(p.contexto.saludo).toBe(VERTICAL_GENERICO.texto);
    expect(p.contexto.angulo).toBe(verticalPorSlug("restaurante").angulo);
  });
});

describe("previsualizarEnvio", () => {
  it("con una sola plantilla y 80 negocios, salen 50 y quedan 30 para otro envío", () => {
    const grupos = gruposParaEnvio(varios("restaurant", 80, "r"), { tipo: "una", slug: "generico" }, CATALOGO);
    expect(previsualizarEnvio(grupos, 50)).toEqual({
      tandas: [{ slug: "generico", label: VERTICAL_GENERICO.label, cantidad: 50, enRevision: false }],
      total: 50,
      sobrantes: 30,
      bloqueados: 0,
    });
  });

  it("según el tipo de negocio, cada tanda con su propio tope", () => {
    const grupos = gruposParaEnvio(
      [...varios("restaurant", 56, "r"), ...varios("manufacturer", 11, "g")],
      { tipo: "nicho" },
      CATALOGO,
    );
    const v = previsualizarEnvio(grupos, 50);
    expect(v.tandas.map((t) => [t.slug, t.cantidad])).toEqual([
      ["restaurante", 50],
      ["generico", 11],
    ]);
    expect(v.total).toBe(61);
    expect(v.sobrantes).toBe(6);
  });

  it("una plantilla en revisión no suma: queda marcada y sus negocios cuentan como bloqueados", () => {
    const enRevision = { ...VERTICAL_GENERICO, enRevision: true };
    const v = previsualizarEnvio([{ vertical: enRevision, negocios: varios("restaurant", 3, "r") }], 50);
    expect(v.tandas).toEqual([
      { slug: "generico", label: VERTICAL_GENERICO.label, cantidad: 3, enRevision: true },
    ]);
    expect(v.total).toBe(0);
    expect(v.bloqueados).toBe(3);
  });
});

describe("modoDesdeCliente", () => {
  it("sin modo es «según el tipo de negocio», como antes", () => {
    expect(modoDesdeCliente(undefined)).toEqual({ tipo: "nicho" });
    expect(modoDesdeCliente({ tipo: "nicho" })).toEqual({ tipo: "nicho" });
  });

  it("acepta una plantilla con un slug válido", () => {
    expect(modoDesdeCliente({ tipo: "una", slug: "generico" })).toEqual({ tipo: "una", slug: "generico" });
  });

  it("lo que no se entiende se rechaza (null), no se adivina", () => {
    expect(modoDesdeCliente({ tipo: "una", slug: "../x" })).toBeNull();
    expect(modoDesdeCliente({ tipo: "una" })).toBeNull();
    expect(modoDesdeCliente({ tipo: "otra" })).toBeNull();
    expect(modoDesdeCliente("generico")).toBeNull();
  });
});
