#!/usr/bin/env node
/**
 * Exporta los assets de public/work desde los masters de assets/masters.
 *
 * Por qué existe: los heroes que estaban en el repo se exportaron a 0.17–0.33
 * bits/píxel, entre 3 y 6 veces por debajo de la densidad de los heroes
 * anteriores del propio proyecto (0.86–1.04 bpp). A ese bitrate una imagen de
 * 2400px se ve peor que una de 1200px bien codificada, y subir `quality` en
 * next/image no lo arregla: el detalle ya no está en el archivo.
 *
 * Este script produce UN source por asset, con resolución y bitrate suficientes.
 * No genera múltiples anchuras a propósito — el optimizador de next/image ya
 * deriva el srcset completo del source, y nunca agranda por encima de él
 * (`resize(..., { withoutEnlargement: true })`), así que lo único que importa
 * aquí es que el source sea lo bastante grande y lo bastante denso.
 *
 *   node scripts/optimize-images.mjs            # exporta lo que encuentre
 *   node scripts/optimize-images.mjs --check    # solo audita public/work
 *
 * sharp viene con Next (es su optimizador), así que no hay dependencia nueva.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const MASTERS = path.join(ROOT, "assets", "masters");
const OUT = path.join(ROOT, "public", "work");

/**
 * `out` es el nombre que ya referencia el código en src/, así que exportar no
 * obliga a tocar content.ts ni services.ts.
 *
 * `minBpp` es el suelo de bits/píxel por rol. Por debajo de ahí el archivo se
 * ve blando por mucha resolución que tenga; es exactamente el síntoma que
 * tenían los tres heroes.
 */
const ROLES = {
  hero: { maxWidth: 3200, quality: 92, minBpp: 0.7 },
  showcase: { maxWidth: 2000, quality: 88, minBpp: 0.6 },
  tile: { maxWidth: 1800, quality: 88, minBpp: 0.55 },
};

const TARGETS = [
  // Los tres slides del hero. 16:9 exacto: `cover` sobre min-height:100vh ya
  // recorta ~13% del ancho, y salir de 16:9 agrava el recorte.
  { out: "zk-hero-agentes-chat-v4", role: "hero", aspect: "16:9" },
  { out: "zk-hero-software-v1", role: "hero", aspect: "16:9" },
  { out: "zk-hero-marca-v1", role: "hero", aspect: "16:9" },

  // Showcase de producto (pin + crossfade). El wrapper es 4:3.
  { out: "zk-prod-landing", role: "showcase", aspect: "4:3" },
  { out: "zk-prod-crm", role: "showcase", aspect: "4:3" },
  { out: "zk-prod-ecommerce", role: "showcase", aspect: "4:3" },

  // Secundarias: hero de servicio, "qué hacemos", casos de uso, contacto.
  { out: "zk-brand-foto2", role: "tile", aspect: "4:3" },
  { out: "zk-software-foto", role: "tile", aspect: "4:3" },
  { out: "zk-ink-foto", role: "tile", aspect: "4:3" },
  { out: "zk-form-foto", role: "tile", aspect: "4:3" },
  { out: "zk-hero-foto", role: "tile", aspect: "5:7" },
];

const SOURCE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"];

const bppOf = (bytes, width, height) => (bytes * 8) / (width * height);
const fmtKb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const pad = (s, n) => String(s).padEnd(n);

function ratioOf(aspect) {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}

/** Busca en assets/masters un archivo cuyo nombre base coincida con el target. */
async function findMaster(files, outName) {
  // Coincidencia exacta primero, luego por prefijo, para que `zk-hero-marca-v2.png`
  // sirva de master de `zk-hero-marca-v1.webp` sin renombrar nada a mano.
  const stem = outName.replace(/-v\d+$/, "").replace(/-chat$/, "");
  const candidates = files.filter((f) => {
    const base = path.basename(f, path.extname(f));
    return base === outName || base.startsWith(stem);
  });
  if (candidates.length === 0) return null;
  // Si hay varias versiones, gana la de mayor área.
  const measured = await Promise.all(
    candidates.map(async (f) => {
      const meta = await sharp(path.join(MASTERS, f)).metadata();
      return { file: f, area: (meta.width ?? 0) * (meta.height ?? 0) };
    }),
  );
  measured.sort((a, b) => b.area - a.area);
  return measured[0].file;
}

async function auditOutputs() {
  console.log("\nAuditoría de public/work\n");
  console.log(
    `  ${pad("archivo", 32)}${pad("px", 13)}${pad("peso", 10)}${pad("bits/px", 10)}estado`,
  );
  console.log(`  ${"-".repeat(78)}`);

  let flagged = 0;
  for (const target of TARGETS) {
    const file = path.join(OUT, `${target.out}.webp`);
    if (!existsSync(file)) {
      console.log(`  ${pad(target.out, 32)}${pad("—", 13)}${pad("—", 10)}${pad("—", 10)}FALTA`);
      flagged += 1;
      continue;
    }
    const { size } = await stat(file);
    const { width = 0, height = 0 } = await sharp(file).metadata();
    const bpp = bppOf(size, width, height);
    const role = ROLES[target.role];
    const wantRatio = ratioOf(target.aspect);
    const gotRatio = width / height;

    const notes = [];
    if (bpp < role.minBpp) notes.push(`bpp<${role.minBpp}`);
    if (width < role.maxWidth * 0.75) notes.push(`ancho<${Math.round(role.maxWidth * 0.75)}`);
    if (Math.abs(gotRatio - wantRatio) / wantRatio > 0.02) {
      notes.push(`aspecto≠${target.aspect}`);
    }
    if (notes.length) flagged += 1;

    console.log(
      `  ${pad(target.out, 32)}${pad(`${width}x${height}`, 13)}` +
        `${pad(fmtKb(size), 10)}${pad(bpp.toFixed(3), 10)}` +
        (notes.length ? `⚠ ${notes.join(", ")}` : "ok"),
    );
  }

  console.log("");
  if (flagged) {
    console.log(
      `  ${flagged} asset(s) por debajo del umbral. Pon el master en assets/masters/\n` +
        `  y corre \`node scripts/optimize-images.mjs\` para re-exportar.\n`,
    );
  } else {
    console.log("  Todos los assets pasan el umbral.\n");
  }
  return flagged;
}

async function exportAll() {
  if (!existsSync(MASTERS)) {
    console.log(
      `\nNo existe ${path.relative(ROOT, MASTERS)}. Créala y pon ahí los masters\n` +
        `(ver assets/masters/README.md para la especificación).\n`,
    );
    return;
  }
  await mkdir(OUT, { recursive: true });

  const files = (await readdir(MASTERS)).filter((f) =>
    SOURCE_EXT.includes(path.extname(f).toLowerCase()),
  );
  if (files.length === 0) {
    console.log(`\n${path.relative(ROOT, MASTERS)} está vacía. Nada que exportar.\n`);
    return;
  }

  console.log(`\nExportando desde ${path.relative(ROOT, MASTERS)}\n`);

  for (const target of TARGETS) {
    const master = await findMaster(files, target.out);
    if (!master) continue;

    const role = ROLES[target.role];
    const src = path.join(MASTERS, master);
    const meta = await sharp(src).metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;

    const ratio = ratioOf(target.aspect);
    // Recorte centrado al aspecto de destino, para que `object-fit: cover` en el
    // navegador no vuelva a recortar sobre un recorte.
    const cropW = Math.min(srcW, Math.round(srcH * ratio));
    const cropH = Math.min(srcH, Math.round(srcW / ratio));
    const width = Math.min(role.maxWidth, cropW);
    const height = Math.round(width / ratio);

    const buf = await sharp(src)
      .resize(cropW, cropH, { fit: "cover", position: "centre" })
      .resize(width, height, { withoutEnlargement: true })
      .webp({ quality: role.quality, effort: 6, smartSubsample: true })
      .toBuffer();

    const dest = path.join(OUT, `${target.out}.webp`);
    await writeFile(dest, buf);

    const bpp = bppOf(buf.length, width, height);
    const warn = bpp < role.minBpp ? `  ⚠ bpp bajo (umbral ${role.minBpp})` : "";
    const upscaled = width < role.maxWidth ? `  (master limita a ${width}px)` : "";
    console.log(
      `  ${pad(master, 30)}→ ${pad(`${target.out}.webp`, 30)}` +
        `${pad(`${width}x${height}`, 13)}${pad(fmtKb(buf.length), 10)}` +
        `${bpp.toFixed(3)} bpp${warn}${upscaled}`,
    );
  }
  console.log("");
}

const checkOnly = process.argv.includes("--check");
if (!checkOnly) await exportAll();
const flagged = await auditOutputs();
if (checkOnly && flagged > 0) process.exitCode = 1;
