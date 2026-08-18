import { verifySession } from "@/lib/admin/dal";
import { statusGlobal } from "@/lib/bots/api";
import { BotsView } from "@/components/admin/bots/BotsView";

export const metadata = { title: "Bots" };

export default async function BotsPage() {
  await verifySession();
  // Con Railway caído el panel carga igual: BotsView pinta el aviso.
  const r = await statusGlobal();
  return <BotsView inicial={r.ok ? r.data : null} />;
}
