export type Capacidad = { titulo: string; desc: string };
export type ServiceExample = { titulo: string; desc: string; img?: string; cat?: string };
export type Plan = { nombre: string; tagline: string; incluye: string[]; destacado?: boolean };

// Cabecera editorial de cada sección (eyebrow numerado en el JSX + título display).
export type BlockHead = { titulo: string; em: string; lead?: string };
export type ServiceSecciones = {
  datosClave: BlockHead;
  queHacemos: BlockHead;
  casos: BlockHead;
  proceso: BlockHead;
  porQue: BlockHead;
  planes: BlockHead;
  faq: BlockHead;
};

// ——— Bloques nuevos (rediseño orientado a venta) ———
export type ServiceMeta = { label: string; val: string };
export type ServiceStat = { num: string; acc?: string; label: string; desc: string };
export type ProcesoPaso = { titulo: string; desc: string };
export type Garantia = { titulo: string; desc: string };
export type FaqItem = { q: string; a: string };
export type ChatLine = { from: "cliente" | "agente"; text: string };

// Sección "estrella" por servicio (discriminada por kind).
export type Signature =
  | {
      kind: "chat";
      titulo: string;
      tituloEm: string;
      sub: string;
      puntos: string[];
      chatName: string;
      guion: ChatLine[];
    }
  | { kind: "producto"; titulo: string; tituloEm: string; sub: string; puntos: string[] }
  | { kind: "marca"; titulo: string; tituloEm: string; sub: string; puntos: string[] };

export type Service = {
  slug: "agentes-ia" | "software" | "marca";
  num: string;
  nav: string;
  tag: string;
  titulo1: string;
  tituloEm: string;
  intro: string;
  heroImg: string;
  ctaTipo: "whatsapp" | "contacto";
  waMsg?: string;
  ctaLabel: string;
  secciones: ServiceSecciones;
  heroMeta: ServiceMeta[];
  stats: ServiceStat[];
  incluye: Capacidad[];
  incluyeImg: string;
  signature: Signature;
  ejemplos: ServiceExample[];
  proceso: ProcesoPaso[];
  tech: { titulo: string; nota: string; items: string[] };
  porQue: Garantia[];
  planes: Plan[];
  faq: FaqItem[];
  seo: { title: string; description: string };
};

export const SERVICE_SLUGS: Service["slug"][] = ["agentes-ia", "software", "marca"];

export const SERVICIOS: Record<Service["slug"], Service> = {
  "agentes-ia": {
    slug: "agentes-ia",
    num: "— I.",
    nav: "Agentes IA",
    tag: "Agentes de IA · WhatsApp & Telegram",
    titulo1: "Agentes de IA que atienden",
    tituloEm: "y venden por ti.",
    intro:
      "Responden, asesoran y cierran ventas en WhatsApp, Telegram e Instagram — 24/7, sin que tú estés. El mismo agente que ya tenemos funcionando, puesto a trabajar para tu negocio.",
    heroImg: "/work/zk-hero-agentes-chat-v4.webp",
    ctaTipo: "whatsapp",
    waMsg: "Hola Zakumi, quiero un agente de IA para mi WhatsApp.",
    ctaLabel: "Habla con nuestro agente",
    secciones: {
      datosClave: { titulo: "Un agente que no", em: "descansa.", lead: "Las cifras de lo que un solo agente sostiene en tu operación — sin turnos, sin días libres, sin bajar el ritmo." },
      queHacemos: { titulo: "Todo lo que tu agente", em: "hace por ti." },
      casos: { titulo: "Míralo", em: "en tu negocio." },
      proceso: { titulo: "De la idea a", em: "funcionando." },
      porQue: { titulo: "No es un bot", em: "cualquiera." },
      planes: { titulo: "Planes que se", em: "ajustan a ti." },
      faq: { titulo: "Antes de que", em: "preguntes." },
    },
    incluyeImg: "/work/zk-prod-ecommerce.webp",
    heroMeta: [
      { label: "Canales", val: "WhatsApp · Telegram · Instagram" },
      { label: "Atiende", val: "24/7, sin que estés" },
      { label: "Responde", val: "En segundos" },
    ],
    stats: [
      { num: "24/7", label: "Siempre despierto", desc: "Atiende y vende a cualquier hora — también de madrugada y festivos." },
      { num: "3", label: "Canales en uno", desc: "WhatsApp, Telegram e Instagram con la misma memoria y tu tono." },
      { num: "<1", acc: "min", label: "Primera respuesta", desc: "Contesta al instante; el cliente no espera ni se enfría." },
      { num: "100", acc: "%", label: "Tu tono, tus precios", desc: "Entrenado con tu catálogo y tu forma de hablar. No es un bot genérico." },
    ],
    incluye: [
      { titulo: "Agente de ventas", desc: "Recomienda, arma el pedido y deja al cliente listo para pagar." },
      { titulo: "Atención 24/7", desc: "Contesta en segundos a cualquier hora y resuelve lo repetitivo." },
      { titulo: "Multicanal", desc: "WhatsApp, Telegram, Instagram y la web, con la misma memoria y tu tono." },
      { titulo: "Automatización e integraciones", desc: "Conecta con tu CRM, catálogo, agenda y pasarela de pago." },
      { titulo: "Entrenado con tu negocio", desc: "Aprende tus productos, precios y forma de hablar. No es un bot genérico." },
      { titulo: "Reportes y mejora", desc: "Ves qué preguntan y qué frena la venta; afinamos el agente con esos datos." },
    ],
    signature: {
      kind: "chat",
      titulo: "Míralo",
      tituloEm: "cerrar una venta.",
      sub: "El mismo agente que pondríamos en tu WhatsApp: responde, asesora y deja al cliente listo para pagar — mientras tú haces otra cosa.",
      puntos: [
        "Responde al instante, 24/7",
        "Asesora y arma el pedido solo",
        "Pasa el link de pago y cierra",
      ],
      chatName: "Zakumi · Agente IA",
      guion: [
        { from: "cliente", text: "Buenas, ¿tienen el labial mate en rojo?" },
        { from: "agente", text: "¡Hola! Sí 💄 Lo tenemos en Rojo Terracota y Vino. ¿Es para ti o para regalo?" },
        { from: "cliente", text: "Para mí. ¿Cuánto vale y hacen envío a Medellín?" },
        { from: "agente", text: "Vale $38.000. A Medellín llega en 24–48h y el envío es gratis desde $80.000 🚚" },
        { from: "cliente", text: "Listo, llevo dos 🙌" },
        { from: "agente", text: "¡Genial! Son $76.000 con envío gratis. Te paso el link de pago y apenas confirmes lo despacho hoy ✅" },
      ],
    },
    ejemplos: [
      { titulo: "Tienda que vende por WhatsApp", desc: "El agente atiende el catálogo, arma el carrito y pasa el pago.", img: "/work/zk-software-foto.webp", cat: "Retail" },
      { titulo: "Agenda de citas", desc: "Clínicas y salones: agenda, recuerda y reprograma sin llamadas.", img: "/work/zk-form-foto.webp", cat: "Servicios" },
      { titulo: "Soporte de primer nivel", desc: "Resuelve el grueso de las dudas y escala a una persona cuando hace falta.", img: "/work/zk-ink-foto.webp", cat: "Soporte" },
    ],
    proceso: [
      { titulo: "Diagnóstico", desc: "Entendemos tu negocio, tus productos y las preguntas que más te hacen." },
      { titulo: "Entrenamiento", desc: "Cargamos catálogo, precios y tu tono. Definimos cómo vende y cuándo escala a una persona." },
      { titulo: "Conexión", desc: "Lo enchufamos a WhatsApp, a tu CRM y a tu pasarela de pago." },
      { titulo: "Mejora continua", desc: "Vemos qué frena la venta y afinamos el agente con datos reales." },
    ],
    tech: {
      titulo: "Con qué lo construimos",
      nota: "IA de primera + las integraciones que ya usas.",
      items: ["Anthropic", "Gemini", "OpenAI", "WhatsApp", "Telegram", "n8n", "Postgres"],
    },
    porQue: [
      { titulo: "No es un bot de plantilla", desc: "Se entrena con tu negocio: tus productos, tus precios, tu forma de hablar." },
      { titulo: "Escala a un humano cuando toca", desc: "Resuelve lo repetitivo y te pasa el cliente cuando hay intención real." },
      { titulo: "Tú ves todo", desc: "Reportes claros de qué preguntan y qué compran. Nada de caja negra." },
      { titulo: "Un solo equipo", desc: "IA, software y marca sin intermediarios entre quien diseña, programa y conecta." },
    ],
    planes: [
      { nombre: "Esencial", tagline: "Para empezar a no perder clientes.", incluye: ["Un canal (WhatsApp)", "Preguntas frecuentes + catálogo", "Flujo de ventas básico"] },
      { nombre: "Crecimiento", tagline: "Cuando el volumen aprieta.", incluye: ["Multicanal", "Integración con CRM y pagos", "Automatizaciones y reportes"], destacado: true },
      { nombre: "A medida", tagline: "Operaciones serias.", incluye: ["Agentes especializados", "Integraciones complejas", "Alto volumen"] },
    ],
    faq: [
      { q: "¿Funciona con mi número de WhatsApp actual?", a: "Sí. Lo conectamos a tu WhatsApp Business sin cambiar tu número ni perder tus chats." },
      { q: "¿Cuánto tarda en estar listo?", a: "Un agente esencial puede estar atendiendo en 1–2 semanas, según tu catálogo e integraciones." },
      { q: "¿Reemplaza a mi equipo?", a: "No: le quita lo repetitivo. Responde al instante y escala a una persona cuando hay una decisión o un caso especial." },
      { q: "¿Cuánto cuesta?", a: "Cotizamos por proyecto según canales e integraciones, con precios pensados para Colombia. Escríbenos y te armamos una propuesta." },
    ],
    seo: {
      title: "Agentes de IA para WhatsApp y Telegram",
      description: "Agentes de IA que atienden y venden 24/7 en WhatsApp, Telegram e Instagram. Entrenados con tu negocio e integrados a tu CRM. Estudio en Colombia.",
    },
  },

  software: {
    slug: "software",
    num: "— II.",
    nav: "Software",
    tag: "Software & plataformas a medida",
    titulo1: "Software a medida",
    tituloEm: "que sostiene tu crecimiento.",
    intro:
      "Web, apps y plataformas hechas a tu medida, con datos serios y código propio. Del prototipo a producción — nada de plantillas.",
    heroImg: "/work/zk-hero-software-v1.webp",
    ctaTipo: "contacto",
    ctaLabel: "Cuéntanos tu proyecto",
    secciones: {
      datosClave: { titulo: "Cimientos que", em: "aguantan.", lead: "Lo que garantizamos en cada plataforma que construimos, del prototipo al día en que escala." },
      queHacemos: { titulo: "Todo lo que", em: "construimos." },
      casos: { titulo: "Para qué", em: "sirve." },
      proceso: { titulo: "De la idea a", em: "funcionando." },
      porQue: { titulo: "El código", em: "es tuyo." },
      planes: { titulo: "Empieza", em: "pequeño." },
      faq: { titulo: "Antes de que", em: "preguntes." },
    },
    incluyeImg: "/work/zk-prod-crm.webp",
    heroMeta: [
      { label: "Construimos", val: "Web · Apps · Plataformas" },
      { label: "Con", val: "Next.js · React · Postgres" },
      { label: "Enfoque", val: "A medida, sin plantillas" },
    ],
    stats: [
      { num: "0", label: "Plantillas", desc: "Cada proyecto se diseña y programa desde cero, a la medida de tu operación." },
      { num: "100", acc: "%", label: "Código tuyo", desc: "Te entregamos el código y la documentación. Sin ataduras ni cajas negras." },
      { num: "∞", label: "Escala contigo", desc: "Bases de datos serias en Postgres, pensadas para crecer sin sustos." },
      { num: "1", label: "Un solo equipo", desc: "Diseño, código y despliegue bajo el mismo techo. Sin intermediarios." },
    ],
    incluye: [
      { titulo: "Plataformas a medida", desc: "Paneles, portales, marketplaces y herramientas internas que crecen contigo." },
      { titulo: "Web y apps", desc: "Sitios rápidos y aplicaciones que se sienten nativas, con Next.js y React." },
      { titulo: "Bases de datos serias", desc: "Modelado con Postgres pensado para escalar sin sustos." },
      { titulo: "Integraciones", desc: "Pagos, facturación, mensajería, IA y lo que tu operación necesite conectar." },
      { titulo: "Código propio, sin ataduras", desc: "Te entregamos el código y la documentación. La plataforma es tuya." },
      { titulo: "Del prototipo a producción", desc: "Arrancamos con algo funcional rápido y lo llevamos a algo robusto." },
    ],
    signature: {
      kind: "producto",
      titulo: "Tu operación,",
      tituloEm: "en una sola pantalla.",
      sub: "Paneles, portales y plataformas a medida que reemplazan los Excel y las herramientas sueltas por un sistema que de verdad usas.",
      puntos: [
        "Paneles y portales a tu medida",
        "Datos serios en Postgres",
        "Integraciones: pagos, IA, mensajería",
        "Desplegado y monitoreado",
      ],
    },
    ejemplos: [
      { titulo: "Panel de operación", desc: "Pedidos, inventario y clientes en un solo lugar.", img: "/work/zk-form-foto.webp", cat: "Interno" },
      { titulo: "Portal para clientes", desc: "Cada cliente entra, ve su estado y se autogestiona.", img: "/work/zk-ink-foto.webp", cat: "Portal" },
      { titulo: "App de producto", desc: "Del MVP que valida al producto que aguanta usuarios reales.", img: "/work/zk-software-foto.webp", cat: "Producto" },
    ],
    proceso: [
      { titulo: "Descubrimiento", desc: "Mapeamos tu operación y definimos qué resuelve la plataforma." },
      { titulo: "Prototipo", desc: "Armamos algo funcional rápido para validar contigo antes de construir todo." },
      { titulo: "Construcción", desc: "Desarrollamos con datos serios, integraciones y código propio." },
      { titulo: "Lanzamiento y evolución", desc: "Desplegamos, monitoreamos y mejoramos mes a mes." },
    ],
    tech: {
      titulo: "Con qué lo construimos",
      nota: "Herramientas modernas, nada de plantillas.",
      items: ["Next.js", "React", "TypeScript", "Postgres", "Tailwind", "Vercel"],
    },
    porQue: [
      { titulo: "Código propio, sin ataduras", desc: "Te entregamos el código y la documentación. La plataforma es tuya." },
      { titulo: "Nada de plantillas", desc: "Se diseña a tu medida, para tu operación real, no para un molde." },
      { titulo: "Datos serios", desc: "Modelado en Postgres pensado para escalar sin sustos." },
      { titulo: "Del prototipo a producción", desc: "Validamos rápido y lo llevamos a algo robusto, sin reescribir todo." },
    ],
    planes: [
      { nombre: "Prototipo / MVP", tagline: "Validar rápido.", incluye: ["Algo funcional para probar la idea", "Alcance acotado", "Listo para mostrar a usuarios"] },
      { nombre: "Plataforma", tagline: "Producto en producción.", incluye: ["Sistema completo", "Datos e integraciones", "Desplegado y monitoreado"], destacado: true },
      { nombre: "Evolución continua", tagline: "Mejorar mes a mes.", incluye: ["Acompañamiento", "Nuevas funciones", "Mantenimiento"] },
    ],
    faq: [
      { q: "¿El código es mío?", a: "Sí. Te entregamos el código fuente y la documentación. No quedas amarrado a nosotros ni a una plataforma cerrada." },
      { q: "¿Cuánto tarda?", a: "Un prototipo funcional puede estar en pocas semanas; una plataforma completa depende del alcance. Lo definimos juntos antes de arrancar." },
      { q: "¿Puedo empezar pequeño?", a: "Sí, lo recomendamos: arrancamos con un MVP acotado, lo validamos con usuarios y crecemos desde ahí." },
      { q: "¿Cuánto cuesta?", a: "Cotizamos por proyecto según el alcance, con presupuestos pensados para Colombia. Cuéntanos tu idea y te proponemos." },
    ],
    seo: {
      title: "Software y plataformas a medida en Colombia",
      description: "Web, apps y plataformas a medida con Next.js, React y Postgres. Código propio, del prototipo a producción. Estudio en Colombia.",
    },
  },

  marca: {
    slug: "marca",
    num: "— III.",
    nav: "Marca",
    tag: "Marca · Contenido · Redes",
    titulo1: "Tu marca, viva.",
    tituloEm: "Tus redes, en automático.",
    intro:
      "Identidad con criterio + contenido y publicación automatizada. Presencia todos los días, sin que tengas que estar pendiente.",
    heroImg: "/work/zk-hero-marca-v1.webp",
    ctaTipo: "contacto",
    ctaLabel: "Activa tu marca",
    secciones: {
      datosClave: { titulo: "Presencia que no", em: "falla.", lead: "Lo que significa tener tu marca viva todos los días, con criterio humano encima de la máquina." },
      queHacemos: { titulo: "Todo lo que ponemos", em: "a andar." },
      casos: { titulo: "Cómo se", em: "ve en vivo." },
      proceso: { titulo: "De cero a", em: "publicando." },
      porQue: { titulo: "Una marca", em: "de verdad." },
      planes: { titulo: "Elige tu", em: "ritmo." },
      faq: { titulo: "Antes de que", em: "preguntes." },
    },
    incluyeImg: "/work/zk-prod-landing.webp",
    heroMeta: [
      { label: "Incluye", val: "Identidad · Contenido · Redes" },
      { label: "Publica", val: "A diario, en automático" },
      { label: "Resultado", val: "Marca siempre presente" },
    ],
    stats: [
      { num: "365", label: "Días al año", desc: "Calendario y publicación constante, sin semanas en blanco." },
      { num: "1", label: "Sistema coherente", desc: "Logo, colores y tipografías que hablan con una sola voz en todo." },
      { num: "∞", label: "Contenido a escala", desc: "Producción apoyada en IA, con criterio humano encima." },
      { num: "0", label: "Días improvisando", desc: "Todo planeado: tú revisas y apruebas, nosotros publicamos." },
    ],
    incluye: [
      { titulo: "Identidad visual", desc: "Logo, paleta, tipografías y un sistema coherente en todo." },
      { titulo: "Manejo de redes", desc: "Estrategia, calendario y publicación constante en tus canales." },
      { titulo: "Creación de contenido", desc: "Piezas, copy y formatos pensados para tu audiencia." },
      { titulo: "Publicación automatizada", desc: "Programado y publicado a diario, sin que estés encima." },
      { titulo: "Lineamientos de marca", desc: "Una guía para que todo hable con la misma voz." },
      { titulo: "Contenido con IA", desc: "Producción a escala apoyada en IA, con criterio humano." },
    ],
    signature: {
      kind: "marca",
      titulo: "Un sistema de marca,",
      tituloEm: "no un logo suelto.",
      sub: "Identidad, tono y piezas que se ven como una marca de verdad — y se publican solas, todos los días.",
      puntos: [
        "Identidad visual completa",
        "Lineamientos y tono de voz",
        "Contenido y publicación a diario",
      ],
    },
    ejemplos: [
      { titulo: "Marca desde cero", desc: "Le damos identidad y la ponemos a operar en redes.", img: "/work/zk-brand-foto2.webp", cat: "Identidad" },
      { titulo: "Relanzamiento", desc: "Refrescamos la imagen y reactivamos la presencia digital.", img: "/work/zk-ink-foto.webp", cat: "Rebrand" },
      { titulo: "Redes en piloto automático", desc: "Calendario mensual + publicación; tú revisas y apruebas.", img: "/work/zk-form-foto.webp", cat: "Redes" },
    ],
    proceso: [
      { titulo: "Inmersión", desc: "Entendemos tu negocio, tu público y tu competencia." },
      { titulo: "Identidad", desc: "Creamos el sistema visual: logo, colores, tipografías y tono." },
      { titulo: "Contenido", desc: "Diseñamos el calendario y producimos las piezas del mes." },
      { titulo: "Publicación automática", desc: "Programamos y publicamos a diario; tú revisas y apruebas." },
    ],
    tech: {
      titulo: "Con qué lo hacemos",
      nota: "Diseño con criterio + IA + automatización.",
      items: ["Anthropic", "Gemini", "n8n", "Instagram", "Meta"],
    },
    porQue: [
      { titulo: "Se ve como una marca de verdad", desc: "Nada improvisado: un sistema coherente en cada pieza." },
      { titulo: "Publica sin que estés encima", desc: "Programado y publicado a diario; tú solo revisas y apruebas." },
      { titulo: "Contenido a escala con criterio", desc: "IA para producir volumen, humanos para que tenga sentido." },
      { titulo: "Todo bajo un techo", desc: "Marca, contenido y las plataformas que lo sostienen, en un solo equipo." },
    ],
    planes: [
      { nombre: "Identidad", tagline: "El sistema de marca.", incluye: ["Identidad visual completa", "Lineamientos de marca", "Entrega una sola vez"] },
      { nombre: "Marca + Redes", tagline: "Imagen y presencia.", incluye: ["Identidad", "Manejo de redes", "Contenido mensual"], destacado: true },
      { nombre: "Contenido continuo", tagline: "Siempre presente.", incluye: ["Producción sostenida", "Publicación mensual", "Reportes"] },
    ],
    faq: [
      { q: "¿Publican ustedes o solo entregan las piezas?", a: "Ambas. Diseñamos el contenido y lo publicamos a diario en tus redes; tú apruebas antes." },
      { q: "¿Puedo aprobar antes de publicar?", a: "Sí. Te pasamos el calendario del mes; revisas, ajustas y nosotros programamos." },
      { q: "¿Sirve si ya tengo logo?", a: "Claro. Podemos refrescar tu identidad o trabajar sobre la que ya tienes y ordenar tus redes." },
      { q: "¿Cuánto cuesta?", a: "Cotizamos por mes según el volumen de contenido y canales, con precios para Colombia. Escríbenos y armamos un plan." },
    ],
    seo: {
      title: "Marca, contenido y redes en automático",
      description: "Identidad visual con criterio + contenido y publicación automatizada en tus redes. Presencia todos los días. Estudio en Colombia.",
    },
  },
};
