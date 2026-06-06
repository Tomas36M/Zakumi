import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZAKUMI — Estudio de marca & software",
    short_name: "ZAKUMI",
    description:
      "Estudio de marca y software a medida desde Colombia. Identidad visual y producto digital end-to-end.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0C12",
    theme_color: "#0A0C12",
    lang: "es-CO",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
