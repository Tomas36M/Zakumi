import type { Metadata } from "next";
import Link from "next/link";
import { verifySesionPortal, botDelCliente } from "@/lib/portal/dal";
import { listarLeads, obtenerPrompt, statusInstancia } from "@/lib/bots/api";
import { parseConocimiento } from "@/lib/portal/conocimiento";
import { MiBotView } from "@/components/portal/bot/MiBotView";

export const metadata: Metadata = { title: "Mi agente" };

export default async function MiBotPage() {
  const sesion = await verifySesionPortal();
  const bot = await botDelCliente(sesion);

  if (!bot) {
    return (
      <div className="app-pagina">
        <p className="app-eyebrow">Mi agente</p>
        <h1 className="app-titulo">Aún no tienes un agente.</h1>
        <p className="app-lead">
          Un agente de WhatsApp atiende, vende y captura contactos por ti,
          24 horas. Cuando actives el tuyo, desde aquí lo verás trabajar y le
          enseñarás cómo hablar de tu negocio.
        </p>
        <Link href="/app/tienda" className="app-btn">
          Conocer el bot de WhatsApp
        </Link>
      </div>
    );
  }

  const iid = Number(bot.instancia_id);
  // Cada llamada degrada por su lado: Railway caído no rompe la página.
  const [prompt, status, leads] = await Promise.all([
    obtenerPrompt(iid),
    statusInstancia(iid),
    listarLeads(iid, 50),
  ]);

  return (
    <div className="app-pagina">
      <p className="app-eyebrow">Mi agente</p>
      <h1 className="app-titulo">{bot.nombre}</h1>
      <p className="app-lead">
        Enséñale cómo hablar de tu negocio, pruébalo como si fueras tu cliente y
        mira las conversaciones y contactos que capta.
      </p>

      <MiBotView
        instanciaId={bot.instancia_id}
        activo={status.ok ? status.data.instancia.activo : null}
        conversaciones={status.ok ? status.data.conversaciones : null}
        prompt={
          prompt.ok
            ? (() => {
                // Al cliente solo viajan sus 5 campos: el `resto` (escrito a
                // mano por Zakumi) se queda en el servidor y la action lo
                // preserva al guardar.
                const s = parseConocimiento(prompt.data.knowledge);
                return {
                  baseVersion: prompt.data.version,
                  campos: {
                    personalidad: s.personalidad,
                    negocio: s.negocio,
                    horarios: s.horarios,
                    faq: s.faq,
                    noDecir: s.noDecir,
                  },
                };
              })()
            : null
        }
        leads={leads.ok ? leads.data : null}
      />
    </div>
  );
}
