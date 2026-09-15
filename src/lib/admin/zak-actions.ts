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
  despacharTandas,
  TANDA_MAX_BOT,
  verticalPorSlug,
} from "./zak";
import { avanzarEstadoNegocio, avanzarEstadosNegocio } from "./estado-negocio";
import { catalogoVerticales } from "./zak-verticales";
import type { EstadoNegocio, Negocio } from "./negocios";
import { crearTanda, enviarPlantillaDirecta, listarProspectos } from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";

const ENVIO_MAX = 250; // cupo diario del número en Meta (TIER_250): más que esto no sale hoy

/**
 * «Que Zak los contacte»: crea en el bot UNA tanda por vertical (plantilla +
 * contexto por negocio), de máximo TANDA_MAX_BOT, y marca 'contactado' en el
 * CRM a todo lo que entró, duplicados incluidos. Lo que no cupo en la tanda de
 * su vertical vuelve en `sobrantes`; si el bot avisa tope diario, lo que falta
 * vuelve en `porTope`. El trigger de la base deja la nota automática del
 * cambio de estado.
 */
export async function enviarTandaZak(negocioIds: string[]): Promise<
  | { contactados: number; omitidos: number; duplicados: number; porTope: number; sobrantes: number }
  | { error: string }
> {
  const { supabase } = await verifySession();

  if (!Array.isArray(negocioIds) || negocioIds.length === 0) {
    return { error: "No hay negocios seleccionados." };
  }
  if (negocioIds.length > ENVIO_MAX) {
    return { error: `Máximo ${ENVIO_MAX} negocios por envío: es el cupo diario del número.` };
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
  for (const { vertical } of grupos) {
    // Meta puede rechazar envíos de una plantilla mientras la revisa: ese
    // grupo se queda por fuera (cuenta como 'omitidos') hasta la aprobación.
    if (vertical.enRevision) {
      console.error("[enviarTandaZak] vertical en revisión, omitido:", vertical.slug);
    }
  }

  // Una tanda por vertical, de máximo TANDA_MAX_BOT: lo que sobra vuelve en
  // `sobrantes`. Al primer «tope diario» se para (el cupo es del número
  // entero) y lo que falta vuelve en `porTope`.
  const despacho = await despacharTandas(
    grupos,
    async (vertical, lote) => {
      // El folleto del nicho: mismo header de imagen para toda la tanda.
      const componentes = componentesSaludo(vertical);
      const r = await crearTanda(ID_ZAK, {
        plantilla: vertical.plantilla,
        lang: "es",
        notas: `tanda ${vertical.label} desde el CRM (${lote.length} negocios)`,
        prospectos: lote.map((n) => ({
          telefono: sinMas(n.telefono as string),
          negocio_id: n.id,
          contexto: {
            nombre: n.nombre,
            categoria: n.categoria ?? undefined,
            ciudad: n.ciudad ?? undefined,
            angulo: vertical.angulo,
            // La burbuja inicial del chat: el bot la guarda al enviar la
            // plantilla (y con el texto EXACTO del catálogo, el folleto se
            // pinta en la bandeja).
            saludo: vertical.texto,
          },
          componentes,
        })),
      });
      if (r.ok) return { ok: true as const, duplicados: r.data.duplicados };
      if (r.error !== "conflicto") {
        console.error("[enviarTandaZak] bot:", r.error, "vertical:", vertical.slug);
      }
      return { ok: false as const, tope: r.error === "conflicto" };
    },
    TANDA_MAX_BOT,
  );

  if (!despacho.algunaOk) {
    return {
      error:
        despacho.porTope > 0
          ? "Tope diario de prospección alcanzado. Inténtalo mañana."
          : "No hay conexión con el bot para crear la tanda.",
    };
  }

  // 'contactado' para todo lo que entró al bot, duplicados incluidos: un
  // duplicado ya es prospecto de Zak (lo contactó otra tanda) y el bot no lo
  // vuelve a aceptar; dejarlo en 'nuevo' lo pondría primero en cada
  // «Contactar a los nuevos» sin poder salir nunca. avanzarEstadosNegocio es
  // forward-only y respeta el candado manual.
  const idsEnviados = despacho.enviados.map((n) => n.id);
  if (idsEnviados.length > 0) {
    await avanzarEstadosNegocio(supabase, idsEnviados, "contactado");
  }
  const contactados = despacho.enviados.filter(
    (n) => !despacho.duplicados.has(sinMas(n.telefono as string)),
  ).length;

  revalidatePath("/admin/prospeccion");
  revalidatePath("/admin/zak");
  return {
    contactados,
    omitidos: negocioIds.length - despacho.enviados.length - despacho.porTope - despacho.sobrantes,
    duplicados: despacho.duplicados.size,
    porTope: despacho.porTope,
    sobrantes: despacho.sobrantes,
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
  negocioId?: string,
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
  if (negocioId) {
    await avanzarEstadoNegocio(supabase, negocioId, "contactado");
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
  const { data, error } = await supabase
    .from("negocios")
    .select("id, estado, estado_fijado_manual")
    .in("id", ids);
  if (error || !data) {
    console.error("[sincronizarEstadosZak] negocios:", error?.message);
    return { error: "No se pudieron leer los estados actuales del CRM." };
  }

  const avances = avancesDeEstado(
    r.data,
    data as { id: string; estado: EstadoNegocio; estado_fijado_manual: boolean }[],
  );
  const aRespondido = avances.filter((a) => a.a === "respondido").map((a) => a.id);
  const aInteresado = avances.filter((a) => a.a === "interesado").map((a) => a.id);

  if (aRespondido.length > 0) {
    await avanzarEstadosNegocio(supabase, aRespondido, "respondido");
  }
  if (aInteresado.length > 0) {
    await avanzarEstadosNegocio(supabase, aInteresado, "interesado");
  }
  if (avances.length > 0) revalidatePath("/admin/prospeccion");

  return { respondidos: aRespondido.length, interesados: aInteresado.length };
}
