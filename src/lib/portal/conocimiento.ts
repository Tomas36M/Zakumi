// Secciones guiadas del bot del cliente ↔ campo `knowledge` del prompt.
//
// El cliente NUNCA toca el system_prompt (reglas duras: escalado, no inventar
// precios). Edita campos estructurados que aquí se serializan a markdown con
// títulos fijos dentro de `knowledge`. Todo lo que Zakumi haya escrito a mano
// fuera de esas secciones se preserva intacto en `resto` (el cliente no lo ve
// ni lo edita): guardar desde el portal jamás destruye conocimiento ajeno.

export type SeccionesConocimiento = {
  personalidad: string;
  negocio: string;
  horarios: string;
  faq: string;
  noDecir: string;
  /** Contenido fuera de las secciones guiadas. Se preserva tal cual. */
  resto: string;
};

export type CampoGuiado = Exclude<keyof SeccionesConocimiento, "resto">;

export const CAMPOS_GUIADOS: readonly {
  campo: CampoGuiado;
  titulo: string;
  ayuda: string;
  placeholder: string;
}[] = [
  {
    campo: "personalidad",
    titulo: "Personalidad y tono",
    ayuda: "Cómo quieres que suene tu agente: cercano, formal, con humor…",
    placeholder: "Ej.: Habla de tú, cercano y directo. Usa frases cortas.",
  },
  {
    campo: "negocio",
    titulo: "Información del negocio",
    ayuda: "Qué vendes, tus productos o servicios, precios, dirección.",
    placeholder: "Ej.: Somos una barbería en Madrid, Cundinamarca. Corte $25.000…",
  },
  {
    campo: "horarios",
    titulo: "Horarios",
    ayuda: "Cuándo atiendes y qué debe responder fuera de horario.",
    placeholder: "Ej.: Lunes a sábado 9am–7pm. Domingos cerrado.",
  },
  {
    campo: "faq",
    titulo: "Preguntas frecuentes",
    ayuda: "Preguntas que te hacen siempre, con su respuesta.",
    placeholder: "Ej.: ¿Aceptan tarjeta? Sí, todas. ¿Hacen domicilios? Solo en el centro.",
  },
  {
    campo: "noDecir",
    titulo: "Qué no decir",
    ayuda: "Temas o promesas que tu agente debe evitar.",
    placeholder: "Ej.: No prometer citas sin confirmar. No hablar de la competencia.",
  },
] as const;

export const MAX_POR_CAMPO = 4000;
export const MAX_TOTAL = 20_000;

const TITULO_A_CAMPO = new Map<string, CampoGuiado>(
  CAMPOS_GUIADOS.map((s) => [`## ${s.titulo}`, s.campo]),
);

function vacias(): SeccionesConocimiento {
  return { personalidad: "", negocio: "", horarios: "", faq: "", noDecir: "", resto: "" };
}

/**
 * Divide el knowledge en secciones guiadas + resto. Un `##` desconocido
 * (títulos escritos a mano por Zakumi) devuelve el cursor a `resto`,
 * conservando la línea del título: nada se pierde, solo lo guiado se edita.
 */
export function parseConocimiento(knowledge: string): SeccionesConocimiento {
  const secciones = vacias();
  const buckets: Record<string, string[]> = {
    personalidad: [], negocio: [], horarios: [], faq: [], noDecir: [], resto: [],
  };
  let actual: keyof SeccionesConocimiento = "resto";

  for (const linea of knowledge.split("\n")) {
    const campo = TITULO_A_CAMPO.get(linea.trim());
    if (campo) {
      actual = campo;
      continue;
    }
    if (/^##\s/.test(linea.trim()) && actual !== "resto") {
      actual = "resto";
    }
    buckets[actual].push(linea);
  }

  for (const clave of Object.keys(buckets) as (keyof SeccionesConocimiento)[]) {
    secciones[clave] = buckets[clave].join("\n").trim();
  }
  return secciones;
}

/** Serializa: `resto` primero (la base escrita a mano), luego lo guiado. */
export function serializarConocimiento(s: SeccionesConocimiento): string {
  const partes: string[] = [];
  if (s.resto.trim()) partes.push(s.resto.trim());
  for (const { campo, titulo } of CAMPOS_GUIADOS) {
    const texto = s[campo].trim();
    if (texto) partes.push(`## ${titulo}\n\n${texto}`);
  }
  return partes.join("\n\n");
}

/** null si todo bien; mensaje de error si algo se pasa de tamaño. */
export function validarSecciones(s: SeccionesConocimiento): string | null {
  for (const { campo, titulo } of CAMPOS_GUIADOS) {
    if (s[campo].length > MAX_POR_CAMPO) {
      return `"${titulo}" supera los ${MAX_POR_CAMPO.toLocaleString("es-CO")} caracteres.`;
    }
  }
  if (serializarConocimiento(s).length > MAX_TOTAL) {
    return `El conocimiento completo supera los ${MAX_TOTAL.toLocaleString("es-CO")} caracteres.`;
  }
  return null;
}
