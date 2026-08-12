import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin es el panel interno: noindex en su layout y bloqueado aquí.
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
