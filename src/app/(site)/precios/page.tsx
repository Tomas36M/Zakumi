import type { Metadata } from "next";
import { PreciosPage } from "@/components/zakumi/sections/PreciosPage";
import { COMBOS, SEO, SUFIJO, TARIFAS } from "@/components/zakumi/precios";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  alternates: { canonical: "/precios" },
  openGraph: {
    title: SEO.title,
    description: SEO.description,
    url: `${siteUrl}/precios`,
    type: "website",
  },
};

/**
 * Datos estructurados del tarifario: un `OfferCatalog` con una `Offer` por
 * tarifa y por combo. Los «desde» van como precio mínimo. Precios en COP,
 * los mismos de la página (misma fuente: src/components/zakumi/precios.ts).
 */
function PreciosJsonLd() {
  const ofertas = [
    ...TARIFAS.map((t) => ({
      "@type": "Offer",
      name: t.nombre,
      description: t.desc,
      url: `${siteUrl}/precios`,
      priceCurrency: "COP",
      ...(t.cadencia === "desde"
        ? {
            priceSpecification: {
              "@type": "PriceSpecification",
              minPrice: t.precio,
              priceCurrency: "COP",
            },
          }
        : { price: String(t.precio) }),
      category: SUFIJO[t.cadencia],
      availability: "https://schema.org/InStock",
      areaServed: "CO",
    })),
    ...COMBOS.map((c) => ({
      "@type": "Offer",
      name: `Combo ${c.nombre}`,
      description: c.para,
      url: `${siteUrl}/precios`,
      priceCurrency: "COP",
      price: String(c.precio),
      category: "pago único",
      availability: "https://schema.org/InStock",
      areaServed: "CO",
    })),
  ];

  const graph = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${siteUrl}/precios#tarifario`,
    name: "Precios de Zakumi",
    url: `${siteUrl}/precios`,
    inLanguage: "es-CO",
    provider: { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: "Zakumi", url: siteUrl },
    itemListElement: ofertas,
  };

  return (
    <script
      type="application/ld+json"
      // El JSON es estático y generado por nosotros; no hay entrada de usuario.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export default function Page() {
  return (
    <>
      <PreciosJsonLd />
      <PreciosPage />
    </>
  );
}
