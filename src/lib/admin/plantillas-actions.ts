"use server";

// Mutaciones del gestor de plantillas: borradores en Supabase, folletos al
// bucket de Storage, la edición hacia Meta vía el bot, y la conciliación de
// estados. Mismo contrato de siempre: verifySession() primera línea, retornos
// que nunca lanzan, español al usuario.

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import {
  conciliarPlantillas,
  edicionesRestantes,
  validarCuerpo,
  type PlantillaZakFila,
} from "./plantillas";
import { editarPlantillaMeta, listarPlantillasMeta } from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";

const BUCKET = "folletos";
const FOLLETO_MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_FOLLETO = ["image/png", "image/jpeg"];

async function filaPorSlug(
  supabase: Awaited<ReturnType<typeof verifySession>>["supabase"],
  slug: string,
): Promise<PlantillaZakFila | null> {
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const { data, error } = await supabase
    .from("plantillas_zak")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[plantillas] filaPorSlug:", error.message);
    return null;
  }
  return data as PlantillaZakFila | null;
}

/** Guarda el texto del borrador (aún no viaja a Meta). */
export async function guardarBorradorPlantilla(
  slug: string,
  texto: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();

  const invalido = validarCuerpo(typeof texto === "string" ? texto : "");
  if (invalido) return { error: invalido };
  const fila = await filaPorSlug(supabase, slug);
  if (!fila) return { error: "Esa plantilla no existe (¿corriste plantillas.sql?)." };

  const { error } = await supabase
    .from("plantillas_zak")
    .update({ texto_borrador: texto.trim() })
    .eq("slug", fila.slug);
  if (error) {
    console.error("[guardarBorradorPlantilla]:", error.message);
    return { error: "No se pudo guardar el borrador." };
  }
  revalidatePath("/admin/zak");
  return { ok: true };
}

/**
 * Sube un folleto nuevo al bucket público y lo deja como borrador. SIEMPRE
 * con nombre nuevo: el CDN de Supabase cachea el path — sobreescribir
 * serviría la imagen vieja quién sabe cuánto tiempo.
 */
export async function subirFolletoBorrador(
  slug: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { error: string }> {
  const { supabase } = await verifySession();

  const fila = await filaPorSlug(supabase, slug);
  if (!fila) return { error: "Esa plantilla no existe (¿corriste plantillas.sql?)." };

  const archivo = formData.get("folleto");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Adjunta la imagen del folleto (PNG o JPG)." };
  }
  if (!TIPOS_FOLLETO.includes(archivo.type)) {
    return { error: "El folleto tiene que ser PNG o JPG." };
  }
  if (archivo.size > FOLLETO_MAX_BYTES) {
    return { error: "Meta acepta headers de máximo 5 MB." };
  }

  const extension = archivo.type === "image/png" ? "png" : "jpg";
  const ruta = `${fila.slug}/${Date.now()}.${extension}`;
  const { error: eSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type });
  if (eSubida) {
    console.error("[subirFolletoBorrador] upload:", eSubida.message);
    return { error: "No se pudo subir al bucket (¿existe 'folletos' en Storage?)." };
  }
  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(ruta);

  const { error } = await supabase
    .from("plantillas_zak")
    .update({ folleto_url_borrador: publica.publicUrl })
    .eq("slug", fila.slug);
  if (error) {
    console.error("[subirFolletoBorrador] fila:", error.message);
    return { error: "Subió la imagen pero no se pudo guardar el borrador." };
  }
  revalidatePath("/admin/zak");
  return { ok: true, url: publica.publicUrl };
}

/**
 * Manda la edición a aprobación de Meta (vía el bot). El texto/folleto que
 * viajan son los del borrador con fallback a los vigentes. Mientras Meta
 * revisa, el envío de saludos sigue usando la versión aprobada — pero la
 * plantilla puede fallar si se usa: el selector la deshabilita.
 */
export async function enviarARevisionPlantilla(
  slug: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();

  const fila = await filaPorSlug(supabase, slug);
  if (!fila) return { error: "Esa plantilla no existe (¿corriste plantillas.sql?)." };

  const limites = edicionesRestantes(fila.envios_revision, Date.now());
  if (!limites.puedeEnviar) return { error: limites.motivo ?? "Límite de ediciones." };

  const cuerpo = (fila.texto_borrador ?? fila.texto_vigente).trim();
  const invalido = validarCuerpo(cuerpo);
  if (invalido) return { error: invalido };
  const folletoUrl = fila.folleto_url_borrador ?? fila.folleto_url_vigente;

  const r = await editarPlantillaMeta(ID_ZAK, fila.plantilla, {
    cuerpo,
    con_header: true, // v1: los saludos de Zak siempre llevan folleto
    folleto_url: folletoUrl,
  });
  if (!r.ok) {
    return {
      error:
        r.mensaje ??
        (r.error === "sin_conexion"
          ? "No hay conexión con el bot."
          : "Meta rechazó la edición."),
    };
  }

  const { error } = await supabase
    .from("plantillas_zak")
    .update({
      estado_meta: "PENDING",
      motivo_rechazo: null,
      texto_borrador: cuerpo,
      folleto_url_borrador: folletoUrl,
      borrador_enviado_en: new Date().toISOString(),
      envios_revision: [...fila.envios_revision, new Date().toISOString()],
    })
    .eq("slug", fila.slug);
  if (error) {
    console.error("[enviarARevisionPlantilla]:", error.message);
    return {
      error:
        "Meta recibió la edición pero no se pudo anotar localmente — refresca estados.",
    };
  }
  revalidatePath("/admin/zak");
  return { ok: true };
}

/**
 * Trae los estados reales de Meta y concilia: refresco siempre; PROMOCIÓN
 * borrador→vigente al detectar APPROVED; fin de revisión en REJECTED (el
 * borrador queda para corregir); detección de ediciones por fuera.
 */
export async function refrescarEstadosPlantillas(): Promise<
  | { promovidas: string[]; rechazadas: string[]; desincronizadas: string[] }
  | { error: string }
> {
  const { supabase } = await verifySession();

  const { data, error } = await supabase
    .from("plantillas_zak")
    .select("*")
    .order("orden", { ascending: true });
  if (error || !data || data.length === 0) {
    return { error: "No se pudo leer plantillas_zak (¿corriste plantillas.sql?)." };
  }

  const r = await listarPlantillasMeta(ID_ZAK);
  if (!r.ok) return { error: "No hay conexión con el bot para hablar con Meta." };

  const filas = data as PlantillaZakFila[];
  const c = conciliarPlantillas(filas, r.data);
  const ahora = new Date().toISOString();
  await Promise.all(
    c.updates.map(async (u) => {
      const { error: eUpd } = await supabase
        .from("plantillas_zak")
        .update({ ...u.campos, estados_refrescados_en: ahora })
        .eq("slug", u.slug);
      if (eUpd) console.error("[refrescarEstadosPlantillas]", u.slug, eUpd.message);
    }),
  );
  revalidatePath("/admin/zak");
  return {
    promovidas: c.promovidas,
    rechazadas: c.rechazadas,
    desincronizadas: c.desincronizadas,
  };
}

/** «Adoptar el texto de Meta»: alguien editó por fuera (Business Manager) y
 * el humano decidió que ESO es la verdad del espejo. */
export async function adoptarTextoDeMeta(
  slug: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();

  const fila = await filaPorSlug(supabase, slug);
  if (!fila) return { error: "Esa plantilla no existe." };

  const r = await listarPlantillasMeta(ID_ZAK);
  if (!r.ok) return { error: "No hay conexión con el bot para hablar con Meta." };
  const enMeta = r.data.find((p) => p.nombre === fila.plantilla);
  if (!enMeta || !enMeta.cuerpo.trim()) {
    return { error: "Meta no reporta cuerpo para esa plantilla." };
  }

  const { error } = await supabase
    .from("plantillas_zak")
    .update({
      texto_vigente: enMeta.cuerpo,
      header_aprobado: enMeta.tiene_header_imagen ?? fila.header_aprobado,
    })
    .eq("slug", fila.slug);
  if (error) {
    console.error("[adoptarTextoDeMeta]:", error.message);
    return { error: "No se pudo actualizar el espejo." };
  }
  revalidatePath("/admin/zak");
  return { ok: true };
}
