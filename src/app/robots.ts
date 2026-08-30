import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // /admin (panel interno) y /app (portal de clientes) llevan noindex en
    // su layout y además se bloquean aquí a nivel de crawler. /voz/ son
    // assets del lab del panel (widget vendorizado): nada que indexar.
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/app", "/voz/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
