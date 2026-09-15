import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { pagosRecientesDeCliente } from "@/lib/admin/fichas-servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los pagos recientes de un cliente para su ficha en modal (PagosRecientes).
 * Los productos salen del cliente en el servidor, no de una lista de ids que
 * mande el navegador. Existe para que esa lectura no necesite el SDK de
 * Supabase en el navegador, que viajaba a /admin/clientes solo por esto.
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

  const pagos = await pagosRecientesDeCliente(sesion.supabase, id);
  if (pagos === null) {
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  return NextResponse.json({ pagos });
}
