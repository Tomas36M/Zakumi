// Parseo del evento post-call de ElevenLabs (sin zod, como todo el repo):
// funciones puras y testeables que convierten el JSON crudo en los parámetros
// de la RPC registrar_llamada_voz. El shape es el verificado por Luci
// (voice-validation-webhook/schema.ts + fixtures de la doc oficial).
//
// Todo valor se NORMALIZA aquí a los checks del SQL (estado/resultado/
// direccion): un valor nuevo de ElevenLabs jamás debe tumbar el insert.

import type { Direccion, EstadoLlamada, ResultadoLlamada } from "./tipos";

export type ParamsRpc = {
  p_agent_id_eleven: string;
  p_conversation_id: string;
  p_direccion: Direccion;
  p_telefono: string | null;
  p_estado: EstadoLlamada;
  p_resultado: ResultadoLlamada | null;
  p_duracion_seg: number | null;
  p_costo_creditos: number | null;
  p_resumen: string | null;
  p_transcript: { role: string; message: string | null }[] | null;
  p_datos: Record<string, unknown> | null;
  p_criterios: Record<string, unknown> | null;
  p_dynamic_variables: Record<string, unknown> | null;
  p_batch_id: string | null;
  p_tiene_audio: boolean;
  p_iniciada_en: string | null;
};

export type EventoParseado =
  | { tipo: "llamada"; params: ParamsRpc; esPrueba: boolean }
  | { tipo: "ignorar"; razon: string };

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function entero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

function inferirDireccion(dv: Record<string, unknown> | null, batchId: string | null): Direccion {
  const origen = texto(dv?.origen);
  if (origen === "zakumi_prueba") return "prueba";
  if (origen === "zakumi_salida" || batchId !== null) return "saliente";
  // system__caller_id lo inyecta ElevenLabs en llamadas telefónicas entrantes.
  if (texto(dv?.system__caller_id)) return "entrante";
  return "widget";
}

export function parseEventoPostCall(json: unknown): EventoParseado {
  const evento = obj(json);
  if (!evento) return { tipo: "ignorar", razon: "cuerpo no es un objeto" };

  const tipo = texto(evento.type);
  // post_call_audio y cualquier tipo futuro: 200 sin procesar (el audio se
  // sirve on-demand por el proxy, no se almacena).
  if (tipo !== "post_call_transcription" && tipo !== "call_initiation_failure") {
    return { tipo: "ignorar", razon: `tipo no manejado: ${tipo ?? "sin type"}` };
  }

  const data = obj(evento.data);
  const agentId = texto(data?.agent_id);
  const conversationId = texto(data?.conversation_id);
  if (!data || !agentId || !conversationId) {
    return { tipo: "ignorar", razon: "evento sin agent_id o conversation_id" };
  }

  const metadata = obj(data.metadata);
  const analysis = obj(data.analysis);
  const inicio = obj(data.conversation_initiation_client_data);
  const dv = obj(inicio?.dynamic_variables);
  const batchId = texto(obj(metadata?.batch_call)?.batch_call_id);

  const estado: EstadoLlamada =
    tipo === "call_initiation_failure"
      ? "fallo_inicio"
      : texto(data.status) === "failed"
        ? "failed"
        : "done";

  const crudoResultado = texto(analysis?.call_successful);
  const resultado: ResultadoLlamada | null =
    crudoResultado === "success" || crudoResultado === "failure"
      ? crudoResultado
      : crudoResultado !== null || analysis !== null
        ? "unknown"
        : null;

  // data_collection_results: { clave: {value, rationale, …} } → { clave: value }
  let datos: Record<string, unknown> | null = null;
  const coleccion = obj(analysis?.data_collection_results);
  if (coleccion) {
    datos = {};
    for (const [clave, resultadoCampo] of Object.entries(coleccion)) {
      datos[clave] = obj(resultadoCampo)?.value ?? null;
    }
  }

  let transcript: { role: string; message: string | null }[] | null = null;
  if (Array.isArray(data.transcript)) {
    transcript = data.transcript
      .map((turno) => obj(turno))
      .filter((t): t is Record<string, unknown> => t !== null)
      .map((t) => ({
        role: texto(t.role) ?? "desconocido",
        message: typeof t.message === "string" ? t.message : null,
      }));
  }

  const inicioUnix = entero(metadata?.start_time_unix_secs);

  const params: ParamsRpc = {
    p_agent_id_eleven: agentId,
    p_conversation_id: conversationId,
    p_direccion: inferirDireccion(dv, batchId),
    p_telefono: texto(dv?.telefono) ?? texto(dv?.system__caller_id),
    p_estado: estado,
    p_resultado: resultado,
    p_duracion_seg: entero(metadata?.call_duration_secs),
    p_costo_creditos: entero(metadata?.cost),
    p_resumen: texto(analysis?.transcript_summary),
    p_transcript: transcript,
    p_datos: datos,
    p_criterios: obj(analysis?.evaluation_criteria_results),
    p_dynamic_variables: dv,
    p_batch_id: batchId,
    p_tiene_audio: data.has_audio === true,
    p_iniciada_en: inicioUnix !== null ? new Date(inicioUnix * 1000).toISOString() : null,
  };

  return { tipo: "llamada", params, esPrueba: params.p_direccion === "prueba" };
}
