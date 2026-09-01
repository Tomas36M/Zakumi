"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { verifySession } from "./dal";
import { ESTADOS, type EstadoNegocio } from "./negocios";
import { normalizarTelefonoCO } from "./telefono";
import type { ResultadoPlace } from "./places";

export type EstadoLogin = { error: string | null };

/**
 * Inicia sesión con email + contraseña. No hay registro: las cuentas se
 * crean a mano en el dashboard de Supabase (signup público desactivado).
 */
export async function login(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Escribe correo y contraseña." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Mensaje genérico a propósito: no revelar si el correo existe.
    return { error: "Credenciales inválidas." };
  }

  redirect("/admin/mapa");
}

export async function logout(): Promise<void> {
  // Como toda server action, es un endpoint público: sesión primero.
  const { supabase } = await verifySession();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/* ————————————————————————————————————————————————————————————————————————
   CRM de prospección. Toda action valida sesión primero (son endpoints
   públicos) y re-normaliza en servidor lo que venga del cliente.
   ———————————————————————————————————————————————————————————————————— */

const ESTADOS_VALIDOS = new Set(ESTADOS.map((e) => e.valor));

/** Ciudad libre: cualquier texto no vacío, o null. Con territorios ya no hay
 * un enum de municipios que validar — el dato honesto es el que trae Google
 * (o el que escribe el humano), recortado a un largo razonable. */
function ciudadLimpia(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, 120) : null;
}

function esEstado(valor: unknown): valor is EstadoNegocio {
  return typeof valor === "string" && ESTADOS_VALIDOS.has(valor as EstadoNegocio);
}

function coordenadasValidas(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Solo URLs navegables: nada de javascript: ni esquemas raros en los href. */
function urlHttpONull(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return /^https?:\/\/\S+$/i.test(limpio) ? limpio : null;
}

function revalidarPanel() {
  revalidatePath("/admin/mapa");
  revalidatePath("/admin/negocios");
}

/**
 * Importa resultados de Places. El upsert con ignoreDuplicates hace el
 * dedupe atómico contra google_place_id: importar dos veces no duplica.
 */
export async function importarNegocios(
  resultados: ResultadoPlace[],
): Promise<{ importados: number; duplicados: number } | { error: string }> {
  const { supabase } = await verifySession();

  if (!Array.isArray(resultados) || resultados.length === 0) {
    return { error: "Nada para importar." };
  }
  if (resultados.length > 25) {
    return { error: "Máximo 25 negocios por tanda." };
  }

  const filas = [];
  for (const r of resultados) {
    if (
      typeof r?.placeId !== "string" ||
      !r.placeId ||
      typeof r?.nombre !== "string" ||
      !r.nombre.trim() ||
      !coordenadasValidas(r.lat, r.lng)
    ) {
      return { error: "Uno de los resultados llegó incompleto." };
    }
    // Nunca confiar en la normalización del cliente.
    const { telefono, tipo } = normalizarTelefonoCO(r.telefono);
    filas.push({
      nombre: r.nombre.trim().slice(0, 300),
      direccion: typeof r.direccion === "string" ? r.direccion : null,
      ciudad: typeof r.ciudad === "string" && r.ciudad.trim() ? r.ciudad.trim() : null,
      lat: r.lat,
      lng: r.lng,
      categoria: typeof r.categoria === "string" ? r.categoria : null,
      rating: typeof r.rating === "number" ? r.rating : null,
      sitio_web: urlHttpONull(r.sitioWeb),
      telefono,
      tipo_telefono: tipo,
      google_place_id: r.placeId,
      territorio_id: null,
      fuente: "places" as const,
    });
  }

  const { data, error } = await supabase
    .from("negocios")
    .upsert(filas, { onConflict: "google_place_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[importarNegocios]", error.message);
    return { error: "No se pudo guardar en la base." };
  }

  revalidarPanel();
  const importados = data?.length ?? 0;
  return { importados, duplicados: filas.length - importados };
}

export async function crearNegocioManual(datos: {
  nombre: string;
  lat: number;
  lng: number;
  ciudad: string | null;
  direccion?: string;
  categoria?: string;
  telefono?: string;
}): Promise<{ id: string } | { error: string }> {
  const { supabase } = await verifySession();

  const nombre = typeof datos?.nombre === "string" ? datos.nombre.trim() : "";
  if (!nombre) return { error: "El negocio necesita un nombre." };
  if (!coordenadasValidas(datos.lat, datos.lng)) {
    return { error: "Las coordenadas no son válidas." };
  }

  const bruto = datos.telefono?.trim() ?? "";
  const { telefono, tipo } = normalizarTelefonoCO(bruto);
  if (bruto && telefono === null) {
    return { error: "Ese teléfono no se entiende. Usa 10 dígitos o +57…" };
  }

  const { data, error } = await supabase
    .from("negocios")
    .insert({
      nombre: nombre.slice(0, 300),
      direccion: datos.direccion?.trim() || null,
      ciudad: ciudadLimpia(datos.ciudad),
      lat: datos.lat,
      lng: datos.lng,
      categoria: datos.categoria?.trim() || null,
      telefono,
      tipo_telefono: tipo,
      territorio_id: null,
      fuente: "manual" as const,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[crearNegocioManual]", error?.message);
    return { error: "No se pudo guardar en la base." };
  }

  revalidarPanel();
  return { id: data.id as string };
}

export async function actualizarNegocio(
  id: string,
  cambios: {
    estado?: EstadoNegocio;
    telefono?: string;
    nombre?: string;
    categoria?: string;
    ciudad?: string | null;
    sitio_web?: string;
    direccion?: string;
  },
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  if (typeof id !== "string" || !id) return { error: "Negocio no válido." };

  // Whitelist explícita: solo entra a la base lo que el panel edita.
  const fila: Record<string, unknown> = {};
  if ("estado" in cambios) {
    if (!esEstado(cambios.estado)) return { error: "Estado no válido." };
    fila.estado = cambios.estado;
  }
  if ("telefono" in cambios) {
    const bruto = cambios.telefono?.trim() ?? "";
    const { telefono, tipo } = normalizarTelefonoCO(bruto);
    if (bruto && telefono === null) {
      return { error: "Ese teléfono no se entiende. Usa 10 dígitos o +57…" };
    }
    fila.telefono = telefono;
    fila.tipo_telefono = tipo;
  }
  if ("nombre" in cambios) {
    const nombre = cambios.nombre?.trim() ?? "";
    if (!nombre) return { error: "El nombre no puede quedar vacío." };
    fila.nombre = nombre.slice(0, 300);
  }
  if ("categoria" in cambios) fila.categoria = cambios.categoria?.trim() || null;
  if ("ciudad" in cambios) fila.ciudad = ciudadLimpia(cambios.ciudad);
  if ("sitio_web" in cambios) fila.sitio_web = urlHttpONull(cambios.sitio_web);
  if ("direccion" in cambios) fila.direccion = cambios.direccion?.trim() || null;

  if (Object.keys(fila).length === 0) return { error: null };

  const { error } = await supabase.from("negocios").update(fila).eq("id", id);
  if (error) {
    console.error("[actualizarNegocio]", error.message);
    return { error: "No se pudo guardar el cambio." };
  }

  revalidarPanel();
  return { error: null };
}

/**
 * Cambio de estado en lote — el control fino de a quién se contacta.
 * El trigger de la base deja una nota automática por cada fila.
 */
export async function cambiarEstadoLote(
  ids: string[],
  estado: EstadoNegocio,
): Promise<{ actualizados: number } | { error: string }> {
  const { supabase } = await verifySession();

  if (!esEstado(estado)) return { error: "Estado no válido." };
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "No hay negocios seleccionados." };
  }
  if (ids.length > 500 || ids.some((i) => typeof i !== "string" || !i)) {
    return { error: "Selección no válida." };
  }

  const { data, error } = await supabase
    .from("negocios")
    .update({ estado })
    .in("id", ids)
    .select("id");

  if (error) {
    console.error("[cambiarEstadoLote]", error.message);
    return { error: "No se pudo aplicar el cambio." };
  }

  revalidarPanel();
  return { actualizados: data?.length ?? 0 };
}

export async function agregarNota(
  negocioId: string,
  texto: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();

  if (typeof negocioId !== "string" || !negocioId) {
    return { error: "Negocio no válido." };
  }
  const limpio = typeof texto === "string" ? texto.trim() : "";
  if (!limpio) return { error: "La nota está vacía." };
  if (limpio.length > 4000) return { error: "Máximo 4000 caracteres." };

  const { error } = await supabase
    .from("notas")
    .insert({ negocio_id: negocioId, texto: limpio });

  if (error) {
    console.error("[agregarNota]", error.message);
    return { error: "No se pudo guardar la nota." };
  }

  return { error: null };
}

/**
 * Borra negocios en lote. Las notas se van en cascada (FK) y si alguno fue
 * convertido en cliente, el cliente queda (negocio_id pasa a NULL). Los
 * prospectos de Zak no se tocan: viven en la base del bot con referencia
 * blanda, y su conversación sigue existiendo en la bandeja.
 */
export async function eliminarNegocios(
  ids: string[],
): Promise<{ eliminados: number } | { error: string }> {
  const { supabase } = await verifySession();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "No hay negocios seleccionados." };
  }
  if (ids.length > 500) return { error: "Máximo 500 por operación." };
  if (ids.some((id) => typeof id !== "string" || !id)) {
    return { error: "Selección no válida." };
  }

  const { data, error } = await supabase
    .from("negocios")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) {
    console.error("[eliminarNegocios]", error.message);
    return { error: "No se pudieron eliminar los negocios." };
  }
  revalidarPanel();
  return { eliminados: data?.length ?? 0 };
}
