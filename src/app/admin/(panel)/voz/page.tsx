import { verifySession } from "@/lib/admin/dal";
import { listarAgentesVoz, llamadasHoyPorAgente } from "@/lib/admin/voz";
import { listarVoces } from "@/lib/voz/api";
import { VozView } from "@/components/admin/voz/VozView";

export const metadata = { title: "Voz" };

export default async function VozPage() {
  const sesion = await verifySession();

  // Con ElevenLabs caído (o sin key) la consola carga igual: VozView pinta el
  // aviso y la lista local sigue operable — mismo contrato que /admin/bots.
  const [agentes, llamadasHoy, voces, clientes] = await Promise.all([
    listarAgentesVoz(sesion.supabase),
    llamadasHoyPorAgente(sesion.supabase),
    listarVoces(),
    sesion.supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <VozView
      agentes={agentes}
      llamadasHoy={llamadasHoy}
      voces={voces.ok ? voces.data : null}
      clientes={(clientes.data ?? []) as { id: string; nombre: string }[]}
    />
  );
}
