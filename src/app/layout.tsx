import type { Metadata, Viewport } from "next";
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
  title: {
    default: "ZAKUMI — IA, agentes y software a medida en Colombia",
    template: "%s · ZAKUMI",
  },
  description:
    "Estudio de marca, agentes de IA y software a medida desde Colombia. Creamos agentes para WhatsApp y Telegram, CRM con IA, identidad visual y producto digital end-to-end. Recibiendo nuevos proyectos.",
  applicationName: "ZAKUMI",
  authors: [{ name: "ZAKUMI Studio" }],
  creator: "ZAKUMI Studio",
  publisher: "ZAKUMI Studio",
  category: "technology",
  keywords: [
    "estudio de marca Colombia",
    "agencia de branding Colombia",
    "diseño de identidad visual",
    "desarrollo de software a medida Colombia",
    "diseño web Colombia",
    "producto digital",
    "desarrollo de aplicaciones",
    "branding y diseño",
    "agentes de IA WhatsApp Colombia",
    "chatbot de ventas con IA",
    "automatización de ventas con IA",
    "CRM con inteligencia artificial",
    "desarrollo de software Colombia",
  ],
  alternates: { canonical: "/" },
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    title: "ZAKUMI — IA, agentes y software a medida desde Colombia",
    description:
      "Agentes de IA para WhatsApp y Telegram, CRM con IA y software a medida en Colombia. Identidad de marca y producto digital end-to-end. Recibiendo nuevos proyectos.",
    locale: "es_CO",
    type: "website",
    url: siteUrl,
    siteName: "ZAKUMI",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "ZAKUMI — Agentes de IA y software a medida desde Colombia.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZAKUMI — Agentes de IA y software a medida desde Colombia",
    description:
      "Agentes de IA para WhatsApp y Telegram, CRM con IA y software a medida en Colombia. Identidad de marca y producto digital end-to-end.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0C12",
  colorScheme: "dark",
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
