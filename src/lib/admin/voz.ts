// Lecturas del canal de voz para el panel. SOLO SERVIDOR: reciben el cliente
// Supabase de la sesión (RLS admin aplica). Contrato degradable: un error de
// red devuelve listas vacías + console.error — la consola muestra su aviso.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inicioDiaBogota,
  type AgenteVoz,
  type CampoExtraccion,
  type LlamadaVoz,
  type TipoExtraccion,
} from "@/lib/voz/tipos";

export type AgenteVozFila = AgenteVoz & { cliente_nombre: string | null };

const TIPOS: readonly TipoExtraccion[] = ["string", "boolean", "integer", "number"];

/** jsonb crudo → CampoExtraccion[] (descarta entradas malformadas). */
export function extraccionDe(crudo: unknown): CampoExtraccion[] {
  if (!Array.isArray(crudo)) return [];
  const campos: CampoExtraccion[] = [];
  for (const c of crudo) {
    const campo = (c ?? {}) as Record<string, unknown>;
    if (
      typeof campo.clave === "string" && campo.clave !== "" &&
      typeof campo.descripcion === "string" &&
      TIPOS.includes(campo.tipo as TipoExtraccion)
    ) {
      campos.push({
        clave: campo.clave,
        tipo: campo.tipo as TipoExtraccion,
        descripcion: campo.descripcion,
      });
    }
  }
  return campos;
}

function mapAgente(fila: Record<string, unknown>): AgenteVozFila {
  const cliente = (fila.clientes ?? null) as { nombre?: unknown } | null;
  return {
    id: String(fila.id),
    cliente_id: fila.cliente_id === null ? null : String(fila.cliente_id),
    nombre: String(fila.nombre ?? ""),
    agent_id_eleven: fila.agent_id_eleven === null ? null : String(fila.agent_id_eleven),
    phone_number_id_eleven:
      fila.phone_number_id_eleven === null ? null : String(fila.phone_number_id_eleven),
    voice_id: fila.voice_id === null ? null : String(fila.voice_id),
    primer_mensaje: fila.primer_mensaje === null ? null : String(fila.primer_mensaje),
    secciones: (typeof fila.secciones === "object" && fila.secciones !== null
      ? fila.secciones
      : {}) as Record<string, string>,
    extraccion: extraccionDe(fila.extraccion),
    cap_diario: Number(fila.cap_diario ?? 0),
    activo: Boolean(fila.activo),
    es_zak: Boolean(fila.es_zak),
    created_at: String(fila.created_at ?? ""),
    updated_at: String(fila.updated_at ?? ""),
    cliente_nombre: typeof cliente?.nombre === "string" ? cliente.nombre : null,
  };
}

export async function listarAgentesVoz(supabase: SupabaseClient): Promise<AgenteVozFila[]> {
  const { data, error } = await supabase
    .from("agentes_voz")
    .select("*, clientes(nombre)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[voz] listarAgentesVoz:", error.message);
    return [];
  }
  return (data ?? []).map((f) => mapAgente(f as Record<string, unknown>));
}

export async function obtenerAgenteVoz(
  supabase: SupabaseClient,
  id: string,
): Promise<AgenteVozFila | null> {
  const { data, error } = await supabase
    .from("agentes_voz")
    .select("*, clientes(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[voz] obtenerAgenteVoz:", error.message);
    return null;
  }
  return data ? mapAgente(data as Record<string, unknown>) : null;
}

// El cap diario gobierna lo que NOSOTROS marcamos (saliente + prueba): las
// sesiones de widget y las entrantes no gastan telefonía nuestra y no deben
// poder bloquear el despacho del día.
const DIRECCIONES_CAP = ["saliente", "prueba"] as const;

/** Llamadas de HOY (día calendario de Bogotá) por agente, para el cap y la lista. */
export async function llamadasHoyPorAgente(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("llamadas_voz")
    .select("agente_id")
    .in("direccion", [...DIRECCIONES_CAP])
    .gte("created_at", inicioDiaBogota(new Date()).toISOString());
  if (error) {
    console.error("[voz] llamadasHoyPorAgente:", error.message);
    return {};
  }
  const conteo: Record<string, number> = {};
  for (const fila of data ?? []) {
    const id = String((fila as { agente_id: unknown }).agente_id);
    conteo[id] = (conteo[id] ?? 0) + 1;
  }
  return conteo;
}

export async function contarLlamadasHoy(
  supabase: SupabaseClient,
  agenteId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("llamadas_voz")
    .select("id", { count: "exact", head: true })
    .eq("agente_id", agenteId)
    .in("direccion", [...DIRECCIONES_CAP])
    .gte("created_at", inicioDiaBogota(new Date()).toISOString());
  if (error) {
    console.error("[voz] contarLlamadasHoy:", error.message);
    return null;
  }
  return count ?? 0;
}

function mapLlamada(fila: Record<string, unknown>): LlamadaVoz {
  return {
    id: String(fila.id),
    agente_id: String(fila.agente_id),
    conversation_id: String(fila.conversation_id ?? ""),
    direccion: (fila.direccion ?? "widget") as LlamadaVoz["direccion"],
    telefono: fila.telefono === null ? null : String(fila.telefono),
    estado: (fila.estado ?? "done") as LlamadaVoz["estado"],
    resultado: fila.resultado === null ? null : (fila.resultado as LlamadaVoz["resultado"]),
    duracion_seg: fila.duracion_seg === null ? null : Number(fila.duracion_seg),
    costo_creditos: fila.costo_creditos === null ? null : Number(fila.costo_creditos),
    resumen: fila.resumen === null ? null : String(fila.resumen),
    transcript: Array.isArray(fila.transcript)
      ? (fila.transcript as LlamadaVoz["transcript"])
      : null,
    datos: (typeof fila.datos === "object" && fila.datos !== null && !Array.isArray(fila.datos)
      ? fila.datos
      : null) as LlamadaVoz["datos"],
    criterios: (typeof fila.criterios === "object" && fila.criterios !== null
      ? fila.criterios
      : null) as LlamadaVoz["criterios"],
    batch_id: fila.batch_id === null ? null : String(fila.batch_id),
    tiene_audio: Boolean(fila.tiene_audio),
    iniciada_en: fila.iniciada_en === null ? null : String(fila.iniciada_en),
    created_at: String(fila.created_at ?? ""),
  };
}

/** El agente de voz de Zak (es_zak), o null si aún no se ha creado. */
export async function agenteZakVoz(supabase: SupabaseClient): Promise<AgenteVozFila | null> {
  const { data, error } = await supabase
    .from("agentes_voz")
    .select("*, clientes(nombre)")
    .eq("es_zak", true)
    .maybeSingle();
  if (error) {
    console.error("[voz] agenteZakVoz:", error.message);
    return null;
  }
  return data ? mapAgente(data as Record<string, unknown>) : null;
}

/** Una llamada aterrizada por su conversation_id (polling del lab). */
export async function obtenerLlamadaVoz(
  supabase: SupabaseClient,
  agenteId: string,
  conversationId: string,
): Promise<LlamadaVoz | null> {
  const { data, error } = await supabase
    .from("llamadas_voz")
    .select("*")
    .eq("agente_id", agenteId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) {
    console.error("[voz] obtenerLlamadaVoz:", error.message);
    return null;
  }
  return data ? mapLlamada(data as Record<string, unknown>) : null;
}

export async function llamadasDeAgente(
  supabase: SupabaseClient,
  agenteId: string,
  limit = 100,
): Promise<LlamadaVoz[]> {
  const { data, error } = await supabase
    .from("llamadas_voz")
    .select("*")
    .eq("agente_id", agenteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[voz] llamadasDeAgente:", error.message);
    return [];
  }
  return (data ?? []).map((f) => mapLlamada(f as Record<string, unknown>));
}
