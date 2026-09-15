import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { notasDeNegocio } from "@/lib/admin/fichas-servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Las notas de un negocio para su ficha en modal (FichaLeadNotas). Existe para
 * que esa lectura no necesite el SDK de Supabase en el navegador, que viajaba
 * a cuatro rutas del panel solo por esto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }

  const notas = await notasDeNegocio(sesion.supabase, id);
  if (notas === null) {
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  return NextResponse.json({ notas });
}
