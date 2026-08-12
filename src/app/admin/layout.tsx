import type { Metadata } from "next";
import "@/styles/admin.css";

// El panel es interno: fuera de buscadores (el shallow-merge de metadata
// hace que este robots cubra todo /admin) y fuera del sitemap. robots.ts
// además lo excluye a nivel de crawler.
export const metadata: Metadata = {
  title: {
    default: "Panel — ZAKUMI",
    template: "%s · Panel ZAKUMI",
  },
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="adm-shell">{children}</div>;
}
