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
  /** COP, pago único al empezar, aparte de la tarifa (el montaje del bot). */
  montaje?: number;
  disponible: boolean; // false = "Próximamente" (gancho comercial visible)
  pitch: string;
};

// Precios aprobados el 15 sep 2026 para PyMEs (spec 2026-09-15-zak-vendedor
// § 4.10). Brochure y página de precios dicen lo mismo que esto; si cambian
// allá, cambian aquí. Zak no los dice en el chat: cotiza Tomás.
export const CATALOGO_ZAKUMI: readonly Servicio[] = [
  {
    slug: "bot-whatsapp",
    nombre: "Bot de WhatsApp",
    tipo: "bot",
    canal: "whatsapp",
    tarifaSugerida: 129_900,
    cicloSugerido: "mensual",
    montaje: 199_900,
    disponible: true,
    pitch:
      "Un agente que atiende, vende y captura leads por WhatsApp 24/7, con escalado a humano.",
  },
  {
    slug: "landing",
    nombre: "Landing / menú digital con QR",
    tipo: "web",
    canal: null,
    tarifaSugerida: 590_000,
    cicloSugerido: "unico",
    disponible: true,
    pitch:
      "Una página con tu marca, dominio el primer año, botón directo a WhatsApp y QR para el local.",
  },
  {
    slug: "pagina-web",
    nombre: "Página web",
    tipo: "web",
    canal: null,
    tarifaSugerida: 1_190_000,
    cicloSugerido: "unico",
    disponible: true,
    pitch: "Hasta cinco secciones, formulario, SEO local es-CO y botón directo a WhatsApp.",
  },
  {
    slug: "tienda-online",
    nombre: "Tienda online con pagos",
    tipo: "web",
    canal: null,
    tarifaSugerida: 1_490_000,
    cicloSugerido: "unico",
    disponible: true,
    pitch:
      "Catálogo de hasta 50 productos, carrito, pagos con Wompi o Bold y el pedido directo a tu WhatsApp.",
  },
  {
    slug: "mantenimiento-web",
    nombre: "Mantenimiento web",
    tipo: "mantenimiento",
    canal: null,
    tarifaSugerida: 49_900,
    cicloSugerido: "mensual",
    disponible: true,
    pitch: "Hosting, dominio, dos cambios de contenido al mes y soporte, sin dolores de cabeza.",
  },
  {
    slug: "crm",
    nombre: "CRM",
    tipo: "crm",
    canal: null,
    tarifaSugerida: 99_900,
    cicloSugerido: "mensual",
    disponible: true,
    pitch: "Los clientes y pedidos del negocio organizados en un solo lugar.",
  },
  {
    slug: "agente-voz",
    nombre: "Agente de voz",
    tipo: "voz",
    canal: "voz",
    tarifaSugerida: 249_900,
    cicloSugerido: "mensual",
    montaje: 199_900,
    disponible: true,
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
  { slug: "landing", palabras: ["landing", "menu", "qr"] },
  { slug: "tienda-online", palabras: ["tienda", "carrito", "ecommerce", "e-commerce", "pagos"] },
  { slug: "bot-whatsapp", palabras: ["whatsapp", "bot", "chatbot"] },
  { slug: "agente-voz", palabras: ["voz", "llamada", "telefono", "call"] },
  { slug: "crm", palabras: ["crm", "clientes"] },
  { slug: "pagina-web", palabras: ["pagina", "web", "sitio"] },
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
