// Builders PUROS de payloads hacia ElevenLabs (testeables sin red). Los shapes
// son los verificados en producción por el lazo de voz de Luci
// (scripts/elevenlabs-setup.mjs y voice-validation-dispatch): crear/PATCH de
// agente, batch-calling/submit y twilio/outbound-call.
//
// Regla de oro del PATCH: SIEMPRE se manda el payload COMPLETO reconstruido
// desde agentes_voz (la fuente de verdad). Un PATCH parcial en ElevenLabs
// borra los tools/overrides/placeholders que no viajen.

import { construirPrompt, type SeccionesVoz } from "./guias";
import {
  IDIOMA_VOZ,
  LLM_VOZ,
  TTS_MODEL_VOZ,
  TTS_SPEED_VOZ,
  type CampoExtraccion,
} from "./tipos";

export type ConfigAgente = {
  nombre: string;
  voiceId: string;
  primerMensaje: string;
  secciones: SeccionesVoz;
  extraccion: CampoExtraccion[];
};

/** Variables que viajan en cada llamada saliente y vuelven INTACTAS en el
 * post-call: son la correlación primaria (el teléfono va aquí a propósito —
 * el evento no lo trae de otra forma verificada). */
export type VariablesLlamada = {
  agente_id: string;
  origen: "zakumi_salida" | "zakumi_prueba";
  telefono: string;
  nombre_contacto?: string;
  /** uuid del negocio del CRM cuando la llamada sale de la prospección:
   * viaja intacto y queda en llamadas_voz.dynamic_variables (auditable). */
  negocio_id?: string;
};

export function payloadAgente(c: ConfigAgente): Record<string, unknown> {
  const dataCollection: Record<string, { type: string; description: string }> = {};
  for (const campo of c.extraccion) {
    dataCollection[campo.clave] = { type: campo.tipo, description: campo.descripcion };
  }

  return {
    name: c.nombre,
    conversation_config: {
      tts: {
        model_id: TTS_MODEL_VOZ,
        voice_id: c.voiceId,
        stability: 0.5,
        similarity_boost: 0.8,
        speed: TTS_SPEED_VOZ,
      },
      agent: {
        language: IDIOMA_VOZ,
        first_message: c.primerMensaje,
        prompt: {
          prompt: construirPrompt(c.nombre, c.secciones),
          llm: LLM_VOZ,
          tools: [
            {
              type: "system",
              name: "end_call",
              description:
                "Termina la llamada cuando la conversación haya concluido o la persona lo pida.",
              params: { system_tool_type: "end_call" },
            },
          ],
        },
        // Placeholders con dummy para que el agente valide aunque una llamada
        // (entrante/widget) llegue sin variables. En salientes van las reales.
        dynamic_variables: {
          dynamic_variable_placeholders: {
            agente_id: "",
            origen: "",
            telefono: "",
            nombre_contacto: "",
            negocio_id: "",
          },
        },
      },
    },
    platform_settings: {
      overrides: {
        conversation_config_override: { tts: { voice_id: true } },
      },
      // El resumen post-llamada (transcript_summary) sale en inglés si no se
      // pide idioma. El webhook lo usa como `detalle` de la solicitud cuando el
      // agente no extrajo lead_detalle (llamada cortada), y ese texto llega al
      // WhatsApp del equipo y a la bandeja: tiene que ir en español.
      summary_language: "es",
      data_collection: dataCollection,
      evaluation: {
        criteria: [
          {
            id: "objetivo_cumplido",
            name: "Objetivo cumplido",
            conversation_goal_prompt:
              "success si el agente logró el objetivo del guion (agendar, confirmar, capturar el dato o dejar el mensaje completo). failure si la persona rechazó o la llamada terminó sin avanzar. unknown si no alcanza a evaluarse (no contestó, se cortó).",
          },
        ],
      },
    },
  };
}

export function payloadLlamadaUnica(datos: {
  agentIdEleven: string;
  phoneNumberId: string;
  telefono: string;
  variables: VariablesLlamada;
}): Record<string, unknown> {
  return {
    agent_id: datos.agentIdEleven,
    agent_phone_number_id: datos.phoneNumberId,
    to_number: datos.telefono,
    conversation_initiation_client_data: {
      dynamic_variables: datos.variables,
    },
  };
}

export function payloadBatch(datos: {
  agentIdEleven: string;
  phoneNumberId: string;
  nombreBatch: string;
  destinos: { telefono: string; variables: VariablesLlamada }[];
}): Record<string, unknown> {
  return {
    call_name: datos.nombreBatch,
    agent_id: datos.agentIdEleven,
    agent_phone_number_id: datos.phoneNumberId,
    scheduled_time_unix: null, // inmediato
    target_concurrency_limit: 1, // de a una: piloto amable con el negocio
    recipients: datos.destinos.map((d) => ({
      phone_number: d.telefono,
      conversation_initiation_client_data: {
        dynamic_variables: d.variables,
      },
    })),
  };
}

const E164 = /^\+[1-9][0-9]{6,14}$/;

/**
 * Normaliza un teléfono tecleado a E.164. Números colombianos sin indicativo
 * (10 dígitos empezando por 3) reciben +57. Devuelve null si no hay forma.
 */
export function normalizarTelefono(crudo: string): string | null {
  const limpio = crudo.trim().replace(/[\s().-]/g, "");
  if (!limpio) return null;
  if (E164.test(limpio)) return limpio;
  if (/^57[0-9]{10}$/.test(limpio)) return `+${limpio}`;
  if (/^3[0-9]{9}$/.test(limpio)) return `+57${limpio}`;
  return null;
}
