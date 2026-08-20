import { verifySession } from "@/lib/admin/dal";
import {
  listarProspectos,
  listarTandas,
  listarVersiones,
  obtenerInstancia,
  obtenerPrompt,
  statusInstancia,
} from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";
import { ZakView, type PestanaZak } from "@/components/admin/bots/ZakView";

export const metadata = { title: "Zak" };

const PESTANAS: readonly PestanaZak[] = [
  "bandeja", "interesados", "tandas", "metricas", "prompt", "labs",
];

export default async function ZakPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; telefono?: string }>;
}) {
  await verifySession();
  const { tab, telefono } = await searchParams;
  // Deep-link desde el CRM: abrir la bandeja con este chat (exista o no).
  const telefonoInicial = /^[0-9]{7,15}$/.test(telefono ?? "") ? (telefono as string) : null;

  // Con Railway caído el cockpit carga igual: cada pieza degrada por su lado.
  const [instancia, prompt, versiones, status, tandas, prospectos] = await Promise.all([
    obtenerInstancia(ID_ZAK),
    obtenerPrompt(ID_ZAK),
    listarVersiones(ID_ZAK),
    statusInstancia(ID_ZAK),
    listarTandas(ID_ZAK),
    listarProspectos(ID_ZAK),
  ]);

  const tabInicial: PestanaZak = telefonoInicial
    ? "bandeja"
    : PESTANAS.includes(tab as PestanaZak)
      ? (tab as PestanaZak)
      : "bandeja";

  return (
    <ZakView
      telefonoInicial={telefonoInicial}
      instancia={instancia.ok ? instancia.data : null}
      prompt={prompt.ok ? prompt.data : null}
      versiones={versiones.ok ? versiones.data : []}
      status={status.ok ? status.data : null}
      tandas={tandas.ok ? tandas.data : []}
      prospectos={prospectos.ok ? prospectos.data : []}
      tabInicial={tabInicial}
    />
  );
}
