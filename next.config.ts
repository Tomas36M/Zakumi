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
  // Cada host tiene una razón verificada leyendo qué carga cada superficie
  // desde el navegador — no "por si acaso":
  // - maps.googleapis.com (script + connect): loader de Google Maps y el
  //   XHR de tiles vectoriales (MapCanvas.tsx).
  // - cdn.jsdelivr.net (script): el widget de voz de ElevenLabs carga su
  //   audio worklet de ahí como fallback en Firefox/Safari.
  // - fonts.googleapis.com / fonts.gstatic.com: el chrome de Google Maps
  //   puede traer Roboto; improbable con disableDefaultUI, barato de cubrir.
  // - media-src https:: las previsualizaciones de voz de ElevenLabs
  //   (VozView, BibliotecaVoces) son <audio> de un CDN de terceros.
  // - *.elevenlabs.io https + wss (connect): el widget está vendorizado en
  //   public/voz/ (lo cubre 'self'), pero habla con api*.elevenlabs.io por
  //   REST y con api*.elevenlabs.io / livekit.rtc.elevenlabs.io por
  //   WebSocket. Sin esto el lab de /admin/voz carga y no funciona.
  // - *.supabase.co (connect): el cliente del navegador le habla directo.
  //   Sin wss:// a propósito: ninguna pantalla usa Realtime desde el cliente.
  // 'unsafe-inline' en script-src: Next inyecta un bootstrap inline; sin
  // nonces no se evita sin un cambio mucho mayor.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "media-src 'self' https:",
      "connect-src 'self' https://maps.googleapis.com https://*.supabase.co https://*.elevenlabs.io wss://*.elevenlabs.io",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
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
      // Bundles vendorizados con la versión en el filename: inmutables de
      // verdad (Next sirve public/ con max-age=0 y son 1.5MB por recarga).
      {
        source: "/voz/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
