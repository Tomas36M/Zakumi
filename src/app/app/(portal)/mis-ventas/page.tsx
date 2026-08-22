import type { Metadata } from "next";
import { verifySesionPortal, botDelCliente } from "@/lib/portal/dal";
import { listarLeads } from "@/lib/bots/api";
import { VentasView, type Venta } from "@/components/portal/ventas/VentasView";

export const metadata: Metadata = { title: "Mis ventas" };

export default async function MisVentasPage() {
  const sesion = await verifySesionPortal();

  const [ventas, bot] = await Promise.all([
    sesion.supabase
      .from("ventas_cliente")
      .select("*")
      .eq("user_id", sesion.userId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .then((r) => (r.data ?? []) as Venta[]),
    botDelCliente(sesion),
  ]);

  // Los contactos del bot se muestran EN VIVO desde su base (no se copian).
  const leads = bot ? await listarLeads(Number(bot.instancia_id), 50) : null;

  return (
    <div className="app-pagina">
      <p className="app-eyebrow">Mis ventas</p>
      <h1 className="app-titulo">Lo que estás vendiendo</h1>
      <p className="app-lead">
        Registra tus ventas para llevar la cuenta, y mira al lado los contactos
        que tu agente capta por WhatsApp.
      </p>
      <VentasView
        ventas={ventas}
        leads={leads?.ok ? leads.data : null}
        tieneBot={bot !== null}
      />
    </div>
  );
}
