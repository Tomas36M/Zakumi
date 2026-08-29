import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";
import {
  COLUMNAS_FICHA,
  fichaDeNegocio,
  patronBusqueda,
  type NegocioParaFicha,
} from "@/lib/admin/zak";
import { catalogoVerticales } from "@/lib/admin/zak-verticales";

/**
 * Buscador del «+ Nuevo chat» de Zak: negocios del CRM por pedazo del nombre,
 * solo contactables — el filtro va EN la query para que el límite no se coma
 * resultados válidos (celular real, ni cliente ni descartado).
 * Lectura = route handler, no server action: las actions se despachan en
 * serie por cliente y cada tecleo se encolaría detrás de las mutaciones.
 */
export async function GET(request: Request) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ fichas: [] });

  const { data, error } = await sesion.supabase
    .from("negocios")
    .select(COLUMNAS_FICHA)
    .ilike("nombre", patronBusqueda(q))
    .eq("tipo_telefono", "movil")
    .not("telefono", "is", null)
    .not("estado", "in", "(cliente,descartado)")
    .order("updated_at", { ascending: false })
    .limit(8);
  if (error || !data) {
    console.error("[api/zak/negocios]:", error?.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  const filas = data as Pick<Negocio, keyof NegocioParaFicha>[];
  const catalogo = await catalogoVerticales(sesion.supabase);
  return NextResponse.json({
    fichas: filas.map((f) => fichaDeNegocio(f, catalogo.verticales, catalogo.generico)),
  });
}
