import type { Metadata } from "next";
import { verifySession } from "@/lib/admin/dal";
import { ESTADOS, type EstadoNegocio } from "@/lib/admin/negocios";
import { listarProspectos, listarTandas } from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Actividad } from "@/components/admin/bots/Actividad";
import { EmbudoEstados } from "@/components/admin/metricas/EmbudoEstados";

export const metadata: Metadata = { title: "Métricas" };

export default async function MetricasPage() {
  const { supabase } = await verifySession();

  const [tandas, prospectos, ...conteos] = await Promise.all([
    listarTandas(ID_ZAK),
    listarProspectos(ID_ZAK),
    ...ESTADOS.map((e) =>
      supabase.from("negocios").select("*", { count: "exact", head: true }).eq("estado", e.valor),
    ),
  ]);

  const embudo = Object.fromEntries(
    ESTADOS.map((e, i) => [e.valor, conteos[i]?.count ?? 0]),
  ) as Record<EstadoNegocio, number>;

  // Tasa de respuesta agregada de la prospección — misma fórmula que
  // ZakView.tsx/MetricasZak.tsx (los fallidos no cuentan como enviados; los
  // pendientes todavía no salieron).
  const tandasData = tandas.ok ? tandas.data : [];
  const prospectosData = prospectos.ok ? prospectos.data : [];
  const enviados = tandasData.reduce(
    (t, x) => t + x.funnel.enviado + x.funnel.entregado + x.funnel.leido + x.funnel.respondido,
    0,
  );
  const respondidos = tandasData.reduce((t, x) => t + x.funnel.respondido, 0);
  const interesados = prospectosData.filter((p) => p.interesado).length;
  const tasa = enviados > 0 ? Math.round((respondidos / enviados) * 100) : 0;

  return (
    <Cockpit>
      <PageHeader
        titulo="Métricas"
        coletilla="cómo le está yendo a Zak"
        contador={
          <>
            {tasa}% tasa de respuesta ({respondidos}/{enviados}) · {interesados} interesados
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
