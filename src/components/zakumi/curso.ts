/**
 * Datos del curso "Introducción a la Inteligencia Artificial" de Zakumi Academy.
 *
 * Fuente de verdad del contenido: `cursos/curso-ia/00-master/curriculo.md`.
 * Si la malla cambia allá, cambia acá — la página de ventas muestra la malla
 * completa a propósito (es la sección que más convierte).
 */

export type CursoClase = { n: string; titulo: string; min: number };

export type CursoModulo = {
  num: string;
  dia?: string;
  titulo: string;
  tituloEm: string;
  promesa: string;
  clases: CursoClase[];
  abierto?: boolean;
};

export type CursoHerramienta = {
  nombre: string;
  marca?: string;
  comoPensarla: string;
  paraQue: string;
};

export type CursoIncluye = { titulo: string; desc: string; destacado?: boolean };
export type CursoMeta = { label: string; val: string; nota: string };
export type CursoFaq = { q: string; a: string };
export type CursoPaso = { titulo: string; desc: string };
export type CursoPunto = { titulo: string; desc: string };

/**
 * Checkout de Hotmart del producto 7970555 (cuenta Zakumi Estudio).
 *
 * `A106414286A` es el código del HotLink principal del producto, tomado de
 * Hotmart → producto 7970555 → "Links de divulgación". `pay.hotmart.com` abre
 * el checkout directo; `go.hotmart.com` pasaría primero por la página de ventas
 * de Hotmart, que no queremos porque la página de ventas es la nuestra
 * (`/academia`).
 */
export const HOTMART_CHECKOUT = "https://pay.hotmart.com/A106414286A";

/**
 * ¿Está vivo el checkout? Comprobado el 2026-07-29: `pay.hotmart.com/A106414286A`
 * responde 307 → `/error?errorMessage=049`, o sea que el CTA "Inscribirme por
 * $129.000" aterriza en una página de error de Hotmart.
 *
 * Mientras esto sea `false`, `/academia` se publica pero con `noindex` y fuera
 * del sitemap: la página existe para quien le pases el enlace a mano, pero
 * Google no indexa un embudo roto ni empieza a mandarle tráfico a una página que
 * no puede cobrar.
 *
 * Cuando la oferta esté activa en Hotmart, comprobar
 *   curl -sI https://pay.hotmart.com/A106414286A | head -1
 * y si da 200, poner esto en `true`. Es el único cambio necesario.
 */
export const CHECKOUT_ACTIVO = false;

export const CURSO = {
  nombre: "Introducción a la Inteligencia Artificial",
  academia: "Zakumi Academy",
  tag: "Curso introductorio · 1 semana",

  titulo1: "Introducción a la",
  tituloEm: "Inteligencia Artificial",

  lead:
    "Aprende a usar la inteligencia artificial en tu día a día: escribir, crear contenido, organizarte y ahorrar tiempo. En español y desde cero.",

  heroImg: "/work/zk-academia-hero.webp",

  /** Precio de lanzamiento de la primera cohorte. Sube de verdad al cerrarla. */
  precio: {
    lanzamiento: "129.000",
    normal: "199.000",
    moneda: "COP",
    nota: "Precio de lanzamiento de la primera cohorte. Al cerrarla sube a $199.000.",
  },

  heroMeta: [
    { label: "Duración", val: "5 días · 10 h", nota: "Una semana, un paso por día" },
    { label: "Modalidad", val: "100% online · en vivo", nota: "Clases en directo, preguntas al momento" },
    { label: "Conocimientos", val: "No necesitas saber nada", nota: "Para principiantes totales" },
    { label: "Certificado", val: "Sí, al terminar", nota: "Zakumi Academy · vía Hotmart" },
  ] satisfies CursoMeta[],

  stats: [
    { num: "40", label: "Clases", desc: "Repartidas en 7 módulos, de 20 a 30 minutos cada una." },
    { num: "10", acc: " h", label: "En vivo", desc: "Y grabadas. La grabación queda para siempre." },
    { num: "62", label: "Prompts listos", desc: "En español, para copiar y usar desde el primer día." },
    { num: "70", acc: "%", label: "Práctica", desc: "Aprendes haciendo, no mirando diapositivas." },
  ],

  /** El porqué: no es "la IA es el futuro", es qué te cambia el lunes. */
  porQueAhora: {
    titulo: "No tienes que volverte experto en tecnología.",
    em: "Solo dejar de hacer a mano lo que la IA hace en segundos.",
    puntos: [
      {
        titulo: "Te quita trabajo de encima",
        desc: "Esos correos, resúmenes y textos que te roban horas, la IA los deja listos en segundos. Tú solo revisas y apruebas.",
      },
      {
        titulo: "Haces tú lo que antes le pedías a otros",
        desc: "Ideas para tus redes, un texto que venda, una imagen o hasta una página web sencilla — sin esperar a nadie.",
      },
      {
        titulo: "Te subes a la ola a tiempo",
        desc: "Mucha gente todavía le tiene miedo o no sabe por dónde empezar. Tú vas a saber, y hoy eso vale oro.",
      },
    ] satisfies CursoPunto[],
    remate:
      "Al terminar no vas a “saber de IA” en teoría: vas a tenerla ayudándote en cosas reales de tu día.",
  },

  paraQuien: {
    titulo: "Si nunca has usado la IA,",
    em: "este curso es justo para ti.",
    img: "/work/zk-academia-para-quien.webp",
    señales: [
      "Abriste ChatGPT alguna vez y no supiste ni qué escribirle.",
      "Quieres usar la IA en tu trabajo, tu negocio o tus redes.",
      "Te encantaría que las tareas repetitivas se hicieran solas.",
      "Tienes curiosidad y ganas de aprender algo que sí te sirva.",
    ],
    logros: [
      "Pedirle cosas a la IA y que te entienda a la primera.",
      "Escribir más rápido: correos, textos y publicaciones.",
      "Crear contenido para tus redes: ideas, guiones e imágenes.",
      "Dejar tareas andando solas mientras haces otra cosa.",
      "Conocer los agentes: una IA que hace, no solo responde.",
      "Crear tu primer proyecto y publicarlo en internet.",
    ],
    nota: "No tienes que programar ni saber de tecnología. Solo necesitas ganas de aprender.",
  },

  /** El método propio. Es lo que hace que el curso no sea "40 trucos". */
  metodo: {
    nombre: "CLARO",
    titulo: "Un método, no",
    em: "cuarenta trucos.",
    lead:
      "Los trucos se te olvidan el lunes. Lo que te enseño es una lista de cinco preguntas que funciona con cualquier herramienta — incluidas las que todavía no existen. Se llama CLARO porque es literalmente eso: hablarle claro.",
    letras: [
      { letra: "C", nombre: "Contexto", pregunta: "¿Qué necesita saber para no inventar?" },
      { letra: "L", nombre: "Labor", pregunta: "¿Qué quiero exactamente que haga?" },
      { letra: "A", nombre: "Audiencia", pregunta: "¿Quién lo va a leer o ver?" },
      { letra: "R", nombre: "Referencia", pregunta: "¿Cómo se ve un buen resultado?" },
      { letra: "O", nombre: "Objeciones", pregunta: "¿Qué me molestaría que hiciera?" },
    ],
    remate:
      "Lo aprendes el Día 1 y lo usas hasta el Día 5. Todos los prompts que te llevas están escritos así, para que veas el patrón hasta que se te vuelva natural.",
  },

  herramientas: {
    titulo: "Las mismas herramientas",
    em: "que usan los que saben.",
    lead: "Cada una sirve para algo distinto. Te enseño con ejemplos cuándo usar cada una.",
    img: "/work/zk-academia-herramientas.webp",
    items: [
      {
        nombre: "ChatGPT",
        marca: "GPT",
        comoPensarla: "como una navaja suiza",
        paraQue: "El asistente para todo: te ayuda a escribir, resumir, tener ideas y hasta crear imágenes.",
      },
      {
        nombre: "Gemini",
        marca: "Google",
        comoPensarla: "el asistente de Google",
        paraQue: "Busca información de hoy y te ayuda dentro de Gmail, Documentos y Drive.",
      },
      {
        nombre: "Claude",
        marca: "Anthropic",
        comoPensarla: "el más detallista",
        paraQue: "Perfecto para textos largos, documentos y contenido bien hecho.",
      },
      {
        nombre: "Manus",
        comoPensarla: "el que hace la tarea solo",
        paraQue: "Le encargas algo y lo resuelve de principio a fin, sin que estés encima.",
      },
      {
        nombre: "Editores con agentes",
        comoPensarla: "le hablas y construye",
        paraQue: "Le dices en español qué quieres y te arma una página o herramienta, sin código.",
      },
      {
        nombre: "GitHub",
        comoPensarla: "una caja fuerte con “deshacer”",
        paraQue: "Guardas tus proyectos sin perder nada y puedes volver atrás cuando quieras.",
      },
    ] satisfies CursoHerramienta[],
  },

  /** La malla completa, clase por clase. Es la sección que más convierte. */
  malla: {
    titulo: "Empezamos perdiéndole el miedo.",
    em: "Terminamos creando algo real.",
    lead: "40 clases en 7 módulos. Un módulo se abre cada día, para que nadie se adelante y se pierda.",
    modulos: [
      {
        num: "00",
        titulo: "Antes de empezar",
        tituloEm: "",
        promesa: "Llegas al Día 1 con todo listo y sin ansiedad.",
        abierto: true,
        clases: [
          { n: "0.1", titulo: "Bienvenido: así funciona esta semana", min: 5 },
          { n: "0.2", titulo: "Crea tus tres cuentas (ChatGPT, Gemini, Claude)", min: 8 },
          { n: "0.3", titulo: "Dónde son las clases y dónde queda todo grabado", min: 4 },
          { n: "0.4", titulo: "Lo único que te pido", min: 3 },
        ],
      },
      {
        num: "01",
        dia: "Día 1",
        titulo: "Pierde el miedo:",
        tituloEm: "qué es la IA y cómo hablarle",
        promesa: "La base que hace que todo lo demás te funcione.",
        clases: [
          { n: "1.1", titulo: "Qué es la IA en cristiano (y qué no es)", min: 20 },
          { n: "1.2", titulo: "El practicante olvidadizo", min: 20 },
          { n: "1.3", titulo: "El método CLARO", min: 30 },
          { n: "1.4", titulo: "Práctica: arregla tres pedidos malos", min: 25 },
          { n: "1.5", titulo: "Los cuatro errores del principiante", min: 15 },
          { n: "1.6", titulo: "Reto del día y qué viene mañana", min: 10 },
        ],
      },
      {
        num: "02",
        dia: "Día 2",
        titulo: "ChatGPT y Gemini:",
        tituloEm: "tus asistentes del día a día",
        promesa: "Dos asistentes listos y tres tareas tuyas resueltas.",
        clases: [
          { n: "2.1", titulo: "Tour de ChatGPT: qué hace cada cosa", min: 15 },
          { n: "2.2", titulo: "El correo que llevas días evitando", min: 25 },
          { n: "2.3", titulo: "Resume lo que no tienes tiempo de leer", min: 20 },
          { n: "2.4", titulo: "Gemini y por qué vive dentro de tu Gmail y tu Drive", min: 20 },
          { n: "2.5", titulo: "Tu primera imagen que sirve", min: 25 },
          { n: "2.6", titulo: "ChatGPT o Gemini: cuál para qué", min: 10 },
          { n: "2.7", titulo: "Reto del día", min: 5 },
        ],
      },
      {
        num: "03",
        dia: "Día 3",
        titulo: "Claude:",
        tituloEm: "tu socio para trabajo serio y contenido",
        promesa: "Un mes de contenido planeado y una propuesta comercial armada.",
        clases: [
          { n: "3.1", titulo: "Por qué Claude para lo largo y lo serio", min: 15 },
          { n: "3.2", titulo: "Proyectos: dale memoria a la IA", min: 25 },
          { n: "3.3", titulo: "Un mes de contenido en una sesión", min: 30 },
          { n: "3.4", titulo: "De la idea al guion: reels y carruseles", min: 25 },
          { n: "3.5", titulo: "Una propuesta o cotización completa", min: 20 },
          { n: "3.6", titulo: "Reto del día", min: 5 },
        ],
      },
      {
        num: "04",
        dia: "Día 4",
        titulo: "Manus y los agentes:",
        tituloEm: "que la IA haga el trabajo por ti",
        promesa: "El ojo para ver qué tareas tuyas puede hacer la IA por ti.",
        clases: [
          { n: "4.1", titulo: "Chatbot o agente: la diferencia que lo cambia todo", min: 15 },
          { n: "4.2", titulo: "Tour de Manus: cómo se le encarga algo", min: 25 },
          { n: "4.3", titulo: "Encargo real #1: la investigación que nunca haces", min: 25 },
          { n: "4.4", titulo: "Encargo real #2: un entregable de principio a fin", min: 25 },
          { n: "4.5", titulo: "El ojo de automatizador", min: 20 },
          { n: "4.6", titulo: "Dónde NO usar un agente", min: 10 },
          { n: "4.7", titulo: "Reto del día", min: 5 },
        ],
      },
      {
        num: "05",
        dia: "Día 5",
        titulo: "Crea de verdad:",
        tituloEm: "editores con agentes + GitHub",
        promesa: "Tu primer proyecto creado, publicado y guardado.",
        clases: [
          { n: "5.1", titulo: "Editores con agentes: le hablas y construye", min: 20 },
          { n: "5.2", titulo: "Construimos tu página, paso por paso", min: 35 },
          { n: "5.3", titulo: "Publícala: que tenga un enlace de verdad", min: 20 },
          { n: "5.4", titulo: "GitHub sin miedo", min: 25 },
          { n: "5.5", titulo: "Guarda tu proyecto y vuelve atrás", min: 15 },
          { n: "5.6", titulo: "Tu proyecto final: qué entregar", min: 5 },
        ],
      },
      {
        num: "06",
        titulo: "Tu certificado",
        tituloEm: "y qué sigue",
        promesa: "Un plan de 30 días para que no se te olvide lo aprendido.",
        clases: [
          { n: "6.1", titulo: "Reclama tu certificado", min: 5 },
          { n: "6.2", titulo: "Tu plan de los próximos 30 días", min: 10 },
          { n: "6.3", titulo: "La biblioteca de prompts es tuya: cómo seguirla usando", min: 5 },
          { n: "6.4", titulo: "Hacia dónde seguir", min: 5 },
        ],
      },
    ] satisfies CursoModulo[],
  },

  comoAprenderas: {
    titulo: "Aprendes haciendo,",
    em: "no mirando diapositivas.",
    pasos: [
      {
        titulo: "70% práctica",
        desc: "De las 10 horas, 7 son con las manos en el teclado. Traes tus propias tareas y sales con trabajo hecho.",
      },
      {
        titulo: "En vivo y online",
        desc: "Clases en directo donde preguntas en el momento. Y todo queda grabado para siempre.",
      },
      {
        titulo: "Con analogías reales",
        desc: "Sin tecnicismos. Si aparece una palabra técnica, se explica en la misma frase.",
      },
      {
        titulo: "A ritmo de principiante",
        desc: "Empezamos desde cero de verdad. Nadie se queda atrás.",
      },
    ] satisfies CursoPaso[],
  },

  instructor: {
    nombre: "Tomás",
    rol: "Fundador de Zakumi",
    kicker: "Marca · Software · Agentes de IA · Colombia",
    img: "/work/zk-academia-instructor.webp",
    cita: "No te voy a enseñar teoría de un libro. Te voy a mostrar lo que hago todos los días.",
    bio: [
      "Dirijo Zakumi, un estudio donde la inteligencia artificial no es un experimento: es lo que usamos todos los días para trabajar. Hacemos agentes de IA que atienden y venden por WhatsApp, software a la medida, CRM con IA y marcas que se mueven solas en redes.",
      "Por eso lo que te enseño no es teoría sacada de internet: es lo que de verdad funciona cuando lo pones a producir. Te muestro el atajo que a mí me costó encontrar, explicado fácil.",
    ],
    pilares: [
      { titulo: "Agentes de IA", desc: "Atienden y venden por WhatsApp y Telegram, 24/7." },
      { titulo: "Software a medida", desc: "Plataformas, CRM y ecommerce hechos desde cero." },
      { titulo: "Marca viva", desc: "Identidad con criterio y redes en automático." },
    ],
    prueba:
      "Puedes comprobarlo antes de pagar: el asistente que te va a atender por WhatsApp es Zak, un agente de IA que construimos nosotros. Háblale y juzga tú.",
  },

  incluye: {
    titulo: "Todo lo que",
    em: "te llevas.",
    items: [
      { titulo: "40 clases · 10 h en vivo", desc: "Y las grabaciones quedan tuyas para siempre." },
      {
        titulo: "Biblioteca de 62 prompts en español",
        desc: "Correos, redes, ventas, imágenes, organizarte y encargos para agentes. Listos para copiar.",
        destacado: true,
      },
      { titulo: "5 cuadernos de trabajo", desc: "Uno por día, en PDF, con los ejercicios y el reto." },
      { titulo: "6 guías rápidas de una página", desc: "ChatGPT · Gemini · Claude · Manus · Editores con agentes · GitHub." },
      { titulo: "5 plantillas para imprimir", desc: "CLARO, calendario de contenido, propuesta comercial, encargo para agentes y mapa de tu semana." },
      { titulo: "Proyecto final publicado", desc: "Un enlace real en internet que puedas mandarle a alguien." },
      { titulo: "Plan de los próximos 30 días", desc: "Para que lo aprendido no se te olvide en dos semanas." },
      { titulo: "Certificado de Zakumi Academy", desc: "Al terminar, emitido vía Hotmart." },
      { titulo: "Grupo de WhatsApp de la cohorte", desc: "Para dudas entre clases y para no hacerlo solo." },
    ] satisfies CursoIncluye[],
  },

  garantia: {
    titulo: "15 días de garantía.",
    em: "Sin preguntas.",
    desc: "Si entras, lo pruebas y no es para ti, pides el reembolso y te devolvemos el 100%. Sin formularios ni explicaciones. Prefiero que no lo tomes a que te sientas atrapado.",
  },

  /** Honestidad explícita. Es lo que diferencia esto del mercado. */
  noPrometemos: {
    titulo: "Lo que este curso",
    em: "no te promete.",
    lead: "Porque el mercado promete de todo y después no lo cumple. Preferimos decírtelo antes.",
    items: [
      "No te promete clientes ni dinero por tomarlo.",
      "No te promete que vas a “programar” en una semana. Vas a construir algo real con un agente, que no es lo mismo.",
      "No te promete que la IA acierta sola. Todo el curso insiste en revisar.",
      "No te promete que vas a dominar todas las herramientas. Es un curso de introducción, y lo dice.",
    ],
  },

  faq: [
    {
      q: "¿Necesito saber programar?",
      a: "Para nada. Todo está pensado para personas que arrancan de cero. Lo que no sepas, lo aprendes en clase, con calma.",
    },
    {
      q: "¿Qué necesito para empezar?",
      a: "Un computador con internet y un correo. Nada más. Las tres cuentas que usamos son gratuitas y las creas antes del Día 1 con el kit de bienvenida.",
    },
    {
      q: "¿Y si no puedo ir a una clase en vivo?",
      a: "No pasa nada: todas quedan grabadas y el acceso es de por vida. Puedes verla después y preguntar en el grupo de la cohorte.",
    },
    {
      q: "¿Tengo que pagar las herramientas?",
      a: "No. Todo el curso se hace con las versiones gratuitas. Al final te digo cuál te conviene pagar según lo que hagas — pero no necesitas comprar nada esa semana.",
    },
    {
      q: "¿Me dan certificado?",
      a: "Sí. Al terminar recibes tu certificado de Zakumi Academy, que entregamos a través de Hotmart. Lo obtienes con los 5 días vistos, 3 de los 5 retos y el proyecto final.",
    },
    {
      q: "¿Cuánto tiempo me va a tomar al día?",
      a: "Dos horas de clase más unos 20 a 30 minutos del reto. Cinco días. Si un día no alcanzas, la grabación te espera.",
    },
    {
      q: "¿Es seguro darle mis datos a estas herramientas?",
      a: "Es una pregunta que tomamos en serio y le dedicamos tiempo en clase. La regla corta: si no lo pondrías en un correo, no lo pongas ahí. Nada de cédulas, historiales ni datos de clientes que no te autorizaron.",
    },
    {
      q: "¿Y esto para qué me sirve después?",
      a: "Para tu trabajo, tu negocio, tus redes o tus proyectos personales. Y si te enganchas, es la puerta para automatizar y crear cosas más grandes.",
    },
    {
      q: "¿Puedo pedir reembolso?",
      a: "Sí, tienes 15 días. Si no es para ti, lo pides y te devolvemos el 100% sin preguntas.",
    },
  ] satisfies CursoFaq[],

  cierre: {
    titulo: "La meta es sencilla:",
    em: "que salgas convencido.",
    sub: "Que tú, con la IA de tu lado, puedes hacer cosas grandes. En una semana la vas a estar usando como la uso yo todos los días.",
    img: "/work/zk-academia-cierre.webp",
  },

  waMsg:
    "Hola Zak, quiero información del curso Introducción a la Inteligencia Artificial de Zakumi Academy.",

  seo: {
    title: "Curso de Inteligencia Artificial desde cero | Zakumi Academy",
    description:
      "Curso introductorio de IA en español, 100% en vivo y online: 5 días, 40 clases, 62 prompts listos y certificado. Desde cero, sin programar. Colombia.",
  },
} as const;
