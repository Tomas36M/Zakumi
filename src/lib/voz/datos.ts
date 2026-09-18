// Los datos que la llamada dejó extraídos, legibles en pantalla.
//
// PURO y compartido: lo usa DetalleLlamada (cliente) y es el único sitio que
// traduce claves y booleanos. La ficha pinta `datos` genéricamente —lo que
// aparece es lo que el agente extrajo—, así que sin esto la pantalla decía
// «tiene_web: false», que es justo la información al revés de como se lee.

/**
 * Las claves estándar (EXTRACCION_ZAK / EXTRACCION_LEAD) con nombre de
 * persona. Una clave que no esté aquí —un campo escrito a mano en la ficha
 * del agente— cae al fallback, nunca se esconde.
 */
const ETIQUETAS: Record<string, string> = {
  lead_nombre: "Nombre",
  lead_telefono: "Teléfono que dio",
  lead_detalle: "Qué quiere",
  lead_interesado: "Interesado",
  servicio_interes: "Servicio que le interesó",
  tiene_web: "Ya tiene página web",
  tiene_bot: "Ya tiene bot",
  tiene_software: "Ya tiene software",
  le_hace_falta: "Le hace falta",
  mejor_horario: "Mejor horario",
  cita_fecha_hora: "Cita",
  cita_confirmada: "Cita confirmada",
};

/** `tiene_web` → «Ya tiene página web»; una clave desconocida se limpia. */
export function etiquetaDato(clave: string): string {
  const conocida = ETIQUETAS[clave];
  if (conocida) return conocida;
  const suelta = clave.replace(/_/g, " ").trim();
  return suelta === "" ? clave : suelta[0].toUpperCase() + suelta.slice(1);
}

/** `false` → «No» (y no "false"). El resto sale tal cual lo dijo el agente. */
export function valorDato(valor: unknown): string {
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  return String(valor);
}
