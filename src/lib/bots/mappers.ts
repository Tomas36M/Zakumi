// JSON crudo del bot → tipos del panel. Funciones puras (testeables en vitest
// node). El bot es nuestro, pero el panel no debe romperse por un campo nuevo,
// un null inesperado o una versión vieja desplegada: aquí se normaliza todo.

import {
  canalDeProveedor,
  type Conversacion,
  type EstadoEnvio,
  type EstadoMeta,
  type Historial,
  type HistorialLabs,
  type Instancia,
  type InstanciaResumen,
  type JobFallido,
  type Lead,
  type MensajeChat,
  type Pausado,
  type PlantillaMeta,
  type PromptActivo,
  type Prospecto,
  type Proveedor,
  type RespuestaLabs,
  type StatusGlobal,
  type StatusInstancia,
  type Tanda,
  type UsoHoy,
  type VersionPrompt,
} from "./tipos";

type Crudo = Record<string, unknown>;

function obj(v: unknown): Crudo {
  return typeof v === "object" && v !== null ? (v as Crudo) : {};
}

function lista(v: unknown): Crudo[] {
  return Array.isArray(v) ? v.map(obj) : [];
}

function num(v: unknown, porDefecto = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : porDefecto;
}

function texto(v: unknown, porDefecto = ""): string {
  return typeof v === "string" ? v : porDefecto;
}

function textoONull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function proveedor(v: unknown): Proveedor {
  return v === "cloud" ? "cloud" : "green";
}

export function mapInstancia(crudo: unknown): Instancia {
  const c = obj(crudo);
  const prov = proveedor(c.proveedor);
  return {
    id: num(c.id),
    slug: texto(c.slug),
    nombre: texto(c.nombre),
    activo: c.activo === true,
    proveedor: prov,
    canal: canalDeProveedor(texto(c.proveedor)),
    modelo: texto(c.modelo),
    effort: texto(c.effort),
    max_tokens: num(c.max_tokens),
    prompt_version: num(c.prompt_version),
    presupuesto_tokens_dia:
      typeof c.presupuesto_tokens_dia === "number" ? c.presupuesto_tokens_dia : null,
    limite_por_numero: num(c.limite_por_numero),
    limite_ventana_s: num(c.limite_ventana_s),
    green_api_url: textoONull(c.green_api_url),
    green_instance_id: textoONull(c.green_instance_id),
    green_api_token: textoONull(c.green_api_token),
    green_webhook_token: textoONull(c.green_webhook_token),
    meta_phone_number_id: textoONull(c.meta_phone_number_id),
    meta_waba_id: textoONull(c.meta_waba_id),
    meta_access_token: textoONull(c.meta_access_token),
    escalation_notify_to: textoONull(c.escalation_notify_to),
    acuse_escalado: texto(c.acuse_escalado),
    fallback_reply: texto(c.fallback_reply),
    creado_en: textoONull(c.creado_en),
    actualizado_en: textoONull(c.actualizado_en),
  };
}

export function mapInstancias(crudo: unknown): Instancia[] {
  return lista(obj(crudo).instancias).map(mapInstancia);
}

function mapInstanciaResumen(c: Crudo): InstanciaResumen {
  return {
    id: num(c.id),
    slug: texto(c.slug),
    nombre: texto(c.nombre),
    proveedor: proveedor(c.proveedor),
    canal: canalDeProveedor(texto(c.proveedor)),
    activo: c.activo === true,
    prompt_version: num(c.prompt_version),
  };
}

export function mapStatusGlobal(crudo: unknown): StatusGlobal {
  const c = obj(crudo);
  const cola = obj(c.cola);
  return {
    cola: {
      jobs_pendientes: num(cola.jobs_pendientes),
      jobs_trabajando: num(cola.jobs_trabajando),
      jobs_fallidos: num(cola.jobs_fallidos),
      jobs_hechos: num(cola.jobs_hechos),
      edad_del_job_mas_viejo_s: num(cola.edad_del_job_mas_viejo_s),
    },
    por_instancia: lista(c.por_instancia).map((f) => ({
      instancia_id: num(f.instancia_id),
      pendientes: num(f.pendientes),
      trabajando: num(f.trabajando),
      fallidos: num(f.fallidos),
    })),
    instancias: lista(c.instancias).map(mapInstanciaResumen),
  };
}

function mapUsoHoy(c: Crudo): UsoHoy {
  return {
    tokens_entrada: num(c.tokens_entrada),
    tokens_salida: num(c.tokens_salida),
    tokens_cache_lectura: num(c.tokens_cache_lectura),
    tokens_cache_escritura: num(c.tokens_cache_escritura),
    llamadas: num(c.llamadas),
  };
}

export function mapStatusInstancia(crudo: unknown): StatusInstancia {
  const c = obj(crudo);
  return {
    instancia: mapInstancia(c.instancia),
    uso_hoy: mapUsoHoy(obj(c.uso_hoy)),
    conversaciones: num(c.conversaciones),
    pausados: num(c.pausados),
    fallidos: num(c.fallidos),
  };
}

export function mapPromptActivo(crudo: unknown): PromptActivo {
  const c = obj(crudo);
  return {
    version: num(c.version),
    activa: c.activa === true,
    system_prompt: texto(c.system_prompt),
    knowledge: texto(c.knowledge),
    tools_config: c.tools_config ?? null,
    notas: textoONull(c.notas),
    creado_en: texto(c.creado_en),
  };
}

export function mapVersiones(crudo: unknown): VersionPrompt[] {
  return lista(obj(crudo).versiones).map((f) => ({
    version: num(f.version),
    notas: textoONull(f.notas),
    creado_por: textoONull(f.creado_por),
    creado_en: texto(f.creado_en),
    activa: f.activa === true,
  }));
}

export function mapConversaciones(crudo: unknown): Conversacion[] {
  return lista(obj(crudo).conversations).map((f) => ({
    phone: texto(f.phone),
    messages: num(f.messages),
    paused: f.paused === true,
    last: texto(f.last),
    last_at: textoONull(f.last_at),
  }));
}

function mapMensajes(v: unknown): MensajeChat[] {
  return lista(v).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: texto(m.content),
    creado_en: textoONull(m.creado_en),
  }));
}

export function mapHistorial(crudo: unknown): Historial {
  const c = obj(crudo);
  return {
    phone: texto(c.phone),
    paused: c.paused === true,
    messages: mapMensajes(c.messages),
    ultimo_del_cliente: textoONull(c.ultimo_del_cliente),
  };
}

const ESTADOS_META: readonly EstadoMeta[] = [
  "APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED",
];

/** Plantillas del WABA vía el proxy del bot. Defensivo: estado raro →
 * DESCONOCIDO; si faltan los campos convenience, extrae BODY/HEADER del
 * `components` crudo de Graph. */
export function mapPlantillasMeta(crudo: unknown): PlantillaMeta[] {
  return lista(obj(crudo).plantillas).map((p) => {
    const components = lista(p.components);
    const body = components.find((c) => texto(c.type).toUpperCase() === "BODY");
    const header = components.find((c) => texto(c.type).toUpperCase() === "HEADER");
    const estado = texto(p.estado).toUpperCase();
    return {
      id: textoONull(p.id),
      nombre: texto(p.nombre),
      estado: (ESTADOS_META as readonly string[]).includes(estado)
        ? (estado as EstadoMeta)
        : "DESCONOCIDO",
      categoria: textoONull(p.categoria),
      motivo_rechazo: textoONull(p.motivo_rechazo),
      cuerpo: texto(p.cuerpo, body ? texto(body.text) : ""),
      // Solo evidencia real: convenience booleano del bot, o components
      // presentes. Sin evidencia = null — jamás un false que apague el header.
      tiene_header_imagen:
        typeof p.tiene_header_imagen === "boolean"
          ? p.tiene_header_imagen
          : components.length > 0
            ? header !== undefined && texto(header.format).toUpperCase() === "IMAGE"
            : null,
    };
  });
}

/** El bot devuelve un dict {telefono: {motivo, acuse_enviado}}; el panel quiere filas. */
export function mapPausados(crudo: unknown): Pausado[] {
  const c = obj(obj(crudo).paused);
  return Object.entries(c).map(([telefono, datos]) => {
    const d = obj(datos);
    return {
      telefono,
      motivo: texto(d.motivo),
      acuse_enviado: d.acuse_enviado === true,
    };
  });
}

export function mapLeads(crudo: unknown): Lead[] {
  return lista(obj(crudo).leads).map((f) => {
    const { phone, ...datos } = f;
    return { phone: texto(phone), datos };
  });
}

export function mapJobs(crudo: unknown): JobFallido[] {
  return lista(obj(crudo).jobs).map((f) => ({
    id: num(f.id),
    instancia_id: num(f.instancia_id),
    telefono: texto(f.telefono),
    texto: texto(f.texto),
    error: textoONull(f.error),
    intentos: num(f.intentos),
    creado_en: texto(f.creado_en),
  }));
}

const ESTADOS_ENVIO: readonly EstadoEnvio[] = [
  "pendiente", "enviado", "entregado", "leido", "respondido", "fallido",
] as const;

function estadoEnvio(v: unknown): EstadoEnvio {
  return ESTADOS_ENVIO.includes(v as EstadoEnvio) ? (v as EstadoEnvio) : "pendiente";
}

export function mapProspectos(crudo: unknown): Prospecto[] {
  return lista(obj(crudo).prospectos).map((f) => ({
    id: num(f.id),
    tanda_id: num(f.tanda_id),
    telefono: texto(f.telefono),
    negocio_id: textoONull(f.negocio_id),
    contexto: obj(f.contexto) as Prospecto["contexto"],
    estado_envio: estadoEnvio(f.estado_envio),
    interesado: f.interesado === true,
    interes_resumen: textoONull(f.interes_resumen),
    error: textoONull(f.error),
    creado_en: texto(f.creado_en),
    actualizado_en: textoONull(f.actualizado_en),
  }));
}

export function mapTandas(crudo: unknown): Tanda[] {
  return lista(obj(crudo).tandas).map((f) => {
    const funnel = obj(f.funnel);
    return {
      id: num(f.id),
      plantilla: texto(f.plantilla),
      notas: textoONull(f.notas),
      creado_en: texto(f.creado_en),
      funnel: {
        pendiente: num(funnel.pendiente),
        enviado: num(funnel.enviado),
        entregado: num(funnel.entregado),
        leido: num(funnel.leido),
        respondido: num(funnel.respondido),
        fallido: num(funnel.fallido),
      },
      interesados: num(f.interesados),
    };
  });
}

export function mapRespuestaLabs(crudo: unknown): RespuestaLabs {
  const c = obj(crudo);
  return {
    reply: textoONull(c.reply),
    paused: c.paused === true,
  };
}

export function mapHistorialLabs(crudo: unknown): HistorialLabs {
  const c = obj(crudo);
  return {
    messages: mapMensajes(c.messages),
    paused: c.paused === true,
  };
}
