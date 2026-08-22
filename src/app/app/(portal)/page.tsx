import Link from "next/link";
import { verifySesionPortal, botDelCliente } from "@/lib/portal/dal";
import { statusInstancia } from "@/lib/bots/api";
import { labelEstado, type Solicitud } from "@/lib/portal/solicitudes";
import { servicioDelSlug } from "@/lib/catalogo";

export default async function InicioPage() {
  const sesion = await verifySesionPortal();

  const [solicitudes, bot, productos] = await Promise.all([
    sesion.supabase
      .from("solicitudes")
      .select("*")
      .eq("user_id", sesion.userId)
      .order("created_at", { ascending: false })
      .limit(3)
      .then((r) => (r.data ?? []) as Solicitud[]),
    botDelCliente(sesion),
    sesion.clienteId
      ? sesion.supabase
          .from("productos_contratados")
          .select("id")
          .eq("cliente_id", sesion.clienteId)
          .eq("activo", true)
          .then((r) => r.data?.length ?? 0)
      : Promise.resolve(0),
  ]);

  // El status del bot degrada por su lado: Railway caído no rompe el inicio.
  const status = bot ? await statusInstancia(Number(bot.instancia_id)) : null;

  const nombre = sesion.nombre?.split(" ")[0];

  return (
    <div className="app-pagina">
      <p className="app-eyebrow">Mi Zakumi</p>
      <h1 className="app-titulo">{nombre ? `Hola, ${nombre}.` : "Hola."}</h1>
      <p className="app-lead">
        Tu estudio digital: tus servicios, tu agente y tus ventas en un solo lugar.
      </p>

      <div className="app-grid">
        <div className="app-card">
          <p className="app-card-titulo">Tu agente</p>
          {bot ? (
            <>
              {status?.ok ? (
                <span
                  className={
                    status.data.instancia.activo ? "app-chip app-chip--ok" : "app-chip app-chip--neutro"
                  }
                >
                  {status.data.instancia.activo ? "Activo" : "Apagado"}
                </span>
              ) : (
                <span className="app-chip app-chip--neutro">Sin conexión</span>
              )}
              <p className="app-card-nota">
                {status?.ok
                  ? `${status.data.conversaciones} conversaciones atendidas`
                  : bot.nombre}
              </p>
              <p className="app-card-nota">
                <Link href="/app/mi-bot" className="app-btn-ghost">
                  Ver mi agente
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="app-card-nota">
                Aún no tienes un agente atendiendo por ti.
              </p>
              <p className="app-card-nota">
                <Link href="/app/tienda" className="app-btn">
                  Conocer el bot de WhatsApp
                </Link>
              </p>
            </>
          )}
        </div>

        <div className="app-card">
          <p className="app-card-titulo">Solicitudes</p>
          <p className="app-cifra">{solicitudes.length === 0 ? "—" : solicitudes.length}</p>
          <p className="app-card-nota">
            {solicitudes.length === 0 ? (
              <Link href="/app/tienda">Pide tu primer servicio →</Link>
            ) : (
              <Link href="/app/solicitudes">Ver el estado →</Link>
            )}
          </p>
        </div>

        <div className="app-card">
          <p className="app-card-titulo">Servicios activos</p>
          <p className="app-cifra">{productos}</p>
          <p className="app-card-nota">
            <Link href="/app/pagos">Servicios y pagos →</Link>
          </p>
        </div>

        <div className="app-card">
          <p className="app-card-titulo">Tus ventas</p>
          <p className="app-card-nota">
            Registra lo que vendes y mira los contactos que capta tu agente.
          </p>
          <p className="app-card-nota">
            <Link href="/app/mis-ventas" className="app-btn-ghost">
              Ir a mis ventas
            </Link>
          </p>
        </div>
      </div>

      {solicitudes.length > 0 && (
        <>
          <h2 className="app-seccion-titulo">Últimas solicitudes</h2>
          {solicitudes.map((s) => (
            <div key={s.id} className="app-solicitud">
              <div className="app-solicitud-cabecera">
                <span className="app-solicitud-servicio">
                  {servicioDelSlug(s.servicio_slug)?.nombre ?? s.servicio_slug}
                </span>
                <span
                  className={
                    s.estado === "activa"
                      ? "app-chip app-chip--ok"
                      : s.estado === "rechazada"
                        ? "app-chip app-chip--neutro"
                        : "app-chip"
                  }
                >
                  {labelEstado(s.estado)}
                </span>
              </div>
              <p className="app-card-nota">
                <Link href="/app/solicitudes">Ver detalle →</Link>
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
