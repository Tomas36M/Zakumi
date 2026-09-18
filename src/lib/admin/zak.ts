// Lógica pura de la prospección de Zak (testeable en vitest node).
// Zak abre leads: Tomás selecciona negocios del CRM, Zak les manda la
// plantilla y conversa con contexto. Aquí viven las reglas de quién es
// contactable y cómo avanzan los estados del CRM — nunca hacia atrás.

import type { EstadoNegocio, Negocio } from "./negocios";
import { admiteWhatsApp, normalizarTelefonoCO, sinMas } from "./telefono";
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

/** La ruta del folleto bajo public/ — única fuente del path (la UI la usa
 * relativa; urlFolleto compone el dominio encima para Meta). */
export function rutaFolleto(archivo: string): string {
  return `/folletos/${archivo}`;
}

export function urlFolleto(vertical: VerticalProspeccion): string {
  return vertical.folletoUrl;
}

/** El src para next/image: relativa cuando el folleto vive en nuestro propio
 * dominio (sin remotePatterns), absoluta cuando viene del bucket de Storage.
 * El host canónico también se relativiza: el seed de la tabla lo trae
 * hardcodeado y un preview de Vercel tiene OTRO SITE_URL. */
export function srcFolleto(vertical: VerticalProspeccion): string {
  for (const base of [SITE_URL, "https://zakumistudio.com"]) {
    if (vertical.folletoUrl.startsWith(`${base}/`)) {
      return vertical.folletoUrl.slice(base.length);
    }
  }
  return vertical.folletoUrl;
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
  // La trampa simétrica: contra una plantilla aprobada SIN header, mandar el
  // header es 4xx permanente (y viceversa). Decide `conHeader` (la DB), no la
  // memoria de nadie.
  if (!vertical.conHeader) return [];
  return [
    {
      type: "header",
      parameters: [{ type: "image", image: { link: vertical.folletoUrl } }],
    },
  ];
}

// El cuerpo visible de saludo_dueno: se guarda como mensaje del asistente al
// abrir/reabrir un chat, para que la conversación exista en la bandeja y Zak
// sepa que ya saludó. Mantener en espejo con la plantilla aprobada en Meta.
// Esto es SOLO el fallback del genérico: la plantilla que se manda de verdad
// sale de la tabla `plantillas_zak` (ver zak-verticales.ts), así que dejarlo
// viejo no rompe un envío — pero si Supabase no responde, el genérico volvería
// en silencio al texto anterior.
// `saludo_dueno` reemplazó a `saludo_general` el 2026-09-18 (id de Meta
// 3260201447512388): el texto viejo era un catálogo de servicios que terminaba
// en «Cuéntame qué hace tu negocio» — justo lo que la contestadora del negocio
// está hecha para contestar, y 18 de 22 «respuestas» de las tandas 4-6 fueron
// máquinas. El nuevo dice que lo escribe una IA, que no viene a pedir nada, y
// pregunta por el dueño (algo que el bot de atención del negocio no sabe
// responder). Plantilla nueva y no edición: Meta solo acepta 1 cada 24 h y
// cuenta las «sin cambios».
export const PLANTILLA_SALUDO = "saludo_dueno";
export const PLANTILLA_SALUDO_TEXTO = [
  "Hola, buenas 👋 Soy Zak, de Zakumi Estudio, en Bogotá.",
  "",
  "Hacemos tres cosas para negocios como el tuyo: páginas web que convierten, aplicaciones web y móviles, y agentes de IA que atienden tu WhatsApp para que no se quede ningún cliente sin respuesta.",
  "",
  "Antes de contarte más: ¿con quién hablo? ¿Eres el dueño del negocio?",
].join("\n");

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
  texto: string; // cuerpo visible (espejo de lo APROBADO — con la tabla, texto_vigente)
  angulo: string; // cómo hablarle a este tipo de negocio
  matchers: string[]; // substrings de negocios.categoria (Google Places)
  folleto: string; // archivo del seed en public/folletos/ (fallback)
  folletoUrl: string; // URL absoluta del header vigente (seed o bucket de Storage)
  conHeader: boolean; // si la versión APROBADA en Meta lleva header de imagen
  /** Edición en revisión en Meta: el selector la deshabilita. */
  enRevision?: boolean;
};

type VerticalSeed = Omit<VerticalProspeccion, "folletoUrl" | "conHeader" | "enRevision">;

const desdeSeed = (v: VerticalSeed): VerticalProspeccion => ({
  ...v,
  folletoUrl: `${SITE_URL}${rutaFolleto(v.folleto)}`,
  conHeader: true,
});

const _SALUDO = (queHacemos: string, emoji: string) =>
  `¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos ${queHacemos} — ` +
  `con un agente como yo. ¿Te cuento cómo se vería en tu negocio? ${emoji}`;

const SEEDS: readonly VerticalSeed[] = [
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

/** El catálogo ESTÁTICO: seed de supabase/plantillas.sql y fallback si la
 * tabla no responde. La fuente viva es `catalogoVerticales` (zak-verticales). */
export const VERTICALES_PROSPECCION: readonly VerticalProspeccion[] = SEEDS.map(desdeSeed);

export const VERTICAL_GENERICO: VerticalProspeccion = desdeSeed({
  slug: "generico",
  label: "Genérico",
  plantilla: PLANTILLA_SALUDO,
  texto: PLANTILLA_SALUDO_TEXTO,
  angulo: "Descubre a qué se dedica el negocio y muestra cómo un agente como tú le atendería clientes 24/7.",
  folleto: "generico-v2.jpg",
  matchers: [],
});

/** El vertical elegido a mano en la UI, por su slug. Slug desconocido o
 * ausente cae al genérico: un select desincronizado jamás rompe el envío. */
export function verticalPorSlug(
  slug: string | null | undefined,
  catalogo: readonly VerticalProspeccion[] = VERTICALES_PROSPECCION,
  generico: VerticalProspeccion = VERTICAL_GENERICO,
): VerticalProspeccion {
  return catalogo.find((v) => v.slug === slug) ?? generico;
}

/** Patrón para `ilike` de Supabase: el término va literal (se escapan sus
 * comodines) envuelto en % para buscar por pedazo del nombre. El `*` no se
 * puede escapar: PostgREST lo convierte en `%` antes de llegar a la base, así
 * que pasa a `_` (un solo carácter cualquiera, que incluye al propio `*`). */
export function patronBusqueda(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replaceAll("*", "_")}%`;
}

/** Lo que la bandeja necesita saber de un negocio del CRM: quién es, en qué
 * anda y con qué plantilla se le habla. Serializable (viaja del server a la UI). */
export type FichaNegocio = {
  negocioId: string;
  nombre: string;
  ciudad: Negocio["ciudad"];
  categoria: string | null;
  estado: EstadoNegocio;
  telefono: string; // E.164 (+57…)
  verticalSlug: string;
  verticalLabel: string;
};

/** Las columnas de `negocios` que alimentan una ficha — el select de los
 * handlers pide esto, no `*`. */
export const COLUMNAS_FICHA = "id, nombre, ciudad, categoria, estado, telefono";

export type NegocioParaFicha = Pick<
  Negocio,
  "id" | "nombre" | "ciudad" | "categoria" | "estado" | "telefono"
>;

export function fichaDeNegocio(
  n: NegocioParaFicha,
  catalogo: readonly VerticalProspeccion[] = VERTICALES_PROSPECCION,
  generico: VerticalProspeccion = VERTICAL_GENERICO,
): FichaNegocio {
  const v = verticalPara(n.categoria, catalogo, generico);
  return {
    negocioId: n.id,
    nombre: n.nombre,
    ciudad: n.ciudad,
    categoria: n.categoria,
    estado: n.estado,
    telefono: n.telefono ?? "",
    verticalSlug: v.slug,
    verticalLabel: v.label,
  };
}

/**
 * El cruce bandeja↔CRM: fichas indexadas por EXACTAMENTE los teléfonos que
 * pidió el caller (en su formato — el del bot sin `+`, o el crudo de un
 * deep-link), no por cómo los guarda la base. Sin negocio = sin entrada.
 * Si dos negocios comparten teléfono gana el primero: es informativo.
 */
export function mapaFichas(
  telefonos: string[],
  negocios: NegocioParaFicha[],
  catalogo: readonly VerticalProspeccion[] = VERTICALES_PROSPECCION,
  generico: VerticalProspeccion = VERTICAL_GENERICO,
): Record<string, FichaNegocio> {
  const porE164 = new Map<string, FichaNegocio>();
  for (const n of negocios) {
    if (n.telefono && !porE164.has(n.telefono)) {
      porE164.set(n.telefono, fichaDeNegocio(n, catalogo, generico));
    }
  }
  const fichas: Record<string, FichaNegocio> = {};
  for (const t of telefonos) {
    const e164 = normalizarTelefonoCO(t).telefono;
    const ficha = e164 !== null ? porE164.get(e164) : undefined;
    if (ficha) fichas[t] = ficha;
  }
  return fichas;
}

/** Los 10 verticales + el genérico, en el orden del catálogo. Única lista
 * "todos" — la UI y el match de saludos la comparten. */
export const TODOS_LOS_VERTICALES: readonly VerticalProspeccion[] = [
  ...VERTICALES_PROSPECCION,
  VERTICAL_GENERICO,
];

/** Deep-link al chat de Zak con un negocio, o null si no se le puede escribir
 * por WhatsApp (fijo, sin teléfono). Misma regla que el envío: [[admiteWhatsApp]]. */
export function linkChatZak(
  n: Pick<Negocio, "telefono" | "tipo_telefono">,
): string | null {
  if (!n.telefono) return null;
  if (!admiteWhatsApp({ telefono: n.telefono, tipo: n.tipo_telefono })) return null;
  return `/admin/zak?telefono=${sinMas(n.telefono)}`;
}

/** Deep-link a la ficha de un lead en el CRM (la cara Leads con su modal
 * abierto). Es el camino de vuelta de `linkChatZak`. */
export function linkFichaLead(id: string): string {
  return `/admin/prospeccion?tab=leads&lead=${encodeURIComponent(id)}`;
}

/** El vertical cuyo saludo de plantilla es este contenido, o null. Con esto la
 * bandeja pinta el folleto que Meta mostró: el saludo se guarda como mensaje
 * del asistente con el texto EXACTO del vertical (startsWith tolera sufijos;
 * los textos son largos y ninguno es prefijo de otro). */
export function verticalDeSaludo(
  contenido: string,
  todos: readonly VerticalProspeccion[] = TODOS_LOS_VERTICALES,
): VerticalProspeccion | null {
  const c = contenido.trim();
  if (!c) return null;
  for (const v of todos) {
    if (c.startsWith(v.texto)) return v;
  }
  return null;
}

/** Heurística del campo único de «+ Nuevo chat»: con suficientes dígitos es
 * un teléfono pegado (con puntos, espacios o "ext" da igual — el server lo
 * normaliza); con menos, es el nombre de un negocio para buscar en el CRM. */
export function pareceTelefono(texto: string): boolean {
  const digitos = texto.replace(/\D/g, "").length;
  return digitos >= 7 && digitos <= 15;
}

/** El vertical de un negocio según su categoría de Google (fallback genérico).
 * El orden del catálogo importa: gana el primer match — 'comercio' va de
 * último porque sus matchers ("store") son los más genéricos. */
export function verticalPara(
  categoria: string | null,
  catalogo: readonly VerticalProspeccion[] = VERTICALES_PROSPECCION,
  generico: VerticalProspeccion = VERTICAL_GENERICO,
): VerticalProspeccion {
  if (!categoria) return generico;
  const c = categoria.toLowerCase();
  for (const v of catalogo) {
    if (v.matchers.some((m) => c.includes(m))) return v;
  }
  return generico;
}

/** Agrupa negocios por vertical (para crear una tanda por plantilla). */
export function agruparPorVertical(
  negocios: Negocio[],
  catalogo: readonly VerticalProspeccion[] = VERTICALES_PROSPECCION,
  generico: VerticalProspeccion = VERTICAL_GENERICO,
): { vertical: VerticalProspeccion; negocios: Negocio[] }[] {
  const grupos = new Map<string, { vertical: VerticalProspeccion; negocios: Negocio[] }>();
  for (const n of negocios) {
    const v = verticalPara(n.categoria, catalogo, generico);
    const g = grupos.get(v.slug) ?? { vertical: v, negocios: [] };
    g.negocios.push(n);
    grupos.set(v.slug, g);
  }
  return [...grupos.values()];
}

/** Máximo de mensajes en frío al día según la estrategia «Catorce días»:
 * más que eso arriesga la calidad del número en Meta. El botón «contactar a
 * los nuevos» no pasa de aquí; una selección a mano sí puede (su techo es el
 * cupo diario del número). */
export const TANDA_SUGERIDA_DIA = 80;

/** Máximo de prospectos por tanda: espejo de `TANDA_MAX` del bot
 * (whatsapp-bot/admin_api.py), que rechaza una tanda más grande. */
export const TANDA_MAX_BOT = 50;

/** Los que siguen en «Nuevo», tienen celular y nadie fijó a mano, en el orden
 * de la lista; con `limite`, solo los primeros. Los fijados a mano quedan
 * fuera: la automatización no les mueve el estado, así que volverían a salir
 * primeros en cada envío. */
export function nuevosContactables(negocios: Negocio[], limite?: number): Negocio[] {
  const nuevos = contactables(negocios).filter(
    (n) => n.estado === "nuevo" && !n.estado_fijado_manual,
  );
  return limite === undefined ? nuevos : nuevos.slice(0, limite);
}

/** Lo que responde el bot a UNA tanda: entró (con los teléfonos que ya eran
 * prospectos) o no entró (y si fue por el tope diario del número). */
export type ResultadoLote = { ok: true; duplicados: string[] } | { ok: false; tope: boolean };

export type Despacho = {
  /** Negocios cuya tanda SÍ entró al bot (duplicados incluidos). */
  enviados: Negocio[];
  duplicados: Set<string>;
  /** Negocios que no salieron porque se llegó al tope diario. */
  porTope: number;
  /** Negocios que no cupieron en la tanda de su vertical (pasaban de `tamano`). */
  sobrantes: number;
  algunaOk: boolean;
};

/**
 * Manda UNA tanda por vertical, con su plantilla y de máximo `tamano`; lo que
 * sobra de un vertical queda para el siguiente envío. Un vertical no se parte
 * en varias tandas a propósito: el bot espacia los envíos dentro de cada tanda
 * desde cero, y dos tandas del mismo envío saldrían en paralelo, al doble del
 * ritmo que cuida el número. Se salta los verticales con la plantilla en
 * revisión y las tandas que fallan por otra causa; al primer «tope diario»
 * para, porque el cupo es del número entero y nada de lo que sigue cabe hoy.
 */
export async function despacharTandas(
  grupos: readonly { vertical: VerticalProspeccion; negocios: Negocio[] }[],
  enviar: (vertical: VerticalProspeccion, lote: Negocio[]) => Promise<ResultadoLote>,
  tamano: number,
): Promise<Despacho> {
  const maximo = Math.max(1, Math.floor(tamano));
  const tandas = grupos
    .filter((g) => !g.vertical.enRevision)
    .map((g) => ({
      vertical: g.vertical,
      lote: g.negocios.slice(0, maximo),
      sobran: Math.max(0, g.negocios.length - maximo),
    }));
  const despacho: Despacho = {
    enviados: [],
    duplicados: new Set(),
    porTope: 0,
    sobrantes: tandas.reduce((s, t) => s + t.sobran, 0),
    algunaOk: false,
  };

  for (let i = 0; i < tandas.length; i++) {
    const { vertical, lote } = tandas[i];
    const r = await enviar(vertical, lote);
    if (r.ok) {
      despacho.algunaOk = true;
      despacho.enviados.push(...lote);
      for (const t of r.duplicados) despacho.duplicados.add(t);
    } else if (r.tope) {
      despacho.porTope = tandas.slice(i).reduce((s, t) => s + t.lote.length, 0);
      break;
    }
  }
  return despacho;
}

/** El aviso que queda en pantalla después de mandar una tanda. */
export function resumenTanda(r: {
  contactados: number;
  duplicados: number;
  omitidos: number;
  porTope: number;
  sobrantes: number;
}): string {
  const partes = [`Zak va a contactar a ${r.contactados} ${r.contactados === 1 ? "negocio" : "negocios"}`];
  if (r.duplicados > 0) {
    partes.push(`${r.duplicados} ${r.duplicados === 1 ? "ya era prospecto" : "ya eran prospectos"}`);
  }
  if (r.omitidos > 0) {
    partes.push(`${r.omitidos} ${r.omitidos === 1 ? "quedó fuera" : "quedaron fuera"}`);
  }
  const frase =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  const tope =
    r.porTope > 0
      ? ` Se llegó al tope diario: ${r.porTope} ${r.porTope === 1 ? "quedó" : "quedaron"} para mañana.`
      : "";
  const sobran =
    r.sobrantes > 0
      ? ` ${r.sobrantes} ${r.sobrantes === 1 ? "quedó" : "quedaron"} para el siguiente envío: cada tanda lleva máximo ${TANDA_MAX_BOT}.`
      : "";
  return `${frase}.${tope}${sobran}`;
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
  actuales: { id: string; estado: EstadoNegocio; estado_fijado_manual: boolean }[],
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
    if (n.estado_fijado_manual) continue;
    // La evidencia del bot: true = escribió una persona, false = solo la
    // contestadora, ausente = prospecto anterior a la clasificación (se trata
    // como hoy). Interesado exige persona; respondido solo se frena con false.
    const humano = p.contexto.humano;
    if (p.interesado && humano === true && n.estado !== "interesado") {
      avances.push({ id: n.id, a: "interesado" });
    } else if (
      p.estado_envio === "respondido" &&
      humano !== false &&
      (n.estado === "nuevo" || n.estado === "contactado")
    ) {
      avances.push({ id: n.id, a: "respondido" });
    }
  }
  return avances;
}

/** A dónde vuelve un negocio cuando Tomás dice «no era interés real»: si el
 * bot ya vio escribir a una persona, a Respondió; si solo hubo contestadora o
 * no se sabe, a Contactado. Nunca más abajo: el contacto sí ocurrió. */
export function estadoTrasDescartarInteres(humano: boolean | null): EstadoNegocio {
  return humano === true ? "respondido" : "contactado";
}
