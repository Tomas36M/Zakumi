// Tipos del API admin del bot (Flask en Railway, /admin/api/v1). Espejo de las
// respuestas JSON del bot con nombres snake_case, como cartera.ts espeja su SQL.
// Solo tipos y constantes puras: importable desde componentes cliente y tests.

// `canal` es el eje de producto (qué hace el agente); `proveedor` el de
// infraestructura (por dónde habla). Hoy todo proveedor es WhatsApp; cuando
// entre ElevenLabs se añade proveedor "eleven" con canal "voz" y nada más cambia.
export type Canal = "whatsapp" | "voz";
export type Proveedor = "green" | "cloud";

export const PROVEEDORES: readonly { valor: Proveedor; label: string }[] = [
  { valor: "green", label: "Green API" },
  { valor: "cloud", label: "Meta Cloud API" },
] as const;

export type Instancia = {
  id: number;
  slug: string;
  nombre: string;
  activo: boolean;
  proveedor: Proveedor;
  canal: Canal; // derivado del proveedor, no viene del API
  modelo: string;
  effort: string;
  max_tokens: number;
  prompt_version: number;
  presupuesto_tokens_dia: number | null;
  limite_por_numero: number;
  limite_ventana_s: number;
  // Credenciales REDACTADAS por el API (•••XXXX): solo para mostrar,
  // jamás reenviarlas en un PUT.
  green_api_url: string | null;
  green_instance_id: string | null;
  green_api_token: string | null;
  green_webhook_token: string | null;
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  meta_access_token: string | null;
  escalation_notify_to: string | null;
  acuse_escalado: string;
  fallback_reply: string;
  creado_en: string | null;
  actualizado_en: string | null;
};

/** La fila corta que trae el status global (sin credenciales ni textos). */
export type InstanciaResumen = {
  id: number;
  slug: string;
  nombre: string;
  proveedor: Proveedor;
  canal: Canal;
  activo: boolean;
  prompt_version: number;
};

export type PromptActivo = {
  version: number;
  activa: boolean;
  system_prompt: string;
  knowledge: string;
  tools_config: unknown;
  notas: string | null;
  creado_en: string;
};

export type VersionPrompt = {
  version: number;
  notas: string | null;
  creado_por: string | null;
  creado_en: string;
  activa: boolean;
};

export type Conversacion = {
  phone: string;
  messages: number;
  paused: boolean;
  last: string;
  last_at: string | null;
};

export type MensajeChat = {
  role: "user" | "assistant";
  content: string;
};

export type Historial = {
  phone: string;
  paused: boolean;
  messages: MensajeChat[];
};

export type Pausado = {
  telefono: string;
  motivo: string;
  acuse_enviado: boolean;
};

export type Lead = {
  phone: string;
  datos: Record<string, unknown>;
};

export type JobFallido = {
  id: number;
  instancia_id: number;
  telefono: string;
  texto: string;
  error: string | null;
  intentos: number;
  creado_en: string;
};

export type UsoHoy = {
  tokens_entrada: number;
  tokens_salida: number;
  tokens_cache_lectura: number;
  tokens_cache_escritura: number;
  llamadas: number;
};

export type StatusInstancia = {
  instancia: Instancia;
  uso_hoy: UsoHoy;
  conversaciones: number;
  pausados: number;
  fallidos: number;
};

export type Cola = {
  jobs_pendientes: number;
  jobs_trabajando: number;
  jobs_fallidos: number;
  jobs_hechos: number;
  edad_del_job_mas_viejo_s: number;
};

export type ColaInstancia = {
  instancia_id: number;
  pendientes: number;
  trabajando: number;
  fallidos: number;
};

export type StatusGlobal = {
  cola: Cola;
  por_instancia: ColaInstancia[];
  instancias: InstanciaResumen[];
};

export type RespuestaLabs = {
  reply: string | null;
  paused: boolean;
};

export type HistorialLabs = {
  messages: MensajeChat[];
  paused: boolean;
};

// Zak es la instancia 1: el agente de Zakumi, con vista propia (/admin/zak).
// Los demás son bots vendibles y viven en /admin/bots.
export const ID_ZAK = 1;

// ---------- Prospección (tandas de Zak) ----------

export type EstadoEnvio =
  | "pendiente"
  | "enviado"
  | "entregado"
  | "leido"
  | "respondido"
  | "fallido";

export type Prospecto = {
  id: number;
  tanda_id: number;
  telefono: string; // sin '+', formato del bot
  negocio_id: string | null; // uuid del negocio en Supabase (clave del sync)
  contexto: { nombre?: string; categoria?: string; ciudad?: string };
  estado_envio: EstadoEnvio;
  interesado: boolean;
  interes_resumen: string | null;
  error: string | null;
  creado_en: string;
  actualizado_en: string | null;
};

export type FunnelTanda = Record<EstadoEnvio, number>;

export type Tanda = {
  id: number;
  plantilla: string;
  notas: string | null;
  creado_en: string;
  funnel: FunnelTanda;
  interesados: number;
};

/** Conversaciones y leads del Labs llevan teléfono sentinel "labs:<session>". */
export function esLabs(telefono: string): boolean {
  return telefono.startsWith("labs:");
}

/** Qué canal opera cada proveedor. "eleven" (futuro) caerá en "voz". */
export function canalDeProveedor(proveedor: string): Canal {
  return proveedor === "eleven" ? "voz" : "whatsapp";
}
