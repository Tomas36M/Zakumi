import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { JsonLd } from "@/components/site/JsonLd";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ZAKUMI — Estudio de marca & software",
  description:
    "Creamos marcas. Desarrollamos el futuro. Identidad, software a medida y producto digital con sede en Colombia.",
  keywords: [
    "estudio de marca Colombia",
    "diseño identidad visual",
    "software a medida Colombia",
    "producto digital",
    "branding",
  ],
  openGraph: {
    title: "ZAKUMI — Estudio de marca & software",
    description:
      "Estudio boutique de marca y software en Colombia. Sistemas visuales precisos y producto digital end-to-end.",
    locale: "es_CO",
    type: "website",
    url: siteUrl,
    siteName: "ZAKUMI",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZAKUMI — Estudio de marca & software",
    description:
      "Marca y software boutique desde Colombia. Identidad, producto digital y desarrollo en un mismo estudio.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CO" className={`${inter.variable} ${playfair.variable} h-full`}>
      <body className="min-h-full antialiased">
        <JsonLd />
        {children}
      </body>
    </html>
  );
}
