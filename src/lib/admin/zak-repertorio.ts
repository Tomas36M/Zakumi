// El repertorio de venta por vertical: lo que suele dolerle a ese tipo de
// negocio y tres cosas vendibles del brochure, en orden de preferencia. Viaja
// en el contexto del prospecto y el bot lo lee en el bloque de prospección
// (spec 2026-09-15-zak-vendedor § 4.1). Vive en código y no en
// plantillas_zak.angulo a propósito: el seed de esa tabla es `on conflict do
// nothing` y cambiarlo sería SQL en producción; esto se prueba en vitest.
// Regla: solo lo del brochure (agentes, landing/web/tienda, automatización,
// marca), nunca redes sociales ni precios.

export type Repertorio = {
  /** Lo que suele dolerle a este tipo de negocio, en una frase. */
  senal: string;
  /** Tres cosas vendibles, todas del brochure, en orden de preferencia. */
  ganchos: readonly [string, string, string];
};

export const REPERTORIO: Readonly<Record<string, Repertorio>> = {
  restaurante: {
    senal: "pedidos por app de domicilios o por llamada; el menú en un link o una foto",
    ganchos: [
      "menú digital con QR y pedidos por WhatsApp",
      "Zak toma pedidos y reservas completos",
      "domicilios propios con pago en línea, sin comisión de la app",
    ],
  },
  panaderia: {
    senal: "encargos de tortas por chat, uno por uno",
    ganchos: [
      "catálogo con fotos y encargos por WhatsApp",
      "Zak toma encargos con sabor, porciones y fecha",
      "tienda con pago para pedidos anticipados",
    ],
  },
  ferreteria: {
    senal: "«¿tienen X? ¿a cómo?» todo el día por el celular",
    ganchos: [
      "Zak responde precio y disponibilidad desde el catálogo",
      "catálogo web buscable",
      "automatización pedidos ↔ inventario",
    ],
  },
  veterinaria: {
    senal: "citas por llamada, en medio de la consulta",
    ganchos: [
      "Zak agenda citas y manda recordatorios",
      "landing con reservas",
      "recordatorios automáticos de vacunas",
    ],
  },
  farmacia: {
    senal: "domicilios por llamada con el teléfono ocupado",
    ganchos: [
      "Zak toma domicilios con dirección y pago",
      "catálogo con pedidos",
      "automatización con inventario",
    ],
  },
  belleza: {
    senal: "agenda por mensajes directos y llamadas, con las manos ocupadas",
    ganchos: [
      "Zak agenda, reagenda y recuerda",
      "landing de portafolio con reservas",
      "identidad de marca",
    ],
  },
  taller: {
    senal: "cotizaciones por chat mientras el equipo trabaja",
    ganchos: [
      "Zak agenda revisiones y cotiza repuestos",
      "web con servicios y agenda",
      "automatización de órdenes de trabajo",
    ],
  },
  hogar: {
    senal: "cotización con medidas y fotos, y entregas por coordinar",
    ganchos: [
      "Zak cotiza con fotos y coordina la entrega",
      "catálogo web",
      "tienda online",
    ],
  },
  moda: {
    senal: "tallas y apartados por mensajes directos",
    ganchos: [
      "tienda online con pagos",
      "Zak responde tallas y aparta",
      "identidad de marca",
    ],
  },
  comercio: {
    senal: "pedidos y preguntas por chat que se enfrían esperando",
    ganchos: [
      "Zak toma pedidos",
      "landing con botón a WhatsApp",
      "tienda online",
    ],
  },
};

/** El repertorio de un vertical, o null (genérico o desconocido): entonces Zak
 * pregunta primero a qué se dedica el negocio. */
export function repertorioPara(slug: string): Repertorio | null {
  return REPERTORIO[slug] ?? null;
}
