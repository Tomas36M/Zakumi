/** Datos estructurados para Colombia (schema.org) — mejora cómo Google entiende la marca */
export function JsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";
  const phone = "+573134276879";
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "ProfessionalService"],
        "@id": `${siteUrl}/#organization`,
        name: "ZAKUMI",
        alternateName: "ZAKUMI Studio",
        url: siteUrl,
        logo: `${siteUrl}/icon.svg`,
        image: `${siteUrl}/icon.svg`,
        foundingDate: "2026",
        slogan: "Creamos marcas. Desarrollamos el futuro.",
        description:
          "Estudio de marca y software a medida en Colombia: identidad visual, producto digital y código end-to-end. Recibiendo nuevos proyectos.",
        email: "zakumiestudio@gmail.com",
        telephone: phone,
        address: {
          "@type": "PostalAddress",
          addressCountry: "CO",
        },
        areaServed: [
          { "@type": "Country", name: "Colombia" },
          { "@type": "Place", name: "Latinoamérica" },
        ],
        knowsLanguage: ["es-CO", "es"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "sales",
          telephone: phone,
          email: "zakumiestudio@gmail.com",
          areaServed: "CO",
          availableLanguage: ["Spanish"],
        },
        makesOffer: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Identidad de marca",
              description:
                "Sistemas visuales precisos: tipografía, color, voz y aplicación de marca.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Software a medida",
              description:
                "Producto digital end-to-end, del prototipo a producción. Diseño y código bajo el mismo techo.",
            },
          },
        ],
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
