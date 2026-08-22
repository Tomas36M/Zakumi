import type { Metadata } from "next";
import { verifySesionPortal } from "@/lib/portal/dal";
import { ESTADOS_EN_CURSO } from "@/lib/portal/solicitudes";
import { TiendaView } from "@/components/portal/tienda/TiendaView";
import type { TipoProducto } from "@/lib/admin/cartera";

export const metadata: Metadata = { title: "Tienda" };

export default async function TiendaPage() {
  const sesion = await verifySesionPortal();

  const [enCurso, contratados] = await Promise.all([
    sesion.supabase
      .from("solicitudes")
      .select("servicio_slug")
      .eq("user_id", sesion.userId)
      .in("estado", [...ESTADOS_EN_CURSO])
      .then((r) => (r.data ?? []).map((f) => f.servicio_slug as string)),
    sesion.clienteId
      ? sesion.supabase
          .from("productos_contratados")
          .select("tipo")
          .eq("cliente_id", sesion.clienteId)
          .eq("activo", true)
          .then((r) => (r.data ?? []).map((f) => f.tipo as TipoProducto))
      : Promise.resolve([] as TipoProducto[]),
  ]);

  return (
    <div className="app-pagina">
      <p className="app-eyebrow">Tienda</p>
      <h1 className="app-titulo">¿Qué construimos para ti?</h1>
      <p className="app-lead">
        Cuéntanos qué necesitas y te mandamos la cotización. El precio final se
        ajusta a tu negocio — lo que ves es el punto de partida.
      </p>
      <TiendaView enCurso={enCurso} contratados={contratados} />
    </div>
  );
}
