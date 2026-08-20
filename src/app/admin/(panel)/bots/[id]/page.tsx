import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/admin/dal";
import { ID_ZAK } from "@/lib/bots/tipos";
import {
  listarVersiones,
  obtenerInstancia,
  obtenerPrompt,
  statusInstancia,
} from "@/lib/bots/api";
import { AgenteView, type Pestana } from "@/components/admin/bots/AgenteView";

export const metadata = { title: "Bot" };

const PESTANAS: readonly Pestana[] = ["prompt", "labs", "conversaciones", "actividad"];

export default async function BotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await verifySession();
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) notFound();
  if (iid === ID_ZAK) redirect("/admin/zak"); // Zak vive en su cockpit

  const [instancia, prompt, versiones, status] = await Promise.all([
    obtenerInstancia(iid),
    obtenerPrompt(iid),
    listarVersiones(iid),
    statusInstancia(iid),
  ]);

  if (!instancia.ok && instancia.error === "no_existe") notFound();

  const tabInicial: Pestana = PESTANAS.includes(tab as Pestana)
    ? (tab as Pestana)
    : "prompt";

  return (
    <AgenteView
      id={iid}
      instancia={instancia.ok ? instancia.data : null}
      prompt={prompt.ok ? prompt.data : null}
      versiones={versiones.ok ? versiones.data : []}
      status={status.ok ? status.data : null}
      tabInicial={tabInicial}
    />
  );
}
