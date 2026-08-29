"use server";

// El puente entre el CRM (Supabase, solo escribible con sesión) y la
// prospección de Zak (bot en Railway). Mismo contrato que las demás actions:
// verifySession() primera línea, retornos que nunca lanzan, español al usuario.

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import { admiteWhatsApp, normalizarTelefonoCO, sinMas } from "./telefono";
import {
  agruparPorVertical,
  avancesDeEstado,
  componentesSaludo,
  contactables,
  verticalPorSlug,
} from "./zak";
import { catalogoVerticales } from "./zak-verticales";
import type { EstadoNegocio, Negocio } from "./negocios";
import { crearTanda, enviarPlantillaDirecta, listarProspectos } from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";

const TANDA_MAX = 50; // espejo del tope por tanda del bot

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

  // Una tanda POR VERTICAL: cada tipo de negocio recibe SU plantilla y su
  // ángulo de conversación viaja en el contexto del prospecto. El catálogo se
  // relee de la DB en cada envío: lo que sale es SIEMPRE lo vigente/aprobado.
  const catalogo = await catalogoVerticales(supabase);
  const grupos = agruparPorVertical(elegibles, catalogo.verticales, catalogo.generico);
  const duplicadosTels = new Set<string>();
  const procesados: Negocio[] = []; // negocios de grupos cuya tanda SÍ se creó
  let topeAlcanzado = false;
  let algunaOk = false;

  for (const { vertical, negocios } of grupos) {
    if (vertical.enRevision) {
      // Meta puede rechazar envíos de una plantilla mientras la revisa: ese
      // grupo se queda por fuera (cuenta como 'omitidos') hasta la aprobación.
      console.error("[enviarTandaZak] vertical en revisión, omitido:", vertical.slug);
      continue;
    }
    // El folleto del nicho: mismo header de imagen para toda la tanda.
    const componentes = componentesSaludo(vertical);
    const r = await crearTanda(ID_ZAK, {
      plantilla: vertical.plantilla,
      lang: "es",
      notas: `tanda ${vertical.label} desde el CRM (${negocios.length} negocios)`,
      prospectos: negocios.map((n) => ({
        telefono: sinMas(n.telefono as string),
        negocio_id: n.id,
        contexto: {
          nombre: n.nombre,
          categoria: n.categoria ?? undefined,
          ciudad: n.ciudad,
          angulo: vertical.angulo,
          // La burbuja inicial del chat: el bot la guarda al enviar la
          // plantilla (y con el texto EXACTO del catálogo, el folleto se
          // pinta en la bandeja).
          saludo: vertical.texto,
        },
        componentes,
      })),
    });
    if (!r.ok) {
      if (r.error === "conflicto") {
        topeAlcanzado = true;
        break; // el tope diario es global: los grupos restantes tampoco caben
      }
      console.error("[enviarTandaZak] bot:", r.error, "vertical:", vertical.slug);
      continue;
    }
    algunaOk = true;
    procesados.push(...negocios);
    for (const t of r.data.duplicados) duplicadosTels.add(t);
  }

  if (!algunaOk) {
    return {
      error: topeAlcanzado
        ? "Tope diario de prospección alcanzado. Inténtalo mañana."
        : "No hay conexión con el bot para crear la tanda.",
    };
  }

  // 'contactado' solo para los creados y solo desde 'nuevo': un negocio que ya
  // respondió o se interesó por otra vía no retrocede.
  const idsCreados = procesados
    .filter((n) => !duplicadosTels.has(sinMas(n.telefono as string)))
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
    omitidos: negocioIds.length - procesados.length,
    duplicados: duplicadosTels.size,
  };
}

/**
 * Abre (o reabre) un chat con la plantilla de saludo: lo ÚNICO que Meta
 * permite con números nuevos o con la ventana de 24h cerrada. El saludo queda
 * en el historial como mensaje de Zak, así la conversación aparece en la
 * bandeja y él sabe que ya saludó. `verticalSlug` elige QUÉ plantilla
 * (folleto + texto del nicho); ausente o desconocido = genérica.
 */
export async function abrirChatZak(
  telefonoBruto: string,
  verticalSlug?: string,
): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await verifySession();

  const normalizado = normalizarTelefonoCO(telefonoBruto);
  const { telefono } = normalizado;
  if (telefono === null) {
    return {
      error: "Ese teléfono no se entiende. Usa 10 dígitos (Colombia) o +código de país.",
    };
  }
  if (!admiteWhatsApp(normalizado)) {
    return {
      error:
        "WhatsApp necesita un celular: en Colombia empiezan por 3. Para otro país, escribe el número completo con + (ej. +56 9…).",
    };
  }

  const catalogo = await catalogoVerticales(supabase);
  const vertical = verticalPorSlug(verticalSlug, catalogo.todos, catalogo.generico);
  if (vertical.enRevision) {
    return {
      error: `La plantilla de ${vertical.label} está en revisión de Meta — usa otra o espera la aprobación.`,
    };
  }
  const r = await enviarPlantillaDirecta(ID_ZAK, {
    telefono: sinMas(telefono),
    plantilla: vertical.plantilla,
    lang: "es",
    texto: vertical.texto,
    componentes: componentesSaludo(vertical),
  });
  if (!r.ok) {
    if (r.error === "bot_error") {
      return {
        error:
          "Meta rechazó el envío. Si la plantilla sigue en revisión, hay que esperar su aprobación.",
      };
    }
    return { error: "No hay conexión con el bot para enviar el saludo." };
  }
  revalidatePath("/admin/zak");
  return { ok: true };
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
