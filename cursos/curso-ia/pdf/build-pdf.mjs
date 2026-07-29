/**
 * Genera los PDFs de los materiales del estudiante.
 *
 * Por qué existe este script y no se llama a `make-pdf` directo:
 * el binario de make-pdf estampa "CONFIDENTIAL" en el pie de cada página y su
 * flag `--no-confidential` está roto en el build instalado (se come el archivo
 * de entrada). En material que se le entrega a alumnos eso no puede salir.
 *
 * Así que se usa make-pdf para la tipografía y la paginación (`--to html`), se
 * parchea el CSS —pie de Zakumi en vez de CONFIDENTIAL, idioma es, acentos de
 * marca— y se imprime con Chromium vía agent-browser.
 *
 * Nota de criterio: el fondo se deja BLANCO a propósito. Estos cuadernos se
 * imprimen y se escriben a mano; un fondo negro de marca gastaría tinta y no
 * se podría rellenar. Los acentos naranja y el pie sí llevan la marca.
 *
 * Uso:  node cursos/curso-ia/pdf/build-pdf.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../..");
const MAKE_PDF = join(process.env.HOME, ".claude/skills/gstack/make-pdf/dist/pdf");
const OUT = join(ROOT, "cursos/curso-ia/pdf");
const TMP = mkdtempSync(join(tmpdir(), "zk-pdf-"));

const ORANGE = "#DB5227";
const NAVY = "#023661";
const SLATE = "#76828E";
const PIE = "Zakumi Academy · Introducción a la Inteligencia Artificial";

/**
 * Documentos a generar: [entrada, salida].
 *
 * Sin `--toc`: el índice de make-pdf necesita Paged.js, que solo corre en la
 * salida a PDF, no en `--to html`. Los documentos largos (la biblioteca y las
 * guías) llevan su índice escrito a mano en el markdown.
 */
const DOCS = [
  ["estudiante/00-kit-bienvenida.md", "kit-bienvenida.pdf"],
  ["estudiante/cuaderno-dia-1.md", "cuaderno-dia-1.pdf"],
  ["estudiante/cuaderno-dia-2.md", "cuaderno-dia-2.pdf"],
  ["estudiante/cuaderno-dia-3.md", "cuaderno-dia-3.pdf"],
  ["estudiante/cuaderno-dia-4.md", "cuaderno-dia-4.pdf"],
  ["estudiante/cuaderno-dia-5.md", "cuaderno-dia-5.pdf"],
  ["estudiante/biblioteca-prompts.md", "biblioteca-prompts.pdf"],
  ["estudiante/plantillas.md", "plantillas.pdf"],
  ["estudiante/proyecto-final.md", "proyecto-final.pdf"],
  ["estudiante/plan-30-dias.md", "plan-30-dias.pdf"],
  ["__guias__", "guias-herramientas.pdf"],
];

/** Las 6 guías van en un solo PDF, con salto de página entre cada una. */
function construirGuias() {
  const guias = ["chatgpt", "gemini", "claude", "manus", "editores-con-agentes", "github"];
  const partes = [
    "# Guías rápidas de herramientas",
    "",
    "**Zakumi Academy** · Introducción a la Inteligencia Artificial",
    "",
    "Una página por herramienta. Imprímelas y tenlas al lado.",
  ];
  for (const g of guias) {
    partes.push("", "\\pagebreak", "");
    partes.push(readFileSync(join(ROOT, "cursos/curso-ia/estudiante/guias", `${g}.md`), "utf8"));
  }
  const ruta = join(TMP, "guias.md");
  writeFileSync(ruta, partes.join("\n"));
  return ruta;
}

/** Estilo Zakumi para impresión: fondo blanco, acentos de marca. */
const CSS_ZAKUMI = `
/* ——— Zakumi Academy · estilo de impresión ——— */
h1, h2, h3, h4 { font-family: Georgia, "Times New Roman", serif; font-weight: normal; }
h1 { color: ${NAVY}; letter-spacing: -0.01em; }
h2 { color: ${NAVY}; border-bottom: 1px solid ${ORANGE}; padding-bottom: 0.25em; }
h3 { color: ${ORANGE}; }
blockquote {
  border-left: 3px solid ${ORANGE};
  background: #FBF7F1;
  padding: 0.7em 1em;
  margin: 1em 0;
  font-style: normal;
  color: #2A2A2A;
}
blockquote p:last-child { margin-bottom: 0; }
th { background: ${NAVY}; color: #fff; font-weight: 600; }
td, th { border: 1px solid #D8D2C8; padding: 0.45em 0.6em; }
table { border-collapse: collapse; }
hr { border: none; border-top: 1px solid ${ORANGE}; opacity: 0.5; }
code { color: ${NAVY}; }
strong { color: #111; }
/* Los espacios para escribir a mano del cuaderno */
code:not(pre code) { background: transparent; }
a { color: ${NAVY}; }
`;

function parchear(html, titulo) {
  return (
    html
      // Idioma: los materiales son en español.
      .replace('<html lang="en">', '<html lang="es">')
      .replace("html { lang: en; }", "html { lang: es; }")
      // El pie de CONFIDENTIAL se cambia por el de Zakumi.
      .replace(
        /@bottom-right \{ content: "CONFIDENTIAL";[^}]*\}/,
        `@bottom-right { content: "${PIE}"; font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: ${SLATE}; letter-spacing: 0.02em; }`,
      )
      // El encabezado corriente lleva el título del documento (ya lo pone
      // make-pdf); se le baja el peso visual.
      .replace(/@top-center \{ content: "[^"]*";/, `@top-center { content: "${titulo}";`)
      // Acentos de marca al final del <style> para que ganen.
      .replace("</style>", `${CSS_ZAKUMI}\n</style>`)
  );
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

let ok = 0;
let fallos = 0;

for (const [entrada, salida, opts = {}] of DOCS) {
  const md = entrada === "__guias__" ? construirGuias() : join(ROOT, "cursos/curso-ia", entrada);
  const htmlPath = join(TMP, salida.replace(/\.pdf$/, ".html"));
  // El encabezado corriente sale del primer H1 del markdown, no del nombre del
  // archivo — así lleva tildes y mayúsculas de verdad.
  const h1 = readFileSync(md, "utf8").match(/^#\s+(.+)$/m);
  const titulo = h1 ? h1[1].trim() : salida.replace(/\.pdf$/, "").replace(/-/g, " ");

  try {
    // 1 · make-pdf hace la tipografía y la paginación, en HTML autocontenido.
    const args = ["generate", "--cover", "--author", "Zakumi Academy", "--date", "Edición 2026"];
    if (opts.toc) args.push("--toc");
    args.push(md, htmlPath, "--to", "html");
    sh(MAKE_PDF, args);

    // 2 · Se parchea el CSS.
    writeFileSync(htmlPath, parchear(readFileSync(htmlPath, "utf8"), titulo));

    // 3 · Chromium lo imprime.
    sh("agent-browser", ["open", `file://${htmlPath}`]);
    sh("agent-browser", ["pdf", join(OUT, salida)]);

    // 4 · Verificación: que no quede rastro de CONFIDENTIAL.
    const texto = sh("pdftotext", [join(OUT, salida), "-"]);
    if (texto.includes("CONFIDENTIAL")) throw new Error("quedó CONFIDENTIAL en el PDF");

    console.log(`ok      ${salida}`);
    ok++;
  } catch (e) {
    console.error(`FALLÓ   ${salida} — ${e.message.split("\n")[0]}`);
    fallos++;
  }
}

console.log(`\n${ok} generados, ${fallos} fallidos.`);
process.exit(fallos ? 1 : 0);
