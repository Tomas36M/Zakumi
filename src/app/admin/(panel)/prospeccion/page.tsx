import { ProspeccionView } from "@/components/admin/prospeccion/ProspeccionView";
import { verifySession } from "@/lib/admin/dal";
import { FILTRO_SIN_WEB } from "@/lib/admin/leads-consulta";
import { TOPE_LEADS, type Negocio } from "@/lib/admin/negocios";
import { consultasDelMes, type Territorio } from "@/lib/admin/territorios";
import { agenteZakVoz } from "@/lib/admin/voz";
import { estadoVozZak } from "@/lib/admin/voz-estado";

export const metadata = { title: "Encontrar clientes" };

export default async function ProspeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; territorio?: string }>;
}) {
  // Next 16: los layouts NO se re-renderizan — el check va en CADA page.
  const { supabase } = await verifySession();
  const { tab, territorio } = await searchParams;

  const [negocios, cuenta, cuentaSinWeb, territorios, consultasMes, zakVoz] = await Promise.all([
    supabase
      .from("negocios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(TOPE_LEADS),
    supabase.from("negocios").select("*", { count: "exact", head: true }),
    // «Sin web» de la base entera para la cabecera: la misma definición que el
    // filtro de la lista y que `esSinWeb` (nulo o texto vacío).
    supabase.from("negocios").select("*", { count: "exact", head: true }).or(FILTRO_SIN_WEB),
    supabase.from("territorios").select("*").order("created_at", { ascending: false }),
    // null = no se pudo leer el consumo del mes: llega tal cual hasta el
    // diálogo de barrer, que no puede afirmar cuota gratis sobre un dato que
    // no tiene.
    consultasDelMes(supabase),
    // La voz de Zak para «Llamar con IA» desde la ficha de un lead: una
    // consulta a agentes_voz, sin tocar ElevenLabs.
    agenteZakVoz(supabase),
  ]);

  // El detalle del error va al log del servidor; a la vista solo baja el hecho
  // de que falló. Y BAJA: una consulta caída que se degrada a [] en silencio
  // pinta "ningún territorio todavía" sobre territorios que existen y ya están
  // pagados, y quien los redibuje le paga a Google otra vez lo mismo.
  if (negocios.error) console.error("[prospección] negocios:", negocios.error.message);
  if (cuenta.error) console.error("[prospección] cuenta de negocios:", cuenta.error.message);
  if (cuentaSinWeb.error) {
    console.error("[prospección] cuenta de sin web:", cuentaSinWeb.error.message);
  }
  if (territorios.error) console.error("[prospección] territorios:", territorios.error.message);

  const filas = (negocios.data as Negocio[]) ?? [];

  return (
    <ProspeccionView
      tab={tab ?? null}
      negocios={filas}
      territorios={(territorios.data as Territorio[]) ?? []}
      // null cuando la cuenta falló: la vista no puede afirmar un total que no
      // sabe, y tampoco puede inventar `filas.length` como si fuera el total.
      negociosTotal={cuenta.error ? null : (cuenta.count ?? null)}
      sinWebTotal={cuentaSinWeb.error ? null : (cuentaSinWeb.count ?? null)}
      fallaNegocios={negocios.error !== null}
      fallaTerritorios={territorios.error !== null}
      consultasMes={consultasMes}
      vozZak={estadoVozZak(zakVoz, Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID))}
      // Deep-link desde la página Territorios («Ver en el mapa» / «Barrer»):
      // abre la ficha del territorio y encuadra el mapa en él.
      territorioInicial={territorio ?? null}
    />
  );
}
