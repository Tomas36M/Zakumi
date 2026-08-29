import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import type { Negocio } from "@/lib/admin/negocios";
import { normalizarTelefonoCO } from "@/lib/admin/telefono";
import { COLUMNAS_FICHA, mapaFichas, type NegocioParaFicha } from "@/lib/admin/zak";

/**
 * El cruce bandeja↔CRM: `?tels=573…,573…` (formato del bot, hasta 60) →
 * `{ fichas }` indexadas por esos mismos teléfonos. Números sin negocio no
 * vienen. Lectura = route handler, no server action (las actions se
 * despachan en serie por cliente).
 */
export async function GET(request: Request) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const tels = (new URL(request.url).searchParams.get("tels") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 60);
  const e164 = [
    ...new Set(
      tels
        .map((t) => normalizarTelefonoCO(t).telefono)
        .filter((t): t is string => t !== null),
    ),
  ];
  if (e164.length === 0) return NextResponse.json({ fichas: {} });

  const { data, error } = await sesion.supabase
    .from("negocios")
    .select(COLUMNAS_FICHA)
    .in("telefono", e164);
  if (error || !data) {
    console.error("[api/zak/fichas]:", error?.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  const filas = data as Pick<Negocio, keyof NegocioParaFicha>[];
  return NextResponse.json({ fichas: mapaFichas(tels, filas) });
}
