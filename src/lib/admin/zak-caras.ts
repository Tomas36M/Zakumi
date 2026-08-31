// Las dos caras de Zak dentro de /admin/zak: el chatbot de WhatsApp y el
// agente de voz. Viven en la MISMA pantalla porque son el mismo empleado —
// /admin/bots y /admin/voz quedan para lo que se le vende a clientes.
//
// Una sola pestaña en la URL (?tab=…) manda sobre las dos caras: las de voz
// van prefijadas. Así no hay dos parámetros que puedan contradecirse ni
// estado duplicado que sincronizar.

export type CaraZak = "chat" | "voz";

export const PESTANAS_CHAT = [
  "bandeja",
  "interesados",
  "tandas",
  "plantillas",
  "metricas",
  "prompt",
  "labs",
] as const;

export const PESTANAS_VOZ = [
  "voz-config",
  "voz-lab",
  "voz-llamadas",
  "voz-tanda",
  "voz-widget",
] as const;

export type PestanaChat = (typeof PESTANAS_CHAT)[number];
export type PestanaVoz = (typeof PESTANAS_VOZ)[number];
export type PestanaZak = PestanaChat | PestanaVoz;

export const PREFIJO_VOZ = "voz-";

/** La pestaña por defecto de cada cara (a la que se cae al cambiar de cara). */
export const PESTANA_INICIAL: Record<CaraZak, PestanaZak> = {
  chat: "bandeja",
  voz: "voz-config",
};

/** A qué cara pertenece una pestaña. El prefijo es la única fuente de verdad. */
export function caraDe(tab: PestanaZak): CaraZak {
  return tab.startsWith(PREFIJO_VOZ) ? "voz" : "chat";
}

/** ¿Es un valor de pestaña que conocemos? (para sanear la URL) */
export function esPestanaZak(valor: unknown): valor is PestanaZak {
  return (
    typeof valor === "string" &&
    ([...PESTANAS_CHAT, ...PESTANAS_VOZ] as readonly string[]).includes(valor)
  );
}

/**
 * La pestaña con la que abre la pantalla. Un `?tab=` desconocido no rompe
 * nada: cae en la bandeja, que es donde Tomás trabaja el 90% del tiempo.
 */
export function pestanaInicial(tab: unknown): PestanaZak {
  return esPestanaZak(tab) ? tab : "bandeja";
}

/**
 * El id que usan los componentes de voz (`config`, `lab`, …) a partir de la
 * pestaña prefijada. Evita duplicar el catálogo de pestañas en dos sitios.
 */
export function subPestanaVoz(tab: PestanaVoz): string {
  return tab.slice(PREFIJO_VOZ.length);
}
