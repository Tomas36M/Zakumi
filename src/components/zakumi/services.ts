export type Capacidad = { titulo: string; desc: string };
export type ServiceExample = { titulo: string; desc: string; img?: string };
export type Testimonio = { quote: string; autor: string; rol: string; placeholder: true };
export type Plan = { nombre: string; tagline: string; incluye: string[] };

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
  incluye: Capacidad[];
  ejemplos: ServiceExample[];
  testimonios: Testimonio[];
  planes: Plan[];
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
      "Responden, asesoran y cierran ventas en WhatsApp, Telegram y redes — 24/7, sin que tú estés. El mismo agente que ya tenemos funcionando, puesto a trabajar para tu negocio.",
    heroImg: "/work/zk-hero-foto.webp",
    ctaTipo: "whatsapp",
    waMsg: "Hola Zakumi, quiero un agente de IA para mi WhatsApp.",
    incluye: [
      { titulo: "Agente de ventas", desc: "Recomienda, arma el pedido y deja al cliente listo para pagar." },
      { titulo: "Atención 24/7", desc: "Contesta en segundos a cualquier hora y resuelve lo repetitivo." },
      { titulo: "Multicanal", desc: "WhatsApp, Telegram, Instagram y la web, con la misma memoria y tu tono." },
      { titulo: "Automatización e integraciones", desc: "Conecta con tu CRM, catálogo, agenda y pasarela de pago." },
      { titulo: "Entrenado con tu negocio", desc: "Aprende tus productos, precios y forma de hablar. No es un bot genérico." },
      { titulo: "Reportes y mejora", desc: "Ves qué preguntan y qué frena la venta; afinamos el agente con esos datos." },
    ],
    ejemplos: [
      { titulo: "Tienda que vende por WhatsApp", desc: "El agente atiende el catálogo, arma el carrito y pasa el pago.", img: "/work/zk-software-foto.webp" },
      { titulo: "Agenda de citas", desc: "Clínicas y salones: agenda, recuerda y reprograma sin llamadas.", img: "/work/zk-form-foto.webp" },
      { titulo: "Soporte de primer nivel", desc: "Resuelve el grueso de las dudas y escala a una persona cuando hace falta.", img: "/work/zk-ink-foto.webp" },
    ],
    testimonios: [
      // TODO: reemplazar por testimonios reales cuando existan.
      { quote: "Pasamos de responder a medianoche a que el agente cierre ventas mientras dormimos.", autor: "Daniela R.", rol: "Tienda de cosmética", placeholder: true },
      { quote: "Dejé de perder mensajes. Cada cliente recibe respuesta al instante.", autor: "Andrés M.", rol: "Importadora", placeholder: true },
    ],
    planes: [
      { nombre: "Esencial", tagline: "Para empezar a no perder clientes.", incluye: ["Un canal (WhatsApp)", "Preguntas frecuentes + catálogo", "Flujo de ventas básico"] },
      { nombre: "Crecimiento", tagline: "Cuando el volumen aprieta.", incluye: ["Multicanal", "Integración con CRM y pagos", "Automatizaciones y reportes"] },
      { nombre: "A medida", tagline: "Operaciones serias.", incluye: ["Agentes especializados", "Integraciones complejas", "Alto volumen"] },
    ],
    seo: {
      title: "Agentes de IA para WhatsApp y Telegram",
      description: "Agentes de IA que atienden y venden 24/7 en WhatsApp, Telegram y redes. Entrenados con tu negocio e integrados a tu CRM. Estudio en Colombia.",
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
    heroImg: "/work/zk-software-foto.webp",
    ctaTipo: "contacto",
    incluye: [
      { titulo: "Plataformas a medida", desc: "Paneles, portales, marketplaces y herramientas internas que crecen contigo." },
      { titulo: "Web y apps", desc: "Sitios rápidos y aplicaciones que se sienten nativas, con Next.js y React." },
      { titulo: "Bases de datos serias", desc: "Modelado con Postgres pensado para escalar sin sustos." },
      { titulo: "Integraciones", desc: "Pagos, facturación, mensajería, IA y lo que tu operación necesite conectar." },
      { titulo: "Código propio, sin ataduras", desc: "Te entregamos el código y la documentación. La plataforma es tuya." },
      { titulo: "Del prototipo a producción", desc: "Arrancamos con algo funcional rápido y lo llevamos a algo robusto." },
    ],
    ejemplos: [
      { titulo: "Panel de operación", desc: "Pedidos, inventario y clientes en un solo lugar.", img: "/work/zk-form-foto.webp" },
      { titulo: "Portal para clientes", desc: "Cada cliente entra, ve su estado y se autogestiona.", img: "/work/zk-ink-foto.webp" },
      { titulo: "App de producto", desc: "Del MVP que valida al producto que aguanta usuarios reales.", img: "/work/zk-software-foto.webp" },
    ],
    testimonios: [
      // TODO: reemplazar por testimonios reales cuando existan.
      { quote: "Reemplazamos tres hojas de cálculo por una plataforma que de verdad usamos.", autor: "Carolina V.", rol: "Logística", placeholder: true },
      { quote: "Entregaron el código y la documentación. No quedamos amarrados a nadie.", autor: "Felipe G.", rol: "Startup", placeholder: true },
    ],
    planes: [
      { nombre: "Prototipo / MVP", tagline: "Validar rápido.", incluye: ["Algo funcional para probar la idea", "Alcance acotado", "Listo para mostrar a usuarios"] },
      { nombre: "Plataforma", tagline: "Producto en producción.", incluye: ["Sistema completo", "Datos e integraciones", "Desplegado y monitoreado"] },
      { nombre: "Evolución continua", tagline: "Mejorar mes a mes.", incluye: ["Acompañamiento", "Nuevas funciones", "Mantenimiento"] },
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
    heroImg: "/work/zk-brand-foto2.webp",
    ctaTipo: "contacto",
    incluye: [
      { titulo: "Identidad visual", desc: "Logo, paleta, tipografías y un sistema coherente en todo." },
      { titulo: "Manejo de redes", desc: "Estrategia, calendario y publicación constante en tus canales." },
      { titulo: "Creación de contenido", desc: "Piezas, copy y formatos pensados para tu audiencia." },
      { titulo: "Publicación automatizada", desc: "Programado y publicado a diario, sin que estés encima." },
      { titulo: "Lineamientos de marca", desc: "Una guía para que todo hable con la misma voz." },
      { titulo: "Contenido con IA", desc: "Producción a escala apoyada en IA, con criterio humano." },
    ],
    ejemplos: [
      { titulo: "Marca desde cero", desc: "Le damos identidad y la ponemos a operar en redes.", img: "/work/zk-brand-foto2.webp" },
      { titulo: "Relanzamiento", desc: "Refrescamos la imagen y reactivamos la presencia digital.", img: "/work/zk-ink-foto.webp" },
      { titulo: "Redes en piloto automático", desc: "Calendario mensual + publicación; tú revisas y apruebas.", img: "/work/zk-form-foto.webp" },
    ],
    testimonios: [
      // TODO: reemplazar por testimonios reales cuando existan.
      { quote: "Por fin las redes se ven como una marca de verdad, no improvisadas.", autor: "Laura P.", rol: "Gastronomía", placeholder: true },
      { quote: "Publican por mí todos los días. Yo solo reviso y apruebo.", autor: "Santiago O.", rol: "Servicios", placeholder: true },
    ],
    planes: [
      { nombre: "Identidad", tagline: "El sistema de marca.", incluye: ["Identidad visual completa", "Lineamientos de marca", "Entrega una sola vez"] },
      { nombre: "Marca + Redes", tagline: "Imagen y presencia.", incluye: ["Identidad", "Manejo de redes", "Contenido mensual"] },
      { nombre: "Contenido continuo", tagline: "Siempre presente.", incluye: ["Producción sostenida", "Publicación mensual", "Reportes"] },
    ],
    seo: {
      title: "Marca, contenido y redes en automático",
      description: "Identidad visual con criterio + contenido y publicación automatizada en tus redes. Presencia todos los días. Estudio en Colombia.",
    },
  },
};
