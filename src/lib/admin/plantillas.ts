// Lógica pura del gestor de plantillas de Meta (testeable en vitest node).
// La tabla plantillas_zak es la fuente viva del catálogo: texto/folleto
// VIGENTES (lo aprobado, lo único que sale por WhatsApp) vs BORRADOR (la
// edición camino a Meta). Aquí viven la máquina de estados derivada, los
// límites de edición de Meta y la conciliación contra lo que Graph reporta.

import type { EstadoMeta, PlantillaMeta } from "@/lib/bots/tipos";
import type { VerticalProspeccion } from "./zak";

/** Una fila de public.plantillas_zak (espejo de supabase/plantillas.sql). */
export type PlantillaZakFila = {
  slug: string;
  orden: number;
  label: string;
  plantilla: string;
  matchers: string[];
  angulo: string;
  texto_vigente: string;
  folleto_url_vigente: string;
  header_aprobado: boolean;
  texto_borrador: string | null;
  folleto_url_borrador: string | null;
  borrador_enviado_en: string | null;
  estado_meta: EstadoMeta;
  motivo_rechazo: string | null;
  categoria_meta: string | null;
  meta_template_id: string | null;
  envios_revision: string[];
  estados_refrescados_en: string | null;
};

/** Fila → vertical con el shape de siempre: lo VIGENTE es lo que se envía. */
export function verticalDeFila(f: PlantillaZakFila): VerticalProspeccion {
  return {
    slug: f.slug,
    label: f.label,
    plantilla: f.plantilla,
    texto: f.texto_vigente,
    angulo: f.angulo,
    matchers: f.matchers,
    folleto: f.folleto_url_vigente.split("/").pop() ?? "",
    folletoUrl: f.folleto_url_vigente,
    conHeader: f.header_aprobado,
    enRevision: f.borrador_enviado_en !== null && f.estado_meta === "PENDING",
  };
}

export type EstadoLocal = "sincronizada" | "borrador" | "en_revision" | "rechazada";

/** La máquina de estados derivada (no se guarda: se calcula de la fila). */
export function estadoLocal(f: PlantillaZakFila): EstadoLocal {
  if (f.estado_meta === "REJECTED") return "rechazada";
  if (f.borrador_enviado_en !== null && f.estado_meta === "PENDING") return "en_revision";
  if (f.texto_borrador !== null || f.folleto_url_borrador !== null) return "borrador";
  return "sincronizada";
}

const DIA_MS = 24 * 60 * 60 * 1000;
const MES_MS = 30 * DIA_MS;
const TOPE_MES = 10;

/**
 * Los límites de edición de Meta para plantillas aprobadas: máximo 10
 * ediciones por 30 días y 1 por 24 horas. Contador informativo — la verdad
 * final la da Graph, pero avisar ANTES evita quemar el intento.
 */
export function edicionesRestantes(
  enviosRevision: string[],
  ahoraMs: number,
): { puedeEnviar: boolean; motivo?: string; usadasMes: number } {
  const validas = enviosRevision
    .map((e) => Date.parse(e))
    .filter((t) => !Number.isNaN(t) && ahoraMs - t < MES_MS);
  const usadasMes = validas.length;
  if (validas.some((t) => ahoraMs - t < DIA_MS)) {
    return {
      puedeEnviar: false,
      usadasMes,
      motivo: "Meta acepta 1 edición por 24 horas — la última fue hace menos de un día.",
    };
  }
  if (usadasMes >= TOPE_MES) {
    return {
      puedeEnviar: false,
      usadasMes,
      motivo: `Meta acepta ${TOPE_MES} ediciones por 30 días y ya se usaron todas.`,
    };
  }
  return { puedeEnviar: true, usadasMes };
}

/** Validación del cuerpo antes de mandarlo a Meta. Null = válido. */
export function validarCuerpo(textoCuerpo: string): string | null {
  const t = textoCuerpo.trim();
  if (!t) return "El texto no puede quedar vacío.";
  if (t.length > 1024) return `Meta acepta máximo 1024 caracteres (van ${t.length}).`;
  if (t.includes("{{")) {
    return "Las variables {{n}} no van en v1: exigen ejemplo aprobado y cambiar el envío.";
  }
  return null;
}

export type Conciliacion = {
  updates: { slug: string; campos: Partial<PlantillaZakFila> }[];
  promovidas: string[];
  rechazadas: string[];
  /** Sin revisión local pendiente y el cuerpo en Meta ≠ espejo: alguien editó
   * por fuera (Business Manager). Se avisa; adoptar es decisión humana. */
  desincronizadas: string[];
};

/**
 * Cruza las filas locales contra lo que Graph reporta. Devuelve los updates a
 * aplicar: refresco de estado/motivo/categoría/id siempre; PROMOCIÓN
 * (borrador→vigente y limpieza) cuando una edición enviada quedó APPROVED;
 * fin de la revisión (sin descartar el borrador) cuando quedó REJECTED.
 */
export function conciliarPlantillas(
  filas: PlantillaZakFila[],
  plantillasMeta: PlantillaMeta[],
): Conciliacion {
  const porNombre = new Map(plantillasMeta.map((p) => [p.nombre, p]));
  const updates: Conciliacion["updates"] = [];
  const promovidas: string[] = [];
  const rechazadas: string[] = [];
  const desincronizadas: string[] = [];

  for (const f of filas) {
    const m = porNombre.get(f.plantilla);
    if (!m) {
      updates.push({ slug: f.slug, campos: { estado_meta: "DESCONOCIDO" } });
      continue;
    }

    const campos: Partial<PlantillaZakFila> = {
      estado_meta: m.estado,
      motivo_rechazo: m.motivo_rechazo,
      categoria_meta: m.categoria,
      meta_template_id: m.id ?? f.meta_template_id,
    };

    const enRevision = f.borrador_enviado_en !== null;
    if (enRevision && m.estado === "APPROVED") {
      // Guard contra la propagación de Graph: refrescar segundos después de
      // enviar puede ver todavía el APPROVED de la versión VIEJA. Solo se
      // promueve si el cuerpo que Meta reporta ES el borrador; si no, la fila
      // queda intacta ("en revisión") hasta el próximo refresco.
      if ((f.texto_borrador ?? "").trim() !== m.cuerpo.trim()) continue;
      // Meta aprobó la edición: el borrador ES la nueva verdad del envío.
      campos.texto_vigente = f.texto_borrador ?? f.texto_vigente;
      campos.folleto_url_vigente = f.folleto_url_borrador ?? f.folleto_url_vigente;
      // v1 siempre envía con header; sin evidencia en contra, sigue en true.
      campos.header_aprobado = m.tiene_header_imagen ?? true;
      campos.texto_borrador = null;
      campos.folleto_url_borrador = null;
      campos.borrador_enviado_en = null;
      promovidas.push(f.slug);
    } else if (enRevision && m.estado === "REJECTED") {
      // La revisión terminó mal: el borrador se queda para corregir.
      campos.borrador_enviado_en = null;
      rechazadas.push(f.slug);
    } else if (!enRevision && m.cuerpo && m.cuerpo.trim() !== f.texto_vigente.trim()) {
      desincronizadas.push(f.slug);
    }

    updates.push({ slug: f.slug, campos });
  }

  return { updates, promovidas, rechazadas, desincronizadas };
}
