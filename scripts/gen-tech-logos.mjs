#!/usr/bin/env node
/**
 * Genera src/components/zakumi/techLogos.ts con las rutas SVG literales.
 *
 * Por qué: `simple-icons` solo publica un índice JS con los ~3300 iconos (los
 * archivos de `icons/` son SVG crudos, no módulos). Importar 14 nombres de ese
 * índice metía **109 KB de JavaScript sin usar** en el bundle de cliente de
 * todas las páginas — medido con Lighthouse. Como las rutas no cambian salvo
 * que una marca rediseñe su logo, se extraen una vez y `simple-icons` pasa a
 * devDependency.
 *
 *   node scripts/gen-tech-logos.mjs
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import * as icons from "simple-icons";

const OUT = path.resolve(
  import.meta.dirname,
  "..",
  "src",
  "components",
  "zakumi",
  "techLogos.ts",
);

/** Etiqueta que se muestra → clave en simple-icons. `null` = solo texto. */
const MAP = {
  "Next.js": "siNextdotjs",
  React: "siReact",
  TypeScript: "siTypescript",
  Postgres: "siPostgresql",
  Tailwind: "siTailwindcss",
  GSAP: "siGreensock",
  Anthropic: "siAnthropic",
  Gemini: "siGooglegemini",
  n8n: "siN8n",
  WhatsApp: "siWhatsapp",
  Telegram: "siTelegram",
  Vercel: "siVercel",
  Instagram: "siInstagram",
  Meta: "siMeta",
  OpenAI: null, // no está en simple-icons
};

const entries = Object.entries(MAP).map(([label, key]) => {
  if (key === null) return `  ${JSON.stringify(label)}: undefined,`;
  const icon = icons[key];
  if (!icon) throw new Error(`simple-icons no exporta ${key} (¿renombrado?)`);
  return `  ${JSON.stringify(label)}: { path: ${JSON.stringify(icon.path)} },`;
});

const file = `// GENERADO por scripts/gen-tech-logos.mjs — no editar a mano.
// Regenerar: node scripts/gen-tech-logos.mjs
//
// Las rutas van literales en vez de importarse de "simple-icons" porque ese
// paquete solo publica un índice con los ~3300 iconos, y traer 14 nombres de
// ahí metía 109 KB de JavaScript sin usar en el bundle de cliente de todas las
// páginas (medido con Lighthouse). simple-icons es devDependency.

type Icon = { path: string };

/**
 * Logos monocromáticos por tecnología, compartidos por la home y las páginas de
 * servicio. OpenAI no está en simple-icons: se muestra solo con texto.
 */
export const TECH_LOGOS: Record<string, Icon | undefined> = {
${entries.join("\n")}
};
`;

await writeFile(OUT, file);
const kb = (Buffer.byteLength(file) / 1024).toFixed(1);
console.log(`techLogos.ts generado — ${Object.keys(MAP).length} etiquetas, ${kb} KB`);
