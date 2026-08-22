import type { Metadata } from "next";
import Link from "next/link";
import { verifySesionPortal } from "@/lib/portal/dal";
import {
  ESTADOS_SOLICITUD,
  labelEstado,
  type Solicitud,
} from "@/lib/portal/solicitudes";
import { servicioDelSlug } from "@/lib/catalogo";
import { formatearCOP } from "@/lib/admin/cartera";

export const metadata: Metadata = { title: "Solicitudes" };

// El riel editorial: los 5 pasos del camino feliz con numerales romanos
// (rechazada no es un paso, es una salida — se muestra como chip).
const PASOS = ESTADOS_SOLICITUD.filter((e) => e.valor !== "rechazada");
const NUMERALES = ["I", "II", "III", "IV", "V"] as const;

const CICLO_LABEL: Record<string, string> = {
  mensual: "al mes",
  anual: "al año",
  unico: "pago único",
};

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

export default async function SolicitudesPage() {
  const sesion = await verifySesionPortal();

  const { data } = await sesion.supabase
    .from("solicitudes")
    .select("*")
    .eq("user_id", sesion.userId)
    .order("created_at", { ascending: false });
  const solicitudes = (data ?? []) as Solicitud[];

  return (
    <div className="app-pagina">
      <p className="app-eyebrow">Solicitudes</p>
      <h1 className="app-titulo">Tus pedidos, paso a paso</h1>
      <p className="app-lead">
        Cada solicitud recorre el mismo camino: la revisamos, te cotizamos, pagas
        con el link y activamos. Aquí ves en qué punto va la tuya.
      </p>

      {solicitudes.length === 0 ? (
        <div className="app-vacio app-card">
          <p>Todavía no has pedido nada.</p>
          <Link href="/app/tienda" className="app-btn">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        solicitudes.map((s) => <TarjetaSolicitud key={s.id} solicitud={s} />)
      )}
    </div>
  );
}

function TarjetaSolicitud({ solicitud: s }: { solicitud: Solicitud }) {
  const servicio = servicioDelSlug(s.servicio_slug);
  const rechazada = s.estado === "rechazada";
  const indice = PASOS.findIndex((p) => p.valor === s.estado);
  const paso = PASOS.find((p) => p.valor === s.estado);
  const linkSeguro =
    s.link_pago && /^https:\/\/\S+$/i.test(s.link_pago) ? s.link_pago : null;

  return (
    <div className="app-solicitud">
      <div className="app-solicitud-cabecera">
        <span className="app-solicitud-servicio">
          {servicio?.nombre ?? s.servicio_slug}
        </span>
        <span className="app-solicitud-fecha">
          Pedida el {fechaCorta(s.created_at)}
        </span>
      </div>

      {rechazada ? (
        <>
          <span className="app-chip app-chip--neutro">{labelEstado(s.estado)}</span>
          {s.cotizacion_nota && (
            <p className="app-solicitud-detalle">{s.cotizacion_nota}</p>
          )}
        </>
      ) : (
        <>
          <ol className="app-riel">
            {PASOS.map((p, i) => (
              <li
                key={p.valor}
                className={
                  i <= indice ? "app-riel-paso app-riel-paso--hecho" : "app-riel-paso"
                }
                aria-current={i === indice ? "step" : undefined}
              >
                <span className="app-riel-numeral">— {NUMERALES[i]}.</span>
                <span className="app-riel-label">{p.label}</span>
              </li>
            ))}
          </ol>
          {paso && <p className="app-solicitud-detalle">{paso.descripcion}</p>}
        </>
      )}

      {s.cotizacion_monto !== null && !rechazada && (
        <div className="app-solicitud-cotizacion">
          <span className="app-solicitud-monto">
            {formatearCOP(Number(s.cotizacion_monto))}
          </span>
          {s.cotizacion_ciclo && (
            <span className="app-solicitud-detalle">
              {CICLO_LABEL[s.cotizacion_ciclo] ?? s.cotizacion_ciclo}
            </span>
          )}
        </div>
      )}
      {s.cotizacion_nota && !rechazada && (
        <p className="app-solicitud-detalle">{s.cotizacion_nota}</p>
      )}

      {s.estado === "link_enviado" && linkSeguro && (
        <div className="app-solicitud-acciones">
          <a
            href={linkSeguro}
            target="_blank"
            rel="noopener noreferrer"
            className="app-btn"
          >
            Pagar ahora
          </a>
          <span className="app-solicitud-detalle">
            Cuando pagues, activamos tu servicio y te avisamos.
          </span>
        </div>
      )}
    </div>
  );
}
