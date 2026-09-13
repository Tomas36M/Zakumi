import { notFound } from "next/navigation";
import { TerritorioDetalleView } from "@/components/admin/territorios/TerritorioDetalleView";
import { verifySession } from "@/lib/admin/dal";
import { TOPE_LEADS, type Negocio } from "@/lib/admin/negocios";
import { cuentasTerritoriosServidor, type Territorio } from "@/lib/admin/territorios";
import { agenteZakVoz } from "@/lib/admin/voz";
import { estadoVozZak } from "@/lib/admin/voz-estado";

export const metadata = { title: "Territorio" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TerritorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await verifySession();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [territorio, negocios, cuentas, zakVoz] = await Promise.all([
    supabase.from("territorios").select("*").eq("id", id).single(),
    supabase
      .from("negocios")
      .select("*")
      .eq("territorio_id", id)
      .order("created_at", { ascending: false })
      .limit(TOPE_LEADS),
    // Cuenta exacta (count en el servidor): dice si la lista topada está
    // completa y alimenta las cifras de la cabecera.
    cuentasTerritoriosServidor(supabase, [{ id }]),
    // La voz de Zak para «Llamar con IA» desde la ficha: una consulta, sin
    // ElevenLabs.
    agenteZakVoz(supabase),
  ]);

  if (territorio.error || !territorio.data) notFound();
  if (negocios.error) console.error("[territorio] negocios:", negocios.error.message);
  const cuenta = cuentas?.[id] ?? null;

  return (
    <TerritorioDetalleView
      territorio={territorio.data as Territorio}
      negocios={(negocios.data as Negocio[]) ?? []}
      negociosTotal={cuenta?.leads ?? null}
      cuenta={cuenta}
      vozZak={estadoVozZak(zakVoz, Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID))}
    />
  );
}
