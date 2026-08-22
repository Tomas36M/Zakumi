import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin (panel interno) y /app (portal de clientes) llevan noindex en
    // su layout y además se bloquean aquí a nivel de crawler.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/app"] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
