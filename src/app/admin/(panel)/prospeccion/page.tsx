import { ProspeccionView } from "@/components/admin/prospeccion/ProspeccionView";
import { verifySession } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";

export const metadata = { title: "Encontrar clientes" };

/**
 * Cuántos negocios baja esta pantalla como máximo.
 *
 * Sin tope, `select("*")` sobre `negocios` trae la tabla entera, la serializa
 * al cliente, pinta una fila por negocio en la lista y un marcador por negocio
 * en el mapa. Antes de los territorios la tabla crecía de a 25 filas importadas
 * a mano; un barrido de un territorio mete miles de una sola tanda.
 *
 * **900 y no 1.000 ni 5.000, y el número importa.** El proyecto de Supabase
 * tiene *Max rows* (Settings → API) en su valor por defecto de **1.000**:
 * PostgREST recorta ahí CUALQUIER consulta, y lo hace en silencio —devuelve
 * 1.000 filas con `error === null`—. Un `.limit()` por encima de ese techo no
 * hace nada: quien recortaría sería el servidor, sin decirlo. Con 900, el que
 * manda es este número, que es el que está escrito acá. Subirlo sin subir
 * antes *Max rows* en la consola de Supabase no cambia nada.
 *
 * Y el tope se DICE. La cuenta real viene por separado (`count: "exact"` con
 * `head: true`, que no trae filas y NO le afecta el techo del proyecto) y la
 * vista compara contra las filas que de verdad llegaron, NO contra esta
 * constante — así el aviso sale igual si algún día quien recorta es PostgREST.
 */
const TOPE_LEADS = 900;

export default async function ProspeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Next 16: los layouts NO se re-renderizan — el check va en CADA page.
  const { supabase } = await verifySession();
  const { tab } = await searchParams;

  const [negocios, cuenta, territorios] = await Promise.all([
    supabase
      .from("negocios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(TOPE_LEADS),
    supabase.from("negocios").select("*", { count: "exact", head: true }),
    supabase.from("territorios").select("*").order("created_at", { ascending: false }),
  ]);

  // El detalle del error va al log del servidor; a la vista solo baja el hecho
  // de que falló. Y BAJA: una consulta caída que se degrada a [] en silencio
  // pinta "ningún territorio todavía" sobre territorios que existen y ya están
  // pagados, y quien los redibuje le paga a Google otra vez lo mismo.
  if (negocios.error) console.error("[prospección] negocios:", negocios.error.message);
  if (cuenta.error) console.error("[prospección] cuenta de negocios:", cuenta.error.message);
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
      fallaNegocios={negocios.error !== null}
      fallaTerritorios={territorios.error !== null}
    />
  );
}
