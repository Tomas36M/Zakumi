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
  img: string;
  meta: { label: string; val: string }[];
};

// Hero como carrusel de los 3 servicios (primera vista: lo que vendemos).
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "agentes",
    tag: "Agentes de IA para WhatsApp & Telegram",
    titulo1: "Deja de perder ventas",
    tituloEm: "por no responder a tiempo.",
    sub: "Convierte tu chat en una máquina de conversión automatizada. Tu nuevo agente de IA atiende, persuade y cierra tratos las 24 horas del día, los 7 días de la semana. Tú te encargas de entregar; la IA se encarga de vender.",
    cta: "Habla con nuestro agente",
    waMsg: "Hola Zakumi, quiero un agente de IA para mi WhatsApp.",
    href: "/agentes-ia",
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
    titulo1: "Tu negocio es demasiado complejo",
    tituloEm: "para depender de un Excel.",
    sub: "Automatizamos el caos. Si tus procesos internos son manuales, lentos y propensos a errores humanos, construimos el software que los resuelve. Sistemas web a la medida desde cero, respaldados por bases de datos serias en PostgreSQL.",
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
    titulo1: "Deja de abandonar tus redes",
    tituloEm: "cada vez que tienes mucho trabajo.",
    sub: "Sabemos que no tienes tiempo para publicar todos los días. Construimos una identidad visual imponente y automatizamos todo tu contenido para que tu marca siga vendiendo y generando autoridad, incluso cuando estás ocupado operando tu negocio.",
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
