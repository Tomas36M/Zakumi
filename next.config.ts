import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    // Next 16 exige declarar las calidades permitidas; el default es solo [75],
    // y una quality no listada se degrada a la más cercana en vez de fallar.
    qualities: [75, 85, 90],
    // El default de Next 16 es únicamente ['image/webp']. AVIF comprime ~20%
    // mejor a igual calidad percibida, y el navegador elige por Accept.
    formats: ["image/avif", "image/webp"],
    // Folletos subidos desde el panel: viven en el bucket público de Supabase
    // Storage (los del seed se sirven relativos desde public/folletos/).
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: "https" as const,
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: "/storage/v1/object/public/folletos/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // El lab de voz (/admin/voz) habla con el agente desde el navegador y
      // necesita micrófono; el resto del sitio sigue con microphone=().
      // En Next, la última entrada que matchea pisa la key duplicada.
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
