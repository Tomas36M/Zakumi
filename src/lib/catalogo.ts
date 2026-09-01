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
    disponible: true,
    pitch:
      "Un agente que contesta y hace llamadas (~US$0.08/min de conversación). " +
      "Por norma debe presentarse como IA al iniciar la llamada.",
  },
] as const;

export function servicioDelSlug(slug: string): Servicio | null {
  return CATALOGO_ZAKUMI.find((s) => s.slug === slug) ?? null;
}
