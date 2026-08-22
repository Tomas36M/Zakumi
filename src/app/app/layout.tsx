import type { Metadata } from "next";
import "@/styles/portal.css";

// El portal es de clientes: fuera de buscadores (el shallow-merge de metadata
// cubre todo /app) y fuera del sitemap. robots.ts además lo excluye.
export const metadata: Metadata = {
  title: {
    default: "Mi Zakumi",
    template: "%s · Mi Zakumi",
  },
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="app-raiz">{children}</div>;
}
