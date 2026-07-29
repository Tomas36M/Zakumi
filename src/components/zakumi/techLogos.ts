import {
  siNextdotjs,
  siReact,
  siTypescript,
  siPostgresql,
  siTailwindcss,
  siGreensock,
  siAnthropic,
  siGooglegemini,
  siN8n,
  siWhatsapp,
  siTelegram,
  siVercel,
  siInstagram,
  siMeta,
} from "simple-icons";

type Icon = { path: string };

/**
 * Logos monocromáticos por tecnología (compartidos por la home y las páginas de
 * servicio). OpenAI no está en simple-icons → se muestra solo con texto.
 */
export const TECH_LOGOS: Record<string, Icon | undefined> = {
  "Next.js": siNextdotjs,
  React: siReact,
  TypeScript: siTypescript,
  Postgres: siPostgresql,
  Tailwind: siTailwindcss,
  GSAP: siGreensock,
  Anthropic: siAnthropic,
  Gemini: siGooglegemini,
  n8n: siN8n,
  WhatsApp: siWhatsapp,
  Telegram: siTelegram,
  Vercel: siVercel,
  Instagram: siInstagram,
  Meta: siMeta,
  OpenAI: undefined,
};
