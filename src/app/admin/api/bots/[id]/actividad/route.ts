import { NextResponse } from "next/server";
import { getSesion } from "@/lib/admin/dal";
import { jobsFallidos, listarLeads, statusInstancia } from "@/lib/bots/api";

// Uso de hoy + jobs fallidos + leads en una sola llamada del panel.
// Degradable por partes: si jobs o leads fallan, van vacíos (queda en el log);
// solo el status tumba la respuesta porque sin él no hay nada que pintar.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesion();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) {
    return NextResponse.json({ error: "bot_invalido" }, { status: 400 });
  }

  const [status, jobs, leads] = await Promise.all([
    statusInstancia(iid),
    jobsFallidos(iid),
    listarLeads(iid),
  ]);

  if (!status.ok) {
    return NextResponse.json({ error: status.error }, { status: 502 });
  }
  return NextResponse.json({
    status: status.data,
    jobs: jobs.ok ? jobs.data : [],
    leads: leads.ok ? leads.data : [],
  });
}
