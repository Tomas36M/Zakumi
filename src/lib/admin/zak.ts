// Lógica pura de la prospección de Zak (testeable en vitest node).
// Zak abre leads: Tomás selecciona negocios del CRM, Zak les manda la
// plantilla y conversa con contexto. Aquí viven las reglas de quién es
// contactable y cómo avanzan los estados del CRM — nunca hacia atrás.

import type { EstadoNegocio, Negocio } from "./negocios";
import type { Prospecto } from "@/lib/bots/tipos";

/** A quién se le puede mandar la plantilla: celular real y que no sea ya
 * cliente ni descartado (a un cliente no se le prospecta en frío). */
export function contactables(negocios: Negocio[]): Negocio[] {
  return negocios.filter(
    (n) =>
      n.telefono !== null &&
      n.tipo_telefono === "movil" &&
      n.estado !== "cliente" &&
      n.estado !== "descartado",
  );
}

// Dominio público donde viven los folletos (public/folletos/). Meta descarga
// la imagen de este link EN el envío, así que tiene que ser alcanzable desde
// internet — el fallback de producción, jamás localhost.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com"
).replace(/\/+$/, "");

export function urlFolleto(vertical: VerticalProspeccion): string {
  return `${SITE_URL}/folletos/${vertical.folleto}`;
}

/**
 * Los components de la plantilla de un vertical: el folleto del nicho viaja
 * como header de imagen. El body sigue SIN variables (verificado 20 ago 2026);
 * si Meta algún día aprueba un {{1}}, el body se arma aquí — el bot reenvía
 * los components tal cual y no hay que tocarlo.
 *
 * OJO: exige que la plantilla esté aprobada en Meta CON header de imagen.
 * Contra la versión solo-texto, mandar el header es un 4xx permanente
 * (el prospecto queda 'fallido' en el funnel).
 */
export function componentesSaludo(vertical: VerticalProspeccion): unknown[] {
  return [
    {
      type: "header",
      parameters: [{ type: "image", image: { link: urlFolleto(vertical) } }],
    },
  ];
}

// El cuerpo visible de saludo_zakumi: se guarda como mensaje del asistente al
// abrir/reabrir un chat, para que la conversación exista en la bandeja y Zak
// sepa que ya saludó. Mantener en espejo con la plantilla aprobada en Meta.
export const PLANTILLA_SALUDO = "saludo_zakumi";
export const PLANTILLA_SALUDO_TEXTO =
  "¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. " +
  "Me pidieron saludarte por aquí — escríbeme cualquier cosa y conversamos. 🧡";

// ---------- Verticales de prospección ----------
// Cada vertical define: la plantilla de Meta con la que Zak ABRE (su cuerpo en
// `texto`, espejo de lo aprobado), los `matchers` contra la categoría de Google
// del CRM, y el `angulo` — el concepto de venta que viaja en el contexto del
// prospecto para que Zak converse con el pitch correcto. Agregar un vertical =
// una entrada aquí + crear su plantilla en Meta. Cero deploys del bot.

export type VerticalProspeccion = {
  slug: string;
  label: string;
  plantilla: string; // nombre de la plantilla en Meta
  texto: string; // cuerpo visible (espejo de la plantilla)
  angulo: string; // cómo hablarle a este tipo de negocio
  matchers: string[]; // substrings de negocios.categoria (Google Places)
  folleto: string; // archivo en public/folletos/ — header de imagen de la plantilla
};

const _SALUDO = (queHacemos: string, emoji: string) =>
  `¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos ${queHacemos} — ` +
  `con un agente como yo. ¿Te cuento cómo se vería en tu negocio? ${emoji}`;

export const VERTICALES_PROSPECCION: readonly VerticalProspeccion[] = [
  {
    slug: "restaurante",
    label: "Restaurante",
    plantilla: "saludo_restaurante",
    texto: _SALUDO("a restaurantes a tomar pedidos y reservas por WhatsApp 24/7, sin perder llamadas en hora pico", "🍽️"),
    angulo: "Pedidos completos y reservas sin perder llamadas en hora pico: el agente toma el pedido con dirección y forma de pago mientras la cocina trabaja.",
    folleto: "restaurante.png",
    matchers: ["restaurant", "food", "cafe", "coffee", "burger", "pizza", "comida"],
  },
  {
    slug: "panaderia",
    label: "Panadería",
    plantilla: "saludo_panaderia",
    texto: _SALUDO("a panaderías a vender el surtido del día y tomar encargos de tortas por WhatsApp 24/7", "🥐"),
    angulo: "Encargos de tortas y pedidos del día sin ocupar el mostrador; el agente confirma sabores, porciones y fecha de entrega.",
    folleto: "panaderia.png",
    matchers: ["bakery", "pastry", "panader"],
  },
  {
    slug: "ferreteria",
    label: "Ferretería",
    plantilla: "saludo_ferreteria",
    texto: _SALUDO("a ferreterías a responder precios y disponibilidad y tomar pedidos por WhatsApp 24/7, sin filas en el mostrador", "🔧"),
    angulo: "Los '¿tienen X? ¿a cómo?' respondidos al instante desde el catálogo; pedidos listos para recoger o despachar a obra.",
    folleto: "ferreteria.png",
    matchers: ["hardware", "building materials", "paint", "ferreter", "electrical supply", "plumbing"],
  },
  {
    slug: "veterinaria",
    label: "Veterinaria",
    plantilla: "saludo_veterinaria",
    texto: _SALUDO("a veterinarias a agendar citas y responder a los dueños de mascotas a toda hora", "🐾"),
    angulo: "Citas y recordatorios de vacunas; los dueños preguntan a cualquier hora y el agente agenda sin interrumpir la consulta.",
    folleto: "veterinaria.png",
    matchers: ["veterinar", "pet"],
  },
  {
    slug: "farmacia",
    label: "Droguería",
    plantilla: "saludo_farmacia",
    texto: _SALUDO("a droguerías a tomar pedidos a domicilio y responder disponibilidad al instante", "💊"),
    angulo: "Domicilios y disponibilidad al momento, con el teléfono siempre desocupado.",
    folleto: "farmacia.png",
    matchers: ["pharmacy", "drugstore", "drogueria", "droguería"],
  },
  {
    slug: "belleza",
    label: "Belleza",
    plantilla: "saludo_belleza",
    texto: _SALUDO("a salones y barberías a llenar la agenda por WhatsApp 24/7, sin interrumpir el servicio", "💇"),
    angulo: "Agenda llena sin soltar las tijeras: el agente da citas, reagenda y manda recordatorios.",
    folleto: "belleza.png",
    matchers: ["beauty", "hair", "barber", "nail", "spa", "peluquer"],
  },
  {
    slug: "taller",
    label: "Taller",
    plantilla: "saludo_taller",
    texto: _SALUDO("a talleres a agendar revisiones y cotizar repuestos por WhatsApp, sin soltar la herramienta", "🔩"),
    angulo: "Citas de revisión y cotización de repuestos mientras el equipo trabaja; el cliente sabe cuándo traer el carro.",
    folleto: "taller.png",
    matchers: ["car repair", "auto parts", "motorcycle", "mechanic", "taller", "car wash", "tire"],
  },
  {
    slug: "hogar",
    label: "Hogar y muebles",
    plantilla: "saludo_hogar",
    texto: _SALUDO("a tiendas de muebles y hogar a cotizar productos y coordinar entregas por WhatsApp 24/7", "🛋️"),
    angulo: "Cotizaciones con medidas y fotos, y coordinación de entregas sin llamadas cruzadas.",
    folleto: "hogar.png",
    matchers: ["furniture", "home goods", "appliance", "home improvement", "decor", "mueble"],
  },
  {
    slug: "moda",
    label: "Moda",
    plantilla: "saludo_moda",
    texto: _SALUDO("a tiendas de ropa a mostrar novedades, responder tallas y apartar prendas por WhatsApp", "👗"),
    angulo: "Novedades, tallas y apartados: el agente vende por chat mientras la tienda atiende.",
    folleto: "moda.png",
    matchers: ["clothing", "shoe", "boutique", "fashion", "jewelry", "ropa"],
  },
  {
    slug: "comercio",
    label: "Comercio",
    plantilla: "saludo_comercio",
    texto: _SALUDO("a tiendas y comercios a responder clientes y tomar pedidos por WhatsApp 24/7", "🛍️"),
    angulo: "Pedidos y preguntas frecuentes respondidos al momento: la venta no se enfría esperando.",
    folleto: "comercio.png",
    matchers: ["store", "shop", "market", "grocery", "supermarket", "convenience", "tienda", "florist", "garden"],
  },
] as const;

export const VERTICAL_GENERICO: VerticalProspeccion = {
  slug: "generico",
  label: "Genérico",
  plantilla: PLANTILLA_SALUDO,
  texto: PLANTILLA_SALUDO_TEXTO,
  angulo: "Descubre a qué se dedica el negocio y muestra cómo un agente como tú le atendería clientes 24/7.",
  folleto: "generico.png",
  matchers: [],
};

/** El vertical de un negocio según su categoría de Google (fallback genérico).
 * El orden del catálogo importa: gana el primer match — 'comercio' va de
 * último porque sus matchers ("store") son los más genéricos. */
export function verticalPara(categoria: string | null): VerticalProspeccion {
  if (!categoria) return VERTICAL_GENERICO;
  const c = categoria.toLowerCase();
  for (const v of VERTICALES_PROSPECCION) {
    if (v.matchers.some((m) => c.includes(m))) return v;
  }
  return VERTICAL_GENERICO;
}

/** Agrupa negocios por vertical (para crear una tanda por plantilla). */
export function agruparPorVertical(
  negocios: Negocio[],
): { vertical: VerticalProspeccion; negocios: Negocio[] }[] {
  const grupos = new Map<string, { vertical: VerticalProspeccion; negocios: Negocio[] }>();
  for (const n of negocios) {
    const v = verticalPara(n.categoria);
    const g = grupos.get(v.slug) ?? { vertical: v, negocios: [] };
    g.negocios.push(n);
    grupos.set(v.slug, g);
  }
  return [...grupos.values()];
}

/** Ventana de 24h de Meta: fuera de ella el texto libre se descarta en
 * silencio y solo valen plantillas. Sin mensaje del cliente = sin ventana. */
export function fueraDeVentana(ultimoDelCliente: string | null, ahoraMs: number): boolean {
  if (!ultimoDelCliente) return true;
  const t = Date.parse(ultimoDelCliente);
  if (Number.isNaN(t)) return true;
  return ahoraMs - t > 24 * 60 * 60 * 1000;
}

export type AvanceEstado = { id: string; a: EstadoNegocio };

/**
 * Qué negocios del CRM deben avanzar de estado según su prospecto.
 * Forward-only: jamás retrocede (interesado no vuelve a respondido),
 * jamás toca cliente ni descartado. El match es por negocio_id — para
 * eso se guardó en el prospecto.
 */
export function avancesDeEstado(
  prospectos: Prospecto[],
  actuales: { id: string; estado: EstadoNegocio }[],
): AvanceEstado[] {
  const porNegocio = new Map(
    prospectos
      .filter((p) => p.negocio_id !== null)
      .map((p) => [p.negocio_id as string, p]),
  );
  const avances: AvanceEstado[] = [];
  for (const n of actuales) {
    const p = porNegocio.get(n.id);
    if (!p) continue;
    if (n.estado === "cliente" || n.estado === "descartado") continue;
    if (p.interesado && n.estado !== "interesado") {
      avances.push({ id: n.id, a: "interesado" });
    } else if (
      p.estado_envio === "respondido" &&
      (n.estado === "nuevo" || n.estado === "contactado")
    ) {
      avances.push({ id: n.id, a: "respondido" });
    }
  }
  return avances;
}
