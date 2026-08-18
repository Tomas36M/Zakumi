// Catálogo de servicios de Zakumi y motor de oportunidades de upsell.
// Config en TS y no en tabla a propósito: lo editan solo Tomás/Paula, queda
// versionado en git y es testeable en vitest. Se promueve a tabla el día que
// deba editarse sin deploy.

import type { Canal } from "@/lib/bots/tipos";
import type { Ciclo, ProductoContratado, TipoProducto } from "./cartera";

export type Servicio = {
  slug: string;
  nombre: string;
  tipo: TipoProducto;
  canal: Canal | null;
  tarifaSugerida: number; // COP; sugerencia editable al contratar
  cicloSugerido: Ciclo;
  disponible: boolean; // false = "Próximamente" (gancho comercial visible)
  pitch: string;
};

export type Oportunidad = {
  servicio: Servicio;
  razon: string;
};

export const CATALOGO_ZAKUMI: readonly Servicio[] = [
  {
    slug: "bot-whatsapp",
    nombre: "Bot de WhatsApp",
    tipo: "bot",
    canal: "whatsapp",
    tarifaSugerida: 150_000,
    cicloSugerido: "mensual",
    disponible: true,
    pitch:
      "Un agente que atiende, vende y captura leads por WhatsApp 24/7, con escalado a humano.",
  },
  {
    slug: "pagina-web",
    nombre: "Página web",
    tipo: "web",
    canal: null,
    tarifaSugerida: 900_000,
    cicloSugerido: "unico",
    disponible: true,
    pitch: "Presencia propia con dominio, SEO local es-CO y botón directo a WhatsApp.",
  },
  {
    slug: "mantenimiento-web",
    nombre: "Mantenimiento web",
    tipo: "mantenimiento",
    canal: null,
    tarifaSugerida: 80_000,
    cicloSugerido: "mensual",
    disponible: true,
    pitch: "Hosting, cambios de contenido y soporte de la página, sin dolores de cabeza.",
  },
  {
    slug: "crm",
    nombre: "CRM",
    tipo: "crm",
    canal: null,
    tarifaSugerida: 120_000,
    cicloSugerido: "mensual",
    disponible: true,
    pitch: "Los clientes y pedidos del negocio organizados en un solo lugar.",
  },
  {
    slug: "agente-voz",
    nombre: "Agente de voz",
    tipo: "voz",
    canal: "voz",
    tarifaSugerida: 250_000,
    cicloSugerido: "mensual",
    disponible: false, // Próximamente: ElevenLabs, etapa siguiente
    pitch:
      "Un agente que contesta y hace llamadas (~US$0.08/min de conversación). " +
      "Por norma debe presentarse como IA al iniciar la llamada.",
  },
] as const;

/**
 * Qué se le puede vender a un cliente: el catálogo menos los tipos que ya
 * tiene activos, con la razón comercial de cada sugerencia. Ordenado:
 * disponibles primero y por tarifa sugerida descendente (mayor palanca arriba).
 */
export function oportunidades(productosActivos: ProductoContratado[]): Oportunidad[] {
  const activos = productosActivos.filter((p) => p.activo);
  const tiposContratados = new Set<TipoProducto>(activos.map((p) => p.tipo));
  const tieneBot = tiposContratados.has("bot");
  const tieneWeb = tiposContratados.has("web");

  const resultado: Oportunidad[] = [];
  for (const servicio of CATALOGO_ZAKUMI) {
    if (tiposContratados.has(servicio.tipo)) continue;
    // Mantenimiento sin página web no tiene qué mantener.
    if (servicio.tipo === "mantenimiento" && !tieneWeb) continue;

    let razon = servicio.pitch;
    if (servicio.tipo === "web" && tieneBot) {
      razon = "Ya tiene bot y no tiene web: el siguiente paso natural. " + servicio.pitch;
    } else if (servicio.tipo === "mantenimiento" && tieneWeb) {
      razon = "Tiene web sin mantenimiento contratado. " + servicio.pitch;
    } else if (servicio.tipo === "voz" && tieneBot) {
      razon = "Ya confía en un agente de WhatsApp: candidato natural a voz. " + servicio.pitch;
    }
    resultado.push({ servicio, razon });
  }

  return resultado.toSorted((a, b) => {
    if (a.servicio.disponible !== b.servicio.disponible) {
      return a.servicio.disponible ? -1 : 1;
    }
    return b.servicio.tarifaSugerida - a.servicio.tarifaSugerida;
  });
}

/** Suma de tarifas mensualizadas de los productos activos (anual → /12). */
export function mrrDeProductos(productos: ProductoContratado[]): number {
  return productos
    .filter((p) => p.activo)
    .reduce((total, p) => {
      if (p.ciclo === "mensual") return total + p.tarifa;
      if (p.ciclo === "anual") return total + p.tarifa / 12;
      return total; // pago único no es recurrente
    }, 0);
}
