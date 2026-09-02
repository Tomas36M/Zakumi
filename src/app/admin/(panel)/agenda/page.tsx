import type { Metadata } from "next";
import { verifySession } from "@/lib/admin/dal";
import { agruparPorDia, proximasCitas } from "@/lib/agenda/consultas";
import { AgendaView } from "@/components/admin/agenda/AgendaView";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  // verifySession() primera línea: en Next 16 los layouts no se re-renderizan
  // al navegar, así que el check va en CADA page.
  const { supabase } = await verifySession();
  const grupos = agruparPorDia(await proximasCitas(supabase));
  return <AgendaView grupos={grupos} />;
}
