"use server";

// El puente entre el CRM (Supabase, solo escribible con sesión) y la
// prospección de Zak (bot en Railway). Mismo contrato que las demás actions:
// verifySession() primera línea, retornos que nunca lanzan, español al usuario.

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";
import { admiteWhatsApp, normalizarTelefonoCO, sinMas } from "./telefono";
import {
  avancesDeEstado,
  componentesSaludo,
  contactables,
  despacharTandas,
  estadoTrasDescartarInteres,
  TANDA_MAX_BOT,
  verticalPorSlug,
  type AvanceEstado,
} from "./zak";
import {
  contextoDeProspecto,
  gruposParaEnvio,
  modoDesdeCliente,
  prospectoParaTanda,
} from "./envio";
import { avanzarEstadoNegocio, avanzarEstadosNegocio } from "./estado-negocio";
import {
  avancesDesdeChats,
  chatsParaHistorial,
  e164DeChat,
  respondioSegunHistorial,
  type NegocioSync,
} from "./estados-chats";
import { catalogoVerticales } from "./zak-verticales";
import type { EstadoNegocio, Negocio } from "./negocios";
import {
  crearTanda,
  descartarInteres,
  enviarPlantillaDirecta,
  historial,
  listarConversaciones,
  listarProspectos,
} from "@/lib/bots/api";
import { ID_ZAK, type Conversacion } from "@/lib/bots/tipos";

const ENVIO_MAX = 250; // cupo diario del número en Meta (TIER_250): más que esto no sale hoy

/**
 * «Que Zak los contacte»: crea en el bot las tandas del envío —una sola
 * plantilla para todos o la de cada tipo de negocio, según `modoCrudo`— de
 * máximo TANDA_MAX_BOT cada una, y marca 'contactado' en el CRM a todo lo que
 * entró, duplicados incluidos. Lo que no cupo en su tanda vuelve en
 * `sobrantes`; si el bot avisa tope diario, lo que falta vuelve en `porTope`.
 * Sin modo, según el tipo de negocio (lo de antes). El trigger de la base deja
 * la nota automática del cambio de estado.
 */
export async function enviarTandaZak(negocioIds: string[], modoCrudo?: unknown): Promise<
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
  const modo = modoDesdeCliente(modoCrudo);
  if (!modo) return { error: "La plantilla elegida no es válida." };

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

  // El catálogo se relee de la DB en cada envío: lo que sale es SIEMPRE lo
  // vigente/aprobado. Con una sola plantilla, se revisa antes de mandar nada:
  // en revisión, el envío entero se quedaría por fuera sin decirlo.
  const catalogo = await catalogoVerticales(supabase);
  if (modo.tipo === "una") {
    const elegida = catalogo.todos.find((v) => v.slug === modo.slug);
    if (!elegida) return { error: "Esa plantilla ya no está en el catálogo. Recarga la página." };
    if (elegida.enRevision) {
      return {
        error: `La plantilla «${elegida.label}» está en revisión. En Zak → Plantillas dale «Refrescar estados»: si Meta ya la aprobó, queda lista para enviar.`,
      };
    }
  }
  const grupos = gruposParaEnvio(elegibles, modo, catalogo);
  for (const { vertical } of grupos) {
    // Meta puede rechazar envíos de una plantilla mientras la revisa: ese
    // grupo se queda por fuera (cuenta como 'omitidos') hasta la aprobación.
    if (vertical.enRevision) {
      console.error("[enviarTandaZak] vertical en revisión, omitido:", vertical.slug);
    }
  }

  // Una tanda por plantilla, de máximo TANDA_MAX_BOT: lo que sobra vuelve en
  // `sobrantes`. Al primer «tope diario» se para (el cupo es del número
  // entero) y lo que falta vuelve en `porTope`.
  const despacho = await despacharTandas(
    grupos,
    async (vertical, lote) => {
      const r = await crearTanda(ID_ZAK, {
        plantilla: vertical.plantilla,
        lang: "es",
        notas: `tanda ${vertical.label} desde el CRM (${lote.length} negocios)`,
        // Saludo y folleto de la plantilla que sale; ángulo del tipo de cada
        // negocio (ver prospectoParaTanda).
        prospectos: lote.map((n) => prospectoParaTanda(n, vertical, catalogo)),
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
  // El contexto del prospecto, el mismo que en una tanda: sin él, Zak
  // conversa como el bot genérico del sitio y no puede marcar interés.
  // Un teléfono suelto (sin negocio) lleva solo ángulo y saludo.
  let contexto: Record<string, unknown> = { angulo: vertical.angulo, saludo: vertical.texto };
  if (negocioId) {
    const { data: fila, error } = await supabase
      .from("negocios")
      .select("*")
      .eq("id", negocioId)
      .maybeSingle();
    if (error) console.error("[abrirChatZak] negocio:", error.message);
    if (fila) contexto = contextoDeProspecto(fila as Negocio, vertical, catalogo);
  }
  const r = await enviarPlantillaDirecta(ID_ZAK, {
    telefono: sinMas(telefono),
    plantilla: vertical.plantilla,
    lang: "es",
    texto: vertical.texto,
    componentes: componentesSaludo(vertical),
    negocio_id: negocioId,
    contexto,
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

const PAGINA_CONVERSACIONES = 200; // el tope por página de /conversations en el bot
const MAX_CONVERSACIONES = 1000;
const HISTORIALES_EN_PARALELO = 5;

/** Todas las conversaciones de Zak (el bot pagina de a 200), o null si el bot
 * no respondió ni la primera página. */
async function todasLasConversaciones(): Promise<Conversacion[] | null> {
  const todas: Conversacion[] = [];
  for (let offset = 0; offset < MAX_CONVERSACIONES; offset += PAGINA_CONVERSACIONES) {
    const r = await listarConversaciones(ID_ZAK, { limit: PAGINA_CONVERSACIONES, offset });
    if (!r.ok) return offset === 0 ? null : todas;
    todas.push(...r.data);
    if (r.data.length < PAGINA_CONVERSACIONES) break;
  }
  return todas;
}

/** Los negocios del CRM con esos teléfonos, de a 100 por consulta para que la
 * URL no crezca sin tope. null si la base falla. */
async function negociosPorTelefono(
  supabase: SupabaseClient,
  telefonos: string[],
): Promise<NegocioSync[] | null> {
  const filas: NegocioSync[] = [];
  for (let i = 0; i < telefonos.length; i += 100) {
    const { data, error } = await supabase
      .from("negocios")
      .select("id, telefono, estado, estado_fijado_manual")
      .in("telefono", telefonos.slice(i, i + 100));
    if (error || !data) {
      console.error("[sincronizarEstadosZak] negocios por teléfono:", error?.message);
      return null;
    }
    filas.push(...(data as NegocioSync[]));
  }
  return filas;
}

// Tope de historiales por sincronización: con muchos chats pendientes, la
// primera pasada no puede quedarse pidiendo historiales hasta que la función
// se corte. Lo que no alcanza se revisa en la siguiente visita.
const MAX_HISTORIALES_POR_SYNC = 20;

/** Quién escribió en cada chat: true si el negocio escribió, false si solo
 * Zak. Un historial que no llega no entra en el mapa: queda sin decidir. */
async function consultarRespuestas(telefonos: string[]): Promise<Map<string, boolean>> {
  const resultados = await Promise.all(telefonos.map((t) => historial(ID_ZAK, t)));
  const respuestas = new Map<string, boolean>();
  resultados.forEach((r, i) => {
    if (!r.ok) return;
    respuestas.set(telefonos[i], respondioSegunHistorial(r.data));
  });
  return respuestas;
}

type ConteoSync = { contactados: number; respondidos: number; interesados: number };

/** Escribe los avances en orden (contactado → respondido → interesado) y suma
 * al conteo lo que la base aceptó. El UPDATE es forward-only: un avance menor
 * sobre un negocio que ya está más arriba no hace nada. */
async function aplicarAvances(
  supabase: SupabaseClient,
  avances: AvanceEstado[],
  conteo: ConteoSync,
): Promise<void> {
  const pasos: [EstadoNegocio, keyof ConteoSync][] = [
    ["contactado", "contactados"],
    ["respondido", "respondidos"],
    ["interesado", "interesados"],
  ];
  for (const [estado, clave] of pasos) {
    const ids = [...new Set(avances.filter((a) => a.a === estado).map((a) => a.id))];
    if (ids.length === 0) continue;
    const { error } = await avanzarEstadosNegocio(supabase, ids, estado);
    if (!error) conteo[clave] += ids.length;
  }
}

/**
 * Pone al día los estados del CRM con lo que pasó en Zak. Dos fuentes: los
 * prospectos de las tandas (respondido/interesado, por negocio_id) y las
 * conversaciones de la bandeja, que cuentan aunque no hayan salido de una
 * tanda (chats abiertos uno por uno desde la ficha o con «+ Nuevo chat»): solo
 * escribió Zak → contactado; escribió el negocio → respondido. Los chats se
 * cruzan por teléfono y se decide con su historial, hasta
 * MAX_HISTORIALES_POR_SYNC por visita y guardando de a grupos: si la función se
 * corta, lo ya revisado queda escrito. Forward-only y respetando el candado
 * manual; también pone al día los contactos viejos. Se dispara al abrir
 * /admin/zak.
 */
export async function sincronizarEstadosZak(): Promise<ConteoSync | { error: string }> {
  const { supabase } = await verifySession();

  const [prospectos, chats] = await Promise.all([
    listarProspectos(ID_ZAK),
    todasLasConversaciones(),
  ]);
  if (!prospectos.ok && chats === null) {
    return { error: "No hay conexión con el bot para sincronizar." };
  }

  const conteo: ConteoSync = { contactados: 0, respondidos: 0, interesados: 0 };

  // 1) Prospectos de las tandas: respondido / interesado, por negocio_id.
  if (prospectos.ok) {
    const relevantes = prospectos.data.filter(
      (p) => p.negocio_id !== null && (p.estado_envio === "respondido" || p.interesado),
    );
    const ids = [...new Set(relevantes.map((p) => p.negocio_id as string))];
    if (ids.length > 0) {
      const { data, error } = await supabase
        .from("negocios")
        .select("id, estado, estado_fijado_manual")
        .in("id", ids);
      if (error || !data) {
        console.error("[sincronizarEstadosZak] negocios:", error?.message);
      } else {
        await aplicarAvances(
          supabase,
          avancesDeEstado(
            prospectos.data,
            data as { id: string; estado: EstadoNegocio; estado_fijado_manual: boolean }[],
          ),
          conteo,
        );
      }
    }
  }

  // 2) Conversaciones de la bandeja: contactado / respondido, por teléfono,
  // de a HISTORIALES_EN_PARALELO y guardando cada grupo.
  if (chats && chats.length > 0) {
    const telefonos = [
      ...new Set(chats.map((c) => e164DeChat(c.phone)).filter((t): t is string => t !== null)),
    ];
    const negocios = telefonos.length > 0 ? await negociosPorTelefono(supabase, telefonos) : [];
    if (negocios && negocios.length > 0) {
      const aConsultar = chatsParaHistorial(
        chats.map((c) => ({ telefono: c.phone, mensajes: c.messages })),
        negocios,
        MAX_HISTORIALES_POR_SYNC,
      );
      for (let i = 0; i < aConsultar.length; i += HISTORIALES_EN_PARALELO) {
        const grupo = aConsultar.slice(i, i + HISTORIALES_EN_PARALELO);
        const respuestas = await consultarRespuestas(grupo);
        await aplicarAvances(
          supabase,
          avancesDesdeChats(
            grupo.map((t) => ({ telefono: t, respondio: respuestas.get(t) ?? null })),
            negocios,
          ),
          conteo,
        );
      }
    }
  }

  if (conteo.contactados + conteo.respondidos + conteo.interesados > 0) {
    revalidatePath("/admin/prospeccion");
  }
  return conteo;
}

/**
 * «No era interés real» (spec Zak vendedor § 4.7): Tomás desmarca a mano un
 * negocio que el bot marcó interesado por una contestadora. Primero el bot
 * (si falla, el CRM no se toca); después el CRM vuelve a Contactado o
 * Respondió según haya escrito una persona. Es el clic de Tomás, no la
 * automatización: sí baja el estado, pero jamás toca cliente ni descartado.
 */
export async function noEraInteresReal(
  negocioId: string | null,
  telefonoBot: string,
): Promise<{ ok: true; estado: EstadoNegocio | null } | { error: string }> {
  const { supabase } = await verifySession();

  const tel = telefonoBot.replace(/\D/g, "");
  if (tel.length < 7 || tel.length > 15) return { error: "Ese teléfono no se entiende." };

  const r = await descartarInteres(ID_ZAK, tel);
  if (!r.ok) {
    return {
      error:
        r.error === "no_existe"
          ? "El bot no tiene prospecto para este chat (se abrió antes de esta versión): cambia el estado a mano en la ficha."
          : "No hay conexión con el bot para desmarcarlo.",
    };
  }

  let estado: EstadoNegocio | null = null;
  if (negocioId) {
    const h = await historial(ID_ZAK, tel);
    estado = estadoTrasDescartarInteres(h.ok ? h.data.humano : null);
    const { error } = await supabase
      .from("negocios")
      .update({ estado })
      .eq("id", negocioId)
      .eq("estado", "interesado");
    if (error) {
      console.error("[noEraInteresReal] negocios:", error.message);
      return {
        error: "El bot ya lo desmarcó, pero el CRM no se pudo actualizar. Recarga e inténtalo de nuevo.",
      };
    }
  }

  revalidatePath("/admin/zak");
  revalidatePath("/admin/prospeccion");
  return { ok: true, estado };
}
