import type { Metadata } from "next";
import { AcademiaPage } from "@/components/zakumi/sections/AcademiaPage";
import { CURSO, HOTMART_CHECKOUT } from "@/components/zakumi/curso";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

export const metadata: Metadata = {
  title: CURSO.seo.title,
  description: CURSO.seo.description,
  alternates: { canonical: "/academia" },
  openGraph: {
    title: CURSO.seo.title,
    description: CURSO.seo.description,
    url: `${siteUrl}/academia`,
    type: "website",
  },
};

/**
 * Datos estructurados del curso. `Course` + `CourseInstance` es lo que Google
 * usa para las fichas de formación; el precio va en la oferta del instance.
 */
function CursoJsonLd() {
  const totalClases = CURSO.malla.modulos.reduce((n, m) => n + m.clases.length, 0);

  const graph = {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${siteUrl}/academia#curso`,
    name: CURSO.nombre,
    description: CURSO.seo.description,
    url: `${siteUrl}/academia`,
    inLanguage: "es-CO",
    teaches: [
      "Uso de inteligencia artificial en el trabajo diario",
      "Redacción de instrucciones para modelos de lenguaje (prompting)",
      "ChatGPT, Gemini y Claude",
      "Agentes de IA",
      "Creación y publicación de un proyecto web sin programar",
      "Control de versiones con GitHub",
    ],
    educationalLevel: "Principiante",
    isAccessibleForFree: false,
    numberOfCredits: totalClases,
    provider: {
      "@type": "Organization",
      name: "Zakumi Academy",
      url: siteUrl,
      "@id": `${siteUrl}/#organization`,
    },
    instructor: {
      "@type": "Person",
      name: "Tomás Munévar Escalante",
      jobTitle: "Fundador de Zakumi",
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: "PT10H45M",
      instructor: {
        "@type": "Person",
        name: "Tomás Munévar Escalante",
      },
      offers: {
        "@type": "Offer",
        price: CURSO.precio.lanzamiento.replace(/\./g, ""),
        priceCurrency: "COP",
        availability: "https://schema.org/InStock",
        url: HOTMART_CHECKOUT,
        category: "Paid",
      },
    },
    coursePrerequisites: "Ninguno. Un computador con internet y un correo electrónico.",
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
      <CursoJsonLd />
      <AcademiaPage />
    </>
  );
}
