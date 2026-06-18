# Rediseño Landing Zakumi AI-first — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Goal:** Reposicionar la landing de Zakumi a un estudio AI-first cuyo protagonista son los agentes de IA de venta/atención (demo en vivo por WhatsApp), respaldado por software serio (CRM con IA, plataformas) y marca/contenido.

**Architecture:** Refactor de `ZakumiLanding.tsx` (monolito ~1175 líneas) a un orquestador que monta componentes de sección presentacionales bajo `src/components/zakumi/sections/`. Toda la animación GSAP **permanece centralizada** en el `gsap.context()` de `ZakumiLanding` y opera por **selectores globales** (patrón actual), así mover JSX a hijos no rompe animaciones. Copy y datos salen a `content.ts`; constantes de contacto a `contact.ts` con flag `TELEGRAM_ENABLED`.

**Tech Stack:** Next.js 16.2.4 (App Router, client component), React 19.2.4, TypeScript 5, Tailwind v4, GSAP 3.15 (ScrollTrigger + ScrollToPlugin). Tests: vitest (solo lógica pura).

## Global Constraints

- **Idioma:** 100% español es-CO. **Prohibida la palabra "stack"** en todo el copy (usar "tecnología/herramientas/con qué construimos"). Nada de Spanglish.
- **Estética intacta:** paleta negro `#0e0f11` / naranja `#ff6b35`, Playfair Display + Inter, cortina inicial, cursor, marquee, `--hero-size` solo ≥721px. No rediseñar paleta/tipografía.
- **GSAP centralizado** en el `gsap.context()` de `ZakumiLanding.tsx`, por selectores. Toda animación nueva respeta `prefers-reduced-motion` (cae a estado final).
- **Contacto:** WhatsApp `+57 313 4276879` (`573134276879`), email `zakumiestudio@gmail.com`. **Telegram preparado pero apagado** (`TELEGRAM_ENABLED = false`) → su UI no se renderiza hasta encenderlo.
- **Accesibilidad:** enlaces externos `target="_blank" rel="noopener noreferrer"`; CTAs con `aria-label`.
- **Verificación base de cada tarea visual:** `npx tsc --noEmit` ✅, `npm run lint` ✅, `npm run build` ✅.
- **Mercado/SEO:** Colombia, `NEXT_PUBLIC_SITE_URL` → `zakumistudio.com`.
- **Commits frecuentes**, mensajes `feat:`/`refactor:`/`docs:` en español, con trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Trabajar en la rama `feat/landing-ia-redesign` (ya creada).

---

## File Structure

```
src/components/zakumi/
  ZakumiLanding.tsx          # MODIFICAR → orquestador: estado, cortina, cursor, gsap.context central, monta <Section/>
  contact.ts                 # CREAR → EMAIL, WHATSAPP_*, INSTAGRAM_*, TELEGRAM_*, TELEGRAM_ENABLED, helpers
  content.ts                 # CREAR → datos+copy: PILARES, STATS, CHAT_GUION, TECNOLOGIAS, PROYECTOS, HERO_IMAGES, copy hero/crm/contacto
  sections/
    Hero.tsx                 # CREAR
    Servicios.tsx            # CREAR (3 pilares)
    CrmIA.tsx                # CREAR (nueva)
    AgentDemo.tsx            # CREAR (nueva, chat guionizado)
    Proyectos.tsx            # CREAR (showcase + "con qué construimos")
    ComoTrabajamos.tsx       # CREAR (stats)
    Filosofia.tsx            # CREAR
    Contacto.tsx             # CREAR (incluye footer)
  __tests__/
    contact.test.ts          # CREAR
    content.test.ts          # CREAR
src/components/site/JsonLd.tsx   # MODIFICAR (makesOffer)
src/app/layout.tsx               # MODIFICAR (metadata/keywords)
vitest.config.ts                 # CREAR
public/work/                     # placeholders de imágenes nuevas
```

---

## Task 1: Infra de tests + módulo de contacto (`contact.ts`)

**Files:**
- Create: `vitest.config.ts`, `src/components/zakumi/contact.ts`, `src/components/zakumi/__tests__/contact.test.ts`
- Modify: `package.json` (script `test`), `src/components/zakumi/ZakumiLanding.tsx` (importar desde `contact.ts` en vez de declarar constantes)

**Interfaces:**
- Produces: `EMAIL: string`, `WHATSAPP_NUMBER: string`, `WHATSAPP_MESSAGE: string`, `WHATSAPP_URL: string`, `INSTAGRAM_HANDLE: string`, `INSTAGRAM_URL: string`, `TELEGRAM_HANDLE: string`, `TELEGRAM_URL: string`, `TELEGRAM_ENABLED: boolean` desde `contact.ts`.

- [ ] **Step 1: Instalar vitest**

Run: `npm i -D vitest`
Expected: vitest aparece en `devDependencies`.

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Añadir script de test a `package.json`**

En `"scripts"` añadir: `"test": "vitest run"`

- [ ] **Step 4: Escribir el test que falla (`contact.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import {
  WHATSAPP_URL,
  TELEGRAM_ENABLED,
  TELEGRAM_URL,
  INSTAGRAM_URL,
} from "../contact";

describe("contact", () => {
  it("WHATSAPP_URL apunta a wa.me con el número y mensaje codificado", () => {
    expect(WHATSAPP_URL).toContain("https://wa.me/573134276879");
    expect(WHATSAPP_URL).toContain("text=");
    expect(WHATSAPP_URL).not.toContain(" "); // mensaje URL-encoded
  });
  it("Telegram arranca apagado pero con URL lista", () => {
    expect(TELEGRAM_ENABLED).toBe(false);
    expect(TELEGRAM_URL).toMatch(/^https:\/\/t\.me\//);
  });
  it("Instagram apunta al handle correcto", () => {
    expect(INSTAGRAM_URL).toBe("https://www.instagram.com/zakumiestudio/");
  });
});
```

- [ ] **Step 5: Correr el test y verlo fallar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../contact'`.

- [ ] **Step 6: Crear `contact.ts`**

```ts
export const EMAIL = "zakumiestudio@gmail.com";

export const WHATSAPP_NUMBER = "573134276879";
export const WHATSAPP_MESSAGE =
  "Hola Zakumi, vi su sitio y quiero hablar sobre un proyecto.";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE,
)}`;

export const INSTAGRAM_HANDLE = "zakumiestudio";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

// Telegram preparado pero apagado hasta que exista el bot/canal real.
export const TELEGRAM_ENABLED = false;
export const TELEGRAM_HANDLE = "zakumiestudio";
export const TELEGRAM_URL = `https://t.me/${TELEGRAM_HANDLE}`;
```

- [ ] **Step 7: Correr el test y verlo pasar**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 8: Reemplazar constantes en `ZakumiLanding.tsx` por imports**

Borrar las declaraciones locales `EMAIL`, `WHATSAPP_*`, `INSTAGRAM_*` (líneas ~36–42 y la del EMAIL) y añadir arriba:
```ts
import {
  EMAIL, WHATSAPP_URL, INSTAGRAM_HANDLE, INSTAGRAM_URL,
  TELEGRAM_ENABLED, TELEGRAM_URL,
} from "./contact";
```

- [ ] **Step 9: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos OK (la landing renderiza igual que antes).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(contact): extraer constantes a contact.ts + vitest y flag Telegram" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Módulo de contenido (`content.ts`)

**Files:**
- Create: `src/components/zakumi/content.ts`, `src/components/zakumi/__tests__/content.test.ts`
- Modify: `ZakumiLanding.tsx` (mover `HERO_IMAGES` a `content.ts` e importarlo)

**Interfaces:**
- Produces (tipos exportados):
  - `Pilar = { num: string; titulo: string; desc: string; tags: string[] }` → `PILARES: Pilar[]` (3 items)
  - `Stat = { num: string; acc?: string; label: string; desc: string }` → `STATS: Stat[]` (4)
  - `ChatMsg = { from: "cliente" | "agente"; text: string }` → `CHAT_GUION: ChatMsg[]`
  - `TECNOLOGIAS: string[]`
  - `Proyecto = { nombre: string; rol: string; img: string }` → `PROYECTOS: Proyecto[]`
  - `HERO_IMAGES: string[]`
  - `HERO`, `CRM`, `CONTACTO` (objetos de copy)

- [ ] **Step 1: Escribir el test que falla (`content.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { PILARES, STATS, CHAT_GUION, TECNOLOGIAS, HERO, CRM, CONTACTO, PROYECTOS } from "../content";

const allCopy = JSON.stringify([PILARES, STATS, CHAT_GUION, TECNOLOGIAS, HERO, CRM, CONTACTO, PROYECTOS]);

describe("content", () => {
  it("hay exactamente 3 pilares y 4 stats", () => {
    expect(PILARES).toHaveLength(3);
    expect(STATS).toHaveLength(4);
  });
  it("el guion del chat incluye cliente y agente", () => {
    expect(CHAT_GUION.some((m) => m.from === "cliente")).toBe(true);
    expect(CHAT_GUION.some((m) => m.from === "agente")).toBe(true);
  });
  it("las tecnologías incluyen los 3 modelos de IA y el núcleo web", () => {
    for (const t of ["Anthropic", "Gemini", "OpenAI", "Next.js", "React", "Postgres"]) {
      expect(TECNOLOGIAS).toContain(t);
    }
  });
  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    expect(allCopy.toLowerCase()).not.toMatch(/\bstack\b/);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test`
Expected: FAIL — módulo `../content` no existe.

- [ ] **Step 3: Crear `content.ts`** (copy real, en español, sin "stack")

```ts
export type Pilar = { num: string; titulo: string; desc: string; tags: string[] };
export type Stat = { num: string; acc?: string; label: string; desc: string };
export type ChatMsg = { from: "cliente" | "agente"; text: string };
export type Proyecto = { tag: string; title: string; img: string; alt: string };

export const HERO = {
  tag: "Agentes de IA para WhatsApp & Telegram",
  titulo1: "Tu mejor vendedor",
  tituloEm: "es inteligencia artificial.",
  sub: "Y detrás, software de verdad: CRM con IA, plataformas que escalan y tecnología bien construida.",
  ctaPrimario: "Habla con nuestro agente",
  ctaSecundario: "o escríbenos por Telegram",
};

export const PILARES: Pilar[] = [
  {
    num: "— I.",
    titulo: "IA & Automatización",
    desc: "Agentes de venta y atención que trabajan 24/7 en WhatsApp, Telegram y redes. Automatización e integraciones que conectan todo.",
    tags: ["Agentes de venta", "Atención 24/7", "Automatización", "Integraciones"],
  },
  {
    num: "— II.",
    titulo: "Software & Plataformas",
    desc: "Plataformas grandes y sostenibles, web y apps a medida, con bases de datos serias. Construido con Next.js, React, Postgres y TypeScript.",
    tags: ["Plataformas a medida", "Web & apps", "Bases de datos", "Código propio"],
  },
  {
    num: "— III.",
    titulo: "Marca & Contenido",
    desc: "Identidad visual con criterio, manejo de redes y creación de contenido que mantiene tu marca viva y coherente.",
    tags: ["Identidad visual", "Manejo de redes", "Contenido", "Dirección de arte"],
  },
];

export const CRM = {
  titulo1: "Un CRM",
  tituloEm: "que piensa.",
  sub: "Te construimos un CRM con Anthropic, Gemini y OpenAI trabajando para tu equipo de ventas — cada modelo en lo que mejor hace.",
  features: [
    "Clasifica y prioriza tus leads",
    "Responde y resume conversaciones",
    "Agenda y da seguimiento solo",
    "Escala a una persona cuando hay intención real",
  ],
  nota: "Lo desarrollamos a tu medida; no es una plantilla.",
};

// Guion de la demo del agente (mensajes hardcodeados, no conexión en vivo).
export const CHAT_GUION: ChatMsg[] = [
  { from: "cliente", text: "Hola, ¿hacen páginas web con pasarela de pago?" },
  { from: "agente", text: "¡Hola! Sí 🙌 Diseñamos y desarrollamos la tienda completa, con pagos y todo listo para vender. ¿Qué vendes?" },
  { from: "cliente", text: "Ropa. Tengo unos 40 productos." },
  { from: "agente", text: "Perfecto. Para 40 productos te armamos catálogo, carrito y checkout. ¿Te paso una propuesta y agendamos una llamada de 15 min esta semana?" },
  { from: "cliente", text: "Sí, dale 🔥" },
  { from: "agente", text: "Listo, te reservo el jueves 3:00 p. m. Te llega confirmación por aquí. ¡Gracias! 🚀" },
];

export const TECNOLOGIAS: string[] = [
  "Next.js", "React", "TypeScript", "Postgres", "Tailwind", "GSAP",
  "Anthropic", "Gemini", "OpenAI", "n8n",
];

// Reusar imágenes que YA existen en public/work como placeholders; el usuario las reemplaza luego.
export const PROYECTOS: Proyecto[] = [
  { tag: "Agente IA", title: "Agente de ventas en WhatsApp", img: "/work/zk-software-foto.webp", alt: "Agente de IA de ventas de Zakumi en WhatsApp" },
  { tag: "Software", title: "Plataforma a medida", img: "/work/zk-ink-foto.webp", alt: "Plataforma de software a medida construida por Zakumi" },
  { tag: "CRM", title: "CRM con IA multimodelo", img: "/work/zk-form-foto.webp", alt: "CRM con IA multimodelo de Zakumi" },
];

export const STATS: Stat[] = [
  { num: "3", label: "Disciplinas, un equipo", desc: "IA, software y marca bajo un mismo techo. Sin intermediarios." },
  { num: "24/7", label: "Tus agentes no duermen", desc: "Atención y ventas a toda hora, sin que tú estés conectado." },
  { num: "0", label: "Plantillas", desc: "Cada proyecto se construye a la medida, desde cero." },
  { num: "∞", label: "Iteraciones", desc: "Ajustamos hasta que cada detalle quede exacto." },
];

export const CONTACTO = {
  titulo1: "Habla con nuestro agente",
  tituloEm: "ahora.",
  sub: "Es el mismo agente de IA que pondríamos a trabajar para ti. Escríbele por WhatsApp y ve cómo atiende — sin formularios eternos, sin compromiso.",
};

// Mantener los nombres de archivo existentes (zk-hero-2/3 ya existen); el usuario reemplaza el contenido in situ.
export const HERO_IMAGES = [
  "/work/zk-hero-foto.webp",
  "/work/zk-hero-2.webp",
  "/work/zk-hero-3.webp",
];
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 5: Usar `HERO_IMAGES` desde `content.ts` en `ZakumiLanding.tsx`**

Borrar el `const HERO_IMAGES = [...]` local y añadir a un import: `import { HERO_IMAGES } from "./content";`

- [ ] **Step 6: Verificar + commit**

```bash
npx tsc --noEmit && npm run build && npm test
git add -A
git commit -m "feat(content): módulo de contenido es-CO (pilares, guion, stats, tecnologías)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extraer secciones existentes a componentes (refactor sin cambio visual)

**Objetivo:** mover el JSX de cada sección a su propio archivo presentacional; `ZakumiLanding` los monta. El `gsap.context()` y todo el efecto de cortina/cursor/scroll permanecen en `ZakumiLanding`. **No cambia nada visual ni de copy todavía.**

**Files:**
- Create: `sections/Hero.tsx`, `sections/Servicios.tsx`, `sections/ComoTrabajamos.tsx`, `sections/Filosofia.tsx`, `sections/Contacto.tsx`
- Modify: `ZakumiLanding.tsx`

**Interfaces:**
- Cada componente es presentacional. Firma: `export function Hero(props): JSX.Element`. Recibe por props **solo** lo que hoy es estado/handler en `ZakumiLanding` (ej. índice del carrusel, `onDotClick`, refs si aplica). Las clases/IDs del DOM se conservan **idénticas** (`.hero`, `#hero`, `.service`, `.stat`, `.philosophy`, `.phil-word`, `.outro`, `footer`, etc.) para que los selectores GSAP sigan encontrándolas.

- [ ] **Step 1: Crear `sections/Hero.tsx`** moviendo el bloque `<section className="hero" id="hero">…</section>` actual (líneas ~742–833) **textualmente**, recibiendo por props el estado del carrusel (`heroIndex`, `onDot`) y `renderHeadline`. Mantener todas las clases/IDs.

- [ ] **Step 2: Crear `sections/Servicios.tsx`** moviendo `<section id="servicios" …>…</section>` (líneas ~861–969) textual.

- [ ] **Step 3: Crear `sections/ComoTrabajamos.tsx`** moviendo `<section className="stats-section" id="datos">…</section>` (líneas ~1045–1100) textual.

- [ ] **Step 4: Crear `sections/Filosofia.tsx`** moviendo `<section className="philosophy" id="filosofia">…</section>` (líneas ~1102–1125) textual, recibiendo las palabras por props.

- [ ] **Step 5: Crear `sections/Contacto.tsx`** moviendo `<section className="outro" id="contacto">…</section>` + `<footer>…</footer>` (líneas ~1127–1171) textual.

- [ ] **Step 6: En `ZakumiLanding.tsx`, reemplazar los bloques movidos por los componentes**

```tsx
<Hero heroIndex={heroIndex} onDot={setHeroIndex} renderHeadline={renderHeadline} />
<Servicios />
{/* La sección showcase (#seleccion) se DEJA INLINE tal cual por ahora; Task 8 la reemplaza por <Proyectos />. No extraerla en esta tarea. */}
<ComoTrabajamos />
<Filosofia line1={philosophyLine1} line2={philosophyLine2} em={philosophyEm} line3={philosophyLine3} />
<Contacto />
```
(Importar cada uno desde `./sections/...`.)

- [ ] **Step 7: Verificar que NADA cambió visualmente**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: build OK. Levantar `npm run dev` y confirmar que la página se ve y anima **idéntica** a antes (cortina, hero, stagger de servicios, contadores de stats, palabras de filosofía, hover de CTAs).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(zakumi): extraer secciones a componentes (sin cambio visual)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Hero AI-first — copy + burbuja de chat + GSAP typing

**Files:**
- Modify: `sections/Hero.tsx`, `ZakumiLanding.tsx` (añadir animación al `gsap.context`), `src/styles/zakumi-design.css`

**Interfaces:**
- Consumes: `HERO` y `HERO_IMAGES` de `content.ts`; `WHATSAPP_URL`, `TELEGRAM_ENABLED`, `TELEGRAM_URL` de `contact.ts`.
- DOM nuevo: un elemento `.hero-chat-bubble` con `.hero-chat-typing` (3 puntos) y `.hero-chat-text` superpuesto sobre `.hero-visual`.

- [ ] **Step 1: Actualizar copy del hero en `Hero.tsx`**

- Tag → `{HERO.tag}`.
- El `renderHeadline` / `<h1>` debe producir: `Tu mejor vendedor` + salto + `<em>es inteligencia artificial.</em>` (em en cursiva naranja, ya existe el estilo `em`). Tomar textos de `HERO.titulo1` / `HERO.tituloEm`.
- Subtítulo (si el hero tiene `hero-meta`/lead) → `{HERO.sub}`.
- CTA primario (nuevo en el hero, clase `cta`): `href={WHATSAPP_URL}` target/rel, texto `{HERO.ctaPrimario}` + flecha `→`, `aria-label="Habla con nuestro agente de IA por WhatsApp"`.
- CTA secundario Telegram: renderizar **solo** `TELEGRAM_ENABLED && (...)`.

- [ ] **Step 2: Añadir la burbuja de chat al markup del hero**

Dentro de `<figure className="hero-visual">`, después del carrusel:
```tsx
<div className="hero-chat-bubble" aria-hidden>
  <span className="hero-chat-typing"><i></i><i></i><i></i></span>
  <span className="hero-chat-text">¿Hacen tiendas con pago en línea?</span>
</div>
```

- [ ] **Step 3: CSS de la burbuja en `zakumi-design.css`**

```css
.hero-chat-bubble {
  position: absolute; left: 8%; bottom: 12%;
  background: rgba(20,22,25,.92); border: 1px solid rgba(255,107,53,.4);
  border-radius: 14px 14px 14px 4px; padding: 10px 14px; max-width: 240px;
  font-size: .85rem; color: #f4f1ea; backdrop-filter: blur(6px);
}
.hero-chat-typing { display: inline-flex; gap: 4px; }
.hero-chat-typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); opacity: .5; }
.hero-chat-text { display: none; }
@media (prefers-reduced-motion: reduce) {
  .hero-chat-typing { display: none; }
  .hero-chat-text { display: inline; }
}
```

- [ ] **Step 4: Animación GSAP de la burbuja (en el `gsap.context` central de `ZakumiLanding`)**

Dentro del `gsap.context(() => { ... })`, junto a las demás animaciones del hero:
```ts
const bubble = document.querySelector(".hero-chat-bubble");
if (bubble && !gsap.matchMedia) { /* fallback */ }
const mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: no-preference)", () => {
  const typing = bubble?.querySelector(".hero-chat-typing");
  const text = bubble?.querySelector(".hero-chat-text") as HTMLElement | null;
  if (!typing || !text) return;
  const tl = gsap.timeline({ delay: 1.6 });
  tl.to(typing, { duration: 1.1 })                      // "escribe"
    .set(typing, { display: "none" })
    .set(text, { display: "inline" })
    .from(text, { autoAlpha: 0, y: 6, duration: 0.4 });
});
```

- [ ] **Step 5: Imágenes del hero** — `HERO_IMAGES` reusa los archivos existentes (`zk-hero-foto.webp`, `zk-hero-2.webp`, `zk-hero-3.webp`), así el build no se rompe. El usuario reemplaza el **contenido** de esos archivos con las imágenes generadas (prompts en §7 del spec). No hace falta crear archivos nuevos.

- [ ] **Step 6: Verificar + commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add -A
git commit -m "feat(hero): reposicionamiento IA + burbuja de chat animada" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Servicios → 3 pilares

**Files:** Modify: `sections/Servicios.tsx`

**Interfaces:** Consumes `PILARES` de `content.ts`. Conserva las clases `.services`, `.service`, `.service-num`, `.service-arrow`, `.service-meta` para heredar el stagger GSAP existente (`gsap.utils.toArray(".service")`).

- [ ] **Step 1: Renderizar 3 pilares desde datos**

Reemplazar las dos `.service` hardcodeadas por:
```tsx
<div className="services">
  {PILARES.map((p) => (
    <div className="service" key={p.titulo}>
      <div className="service-arrow">↗</div>
      <div className="service-num">{p.num}</div>
      <h3>{p.titulo}</h3>
      <p>{p.desc}</p>
      <div className="service-meta">
        {p.tags.map((t) => (
          <div className="service-meta-row" key={t}>{t}</div>
        ))}
      </div>
    </div>
  ))}
</div>
```
Actualizar el encabezado de la sección (`.section-num` → "01 / Servicios", `.section-title` y `.servicios-lead`) a copy que hable de los 3 pilares.

- [ ] **Step 2: Verificar que el stagger sigue corriendo**

Run: `npm run build` y `npm run dev` → al hacer scroll, las 3 tarjetas entran escalonadas (animación `.service` existente las toma automáticamente).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(servicios): 3 pilares (IA, Software, Marca)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Sección CRM con IA (nueva)

**Files:**
- Create: `sections/CrmIA.tsx`
- Modify: `ZakumiLanding.tsx` (montarla tras Servicios + animación de ensamblado en el context), `zakumi-design.css` (estilos `.crm-*`)

**Interfaces:** Consumes `CRM` de `content.ts`. DOM: `<section className="crm" id="crm">` con `.crm-mock` (tarjetas `.crm-card`) y `.crm-counter[data-target]`.

- [ ] **Step 1: Crear `CrmIA.tsx`**

```tsx
import { CRM } from "../content";

export function CrmIA() {
  return (
    <section className="crm" id="crm">
      <div className="crm-text">
        <div className="section-num">02 / Producto</div>
        <h2 className="section-title">{CRM.titulo1} <em>{CRM.tituloEm}</em></h2>
        <p className="crm-sub">{CRM.sub}</p>
        <ul className="crm-features">
          {CRM.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="crm-nota">{CRM.nota}</p>
      </div>
      <div className="crm-mock" aria-hidden>
        <div className="crm-card">Lead nuevo · <b>IA respondió</b></div>
        <div className="crm-card">Seguimiento agendado</div>
        <div className="crm-card">Resumen de conversación</div>
        <div className="crm-counter"><span data-target="128">0</span> leads atendidos hoy</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Estilos `.crm-*`** en `zakumi-design.css` (grid 2 columnas en desktop, 1 en móvil; `.crm-card` con borde naranja sutil sobre negro; acento en `<b>` y `<em>`). Seguir el patrón visual de `.stat`/`.service` existentes.

- [ ] **Step 3: Montar en `ZakumiLanding`** después de `<Servicios />`: `<CrmIA />`.

- [ ] **Step 4: Animación de ensamblado (en el `gsap.context` central)**

```ts
const crmCards = gsap.utils.toArray<HTMLElement>(".crm-mock .crm-card");
if (crmCards.length) {
  gsap.from(crmCards, {
    scrollTrigger: { trigger: ".crm-mock", start: "top 75%", once: true },
    y: 24, autoAlpha: 0, stagger: 0.12, duration: 0.5, ease: "power3.out",
  });
  // contador (reutiliza el patrón data-target de los stats)
  const counter = document.querySelector(".crm-counter [data-target]") as HTMLElement | null;
  if (counter) {
    const target = Number(counter.getAttribute("data-target"));
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: ".crm-counter", start: "top 80%", once: true,
      onEnter: () => gsap.to(obj, { v: target, duration: 1.4, ease: "power1.out",
        onUpdate: () => { counter.textContent = String(Math.round(obj.v)); } }),
    });
  }
}
```
Nota reduced-motion: envolver en `gsap.matchMedia()` `(prefers-reduced-motion: no-preference)`; en reduce, dejar tarjetas visibles y el número en su valor final.

- [ ] **Step 5: Verificar + commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add -A && git commit -m "feat(crm): sección CRM con IA + mockup ensamblado" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Demo del agente (chat guionizado + timeline GSAP)

**Files:**
- Create: `sections/AgentDemo.tsx`
- Modify: `ZakumiLanding.tsx` (montar + timeline), `zakumi-design.css` (`.agent-*`)

**Interfaces:** Consumes `CHAT_GUION` de `content.ts`, `WHATSAPP_URL` de `contact.ts`. DOM: `<section className="agent-demo" id="demo-agente">` con `.agent-chat` que contiene un `.agent-msg.is-cliente|.is-agente` por mensaje (cada uno con `.agent-typing` + `.agent-text`).

- [ ] **Step 1: Crear `AgentDemo.tsx`**

```tsx
import { CHAT_GUION } from "../content";
import { WHATSAPP_URL } from "../contact";

export function AgentDemo() {
  return (
    <section className="agent-demo" id="demo-agente">
      <div className="section-num">— en vivo —</div>
      <h2 className="section-title">Míralo vender. <em>Luego habla con él.</em></h2>
      <div className="agent-phone">
        <div className="agent-chat">
          {CHAT_GUION.map((m, i) => (
            <div className={`agent-msg is-${m.from}`} key={i}>
              <span className="agent-typing" aria-hidden><i></i><i></i><i></i></span>
              <span className="agent-text">{m.text}</span>
            </div>
          ))}
        </div>
      </div>
      <a className="cta" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
         aria-label="Prueba el agente de IA en WhatsApp">
        <span>Pruébalo tú mismo</span><span className="arrow">→</span>
      </a>
    </section>
  );
}
```

- [ ] **Step 2: Estilos `.agent-*`** en `zakumi-design.css`: marco tipo teléfono/ventana de WhatsApp (fondo oscuro, ancho máx ~380px, centrado); `.agent-msg.is-cliente` alineado a la derecha con burbuja gris, `.is-agente` a la izquierda con burbuja verde/naranja; `.agent-typing` visible por defecto, `.agent-text` oculto (se revelan por GSAP). En `prefers-reduced-motion: reduce`: ocultar `.agent-typing`, mostrar todos los `.agent-text`, mensajes visibles.

```css
.agent-msg { opacity: 0; }              /* GSAP los revela; ver step 4 para reduce */
.agent-msg .agent-text { display: none; }
.agent-msg .agent-typing { display: inline-flex; gap: 4px; }
@media (prefers-reduced-motion: reduce) {
  .agent-msg { opacity: 1; }
  .agent-msg .agent-text { display: block; }
  .agent-msg .agent-typing { display: none; }
}
```

- [ ] **Step 3: Montar en `ZakumiLanding`** después de `<CrmIA />`: `<AgentDemo />`.

- [ ] **Step 4: Timeline GSAP secuencial (en el `gsap.context` central)**

```ts
const mmAgent = gsap.matchMedia();
mmAgent.add("(prefers-reduced-motion: no-preference)", () => {
  const msgs = gsap.utils.toArray<HTMLElement>(".agent-demo .agent-msg");
  if (!msgs.length) return;
  const tl = gsap.timeline({
    scrollTrigger: { trigger: ".agent-demo", start: "top 65%", once: true },
  });
  msgs.forEach((msg) => {
    const typing = msg.querySelector(".agent-typing");
    const text = msg.querySelector(".agent-text") as HTMLElement | null;
    tl.set(msg, { autoAlpha: 1 })
      .from(msg, { y: 14, scale: 0.96, transformOrigin: "left bottom", duration: 0.3 })
      .to({}, { duration: 0.7 })                 // "escribiendo…"
      .set(typing, { display: "none" })
      .set(text, { display: "block" })
      .from(text, { autoAlpha: 0, duration: 0.25 });
  });
});
```

- [ ] **Step 5: Verificar + commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add -A && git commit -m "feat(agent-demo): chat guionizado animado con GSAP + CTA WhatsApp" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Proyectos + "Con qué construimos" (reemplaza Selección)

**Files:**
- Create: `sections/Proyectos.tsx`
- Modify: `ZakumiLanding.tsx` (reemplazar el `<section className="showcase" id="seleccion">` inline por `<Proyectos />` con `id="proyectos"`), `zakumi-design.css` (`.tecnologias` marquee).

**Interfaces:** Consumes `PROYECTOS`, `TECNOLOGIAS` de `content.ts`. Conserva clases `.showcase`, `.show-tile` (heredan reveal GSAP existente). Marquee de tecnologías reutiliza patrón `.marquee`/`.marquee-track`.

- [ ] **Step 1: Crear `Proyectos.tsx`**

```tsx
import Image from "next/image";
import { PROYECTOS, TECNOLOGIAS } from "../content";

export function Proyectos() {
  return (
    <section className="showcase" id="proyectos">
      <div className="section-num">03 / Proyectos</div>
      <h2 className="section-title">Lo que construimos.</h2>
      <div className="showcase-grid">
        {PROYECTOS.map((p) => (
          <figure className="show-tile" key={p.title}>
            <div className="show-mock">
              <Image src={p.img} alt={p.alt} fill className="show-img"
                     sizes="(max-width: 720px) 100vw, 33vw" />
            </div>
            <figcaption>
              <span className="show-tag">{p.tag}</span>
              <span className="show-title">{p.title}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="tecnologias">
        <div className="small">— con qué construimos —</div>
        <div className="marquee"><div className="marquee-track tecnologias-track">
          {[...TECNOLOGIAS, ...TECNOLOGIAS].map((t, i) => (
            <span className="marquee-item" key={i}>{t}</span>
          ))}
        </div></div>
      </div>
    </section>
  );
}
```
Las clases (`.showcase-grid`, `.show-tile`, `.show-mock`, `.show-img`, `.show-tag`, `.show-title`) son las **mismas** que la sección showcase actual (líneas ~970–1043), así el CSS y el reveal GSAP de `.show-tile` aplican sin tocar nada. Usa `next/image` como el resto del sitio.

- [ ] **Step 2: Animar el marquee de tecnologías**

En el `gsap.context` central, replicar el tween del marquee existente para `.tecnologias-track`:
```ts
const techTrack = document.querySelector(".tecnologias-track");
if (techTrack) {
  gsap.to(techTrack, { xPercent: -50, duration: 18, ease: "none", repeat: -1 });
}
```

- [ ] **Step 3: Placeholders** — `PROYECTOS` reusa imágenes existentes (`zk-software-foto.webp`, `zk-ink-foto.webp`, `zk-form-foto.webp`); **no hay que crear archivos nuevos**. El usuario reemplaza el contenido después.

- [ ] **Step 4: Verificar + commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add -A && git commit -m "feat(proyectos): showcase + marquee 'con qué construimos'" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Stats + Filosofía + Contacto + Footer (copy IA + Telegram condicional)

**Files:** Modify: `sections/ComoTrabajamos.tsx`, `sections/Filosofia.tsx`, `sections/Contacto.tsx`

**Interfaces:** Consumes `STATS`, `CONTACTO` de `content.ts`; `WHATSAPP_URL`, `EMAIL`, `TELEGRAM_ENABLED`, `TELEGRAM_URL` de `contact.ts`.

- [ ] **Step 1: `ComoTrabajamos.tsx` desde `STATS`**

Renderizar 4 `.stat` desde `STATS.map(...)`, conservando la estructura `.num`/`.stat-label`/`.stat-desc`. Para los que tienen contador numérico real (solo `"3"`), mantener `data-num`/`data-target` para la animación; los simbólicos (`24/7`, `0`, `∞`) van como texto fijo (sin `data-target`). Actualizar el encabezado/lead a copy IA.

- [ ] **Step 2: `Filosofia.tsx`** — ajustar el copy de las palabras animadas para hablar de "IA con criterio humano: diseño y código bajo el mismo techo". Conservar clases `.phil-word` (las anima el ScrollTrigger existente).

- [ ] **Step 3: `Contacto.tsx`** — titular `{CONTACTO.titulo1} <em>{CONTACTO.tituloEm}</em>`, párrafo `{CONTACTO.sub}`. CTAs:
```tsx
<div className="contact-actions">
  <a href={WHATSAPP_URL} className="cta" target="_blank" rel="noopener noreferrer" style={{opacity:1}}>
    {/* icono WA existente */} <span>Habla con nuestro agente</span><span className="arrow">→</span>
  </a>
  <a href={`mailto:${EMAIL}`} className="cta cta-ghost" style={{opacity:1}}>
    <span>{EMAIL}</span><span className="arrow">→</span>
  </a>
  {TELEGRAM_ENABLED && (
    <a href={TELEGRAM_URL} className="cta cta-ghost" target="_blank" rel="noopener noreferrer" style={{opacity:1}}>
      <span>Telegram</span><span className="arrow">→</span>
    </a>
  )}
</div>
```

- [ ] **Step 4: Footer** — mantener Instagram (ya existe). Añadir Telegram condicional:
```tsx
{TELEGRAM_ENABLED && (
  <a className="footer-social" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Telegram de ZAKUMI">
    {/* icono telegram */} <span className="footer-handle">Telegram</span>
  </a>
)}
```
Actualizar la línea decorativa del footer `Diseño · Código · Marca` → `IA · Software · Marca`.

- [ ] **Step 5: Verificar + commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add -A && git commit -m "feat(copy): stats/filosofía/contacto IA + Telegram condicional" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Navegación (labels + anclas)

**Files:** Modify: `ZakumiLanding.tsx` (array `NAV`, ~líneas 29–34) y los `id` de sección que cambiaron.

**Interfaces:** El scroll suave usa el handler existente con `ScrollToPlugin`; solo cambian `href`/`label`.

- [ ] **Step 1: Actualizar el array de navegación**

```ts
const NAV = [
  { href: "#demo-agente", label: "Agentes" },
  { href: "#servicios", label: "Servicios" },
  { href: "#crm", label: "CRM" },
  { href: "#proyectos", label: "Proyectos" },
  { href: "#contacto", label: "Contacto" },
] as const;
```

- [ ] **Step 2: Confirmar IDs** — `#hero`, `#servicios`, `#crm`, `#demo-agente`, `#proyectos`, `#datos`(stats), `#filosofia`, `#contacto` existen en sus secciones. (La sección showcase pasó de `#seleccion` a `#proyectos`.)

- [ ] **Step 3: Verificar navegación** — `npm run dev`, clic en cada ítem del nav (desktop y menú móvil overlay) → hace scroll suave a la sección correcta.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(nav): Agentes · Servicios · CRM · Proyectos · Contacto" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: SEO — JSON-LD + metadata (Next 16)

**Files:** Modify: `src/components/site/JsonLd.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: Leer guía Next 16 de metadata** (lo exige `AGENTS.md`)

Run: `ls node_modules/next/dist/docs/` y leer el doc de `metadata`/`app-router` relevante antes de editar `layout.tsx`. Confirmar que la API `Metadata` no cambió respecto a lo que ya usa el archivo.

- [ ] **Step 2: Ampliar `makesOffer` en `JsonLd.tsx`**

Añadir al array `makesOffer` (manteniendo los existentes y el `sameAs` de Instagram) ofertas para: "Agentes de IA para WhatsApp y Telegram", "CRM con IA", "Automatización e integraciones", "Manejo de redes y contenido". Cada uno como `{ "@type": "Offer", itemOffered: { "@type": "Service", name, description } }`, descripciones en es-CO sin "stack".

- [ ] **Step 3: Actualizar metadata en `layout.tsx`**

- `description` y `openGraph.description` → mencionar agentes de IA para WhatsApp/Telegram + software a medida en Colombia.
- `keywords` → añadir: "agentes de IA WhatsApp Colombia", "chatbot de ventas IA", "automatización de ventas con IA", "CRM con inteligencia artificial", "desarrollo de software Colombia". Conservar el resto.
- Títulos: mantener "ZAKUMI" pero alinear el subtítulo a "IA, agentes y software".

- [ ] **Step 4: Verificar + commit**

```bash
npx tsc --noEmit && npm run build
git add -A && git commit -m "feat(seo): JSON-LD y metadata orientados a agentes de IA (Colombia)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Verificación final + accesibilidad

**Files:** revisión transversal.

- [ ] **Step 1: Auditar `prefers-reduced-motion`** — confirmar que hero-bubble, CRM assemble, agent-demo timeline y marquees tienen su rama `matchMedia`/CSS reduce con estado final visible.

- [ ] **Step 2: Suite completa**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: todo verde.

- [ ] **Step 3: Revisión manual en `npm run dev`** — recorrer la página completa (desktop + móvil ≤720px): cortina, hero + burbuja, 3 pilares stagger, CRM ensamblado + contador, demo del agente (mensajes secuenciales), proyectos + marquee tecnologías, stats, filosofía, contacto (WhatsApp abre chat con Zak), footer (Instagram; Telegram oculto). Verificar que **no aparece la palabra "stack"** en ningún lado.

- [ ] **Step 4: Commit final**

```bash
git add -A && git commit -m "chore: verificación final rediseño AI-first" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Handoff a review** — la fase siguiente (fuera de este plan) es el "review de todo" con gstack: `qa` (prueba funcional + bugs), `design-review` (ojo de diseñador) y `code-review` (diff). Luego ship.

---

## Notas de implementación

- **Imágenes:** las definitivas las genera el usuario (prompts en §7 del spec). Mientras, usar placeholders en `public/work/` para no romper el build.
- **GSAP:** usar la skill `gsap-skills`/`gsap-core` para validar timelines/easings. Centralizar el registro de plugins (ya existe `gsap.registerPlugin`).
- **Riesgo principal:** Task 3 (extracción) debe dejar la página **idéntica** antes de cambiar copy. Es el checkpoint de seguridad; si algo se rompe ahí, parar y arreglar antes de seguir.
```
