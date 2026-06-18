export type Pilar = { num: string; titulo: string; desc: string; tags: string[] };
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
  img: string;
  bubble?: boolean;
};

// Hero como carrusel de los 3 servicios (primera vista: lo que vendemos).
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "agentes",
    tag: "Agentes de IA · WhatsApp & Telegram",
    titulo1: "Tu mejor vendedor",
    tituloEm: "es inteligencia artificial.",
    sub: "Atiende, responde y cierra ventas 24/7 — sin que tú estés. El mismo agente que pondríamos a trabajar para ti.",
    cta: "Habla con nuestro agente",
    waMsg: "Hola Zakumi, quiero un agente de IA para mi WhatsApp.",
    img: "/work/zk-hero-foto.webp",
    bubble: true,
  },
  {
    id: "desarrollo",
    tag: "Software & plataformas a medida",
    titulo1: "Construimos el software",
    tituloEm: "que sostiene tu crecimiento.",
    sub: "Web, apps y sistemas hechos a tu medida con Next.js, React y datos serios. Del prototipo a producción — nada de plantillas.",
    cta: "Cuéntanos tu proyecto",
    waMsg: "Hola Zakumi, quiero desarrollar un proyecto de software.",
    img: "/work/zk-software-foto.webp",
  },
  {
    id: "marca",
    tag: "Marca · Contenido · Redes 24/7",
    titulo1: "Tu marca, viva.",
    tituloEm: "Tus redes, en automático.",
    sub: "Identidad con criterio + contenido y publicación automatizada. Presencia todos los días, sin que tengas que estar pendiente.",
    cta: "Activa tu marca",
    waMsg: "Hola Zakumi, quiero impulsar mi marca y mis redes.",
    img: "/work/zk-brand-foto2.webp",
  },
];

export const PILARES: Pilar[] = [
  {
    num: "— I.",
    titulo: "IA & Automatización",
    desc: "Agentes de venta y atención que trabajan 24/7 en WhatsApp, Telegram y redes. Automatización e integraciones que conectan todo.",
    tags: ["Agentes de venta", "Atención 24/7", "Automatización", "Integraciones"],
  },
  {
    num: "— II.",
    titulo: "Software & Plataformas",
    desc: "Plataformas grandes y sostenibles, web y apps a medida, con bases de datos serias. Construido con Next.js, React, Postgres y TypeScript.",
    tags: ["Plataformas a medida", "Web & apps", "Bases de datos", "Código propio"],
  },
  {
    num: "— III.",
    titulo: "Marca & Contenido",
    desc: "Identidad visual con criterio, manejo de redes y creación de contenido que mantiene tu marca viva y coherente.",
    tags: ["Identidad visual", "Manejo de redes", "Contenido", "Dirección de arte"],
  },
];

export const CRM = {
  titulo1: "Un CRM",
  tituloEm: "que piensa.",
  sub: "Te construimos un CRM con Anthropic, Gemini y OpenAI trabajando para tu equipo de ventas — cada modelo en lo que mejor hace.",
  features: [
    "Clasifica y prioriza tus leads",
    "Responde y resume conversaciones",
    "Agenda y da seguimiento solo",
    "Escala a una persona cuando hay intención real",
  ],
  nota: "Lo desarrollamos a tu medida; no es una plantilla.",
};

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

// Mantener los nombres de archivo existentes (zk-hero-2/3 ya existen); el usuario reemplaza el contenido in situ.
export const HERO_IMAGES = [
  "/work/zk-hero-foto.webp",
  "/work/zk-hero-2.webp",
  "/work/zk-hero-3.webp",
];
