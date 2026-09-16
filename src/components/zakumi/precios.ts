// La página pública de precios (/precios). Una sola fuente de verdad: los siete
// productos con precio salen de src/lib/catalogo.ts (si cambian allá, cambian
// aquí y en la tienda del portal). Lo que el catálogo del portal no tiene
// —los «desde», los combos, cómo cobramos y lo grande por cotización— vive
// aquí. Zak no dice precios en el chat: los dice esta página y Tomás.

import { CATALOGO_ZAKUMI, type Servicio } from "@/lib/catalogo";
import { waLink } from "./contact";

/** Cómo se paga: la estructura de la página es el ritmo de cobro, no un orden. */
export type Cadencia = "mes" | "unico" | "desde";

export type Tarifa = {
  slug: string;
  nombre: string;
  desc: string;
  /** COP. */
  precio: number;
  cadencia: Cadencia;
  /** COP, pago único al empezar, aparte del precio (el montaje del agente). */
  montaje?: number;
  waMsg: string;
};

export type Grupo = { cadencia: Cadencia; titulo: string; nota: string; tarifas: Tarifa[] };

export type Combo = {
  slug: string;
  nombre: string;
  para: string;
  precio: number;
  incluye: string[];
  /** Lo que costaría comprar las piezas sueltas (para decir cuánto se ahorra). */
  sueltos?: number;
  destacado?: boolean;
  waMsg: string;
};

/** $590.000 — separador de miles colombiano, sin decimales. */
export function cop(n: number): string {
  return `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export const SUFIJO: Record<Cadencia, string> = {
  mes: "al mes",
  unico: "pago único",
  desde: "desde",
};

function mensaje(nombre: string): string {
  return `Hola Zakumi, vi los precios y me interesa ${nombre}. ¿Me cuentan cómo empezamos?`;
}

// Nombres y descripciones para el dueño de un negocio de barrio: lo que hace
// cada cosa, no cómo está construida. El precio viene del catálogo.
const PRESENTACION: Record<string, { nombre: string; desc: string }> = {
  "bot-whatsapp": {
    nombre: "Zak, tu agente de WhatsApp",
    desc: "Responde, toma pedidos y agenda citas a toda hora, con tus precios y tu forma de hablar. Hasta 150 conversaciones al mes.",
  },
  "agente-voz": {
    nombre: "Agente de voz",
    desc: "Contesta y hace llamadas por ti, se presenta como IA y te deja el resumen de cada una. 120 minutos al mes.",
  },
  crm: {
    nombre: "CRM",
    desc: "Tus clientes, pedidos y conversaciones en un solo lugar, sin hojas de cálculo.",
  },
  "mantenimiento-web": {
    nombre: "Mantenimiento web",
    desc: "Hosting, dominio, dos cambios de contenido al mes y alguien a quien escribirle cuando algo falla.",
  },
  landing: {
    nombre: "Landing o menú digital con QR",
    desc: "Una página con tu marca y tu dominio el primer año, botón directo a WhatsApp y el QR para el local.",
  },
  "pagina-web": {
    nombre: "Página web",
    desc: "Hasta cinco secciones, formulario, posicionamiento local y botón directo a WhatsApp.",
  },
  "tienda-online": {
    nombre: "Tienda online con pagos",
    desc: "Hasta 50 productos, carrito, pagos con Wompi o Bold y cada pedido directo a tu WhatsApp.",
  },
};

function tarifaDelCatalogo(slug: string, cadencia: Cadencia): Tarifa {
  const s: Servicio | undefined = CATALOGO_ZAKUMI.find((x) => x.slug === slug);
  if (!s) throw new Error(`precios: el catálogo no tiene «${slug}»`);
  const p = PRESENTACION[slug] ?? { nombre: s.nombre, desc: s.pitch };
  return {
    slug,
    nombre: p.nombre,
    desc: p.desc,
    precio: s.tarifaSugerida,
    cadencia,
    ...(s.montaje ? { montaje: s.montaje } : {}),
    waMsg: mensaje(p.nombre),
  };
}

function tarifaDesde(slug: string, nombre: string, desc: string, precio: number): Tarifa {
  return { slug, nombre, desc, precio, cadencia: "desde", waMsg: mensaje(nombre) };
}

export const GRUPOS: readonly Grupo[] = [
  {
    cadencia: "mes",
    titulo: "Al mes",
    nota: "Sin permanencia: se paga mes a mes y se cancela cuando quieras.",
    tarifas: ["bot-whatsapp", "agente-voz", "crm", "mantenimiento-web"].map((s) =>
      tarifaDelCatalogo(s, "mes"),
    ),
  },
  {
    cadencia: "unico",
    titulo: "Una vez",
    nota: "Anticipo del 50 % para arrancar y el saldo contra entrega.",
    tarifas: ["landing", "pagina-web", "tienda-online"].map((s) => tarifaDelCatalogo(s, "unico")),
  },
  {
    cadencia: "desde",
    titulo: "Desde",
    nota: "Precio de entrada; el valor final depende del alcance.",
    tarifas: [
      tarifaDesde(
        "automatizacion",
        "Automatización de procesos",
        "Que el formulario, el WhatsApp, el correo y la hoja de cálculo se hablen solos.",
        890_000,
      ),
      tarifaDesde(
        "identidad",
        "Identidad de marca",
        "Logo, paleta, tipografías y una guía para que todo lo que publiques se vea tuyo.",
        890_000,
      ),
      tarifaDesde(
        "marca-estrategia",
        "Marca + estrategia",
        "Posicionamiento, narrativa, identidad y las piezas base para salir al mercado.",
        1_990_000,
      ),
    ],
  },
];

/** Todas las tarifas, en el orden de la página. */
export const TARIFAS: readonly Tarifa[] = GRUPOS.flatMap((g) => g.tarifas);

const zak = tarifaDelCatalogo("bot-whatsapp", "mes");
const landing = tarifaDelCatalogo("landing", "unico");
const tienda = tarifaDelCatalogo("tienda-online", "unico");

/** Lo que cuesta Zak cada mes: todos los combos lo suman desde el segundo mes. */
export const MENSUALIDAD_ZAK = zak.precio;
const MONTAJE_ZAK = zak.montaje ?? 0;

export const COMBOS: readonly Combo[] = [
  // El destacado del hero: para cualquier negocio, no para un nicho.
  {
    slug: "plan-completo",
    nombre: "Plan completo",
    para: "Para cualquier negocio: página propia y un agente que atiende el WhatsApp.",
    precio: 690_000,
    incluye: [
      "Landing con tu marca, tu dominio el primer año y el QR para el local",
      "Zak atendiendo tu WhatsApp: responde, toma pedidos y agenda citas",
      "Montaje de Zak incluido",
      "Botón directo a WhatsApp y posicionamiento local básico",
    ],
    sueltos: landing.precio + MONTAJE_ZAK,
    destacado: true,
    waMsg: mensaje("el Plan completo (landing + Zak)"),
  },
  {
    slug: "domicilios-propios",
    nombre: "Domicilios propios",
    para: "Para el restaurante que vive de Rappi o de llamadas.",
    precio: 890_000,
    incluye: [
      "Menú digital con QR y tu marca",
      "Pedidos por WhatsApp que Zak toma completos: plato, dirección y pago",
      "Link de pago en línea, sin comisión por pedido",
      "Montaje de Zak incluido",
    ],
    waMsg: mensaje("el combo Domicilios propios"),
  },
  {
    slug: "agenda-llena",
    nombre: "Agenda llena",
    para: "Para salones, veterinarias y talleres que agendan por chat.",
    precio: 690_000,
    incluye: ["Landing con reservas", "Zak agenda, reagenda y recuerda", "Montaje de Zak incluido"],
    sueltos: landing.precio + MONTAJE_ZAK,
    waMsg: mensaje("el combo Agenda llena"),
  },
  {
    slug: "tienda-y-zak",
    nombre: "Tienda + Zak",
    para: "Para moda, hogar y encargos que se venden con foto.",
    precio: 1_590_000,
    incluye: ["Tienda online con pagos", "Zak responde tallas, aparta y toma pedidos", "Montaje de Zak incluido"],
    sueltos: tienda.precio + MONTAJE_ZAK,
    waMsg: mensaje("el combo Tienda + Zak"),
  },
];

export const COMBO_DESTACADO: Combo = COMBOS.find((c) => c.destacado) as Combo;

/** Lo que se cotiza a la medida: sin cifra, a propósito. */
export const PARA_EMPRESAS: readonly { nombre: string; desc: string }[] = [
  { nombre: "Aplicación web", desc: "Panel, usuarios, base de datos y flujos a la medida de tu operación." },
  { nombre: "Aplicación móvil", desc: "Un producto para Android y iOS, desde la primera versión que valida la idea." },
  { nombre: "Software a medida", desc: "Una plataforma construida alrededor de cómo trabaja tu empresa." },
  { nombre: "CRM con IA", desc: "Leads, pipeline, conversaciones, reportes y recomendaciones." },
];

export const REGLAS: readonly { titulo: string; desc: string }[] = [
  { titulo: "Se prueba antes.", desc: "Le escribes a Zak desde tu celular y ves cómo atiende antes de pagar." },
  { titulo: "Sin permanencia.", desc: "Las mensualidades se cancelan cuando quieras, sin cláusulas." },
  { titulo: "Anticipo del 50 %.", desc: "Lo de pago único arranca con la mitad; el saldo, contra entrega." },
  { titulo: "El alcance manda.", desc: "Son precios de entrada; pantallas, integraciones y contenido mueven el valor final." },
];

export const WA_PRECIOS = waLink(
  "Hola Zakumi, vi los precios y no sé qué me conviene. ¿Me ayudan a elegir?",
);

export const SEO = {
  title: "Precios | Zakumi — agentes de IA, páginas web y tiendas para negocios en Colombia",
  description:
    "Precios claros para negocios de barrio: agente de WhatsApp desde $129.900 al mes, landing desde $590.000, tienda online con pagos desde $1.490.000. Sin permanencia y se prueba antes.",
};
