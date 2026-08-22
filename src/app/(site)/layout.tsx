import "@/styles/zakumi-design.css";

import { JsonLd } from "@/components/site/JsonLd";
import { SiteShell } from "@/components/site/SiteShell";

// Route group del sitio público: aquí vive el chrome de la landing (nav,
// footer, cursor, cortina, GSAP). /admin queda fuera a propósito — no debe
// cargar nada de esto.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <JsonLd />
      <SiteShell>{children}</SiteShell>
    </>
  );
}
