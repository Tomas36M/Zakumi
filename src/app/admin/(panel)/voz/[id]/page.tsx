import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/admin/dal";
import { contarLlamadasHoy, llamadasDeAgente, obtenerAgenteVoz } from "@/lib/admin/voz";
import { listarVoces } from "@/lib/voz/api";
import { FichaAgenteVoz, type Pestana } from "@/components/admin/voz/FichaAgenteVoz";

export const metadata = { title: "Agente de voz" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PESTANAS: readonly Pestana[] = ["config", "lab", "llamadas", "tanda", "widget"];

export default async function AgenteVozPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const sesion = await verifySession();
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const agente = await obtenerAgenteVoz(sesion.supabase, id);
  if (!agente) notFound();

  // La voz de Zak vive en su cockpit, no aquí: dos puertas a la misma ficha
  // se desincronizan (se edita en una y la otra sigue mostrando lo viejo).
  // Los enlaces viejos siguen funcionando gracias a este redirect.
  if (agente.es_zak) {
    const destino = PESTANAS.includes(tab as Pestana) ? `voz-${tab}` : "voz-config";
    redirect(`/admin/zak?tab=${destino}`);
  }

  const [llamadas, hoy, voces, clientes] = await Promise.all([
    llamadasDeAgente(sesion.supabase, id),
    contarLlamadasHoy(sesion.supabase, id),
    listarVoces(),
    sesion.supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <FichaAgenteVoz
      agente={agente}
      llamadas={llamadas}
      llamadasHoy={hoy ?? 0}
      voces={voces.ok ? voces.data : null}
      clientes={(clientes.data ?? []) as { id: string; nombre: string }[]}
      telefoniaLista={
        Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID) ||
        Boolean(agente.phone_number_id_eleven)
      }
      tabInicial={PESTANAS.includes(tab as Pestana) ? (tab as Pestana) : "config"}
    />
  );
}
