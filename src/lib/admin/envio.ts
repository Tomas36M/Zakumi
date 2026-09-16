// Cómo se arma un envío de Zak: qué plantilla le toca a cada negocio y qué
// dice el diálogo antes de mandar. Lógica pura: la usan el diálogo (navegador)
// y enviarTandaZak (servidor), así que no importa nada de servidor.

import type { Negocio } from "./negocios";
import { esSinWeb } from "./negocios";
import { sinMas } from "./telefono";
import { repertorioPara } from "./zak-repertorio";
import {
  agruparPorVertical,
  componentesSaludo,
  TANDA_MAX_BOT,
  verticalPara,
  verticalPorSlug,
  type VerticalProspeccion,
} from "./zak";

/** Una sola plantilla para todos, o la de cada tipo de negocio. */
export type ModoPlantilla = { tipo: "una"; slug: string } | { tipo: "nicho" };

/** Por ahora se prospecta con el saludo genérico. */
export const MODO_POR_DEFECTO: ModoPlantilla = { tipo: "una", slug: "generico" };

export type CatalogoEnvio = {
  /** Los verticales de nicho, en el orden del matching (sin el genérico). */
  verticales: readonly VerticalProspeccion[];
  generico: VerticalProspeccion;
};

export type GrupoEnvio = { vertical: VerticalProspeccion; negocios: Negocio[] };

/** Los grupos de un envío: uno por plantilla. */
export function gruposParaEnvio(
  negocios: Negocio[],
  modo: ModoPlantilla,
  catalogo: CatalogoEnvio,
): GrupoEnvio[] {
  if (negocios.length === 0) return [];
  // Cada tanda se corta en los primeros TANDA_MAX_BOT: los que siguen en
  // «Nuevo» van adelante (sin cambiar el orden entre ellos), así reenviar la
  // misma selección no repite a los ya contactados y los nuevos sí salen.
  const ordenados = [
    ...negocios.filter((n) => n.estado === "nuevo"),
    ...negocios.filter((n) => n.estado !== "nuevo"),
  ];
  if (modo.tipo === "nicho") {
    return agruparPorVertical(ordenados, catalogo.verticales, catalogo.generico);
  }
  const vertical = verticalPorSlug(
    modo.slug,
    [...catalogo.verticales, catalogo.generico],
    catalogo.generico,
  );
  return [{ vertical, negocios: ordenados }];
}

/** Lo que el bot sabe del negocio cuando conversa. Las claves de repertorio
 * se OMITEN (nunca null) cuando el vertical no tiene: para el bot, ausente es
 * «no se sabe», y un bot viejo las ignora sin romperse. */
export type ContextoProspecto = {
  nombre: string;
  categoria?: string;
  ciudad?: string;
  /** El ángulo de una frase de siempre: sigue viajando por si el bot desplegado es viejo. */
  angulo: string;
  saludo: string;
  /** De Google Places, vía el CRM: decide qué gancho va primero. */
  sin_web: boolean;
  ganchos?: string[];
  senal_tipica?: string;
};

export function contextoDeProspecto(
  n: Negocio,
  vertical: VerticalProspeccion,
  catalogo: CatalogoEnvio,
): ContextoProspecto {
  const delNegocio = verticalPara(n.categoria, catalogo.verticales, catalogo.generico);
  const repertorio = repertorioPara(delNegocio.slug);
  return {
    nombre: n.nombre,
    categoria: n.categoria ?? undefined,
    ciudad: n.ciudad ?? undefined,
    angulo: delNegocio.angulo,
    saludo: vertical.texto,
    sin_web: esSinWeb(n),
    ...(repertorio
      ? { ganchos: [...repertorio.ganchos], senal_tipica: repertorio.senal }
      : {}),
  };
}

/**
 * Un prospecto para el bot. El saludo es el de la plantilla que sale (con el
 * texto EXACTO del catálogo, el folleto se pinta en la bandeja); el ángulo, la
 * señal y los ganchos son los del tipo de negocio aunque el saludo haya sido el
 * genérico: cuando responda, Zak ya sabe con quién habla y qué venderle.
 */
export function prospectoParaTanda(
  n: Negocio,
  vertical: VerticalProspeccion,
  catalogo: CatalogoEnvio,
) {
  return {
    telefono: sinMas(n.telefono as string),
    negocio_id: n.id,
    contexto: contextoDeProspecto(n, vertical, catalogo),
    componentes: componentesSaludo(vertical),
  };
}

export type VistaPrevia = {
  tandas: { slug: string; label: string; cantidad: number; enRevision: boolean }[];
  /** Negocios que salen en este envío. */
  total: number;
  /** No cupieron en su tanda: quedan para el siguiente envío. */
  sobrantes: number;
  /** Su plantilla está en revisión: no salen hasta que Meta la apruebe. */
  bloqueados: number;
};

/** Lo que el diálogo dice antes de mandar. Mismo reparto que despacharTandas:
 * una tanda por grupo, de máximo `tamano`. */
export function previsualizarEnvio(
  grupos: readonly GrupoEnvio[],
  tamano: number = TANDA_MAX_BOT,
): VistaPrevia {
  const vista: VistaPrevia = { tandas: [], total: 0, sobrantes: 0, bloqueados: 0 };
  for (const { vertical, negocios } of grupos) {
    const enRevision = Boolean(vertical.enRevision);
    const cantidad = Math.min(negocios.length, tamano);
    vista.tandas.push({ slug: vertical.slug, label: vertical.label, cantidad, enRevision });
    if (enRevision) {
      vista.bloqueados += negocios.length;
    } else {
      vista.total += cantidad;
      vista.sobrantes += negocios.length - cantidad;
    }
  }
  return vista;
}

const SLUG = /^[a-z0-9_-]{1,40}$/;

/** El modo que manda el navegador, validado: jamás confiar en el cliente. Sin
 * modo es «según el tipo de negocio» (lo de antes); lo que no se entiende es
 * null y el servidor lo rechaza en vez de adivinar. */
export function modoDesdeCliente(entrada: unknown): ModoPlantilla | null {
  if (entrada === undefined || entrada === null) return { tipo: "nicho" };
  if (typeof entrada !== "object") return null;
  const m = entrada as Record<string, unknown>;
  if (m.tipo === "nicho") return { tipo: "nicho" };
  if (m.tipo === "una" && typeof m.slug === "string" && SLUG.test(m.slug)) {
    return { tipo: "una", slug: m.slug };
  }
  return null;
}
