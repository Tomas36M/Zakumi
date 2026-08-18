"use server";

// Mutaciones del panel hacia el bot (Flask en Railway). Mismo contrato que
// cartera-actions: verifySession() primera línea, whitelists explícitas,
// retornos { … } | { error } que nunca lanzan, y el detalle técnico al log —
// al usuario solo mensajes en español.

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import {
  activarVersion,
  actualizarInstancia,
  crearInstancia,
  enviarManual as enviarManualApi,
  guardarPrompt as guardarPromptApi,
  obtenerInstancia,
  obtenerPrompt,
  pausar,
  reanudar,
  reintentarJob as reintentarJobApi,
  type DatosInstancia,
  type ErrorBot,
} from "@/lib/bots/api";
import { plantillaPorSlug } from "@/lib/bots/plantillas";

const SLUG = /^[a-z0-9-]{2,40}$/;
const PROVEEDORES_VALIDOS = new Set(["green", "cloud"]);

// Campos de credencial: solo viajan si el usuario tecleó algo. Un valor
// redactado (•••XXXX) que volviera en un PUT corrompería el token real.
const CAMPOS_CREDENCIAL = [
  "green_api_url",
  "green_instance_id",
  "green_api_token",
  "green_webhook_token",
  "meta_phone_number_id",
  "meta_waba_id",
  "meta_access_token",
] as const;

function credencialUsable(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "" && !v.includes("•••");
}

function mensajeDe(error: ErrorBot): string {
  switch (error) {
    case "sin_configurar":
      return "El panel no tiene configurada la conexión al bot (BOT_ADMIN_URL/TOKEN).";
    case "sin_conexion":
      return "No hay conexión con el bot. ¿Railway está arriba?";
    case "no_autorizado":
      return "El bot rechazó las credenciales del panel.";
    case "no_existe":
      return "Ese bot no existe.";
    case "peticion_invalida":
      return "El bot rechazó los datos enviados.";
    case "conflicto":
      return "Ya existe un bot con ese slug.";
    default:
      return "El bot devolvió un error inesperado.";
  }
}

function revalidarBots() {
  revalidatePath("/admin/bots");
}

export async function crearBot(datos: {
  nombre: string;
  slug: string;
  proveedor: string;
  plantilla: string;
  acuse_escalado: string;
  fallback_reply: string;
  escalation_notify_to?: string;
  notas?: string;
  green_api_url?: string;
  green_instance_id?: string;
  green_api_token?: string;
  green_webhook_token?: string;
  meta_phone_number_id?: string;
  meta_waba_id?: string;
  meta_access_token?: string;
}): Promise<{ id: number } | { error: string }> {
  await verifySession();

  const nombre = typeof datos?.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) return { error: "El bot necesita un nombre." };
  const slug = typeof datos.slug === "string" ? datos.slug.trim().toLowerCase() : "";
  if (!SLUG.test(slug)) {
    return { error: "El slug solo admite letras minúsculas, números y guiones (2-40)." };
  }
  if (!PROVEEDORES_VALIDOS.has(datos.proveedor)) {
    return { error: "Proveedor no válido." };
  }
  const plantilla = plantillaPorSlug(datos.plantilla);
  if (!plantilla) return { error: "Plantilla no válida." };

  const acuse = typeof datos.acuse_escalado === "string" ? datos.acuse_escalado.trim() : "";
  const fallback = typeof datos.fallback_reply === "string" ? datos.fallback_reply.trim() : "";
  if (!acuse || !fallback) {
    return { error: "El acuse de escalado y la respuesta de respaldo son obligatorios." };
  }

  const fila: DatosInstancia = {
    slug,
    nombre: nombre.slice(0, 120),
    proveedor: datos.proveedor as "green" | "cloud",
    acuse_escalado: acuse,
    fallback_reply: fallback,
  };
  if (credencialUsable(datos.escalation_notify_to)) {
    fila.escalation_notify_to = datos.escalation_notify_to.trim();
  }
  for (const campo of CAMPOS_CREDENCIAL) {
    const valor = datos[campo];
    if (credencialUsable(valor)) fila[campo] = valor.trim();
  }

  const creado = await crearInstancia(fila);
  if (!creado.ok) return { error: mensajeDe(creado.error) };
  const id = creado.data.id;

  // v1 con la plantilla elegida. Si falla, el bot ya existe y el prompt se
  // pone después en el editor — no vale la pena romper el flujo por esto.
  const prompt = await guardarPromptApi(id, {
    system_prompt: plantilla.system_prompt,
    knowledge: plantilla.knowledge,
    notas: datos.notas?.trim() || `v1 desde plantilla "${plantilla.label}"`,
    base_version: 0,
  });
  if (!prompt.ok) {
    console.error("[crearBot] instancia creada pero el prompt v1 falló:", prompt.error);
  }

  revalidarBots();
  return { id };
}

export async function editarBot(
  id: number,
  cambios: {
    nombre?: string;
    activo?: boolean;
    escalation_notify_to?: string;
    acuse_escalado?: string;
    fallback_reply?: string;
    green_api_url?: string;
    green_instance_id?: string;
    green_api_token?: string;
    green_webhook_token?: string;
    meta_phone_number_id?: string;
    meta_waba_id?: string;
    meta_access_token?: string;
  },
): Promise<{ error: string | null }> {
  await verifySession();
  if (!Number.isInteger(id) || id <= 0) return { error: "Bot no válido." };

  const fila: DatosInstancia = {};
  if ("nombre" in cambios) {
    const nombre = cambios.nombre?.trim() ?? "";
    if (!nombre) return { error: "El nombre no puede quedar vacío." };
    fila.nombre = nombre.slice(0, 120);
  }
  if ("activo" in cambios) fila.activo = Boolean(cambios.activo);
  if ("acuse_escalado" in cambios && cambios.acuse_escalado?.trim()) {
    fila.acuse_escalado = cambios.acuse_escalado.trim();
  }
  if ("fallback_reply" in cambios && cambios.fallback_reply?.trim()) {
    fila.fallback_reply = cambios.fallback_reply.trim();
  }
  if ("escalation_notify_to" in cambios && credencialUsable(cambios.escalation_notify_to)) {
    fila.escalation_notify_to = cambios.escalation_notify_to.trim();
  }
  for (const campo of CAMPOS_CREDENCIAL) {
    const valor = cambios[campo];
    // Vacío o redactado = "no tocar": jamás pisar un token real con •••.
    if (credencialUsable(valor)) fila[campo] = valor.trim();
  }

  if (Object.keys(fila).length === 0) return { error: null };

  const r = await actualizarInstancia(id, fila);
  if (!r.ok) return { error: mensajeDe(r.error) };
  revalidarBots();
  return { error: null };
}

/**
 * Copia una instancia SIN credenciales (el API las redacta y jamás deben
 * viajar de vuelta) con el prompt activo como v1. Ideal para demos: el Labs
 * funciona sin proveedor conectado.
 */
export async function duplicarBot(id: number): Promise<{ id: number } | { error: string }> {
  await verifySession();
  if (!Number.isInteger(id) || id <= 0) return { error: "Bot no válido." };

  const inst = await obtenerInstancia(id);
  if (!inst.ok) return { error: mensajeDe(inst.error) };
  const base = inst.data;
  const prompt = await obtenerPrompt(id); // puede no existir; se tolera

  const fila: DatosInstancia = {
    nombre: `Copia de ${base.nombre}`.slice(0, 120),
    proveedor: base.proveedor,
    acuse_escalado: base.acuse_escalado,
    fallback_reply: base.fallback_reply,
    modelo: base.modelo,
    effort: base.effort,
    max_tokens: base.max_tokens,
  };
  if (base.escalation_notify_to) fila.escalation_notify_to = base.escalation_notify_to;
  if (base.presupuesto_tokens_dia !== null) {
    fila.presupuesto_tokens_dia = base.presupuesto_tokens_dia;
  }

  let creado = await crearInstancia({ ...fila, slug: `${base.slug}-copia`.slice(0, 40) });
  if (!creado.ok && creado.error === "conflicto") {
    const sufijo = Math.random().toString(36).slice(2, 5);
    creado = await crearInstancia({
      ...fila,
      slug: `${base.slug}-copia-${sufijo}`.slice(0, 40),
    });
  }
  if (!creado.ok) return { error: mensajeDe(creado.error) };

  if (prompt.ok) {
    const v1 = await guardarPromptApi(creado.data.id, {
      system_prompt: prompt.data.system_prompt,
      knowledge: prompt.data.knowledge,
      notas: `copiado de ${base.slug} v${prompt.data.version}`,
      base_version: 0,
    });
    if (!v1.ok) {
      console.error("[duplicarBot] copia creada pero el prompt falló:", v1.error);
    }
  }

  revalidarBots();
  return { id: creado.data.id };
}

export async function guardarPrompt(
  id: number,
  datos: { system_prompt: string; knowledge: string; notas?: string; base_version: number },
): Promise<{ version: number } | { conflicto: number } | { error: string }> {
  await verifySession();
  if (!Number.isInteger(id) || id <= 0) return { error: "Bot no válido." };

  const system = typeof datos?.system_prompt === "string" ? datos.system_prompt : "";
  const knowledge = typeof datos?.knowledge === "string" ? datos.knowledge : "";
  if (!system.trim()) return { error: "Las instrucciones no pueden quedar vacías." };
  if (!Number.isInteger(datos.base_version) || datos.base_version < 0) {
    return { error: "Versión base no válida." };
  }

  const r = await guardarPromptApi(id, {
    system_prompt: system,
    knowledge,
    notas: datos.notas?.trim() || undefined,
    base_version: datos.base_version,
  });
  if (!r.ok) {
    if (r.error === "version_desactualizada") return { conflicto: r.activa };
    return { error: mensajeDe(r.error) };
  }
  revalidarBots();
  return { version: r.version };
}

export async function restaurarVersion(
  id: number,
  version: number,
): Promise<{ error: string | null }> {
  await verifySession();
  if (!Number.isInteger(id) || id <= 0) return { error: "Bot no válido." };
  if (!Number.isInteger(version) || version < 1) return { error: "Versión no válida." };

  const r = await activarVersion(id, version);
  if (!r.ok) return { error: mensajeDe(r.error) };
  revalidarBots();
  return { error: null };
}

export async function pausarChat(
  id: number,
  telefono: string,
  motivo?: string,
): Promise<{ error: string | null }> {
  await verifySession();
  const tel = typeof telefono === "string" ? telefono.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !tel) return { error: "Datos no válidos." };

  const r = await pausar(id, tel, motivo?.trim() || "pausado desde el panel");
  if (!r.ok) return { error: mensajeDe(r.error) };
  return { error: null };
}

export async function reanudarChat(
  id: number,
  telefono: string,
): Promise<{ error: string | null }> {
  await verifySession();
  const tel = typeof telefono === "string" ? telefono.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !tel) return { error: "Datos no válidos." };

  const r = await reanudar(id, tel);
  if (!r.ok) return { error: mensajeDe(r.error) };
  return { error: null };
}

export async function reintentarJob(jobId: number): Promise<{ error: string | null }> {
  await verifySession();
  if (!Number.isInteger(jobId) || jobId <= 0) return { error: "Job no válido." };

  const r = await reintentarJobApi(jobId);
  if (!r.ok) {
    return { error: r.error === "no_existe" ? "Ese job ya no está fallido." : mensajeDe(r.error) };
  }
  return { error: null };
}

export async function enviarManual(
  id: number,
  telefono: string,
  texto: string,
): Promise<{ error: string | null }> {
  await verifySession();
  const tel = typeof telefono === "string" ? telefono.trim() : "";
  const msj = typeof texto === "string" ? texto.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !tel || !msj) {
    return { error: "Teléfono y mensaje son obligatorios." };
  }

  const r = await enviarManualApi(id, tel, msj);
  if (!r.ok) return { error: mensajeDe(r.error) };
  return { error: null };
}
