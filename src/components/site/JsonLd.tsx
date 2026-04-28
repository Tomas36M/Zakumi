/** Datos estructurados para Colombia (schema.org) — mejora cómo Google entiende la marca */
export function JsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "ZAKUMI",
        alternateName: "ZAKUMI Studio",
        url: siteUrl,
        logo: `${siteUrl}/icon.svg`,
        foundingDate: "2026",
        description:
          "Estudio boutique de marca y software en Colombia: identidad visual, producto digital y código a medida.",
        address: {
          "@type": "PostalAddress",
          addressCountry: "CO",
        },
        areaServed: { "@type": "Country", name: "Colombia" },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "ZAKUMI",
        inLanguage: "es-CO",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
