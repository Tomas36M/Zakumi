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
        sameAs: ["https://www.instagram.com/zakumiestudio/"],
        foundingDate: "2026",
        slogan: "Agentes de IA que venden. Software que perdura.",
        description:
          "Estudio de marca, agentes de IA y software a medida en Colombia: identidad visual, agentes para WhatsApp y Telegram, CRM con IA, y producto digital end-to-end. Recibiendo nuevos proyectos.",
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
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Agentes de IA para WhatsApp y Telegram",
              description:
                "Agentes de venta y atención al cliente que responden 24/7 por WhatsApp y Telegram: califican leads, resuelven preguntas y cierran negocios de forma autónoma.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "CRM con IA",
              description:
                "CRM a medida construido con Anthropic, Gemini y OpenAI que clasifica, prioriza y atiende leads de manera automática, sin intervención manual.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Automatización e integraciones",
              description:
                "Conectamos el agente con CRM, n8n y APIs externas para automatizar flujos de venta, notificaciones y seguimiento de clientes.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Manejo de redes y contenido",
              description:
                "Gestión de redes sociales y creación de contenido alineado a la marca: publicaciones, historias y estrategia editorial orientada a conversión.",
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
