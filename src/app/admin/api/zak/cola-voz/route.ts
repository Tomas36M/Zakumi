import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";
import { normalizarTelefonoCO } from "@/lib/admin/telefono";
import { agenteZakVoz } from "@/lib/admin/voz";
import { COLUMNAS_FICHA, mapaFichas, type NegocioParaFicha } from "@/lib/admin/zak";
import { catalogoVerticales } from "@/lib/admin/zak-verticales";
import { construirCola, esDeCola } from "@/lib/admin/cola-voz";
import { listarConversaciones } from "@/lib/bots/api";
import { esLabs, ID_ZAK } from "@/lib/bots/tipos";

/** Cuántas conversaciones del bot se miran. La bandeja tenía 159 el 17 sep, así
 *  que 300 cubre toda la historia con margen — y la pantalla lo dice, para no
 *  insinuar que la cola conoce chats que no ha mirado. */
const CONVERSACIONES = 300;

/**
 * La cola de llamadas: negocios de los que SOLO contestó su máquina.
 *
 * Tres fuentes, cada una degradando por su lado: las conversaciones del bot
 * (Railway), sus fichas en el CRM (Supabase) y la última llamada de Zak a cada
 * número. Sin el bot no hay cola y se dice; sin CRM la cola sale con teléfonos
 * pelados, que igual se pueden llamar.
 */
export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const convs = await listarConversaciones(ID_ZAK, { limit: CONVERSACIONES });
  if (!convs.ok) {
    console.error("[api/zak/cola-voz] bot:", convs.error);
    return NextResponse.json({ error: "bot" }, { status: 502 });
  }
  // El Labs no se llama: no hay WhatsApp ni negocio al otro lado.
  const candidatas = convs.data.filter((c) => !esLabs(c.phone) && esDeCola(c));
  if (candidatas.length === 0) {
    return NextResponse.json({ cola: [], miradas: convs.data.length });
  }

  const tels = candidatas.map((c) => c.phone);
  const e164 = [
    ...new Set(
      tels.map((t) => normalizarTelefonoCO(t).telefono).filter((t): t is string => t !== null),
    ),
  ];

  const [negocios, catalogo, zakVoz] = await Promise.all([
    sesion.supabase.from("negocios").select(COLUMNAS_FICHA).in("telefono", e164),
    catalogoVerticales(sesion.supabase),
    agenteZakVoz(sesion.supabase),
  ]);
  if (negocios.error) {
    // Sin CRM la cola sigue sirviendo: son teléfonos que se pueden marcar.
    console.error("[api/zak/cola-voz] crm:", negocios.error.message);
  }
  const fichas = mapaFichas(
    tels,
    (negocios.data ?? []) as Pick<Negocio, keyof NegocioParaFicha>[],
    catalogo.verticales,
    catalogo.generico,
  );

  // La última llamada de Zak a cada número: es lo que saca una fila del tope de
  // la cola sin borrarla (llamar dos veces es legítimo; hacerlo sin saber que
  // ya llamaste, no).
  const ultimaLlamadaPor: Record<string, string> = {};
  if (zakVoz && e164.length > 0) {
    const { data, error } = await sesion.supabase
      .from("llamadas_voz")
      .select("telefono, created_at")
      .eq("agente_id", zakVoz.id)
      .in("telefono", e164)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[api/zak/cola-voz] llamadas:", error.message);
    }
    // Vienen de la más nueva a la más vieja: la primera de cada teléfono manda.
    for (const fila of (data ?? []) as { telefono: string | null; created_at: string }[]) {
      const bot = fila.telefono ? normalizarTelefonoCO(fila.telefono).telefono : null;
      const clave = bot ? bot.replace(/^\+/, "") : null;
      if (clave && !(clave in ultimaLlamadaPor)) {
        ultimaLlamadaPor[clave] = fila.created_at;
      }
    }
  }

  return NextResponse.json({
    cola: construirCola(candidatas, fichas, ultimaLlamadaPor),
    miradas: convs.data.length,
  });
}
