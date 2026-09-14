import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { jobsFallidos, listarLeads, statusInstancia } from "@/lib/bots/api";
import { mezclarLeads, type LeadOverride } from "@/lib/admin/leads-overrides";

// Uso de hoy + jobs fallidos + leads (ya mezclados con sus overrides
// locales) en una sola llamada del panel. Degradable por partes: si jobs
// o leads fallan, van vacíos (queda en el log); solo el status tumba la
// respuesta porque sin él no hay nada que pintar.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) {
    return NextResponse.json({ error: "bot_invalido" }, { status: 400 });
  }

  const [status, jobs, leads, overrides] = await Promise.all([
    statusInstancia(iid),
    jobsFallidos(iid),
    listarLeads(iid),
    sesion.supabase.from("leads_overrides").select("*").eq("instancia_id", iid),
  ]);

  if (!status.ok) {
    return NextResponse.json({ error: status.error }, { status: 502 });
  }
  const leadsCrudos = leads.ok ? leads.data : [];
  if (overrides.error) {
    console.error("[actividad] overrides:", overrides.error.message);
  }
  const overridesData = (overrides.data ?? []) as LeadOverride[];
  return NextResponse.json({
    status: status.data,
    jobs: jobs.ok ? jobs.data : [],
    leads: mezclarLeads(leadsCrudos, overridesData),
  });
}
