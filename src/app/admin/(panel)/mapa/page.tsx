import { verifySession } from "@/lib/admin/dal";

export const metadata = { title: "Mapa" };

export default async function MapaPage() {
  await verifySession();

  // Stub de F3 — el mapa completo llega en F5.
  return (
    <section className="adm-seccion">
      <h1 className="adm-titulo">Mapa</h1>
      <p className="adm-lead">La prospección sobre el mapa se construye en la fase 5.</p>
    </section>
  );
}
