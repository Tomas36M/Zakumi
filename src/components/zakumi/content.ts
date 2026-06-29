export type Stat = { num: string; acc?: string; label: string; desc: string };
export type ChatMsg = { from: "cliente" | "agente"; text: string };
export type Proyecto = { tag: string; title: string; img: string; alt: string };

export const HERO = {
  tag: "Agentes de IA para WhatsApp & Telegram",
  titulo1: "Tu mejor vendedor",
  tituloEm: "es inteligencia artificial.",
  sub: "Y detrás, software de verdad: CRM con IA, plataformas que escalan y tecnología bien construida.",
  ctaPrimario: "Habla con nuestro agente",
  ctaSecundario: "o escríbenos por Telegram",
};

export type HeroSlide = {
  id: string;
  tag: string;
  titulo1: string;
  tituloEm: string;
  sub: string;
  cta: string;
  waMsg: string;
  href: string;
  /** Si es true, el CTA abre WhatsApp (con waMsg) en vez de navegar a href. */
  ctaWa?: boolean;
  img: string;
  meta: { label: string; val: string }[];
};

// Hero como carrusel de los 3 servicios (primera vista: lo que vendemos).
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "agentes",
    tag: "Agentes de IA para WhatsApp & Telegram",
    titulo1: "Un agente de IA que",
    tituloEm: "responde y vende por ti.",
    sub: "Tu agente de IA atiende a cada cliente en WhatsApp y Telegram: responde dudas, toma pedidos y cierra ventas las 24 horas, los 7 días de la semana. Tú te encargas de entregar; la IA se encarga de vender, sin que tengas que estar pegado al celular.",
    cta: "Habla con nuestro agente",
    waMsg: "Hola Zakumi, quiero un agente de IA para mi WhatsApp.",
    href: "/agentes-ia",
    ctaWa: true,
    img: "/work/zk-hero-agentes-chat-v4.webp",
    meta: [
      { label: "Canales", val: "WhatsApp · Telegram · Redes" },
      { label: "Atiende", val: "24/7, sin que tú estés" },
      { label: "Responde", val: "En segundos" },
    ],
  },
  {
    id: "desarrollo",
    tag: "Software & plataformas a medida",
    titulo1: "Desarrollamos el software",
    tituloEm: "que tu negocio necesita.",
    sub: "Reemplazamos los Excel, los procesos manuales y las herramientas sueltas por un sistema web hecho a tu medida. Desde cero, rápido y confiable, con bases de datos serias en PostgreSQL que ordenan y automatizan la operación de tu negocio.",
    cta: "Cuéntanos tu proyecto",
    waMsg: "Hola Zakumi, quiero desarrollar un proyecto de software.",
    href: "/software",
    img: "/work/zk-hero-software-v1.webp",
    meta: [
      { label: "Tecnología", val: "Next.js · React · Postgres" },
      { label: "Entregamos", val: "Web · Apps · Plataformas" },
      { label: "Enfoque", val: "A medida, sin plantillas" },
    ],
  },
  {
    id: "marca",
    tag: "Marca & automatización de redes",
    titulo1: "Automatizamos tus",
    tituloEm: "redes sociales.",
    sub: "Identidad visual imponente y contenido publicado a diario, en automático. Tu marca sigue presente y vendiendo, sin que tengas que pensar en publicar.",
    cta: "Activa tu marca",
    waMsg: "Hola Zakumi, quiero impulsar mi marca y mis redes.",
    href: "/marca",
    img: "/work/zk-hero-marca-v1.webp",
    meta: [
      { label: "Incluye", val: "Identidad · Contenido · Redes" },
      { label: "Publica", val: "Automático, a diario" },
      { label: "Resultado", val: "Marca siempre presente" },
    ],
  },
];

export type ProductoShowcase = {
  idx: number;
  titulo1: string;
  tituloEm: string;
  sub: string;
  features: string[];
  img: string;
  alt: string;
};

// Showcase "02 / Producto": recorrido por scroll (pin + crossfade) entre 3 productos.
export const PRODUCTOS_SHOWCASE: ProductoShowcase[] = [
  {
    idx: 1,
    titulo1: "Landings",
    tituloEm: "que convierten.",
    sub: "Páginas de aterrizaje rápidas y a medida, pensadas para una sola cosa: volver visitas en clientes.",
    features: [
      "Diseño a medida, no plantillas",
      "Carga veloz y SEO técnico",
      "Copy y CTAs que guían a la acción",
      "Medición y A/B para subir conversión",
    ],
    img: "/work/zk-prod-landing.webp",
    alt: "Render de una landing page de alto impacto diseñada por Zakumi",
  },
  {
    idx: 2,
    titulo1: "Un CRM",
    tituloEm: "que piensa.",
    sub: "Te construimos un CRM con Anthropic, Gemini y OpenAI trabajando para tu equipo de ventas — cada modelo en lo que mejor hace.",
    features: [
      "Clasifica y prioriza tus leads",
      "Responde y resume conversaciones",
      "Agenda y da seguimiento solo",
      "Escala a una persona cuando hay intención real",
    ],
    img: "/work/zk-prod-crm.webp",
    alt: "Dashboard de un CRM con IA multimodelo construido por Zakumi",
  },
  {
    idx: 3,
    titulo1: "Ecommerce",
    tituloEm: "que vende solo.",
    sub: "Tiendas online completas: catálogo, carrito y pagos — con un agente de IA que asesora y cierra la venta por ti.",
    features: [
      "Catálogo, carrito y checkout listos",
      "Pasarela de pagos integrada",
      "Agente de IA que asesora y vende",
      "Inventario y pedidos en un panel",
    ],
    img: "/work/zk-prod-ecommerce.webp",
    alt: "Render de una tienda online a medida desarrollada por Zakumi",
  },
];

// Guion de la demo del agente (mensajes hardcodeados, no conexión en vivo).
export const CHAT_GUION: ChatMsg[] = [
  { from: "cliente", text: "Hola, ¿hacen páginas web con pasarela de pago?" },
  { from: "agente", text: "¡Hola! Sí 🙌 Diseñamos y desarrollamos la tienda completa, con pagos y todo listo para vender. ¿Qué vendes?" },
  { from: "cliente", text: "Ropa. Tengo unos 40 productos." },
  { from: "agente", text: "Perfecto. Para 40 productos te armamos catálogo, carrito y checkout. ¿Te paso una propuesta y agendamos una llamada de 15 min esta semana?" },
  { from: "cliente", text: "Sí, dale 🔥" },
  { from: "agente", text: "Listo, te reservo el jueves 3:00 p. m. Te llega confirmación por aquí. ¡Gracias! 🚀" },
];

export const TECNOLOGIAS: string[] = [
  "Next.js", "React", "TypeScript", "Postgres", "Tailwind", "GSAP",
  "Anthropic", "Gemini", "OpenAI", "n8n",
];

// Reusar imágenes que YA existen en public/work como placeholders; el usuario las reemplaza luego.
export const PROYECTOS: Proyecto[] = [
  { tag: "Agente IA", title: "Agente de ventas en WhatsApp", img: "/work/zk-software-foto.webp", alt: "Agente de IA de ventas de Zakumi en WhatsApp" },
  { tag: "Software", title: "Plataforma a medida", img: "/work/zk-ink-foto.webp", alt: "Plataforma de software a medida construida por Zakumi" },
  { tag: "CRM", title: "CRM con IA multimodelo", img: "/work/zk-form-foto.webp", alt: "CRM con IA multimodelo de Zakumi" },
];

export const STATS: Stat[] = [
  { num: "3", label: "Disciplinas, un equipo", desc: "IA, software y marca bajo un mismo techo. Sin intermediarios." },
  { num: "24/7", label: "Tus agentes no duermen", desc: "Atención y ventas a toda hora, sin que tú estés conectado." },
  { num: "0", label: "Plantillas", desc: "Cada proyecto se construye a la medida, desde cero." },
  { num: "∞", label: "Iteraciones", desc: "Ajustamos hasta que cada detalle quede exacto." },
];

export const CONTACTO = {
  titulo1: "Habla con nuestro agente",
  tituloEm: "ahora.",
  sub: "Es el mismo agente de IA que pondríamos a trabajar para ti. Escríbele por WhatsApp y ve cómo atiende — sin formularios eternos, sin compromiso.",
};
