"use server";

// El puente entre el CRM (Supabase, solo escribible con sesión) y la
// prospección de Zak (bot en Railway). Mismo contrato que las demás actions:
// verifySession() primera línea, retornos que nunca lanzan, español al usuario.

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import { sinMas } from "./telefono";
import { avancesDeEstado, componentesSaludo, contactables } from "./zak";
import type { EstadoNegocio, Negocio } from "./negocios";
import { crearTanda, listarProspectos } from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";

const TANDA_MAX = 50; // espejo del tope por tanda del bot
const PLANTILLA_SALUDO = "saludo_zakumi";

/**
 * «Que Zak los contacte»: crea la tanda en el bot (plantilla + contexto por
 * negocio) y marca 'contactado' en el CRM SOLO a los que realmente entraron
 * (los duplicados ya eran prospectos de antes). El trigger de la base deja la
 * nota automática del cambio de estado.
 */
export async function enviarTandaZak(negocioIds: string[]): Promise<
  { contactados: number; omitidos: number; duplicados: number } | { error: string }
> {
  const { supabase } = await verifySession();

  if (!Array.isArray(negocioIds) || negocioIds.length === 0) {
    return { error: "No hay negocios seleccionados." };
  }
  if (negocioIds.length > TANDA_MAX) {
    return { error: `Máximo ${TANDA_MAX} negocios por tanda.` };
  }
  if (negocioIds.some((id) => typeof id !== "string" || !id)) {
    return { error: "Selección no válida." };
  }

  // Releer de la base: jamás confiar en los datos que manda el cliente.
  const { data, error } = await supabase.from("negocios").select("*").in("id", negocioIds);
  if (error || !data) {
    console.error("[enviarTandaZak] negocios:", error?.message);
    return { error: "No se pudieron leer los negocios seleccionados." };
  }
  const elegibles = contactables(data as Negocio[]);
  if (elegibles.length === 0) {
    return { error: "Ninguno de los seleccionados tiene celular contactable." };
  }

  const r = await crearTanda(ID_ZAK, {
    plantilla: PLANTILLA_SALUDO,
    lang: "es",
    notas: `tanda desde el CRM (${elegibles.length} negocios)`,
    prospectos: elegibles.map((n) => ({
      telefono: sinMas(n.telefono as string),
      negocio_id: n.id,
      contexto: {
        nombre: n.nombre,
        categoria: n.categoria ?? undefined,
        ciudad: n.ciudad,
      },
      componentes: componentesSaludo(n),
    })),
  });
  if (!r.ok) {
    if (r.error === "conflicto") {
      return { error: "Tope diario de prospección alcanzado. Inténtalo mañana." };
    }
    console.error("[enviarTandaZak] bot:", r.error);
    return { error: "No hay conexión con el bot para crear la tanda." };
  }

  // 'contactado' solo para los creados y solo desde 'nuevo': un negocio que ya
  // respondió o se interesó por otra vía no retrocede.
  const dup = new Set(r.data.duplicados);
  const idsCreados = elegibles
    .filter((n) => !dup.has(sinMas(n.telefono as string)))
    .map((n) => n.id);
  if (idsCreados.length > 0) {
    const { error: e2 } = await supabase
      .from("negocios")
      .update({ estado: "contactado" })
      .in("id", idsCreados)
      .eq("estado", "nuevo");
    if (e2) console.error("[enviarTandaZak] estados:", e2.message);
  }

  revalidatePath("/admin/negocios");
  revalidatePath("/admin/zak");
  return {
    contactados: idsCreados.length,
    omitidos: negocioIds.length - elegibles.length,
    duplicados: r.data.duplicados.length,
  };
}

/**
 * Trae la prospección del bot y avanza los estados del CRM (forward-only,
 * por negocio_id). Se dispara al abrir /admin/zak y con el botón de la
 * pestaña Interesados.
 */
export async function sincronizarEstadosZak(): Promise<
  { respondidos: number; interesados: number } | { error: string }
> {
  const { supabase } = await verifySession();

  const r = await listarProspectos(ID_ZAK);
  if (!r.ok) {
    return { error: "No hay conexión con el bot para sincronizar." };
  }
  const relevantes = r.data.filter(
    (p) => p.negocio_id !== null && (p.estado_envio === "respondido" || p.interesado),
  );
  if (relevantes.length === 0) return { respondidos: 0, interesados: 0 };

  const ids = [...new Set(relevantes.map((p) => p.negocio_id as string))];
  const { data, error } = await supabase.from("negocios").select("id, estado").in("id", ids);
  if (error || !data) {
    console.error("[sincronizarEstadosZak] negocios:", error?.message);
    return { error: "No se pudieron leer los estados actuales del CRM." };
  }

  const avances = avancesDeEstado(
    r.data,
    data as { id: string; estado: EstadoNegocio }[],
  );
  const aRespondido = avances.filter((a) => a.a === "respondido").map((a) => a.id);
  const aInteresado = avances.filter((a) => a.a === "interesado").map((a) => a.id);

  if (aRespondido.length > 0) {
    const { error: e1 } = await supabase
      .from("negocios").update({ estado: "respondido" }).in("id", aRespondido);
    if (e1) console.error("[sincronizarEstadosZak] respondidos:", e1.message);
  }
  if (aInteresado.length > 0) {
    const { error: e2 } = await supabase
      .from("negocios").update({ estado: "interesado" }).in("id", aInteresado);
    if (e2) console.error("[sincronizarEstadosZak] interesados:", e2.message);
  }
  if (avances.length > 0) revalidatePath("/admin/negocios");

  return { respondidos: aRespondido.length, interesados: aInteresado.length };
}
