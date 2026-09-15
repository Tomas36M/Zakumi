import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
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
  // - cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js@2.1.2/ (script):
  //   el widget de voz carga su audio worklet de ahí como fallback en
  //   Firefox/Safari. Acotado a esa ruta exacta a propósito; si se sube la
  //   versión vendorizada del widget (public/voz/convai-widget-embed-*.js),
  //   revisar que la ruta siga siendo esa.
  // - blob: en script-src: los DOS worklets de audio del widget de voz
  //   (reproducción y micrófono) se cargan desde un blob: que el propio
  //   widget arma — la ruta de red es solo si el embed pasa un override, y
  //   no lo pasa. 'self' NO cubre blob: en ningún navegador. Google Maps
  //   en modo vectorial (mapId) también quiere workers blob:. Si algún día
  //   se quiere blob: fuera de acá, hay que self-hostear los worklets.
  // - blob: en img-src: la miniatura local de un archivo adjunto en el chat
  //   del widget (URL.createObjectURL sobre el archivo elegido).
  // - fonts.googleapis.com / fonts.gstatic.com: el CSS embebido del widget
  //   de voz hace @import de Inter desde ahí en CADA montaje del lab — no
  //   es opcional. (El chrome de Google Maps no las necesita con
  //   disableDefaultUI.)
  // - media-src https:: las previsualizaciones de voz de ElevenLabs
  //   (VozView, BibliotecaVoces) son <audio> de un CDN de terceros.
  // - *.elevenlabs.io https + wss (connect): el widget está vendorizado en
  //   public/voz/ (lo cubre 'self'), pero habla con api*.elevenlabs.io por
  //   REST y con api*.elevenlabs.io / livekit.rtc.elevenlabs.io por
  //   WebSocket. Sin esto el lab de /admin/voz carga y no funciona.
  // - *.supabase.co (connect): el cliente del navegador le habla directo.
  //   Sin wss:// a propósito: ninguna pantalla usa Realtime desde el cliente.
  // - NO está openfpcdn.io a propósito: el widget vendorizado trae
  //   FingerprintJS y manda un ping de telemetría ahí en ~0.1% de las
  //   cargas; el CSP lo bloquea en silencio y así debe quedar.
  // 'unsafe-inline' en script-src: Next inyecta un bootstrap inline; sin
  // nonces no se evita sin un cambio mucho mayor.
  // - form-action 'self': NO hereda de default-src; sin esto un form podía
  //   enviarse a cualquier origen. Las Server Actions postean al mismo.
  // Con 'unsafe-inline' e img-src https:, este CSP es un freno, no un muro
  // contra XSS: un script inline inyectado corre igual y puede exfiltrar por
  // beacons de imagen. Nonces de verdad exigen proxy + render dinámico —
  // plan aparte.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' blob: https://maps.googleapis.com https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js@2.1.2/",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "media-src 'self' https:",
      "connect-src 'self' https://maps.googleapis.com https://*.supabase.co https://*.elevenlabs.io wss://*.elevenlabs.io",
      "form-action 'self'",
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
