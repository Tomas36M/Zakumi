// Tipos y constantes del canal de voz (ElevenLabs). Espejo de supabase/voz.sql
// con los mismos nombres snake_case, como cartera.ts espeja su SQL.
// Solo tipos y constantes puras: importable desde componentes cliente y tests.

// Pins verificados en producción por el lazo de voz de Luci (2026-07-06):
// - gpt-4.1-mini: Gemini con razonamiento leyó su chain-of-thought EN INGLÉS
//   al teléfono; 4.1-mini es rápido y disciplinado.
// - eleven_flash_v2_5: obligatorio para idioma distinto de inglés.
// - speed 1.1 (tope 1.2): natural al teléfono sin atropellarse.
export const LLM_VOZ = "gpt-4.1-mini";
export const TTS_MODEL_VOZ = "eleven_flash_v2_5";
export const TTS_SPEED_VOZ = 1.1;
export const IDIOMA_VOZ = "es";

export type Direccion = "saliente" | "entrante" | "widget" | "prueba";
export type EstadoLlamada = "done" | "failed" | "fallo_inicio";
export type ResultadoLlamada = "success" | "failure" | "unknown";

export type TipoExtraccion = "string" | "boolean" | "integer" | "number";

/** Un campo de data collection: ElevenLabs lo llena por llamada (o null). */
export type CampoExtraccion = {
  clave: string;
  tipo: TipoExtraccion;
  descripcion: string;
};

export const TIPOS_EXTRACCION: readonly { valor: TipoExtraccion; label: string }[] = [
  { valor: "string", label: "Texto" },
  { valor: "boolean", label: "Sí / No" },
  { valor: "integer", label: "Número entero" },
  { valor: "number", label: "Número" },
] as const;

// Claves estándar del lead: si la extracción de una llamada trae lead_nombre
// o lead_telefono, la RPC registrar_llamada_voz crea la venta en
// ventas_cliente (origen 'bot'). Vienen por defecto en todo agente nuevo.
export const EXTRACCION_LEAD: readonly CampoExtraccion[] = [
  {
    clave: "lead_nombre",
    tipo: "string",
    descripcion:
      "Nombre de la persona SOLO si lo dijo en la llamada. Si no lo dijo, devuelve null — nunca lo inventes.",
  },
  {
    clave: "lead_telefono",
    tipo: "string",
    descripcion:
      "Teléfono de contacto en formato internacional (+57...) SOLO si la persona dio uno distinto al de la llamada. Si no, null.",
  },
  {
    clave: "lead_detalle",
    tipo: "string",
    descripcion:
      "Qué quiere o qué preguntó la persona, en una frase. Si no mostró interés en nada, null.",
  },
  {
    clave: "lead_interesado",
    tipo: "boolean",
    descripcion:
      "true solo si la persona mostró interés explícito en comprar o agendar. Si hay duda, null.",
  },
] as const;

export type AgenteVoz = {
  id: string;
  cliente_id: string | null;
  nombre: string;
  agent_id_eleven: string | null;
  phone_number_id_eleven: string | null;
  voice_id: string | null;
  primer_mensaje: string | null;
  secciones: Record<string, string>;
  extraccion: CampoExtraccion[];
  cap_diario: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type LlamadaVoz = {
  id: string;
  agente_id: string;
  conversation_id: string;
  direccion: Direccion;
  telefono: string | null;
  estado: EstadoLlamada;
  resultado: ResultadoLlamada | null;
  duracion_seg: number | null;
  costo_creditos: number | null;
  resumen: string | null;
  transcript: { role: string; message: string | null }[] | null;
  datos: Record<string, unknown> | null;
  criterios: Record<string, unknown> | null;
  batch_id: string | null;
  tiene_audio: boolean;
  iniciada_en: string | null;
  created_at: string;
};

export const LABEL_DIRECCION: Record<Direccion, string> = {
  saliente: "Saliente",
  entrante: "Entrante",
  widget: "Widget",
  prueba: "Prueba",
};

export const LABEL_RESULTADO: Record<ResultadoLlamada, string> = {
  success: "Objetivo cumplido",
  failure: "Sin resultado",
  unknown: "Sin evaluar",
};

/**
 * Inicio del día calendario en Bogotá (UTC-5 fijo, sin horario de verano),
 * expresado en UTC. El cap diario de llamadas se cuenta contra esto — mismo
 * criterio que el daily_call_cap de Luci (America/Bogota).
 */
export function inicioDiaBogota(ahora: Date): Date {
  const bogota = new Date(ahora.getTime() - 5 * 3_600_000);
  return new Date(Date.UTC(
    bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate(), 5, 0, 0,
  ));
}
