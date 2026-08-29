import { describe, expect, it } from "vitest";

import {
  conciliarPlantillas,
  edicionesRestantes,
  estadoLocal,
  validarCuerpo,
  verticalDeFila,
  type PlantillaZakFila,
} from "../plantillas";
import type { PlantillaMeta } from "@/lib/bots/tipos";

function fila(extra: Partial<PlantillaZakFila>): PlantillaZakFila {
  return {
    slug: "panaderia",
    orden: 2,
    label: "Panadería",
    plantilla: "saludo_panaderia",
    matchers: ["bakery"],
    angulo: "Encargos de tortas.",
    texto_vigente: "¡Hola! Soy Zak, saludo de panadería.",
    folleto_url_vigente: "https://zakumistudio.com/folletos/panaderia.png",
    header_aprobado: true,
    texto_borrador: null,
    folleto_url_borrador: null,
    borrador_enviado_en: null,
    estado_meta: "APPROVED",
    motivo_rechazo: null,
    categoria_meta: "MARKETING",
    meta_template_id: "111",
    envios_revision: [],
    estados_refrescados_en: null,
    ...extra,
  };
}

function meta(extra: Partial<PlantillaMeta>): PlantillaMeta {
  return {
    id: "111",
    nombre: "saludo_panaderia",
    estado: "APPROVED",
    categoria: "MARKETING",
    motivo_rechazo: null,
    cuerpo: "¡Hola! Soy Zak, saludo de panadería.",
    tiene_header_imagen: true,
    ...extra,
  };
}

describe("verticalDeFila", () => {
  it("la fila de Supabase se vuelve un vertical con el shape de siempre", () => {
    const v = verticalDeFila(fila({}));
    expect(v.slug).toBe("panaderia");
    expect(v.plantilla).toBe("saludo_panaderia");
    expect(v.texto).toBe("¡Hola! Soy Zak, saludo de panadería.");
    expect(v.folletoUrl).toBe("https://zakumistudio.com/folletos/panaderia.png");
    expect(v.conHeader).toBe(true);
    expect(v.enRevision).toBe(false);
  });

  it("PENDING con borrador enviado = en revisión (el selector la deshabilita)", () => {
    const v = verticalDeFila(
      fila({ estado_meta: "PENDING", borrador_enviado_en: "2026-08-29T10:00:00Z" }),
    );
    expect(v.enRevision).toBe(true);
  });
});

describe("estadoLocal", () => {
  it("sin borradores → sincronizada", () => {
    expect(estadoLocal(fila({}))).toBe("sincronizada");
  });

  it("con borrador sin enviar → borrador", () => {
    expect(estadoLocal(fila({ texto_borrador: "nuevo texto" }))).toBe("borrador");
  });

  it("enviado y Meta dice PENDING → en_revision", () => {
    expect(
      estadoLocal(
        fila({
          texto_borrador: "nuevo",
          borrador_enviado_en: "2026-08-29T10:00:00Z",
          estado_meta: "PENDING",
        }),
      ),
    ).toBe("en_revision");
  });

  it("REJECTED manda sobre todo: hay que corregir", () => {
    expect(estadoLocal(fila({ estado_meta: "REJECTED", texto_borrador: "x" }))).toBe(
      "rechazada",
    );
  });
});

describe("edicionesRestantes", () => {
  const ahora = Date.parse("2026-08-29T12:00:00Z");
  const hace = (h: number) => new Date(ahora - h * 3600_000).toISOString();

  it("sin envíos: puede, con 10 disponibles", () => {
    const r = edicionesRestantes([], ahora);
    expect(r.puedeEnviar).toBe(true);
    expect(r.usadasMes).toBe(0);
  });

  it("una edición hace menos de 24h bloquea (regla 1/24h)", () => {
    const r = edicionesRestantes([hace(3)], ahora);
    expect(r.puedeEnviar).toBe(false);
    expect(r.motivo).toContain("24");
  });

  it("10 en el mes bloquean (regla 10/30d); las de hace 31 días ya no cuentan", () => {
    const diez = Array.from({ length: 10 }, (_, i) => hace(48 + i * 24));
    expect(edicionesRestantes(diez, ahora).puedeEnviar).toBe(false);
    const viejas = Array.from({ length: 10 }, (_, i) => hace(24 * 31 + i));
    expect(edicionesRestantes(viejas, ahora).puedeEnviar).toBe(true);
  });
});

describe("validarCuerpo", () => {
  it("acepta un texto normal", () => {
    expect(validarCuerpo("Hola, somos Zakumi.")).toBeNull();
  });

  it("rechaza vacío, >1024 y variables {{n}} (v1 sin variables)", () => {
    expect(validarCuerpo("   ")).not.toBeNull();
    expect(validarCuerpo("x".repeat(1025))).not.toBeNull();
    expect(validarCuerpo("Hola {{1}}")).not.toBeNull();
  });
});

describe("conciliarPlantillas", () => {
  it("refresca estado/motivo/categoría/id de Meta", () => {
    const r = conciliarPlantillas(
      [fila({ estado_meta: "DESCONOCIDO", meta_template_id: null })],
      [meta({ estado: "PAUSED", motivo_rechazo: null })],
    );
    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].slug).toBe("panaderia");
    expect(r.updates[0].campos.estado_meta).toBe("PAUSED");
    expect(r.updates[0].campos.meta_template_id).toBe("111");
  });

  it("PROMOCIÓN: borrador enviado + APPROVED → el borrador pasa a vigente y se limpia", () => {
    const r = conciliarPlantillas(
      [
        fila({
          texto_borrador: "Texto nuevo aprobado",
          folleto_url_borrador: "https://x.supabase.co/f/panaderia/9.png",
          borrador_enviado_en: "2026-08-28T10:00:00Z",
          estado_meta: "PENDING",
        }),
      ],
      [meta({ estado: "APPROVED", cuerpo: "Texto nuevo aprobado", tiene_header_imagen: true })],
    );
    expect(r.promovidas).toEqual(["panaderia"]);
    const c = r.updates[0].campos;
    expect(c.texto_vigente).toBe("Texto nuevo aprobado");
    expect(c.folleto_url_vigente).toBe("https://x.supabase.co/f/panaderia/9.png");
    expect(c.header_aprobado).toBe(true);
    expect(c.texto_borrador).toBeNull();
    expect(c.folleto_url_borrador).toBeNull();
    expect(c.borrador_enviado_en).toBeNull();
  });

  it("APPROVED RANCIO: si el cuerpo de Meta no es el borrador, NO se promueve (propagación)", () => {
    // Refrescar segundos después de enviar puede ver el APPROVED de la versión
    // VIEJA. Promover ahí instalaría un texto que Meta nunca aprobó.
    const r = conciliarPlantillas(
      [
        fila({
          texto_borrador: "Texto nuevo aún en revisión",
          borrador_enviado_en: "2026-08-29T11:59:00Z",
          estado_meta: "PENDING",
        }),
      ],
      [meta({ estado: "APPROVED", cuerpo: "¡Hola! Soy Zak, saludo de panadería." })],
    );
    expect(r.promovidas).toEqual([]);
    expect(r.updates).toEqual([]); // la fila queda intacta: sigue "en revisión"
  });

  it("promoción con header desconocido: v1 siempre envió header → true", () => {
    const r = conciliarPlantillas(
      [
        fila({
          texto_borrador: "Texto nuevo aprobado",
          borrador_enviado_en: "2026-08-28T10:00:00Z",
          estado_meta: "PENDING",
          header_aprobado: false,
        }),
      ],
      [meta({ estado: "APPROVED", cuerpo: "Texto nuevo aprobado", tiene_header_imagen: null })],
    );
    expect(r.promovidas).toEqual(["panaderia"]);
    expect(r.updates[0].campos.header_aprobado).toBe(true);
  });

  it("RECHAZO: el borrador se conserva para corregir, con el motivo visible", () => {
    const r = conciliarPlantillas(
      [
        fila({
          texto_borrador: "texto rechazado",
          borrador_enviado_en: "2026-08-28T10:00:00Z",
          estado_meta: "PENDING",
        }),
      ],
      [meta({ estado: "REJECTED", motivo_rechazo: "INVALID_FORMAT" })],
    );
    expect(r.rechazadas).toEqual(["panaderia"]);
    const c = r.updates[0].campos;
    expect(c.estado_meta).toBe("REJECTED");
    expect(c.motivo_rechazo).toBe("INVALID_FORMAT");
    expect(c.texto_borrador).toBeUndefined(); // no se toca: sigue ahí para corregir
    expect(c.borrador_enviado_en).toBeNull(); // la revisión terminó
  });

  it("DESINCRONIZADA: sin revisión local y el cuerpo de Meta no es el espejo", () => {
    const r = conciliarPlantillas(
      [fila({})],
      [meta({ cuerpo: "Alguien lo editó en Business Manager" })],
    );
    expect(r.desincronizadas).toEqual(["panaderia"]);
  });

  it("una fila sin plantilla en Meta queda DESCONOCIDO (no truena)", () => {
    const r = conciliarPlantillas([fila({})], []);
    expect(r.updates[0].campos.estado_meta).toBe("DESCONOCIDO");
  });
});
