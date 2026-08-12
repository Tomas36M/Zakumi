import { verifySession } from "@/lib/admin/dal";

export const metadata = { title: "Negocios" };

export default async function NegociosPage() {
  await verifySession();

  // Stub de F3 — la mesa de control llega en F6.
  return (
    <section className="adm-seccion">
      <h1 className="adm-titulo">Negocios</h1>
      <p className="adm-lead">La tabla del pipeline se construye en la fase 6.</p>
    </section>
  );
}
