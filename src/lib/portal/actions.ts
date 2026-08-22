"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { servicioDelSlug } from "@/lib/catalogo";
import { hoyBogota } from "@/lib/admin/cartera";
import { normalizarTelefonoCO } from "@/lib/admin/telefono";
import { guardarPrompt, obtenerPrompt } from "@/lib/bots/api";
import { avisarAdmin } from "./avisos";
import { instanciaDelCliente, verifySesionPortal } from "./dal";
import { ESTADOS_EN_CURSO } from "./solicitudes";
import {
  parseConocimiento,
  serializarConocimiento,
  validarSecciones,
  type CampoGuiado,
} from "./conocimiento";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ————————————————————————————————————————————————————————————————————————
   Tienda: crear solicitud. La RLS solo deja insertar en 'nueva' y sin
   campos de cotización; aquí además se valida el catálogo y el duplicado.
   ———————————————————————————————————————————————————————————————————— */

export type EstadoSolicitudForm = { error: string | null };

export async function crearSolicitud(
  _prev: EstadoSolicitudForm,
  formData: FormData,
): Promise<EstadoSolicitudForm> {
  const sesion = await verifySesionPortal();

  const slug = String(formData.get("servicio") ?? "");
  const mensaje = String(formData.get("mensaje") ?? "").trim().slice(0, 2000);

  const servicio = servicioDelSlug(slug);
  if (!servicio) return { error: "Ese servicio no existe." };
  if (!servicio.disponible) {
    return { error: "Ese servicio está por lanzarse — todavía no se puede solicitar." };
  }

  // Una solicitud en curso por servicio: la segunda confunde la bandeja.
  const { data: enCurso } = await sesion.supabase
    .from("solicitudes")
    .select("id")
    .eq("user_id", sesion.userId)
    .eq("servicio_slug", slug)
    .in("estado", [...ESTADOS_EN_CURSO])
    .limit(1);
  if (enCurso && enCurso.length > 0) {
    return { error: "Ya tienes una solicitud en curso de este servicio. Revísala en Solicitudes." };
  }

  const { error } = await sesion.supabase.from("solicitudes").insert({
    user_id: sesion.userId,
    servicio_slug: slug,
    mensaje: mensaje || null,
  });
  if (error) {
    console.error("[crearSolicitud]", error.message);
    return { error: "No se pudo enviar la solicitud. Intenta de nuevo." };
  }

  // Aviso a Tomás por WhatsApp. Nunca lanza: si Railway está caído, la
  // solicitud igual queda en la bandeja del admin.
  const quien = sesion.nombre || sesion.email || "alguien";
  await avisarAdmin(
    `🛒 Nueva solicitud en el portal\n${servicio.nombre} — ${quien}` +
      (mensaje ? `\n"${mensaje.slice(0, 300)}"` : "") +
      `\nCotiza en zakumistudio.com/admin/solicitudes`,
  );

  revalidatePath("/app/solicitudes");
  revalidatePath("/app");
  redirect("/app/solicitudes");
}

/* ————————————————————————————————————————————————————————————————————————
   Mi bot: guardar las secciones guiadas dentro del knowledge del prompt.
   El system_prompt viaja intacto y el `resto` del knowledge se preserva —
   el cliente solo puede tocar sus cinco campos.
   ———————————————————————————————————————————————————————————————————— */

export type ResultadoGuardarSecciones =
  | { ok: true; version: number }
  | { ok: false; error: string; conflicto?: boolean };

export async function guardarSecciones(datos: {
  instanciaId: string;
  baseVersion: number;
  campos: Record<CampoGuiado, string>;
}): Promise<ResultadoGuardarSecciones> {
  const sesion = await verifySesionPortal();

  const iid = await instanciaDelCliente(sesion, String(datos?.instanciaId ?? ""));
  if (iid === null) return { ok: false, error: "Ese bot no es tuyo." };
  if (!Number.isInteger(datos.baseVersion) || datos.baseVersion < 0) {
    return { ok: false, error: "Versión no válida." };
  }

  // El prompt vigente: de él salen el system_prompt (intacto) y el resto.
  const actual = await obtenerPrompt(iid);
  if (!actual.ok) {
    return { ok: false, error: "Tu bot no respondió. Intenta en un momento." };
  }

  const secciones = parseConocimiento(actual.data.knowledge);
  secciones.personalidad = String(datos.campos?.personalidad ?? "").trim();
  secciones.negocio = String(datos.campos?.negocio ?? "").trim();
  secciones.horarios = String(datos.campos?.horarios ?? "").trim();
  secciones.faq = String(datos.campos?.faq ?? "").trim();
  secciones.noDecir = String(datos.campos?.noDecir ?? "").trim();

  const invalido = validarSecciones(secciones);
  if (invalido) return { ok: false, error: invalido };

  const r = await guardarPrompt(iid, {
    system_prompt: actual.data.system_prompt,
    knowledge: serializarConocimiento(secciones),
    notas: `Editado por cliente ${sesion.email ?? sesion.userId}`,
    base_version: datos.baseVersion,
  });

  if (!r.ok) {
    if (r.error === "version_desactualizada") {
      return {
        ok: false,
        conflicto: true,
        error: "Tu bot fue actualizado mientras editabas. Recarga la página y vuelve a intentar.",
      };
    }
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }

  revalidatePath("/app/mi-bot");
  return { ok: true, version: r.version };
}

/* ————————————————————————————————————————————————————————————————————————
   Mis ventas: mini-CRM del cliente. RLS ya limita a lo propio; el user_id
   explícito hace la intención legible.
   ———————————————————————————————————————————————————————————————————— */

export async function registrarVenta(datos: {
  contacto: string;
  telefono?: string;
  detalle?: string;
  monto?: number;
  fecha?: string;
}): Promise<{ id: string } | { error: string }> {
  const sesion = await verifySesionPortal();

  const contacto = typeof datos?.contacto === "string" ? datos.contacto.trim() : "";
  if (!contacto) return { error: "La venta necesita un contacto o nombre." };

  const bruto = datos.telefono?.trim() ?? "";
  const { telefono } = normalizarTelefonoCO(bruto);
  if (bruto && telefono === null) {
    return { error: "Ese teléfono no se entiende. Usa 10 dígitos o +57…" };
  }

  let monto: number | null = null;
  if (datos.monto !== undefined) {
    if (typeof datos.monto !== "number" || !Number.isFinite(datos.monto) || datos.monto < 0) {
      return { error: "El monto no es válido." };
    }
    monto = datos.monto;
  }
  const fecha = datos.fecha !== undefined ? datos.fecha : hoyBogota();
  if (!FECHA_ISO.test(fecha)) return { error: "La fecha no es válida." };

  const { data, error } = await sesion.supabase
    .from("ventas_cliente")
    .insert({
      user_id: sesion.userId,
      contacto: contacto.slice(0, 200),
      telefono,
      detalle: datos.detalle?.trim().slice(0, 2000) || null,
      monto,
      fecha,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[registrarVenta]", error?.message);
    return { error: "No se pudo guardar la venta." };
  }
  revalidatePath("/app/mis-ventas");
  return { id: data.id as string };
}

export async function eliminarVenta(id: string): Promise<{ error: string | null }> {
  const sesion = await verifySesionPortal();
  if (typeof id !== "string" || !id) return { error: "Venta no válida." };

  const { error } = await sesion.supabase
    .from("ventas_cliente")
    .delete()
    .eq("id", id)
    .eq("user_id", sesion.userId);
  if (error) {
    console.error("[eliminarVenta]", error.message);
    return { error: "No se pudo eliminar la venta." };
  }
  revalidatePath("/app/mis-ventas");
  return { error: null };
}

/* ————————————————————————————————————————————————————————————————————————
   Ajustes de la cuenta. El trigger perfiles_proteger de la base garantiza
   que por aquí no se pueda tocar rol ni cliente_id.
   ———————————————————————————————————————————————————————————————————— */

export async function actualizarNombre(
  nombre: string,
): Promise<{ error: string | null }> {
  const sesion = await verifySesionPortal();
  const limpio = typeof nombre === "string" ? nombre.trim().slice(0, 200) : "";
  if (!limpio) return { error: "El nombre no puede quedar vacío." };

  const { error } = await sesion.supabase
    .from("perfiles")
    .update({ nombre: limpio })
    .eq("user_id", sesion.userId);
  if (error) {
    console.error("[actualizarNombre]", error.message);
    return { error: "No se pudo guardar el nombre." };
  }
  revalidatePath("/app", "layout");
  return { error: null };
}

export async function cambiarPassword(datos: {
  password: string;
  confirmacion: string;
}): Promise<{ error: string | null }> {
  const sesion = await verifySesionPortal();

  const password = typeof datos?.password === "string" ? datos.password : "";
  if (password.length < 8) {
    return { error: "La contraseña necesita al menos 8 caracteres." };
  }
  if (password !== datos.confirmacion) {
    return { error: "Las contraseñas no coinciden." };
  }

  const { error } = await sesion.supabase.auth.updateUser({ password });
  if (error) {
    console.error("[cambiarPassword]", error.message);
    return { error: "No se pudo cambiar la contraseña." };
  }
  return { error: null };
}
