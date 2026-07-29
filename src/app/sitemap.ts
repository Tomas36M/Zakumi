import type { MetadataRoute } from "next";
import { SERVICE_SLUGS } from "@/components/zakumi/services";
import { CHECKOUT_ACTIVO } from "@/components/zakumi/curso";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    "",
    ...SERVICE_SLUGS.map((s) => `/${s}`),
    // /academia entra al sitemap cuando su checkout cobre. Ver CHECKOUT_ACTIVO.
    ...(CHECKOUT_ACTIVO ? ["/academia"] : []),
    "/contacto",
  ];
  return paths.map((p) => ({
    url: `${siteUrl}${p}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.8,
  }));
}
