// Catálogo de servicios de Zakumi — compartido entre el panel (/admin, motor
// de upsell) y el portal de clientes (/app, tienda). Vive fuera de lib/admin
// para que el portal no arrastre imports del panel.
//
// Config en TS y no en tabla a propósito: lo editan solo Tomás/Paula, queda
// versionado en git y es testeable en vitest. Se promueve a tabla el día que
// deba editarse sin deploy.

import type { Canal } from "@/lib/bots/tipos";
import type { Ciclo, TipoProducto } from "@/lib/admin/cartera";

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

export function servicioDelSlug(slug: string): Servicio | null {
  return CATALOGO_ZAKUMI.find((s) => s.slug === slug) ?? null;
}

/** Solicitud entrante donde el agente no logró identificar el servicio. No
 *  está en el catálogo a propósito: la bandeja lo muestra crudo y eso es una
 *  señal útil ("hay que preguntarle"), no un error. */
export const SLUG_POR_DEFINIR = "por-definir";

/** Palabras clave por slug. El ORDEN importa: 'mantenimiento web' contiene
 *  'web', así que mantenimiento tiene que evaluarse antes que página web. */
const CLAVES: readonly { slug: string; palabras: readonly string[] }[] = [
  { slug: "mantenimiento-web", palabras: ["mantenimiento", "soporte"] },
  { slug: "bot-whatsapp", palabras: ["whatsapp", "bot", "chatbot"] },
  { slug: "agente-voz", palabras: ["voz", "llamada", "telefono", "call"] },
  { slug: "crm", palabras: ["crm", "clientes"] },
  { slug: "pagina-web", palabras: ["pagina", "web", "sitio", "landing"] },
] as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    // Marcas diacríticas combinantes: lo que "NFD" separa de la letra base
    // (á → a + ´). El rango va escapado con \u a propósito: la versión
    // anterior traía esos mismos caracteres incrustados LITERALES en el
    // regex — invisibles en el editor y un riesgo si alguien copia/pega mal
    // el archivo.
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Lo que el agente extrajo en `servicio_interes` (texto libre) → slug del
 * catálogo. Nunca lanza y nunca devuelve vacío: sin coincidencia,
 * SLUG_POR_DEFINIR.
 */
export function slugDeInteres(texto: unknown): string {
  if (typeof texto !== "string" || texto.trim() === "") return SLUG_POR_DEFINIR;
  const t = normalizar(texto);
  const exacto = CATALOGO_ZAKUMI.find((s) => s.slug === t.trim());
  if (exacto) return exacto.slug;
  for (const { slug, palabras } of CLAVES) {
    if (palabras.some((p) => t.includes(p))) return slug;
  }
  return SLUG_POR_DEFINIR;
}
