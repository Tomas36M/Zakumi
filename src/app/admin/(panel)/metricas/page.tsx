import type { Metadata } from "next";
import { verifySession } from "@/lib/admin/dal";
import { ESTADOS, type EstadoNegocio } from "@/lib/admin/negocios";
import { listarTandas } from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Actividad } from "@/components/admin/bots/Actividad";
import { EmbudoEstados } from "@/components/admin/metricas/EmbudoEstados";

export const metadata: Metadata = { title: "Métricas" };

export default async function MetricasPage() {
  const { supabase } = await verifySession();

  const [tandas, conteo] = await Promise.all([
    listarTandas(ID_ZAK),
    // Una consulta agrupada (RPC, security invoker) en vez de seis head-counts
    // en paralelo — supabase/rendimiento.sql.
    supabase.rpc("conteo_por_estado"),
  ]);

  // Un conteo que falla y uno que da 0 de verdad son indistinguibles para
  // quien mira la pantalla (mismo riesgo que prospeccion/page.tsx y
  // negocios.ts ya nombran para esta misma tabla) — al menos que quede en
  // el log del servidor. Si falló, TODOS los tiles se pintan como "—" en vez
  // de 0 (EmbudoEstados.tsx): con una sola consulta no hay fallo parcial.
  if (conteo.error) console.error("[metricas] conteo por estado:", conteo.error.message);

  const porEstado = new Map(
    ((conteo.data ?? []) as { estado: EstadoNegocio; n: number }[]).map((f) => [f.estado, f.n]),
  );
  // Un estado sin negocios no viene en el GROUP BY: es 0, no "—".
  const embudo = Object.fromEntries(
    ESTADOS.map((e) => [e.valor, conteo.error ? null : (porEstado.get(e.valor) ?? 0)]),
  ) as Record<EstadoNegocio, number | null>;

  // Tasa de respuesta agregada de la prospección: los fallidos no cuentan
  // como enviados y los pendientes todavía no salieron. Esta página es el
  // único dueño de la fórmula desde que Métricas salió de las pestañas de Zak.
  const tandasData = tandas.ok ? tandas.data : [];
  const enviados = tandasData.reduce(
    (t, x) => t + x.funnel.enviado + x.funnel.entregado + x.funnel.leido + x.funnel.respondido,
    0,
  );
  // Respondieron PERSONAS: una contestadora no es una respuesta.
  const respondidos = tandasData.reduce((t, x) => t + x.humanos, 0);
  const tasa = enviados > 0 ? Math.round((respondidos / enviados) * 100) : 0;

  return (
    <Cockpit>
      <PageHeader
        titulo="Métricas"
        coletilla="cómo le está yendo a Zak"
        migas={["Métricas"]}
        contador={
          <>
            {tasa}% tasa de respuesta ({respondidos}/{enviados})
          </>
        }
      />
      <CockpitBody>
        <EmbudoEstados conteos={embudo} />
        <Actividad instanciaId={ID_ZAK} />
      </CockpitBody>
    </Cockpit>
  );
}
