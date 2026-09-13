import type { Metadata } from "next";
import { verifySession } from "@/lib/admin/dal";
import { hoyBogota } from "@/lib/admin/formato";
import { citasEntre } from "@/lib/agenda/consultas";
import { lunesDe, rangoSemana } from "@/lib/agenda/semana";
import { AgendaView } from "@/components/admin/agenda/AgendaView";

export const metadata: Metadata = { title: "Agenda" };

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  // verifySession() primera línea: en Next 16 los layouts no se re-renderizan
  // al navegar, así que el check va en CADA page.
  const { supabase } = await verifySession();
  const { semana } = await searchParams;

  // «Hoy» y «ahora» se deciden aquí: en el cliente serían `new Date()` en
  // render, que cambia entre servidor y navegador.
  const hoy = hoyBogota();
  const lunes = lunesDe(semana && FECHA_ISO.test(semana) ? semana : hoy);
  const rango = rangoSemana(lunes, hoy);
  const citas = await citasEntre(supabase, rango.desde, rango.hasta);

  return <AgendaView citas={citas} lunes={lunes} hoy={hoy} ahoraIso={new Date().toISOString()} />;
}
