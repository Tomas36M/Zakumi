# Servicios como vistas independientes (multi-página) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la sección de 3 pilares de la landing en tres vistas de servicio independientes (`/agentes-ia`, `/software`, `/marca`) + una vista de contacto (`/contacto`), separando el "chrome" global en un `SiteShell` compartido.

**Architecture:** App Router multi-página. `SiteShell` (client) en `app/layout.tsx` renderiza chrome global (fondo, grain, cortina solo en `/`, cursor, barra de progreso, nav, footer) y el GSAP global. `ZakumiHome` (client) tiene las secciones de la home menos Servicios y Contacto. `ServicePage` (client) es la plantilla de servicio alimentada por `services.ts`. Cada ruta tiene su `page.tsx` server con `metadata`.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind v4 + GSAP (ScrollTrigger, ScrollToPlugin). Tests con Vitest (capa de datos). Refactor visual/GSAP verificado con `next build` + navegador headless (`browse`).

## Global Constraints

- **Copy 100% español es-CO. Prohibida la palabra "stack"** (usar "tecnología/herramientas"). Nada de Spanglish.
- **No nuevas dependencias.** Reutilizar GSAP, next/font, next/image, next/link existentes.
- **App Router de esta versión tiene cambios:** leer `node_modules/next/dist/docs/` antes de escribir rutas/metadata si hay duda. Respetar deprecations.
- **`prefers-reduced-motion`**: toda animación nueva debe respetarlo.
- **SEO:** `metadataBase` vía `NEXT_PUBLIC_SITE_URL` (fallback `https://zakumistudio.com`). `lang="es-CO"`.
- **Escala visual generosa** (preferencia del usuario): tipografía amplia, aire entre bloques.
- **Calidad de diseño (regla dura):** todo estilo va **al lenguaje gráfico ya existente** y se diseña
  **como un diseñador de interfaces senior** — creatividad, mejores prácticas, animaciones cuidadas.
  **Prohibido lo "templated"** (tarjetas con borde y grids `auto-fit` genéricos). Ver guía abajo.
- **Verificación de navegador:** binario en `~/.claude/skills/gstack/browse/dist/browse` (dev en `http://localhost:3000`).
- Spec de referencia: `docs/superpowers/specs/2026-06-18-zakumi-servicios-multipagina-design.md`.

---

## Design & Animation Guidelines (aplican a TODA pieza nueva)

Las vistas de servicio y `/contacto` deben sentirse **parte del mismo sitio**, no un tema aparte.
Antes de estilizar, abrir `src/styles/zakumi-design.css` y reusar el vocabulario existente.

**Sistema visual (reusar tokens y patrones que ya existen):**
- Tipografía: **Playfair Display** (títulos, cifras, citas — italic para énfasis) + **Inter** (cuerpo,
  labels en mayúsculas con `letter-spacing`). Variables `--font-playfair` / `--font-inter`.
- Color: `--paper` (texto), `--slate` (secundario), `--black`/`--bg`, **`--orange` (#DB5227)** como
  único acento. Nada de colores nuevos.
- Vocabulario editorial del sitio: **eyebrow numerado** (`— I.`, `— II.`, `— III.`) y
  `section-num`/`section-title`; **hairlines** `1px solid rgba(118,130,142,0.18)`; **cifras/numerales
  grandes** tenues como elemento gráfico; layouts **asimétricos** (no centrados, alineados a la
  izquierda y a todo el ancho, como el resto); la flecha **`↗`** como motivo (ver `.service-arrow`).
- Botones: reusar `.cta` (relleno naranja con barra que desliza en hover) y `.cta-ghost` (contorno).
- Imágenes: `next/image` con overlay/scrim como en el hero; hover con leve zoom (lenguaje ken-burns).

**Listas/contenido — NO usar tarjetas con borde por defecto.** Preferir el patrón editorial del sitio:
filas con hairline e índice (como `service-meta-row` / `service-num`), tipografía como jerarquía,
mucho aire. Las "tarjetas" solo cuando aporten (ej. **un plan destacado** relleno en naranja, guiño
a la tarjeta naranja del pilar "Marca" del diseño original).

**Animación (mismo idioma GSAP del sitio):**
- Entradas por **scroll-reveal con stagger** (no un fade plano de bloque entero): los hijos de cada
  sección entran escalonados, como en el reveal global (`.section-num, .section-title, …`).
- Easings del sitio: `power3.out`, `expo.out`, `cubic-bezier(0.2,0.8,0.2,1)`. `ScrollTrigger` con
  `once: true`. Micro-interacciones de hover (flecha que se desplaza, underline, zoom de imagen).
- **Siempre** respetar `prefers-reduced-motion: reduce` (sin entradas intrusivas).
- El cursor magnético global ya cubre `a, button, .cta`; mantener esos className en lo interactivo.

> Regla práctica: si una sección nueva se ve como un "card grid" de framework, está mal. Debe leerse
> como una página editorial diseñada a mano, con la misma voz que el hero y la sección de proyectos.

---

## File Structure

**Crear:**
- `src/components/zakumi/services.ts` — datos de los 3 servicios + tipos.
- `src/components/zakumi/__tests__/services.test.ts` — tests de datos.
- `src/components/site/SiteShell.tsx` — chrome global + GSAP global (client).
- `src/components/zakumi/ZakumiHome.tsx` — secciones de la home + GSAP de sección (client).
- `src/components/zakumi/sections/ServicePage.tsx` — plantilla de servicio (client).
- `src/components/zakumi/sections/ContactoView.tsx` — contenido de `/contacto` (client).
- `src/app/agentes-ia/page.tsx`, `src/app/software/page.tsx`, `src/app/marca/page.tsx`, `src/app/contacto/page.tsx`.

**Modificar:**
- `src/app/layout.tsx` — envolver `{children}` en `<SiteShell>`.
- `src/app/page.tsx` — renderizar `<ZakumiHome />`.
- `src/components/zakumi/content.ts` — `HERO_SLIDES[].href`; eliminar `PILARES`.
- `src/components/zakumi/sections/Hero.tsx` — CTA del slide → `<Link href={slide.href}>`.
- `src/app/sitemap.ts` — 5 URLs.
- `src/components/site/JsonLd.tsx` — entidades `Service`.
- `src/styles/zakumi-design.css` — estilos de `ServicePage`; quitar `.service`/`.services` (grid de pilares).
- `src/components/zakumi/__tests__/content.test.ts` — quitar aserción de `PILARES`.

**Eliminar:**
- `src/components/zakumi/sections/Servicios.tsx`.
- `src/components/zakumi/ZakumiLanding.tsx` (tras migrar a SiteShell + ZakumiHome).

---

## Task 1: Capa de datos de servicios (`services.ts`)

**Files:**
- Create: `src/components/zakumi/services.ts`
- Test: `src/components/zakumi/__tests__/services.test.ts`

**Interfaces:**
- Produces: `export type Service`, `export const SERVICIOS: Record<Service["slug"], Service>`, `export const SERVICE_SLUGS: Service["slug"][]`.
  - `Service` campos: `slug` (`"agentes-ia"|"software"|"marca"`), `num`, `nav`, `tag`, `titulo1`, `tituloEm`, `intro`, `heroImg`, `ctaTipo` (`"whatsapp"|"contacto"`), `waMsg?`, `incluye: {titulo;desc}[]`, `ejemplos: {titulo;desc;img?}[]`, `testimonios: {quote;autor;rol;placeholder:true}[]`, `planes: {nombre;tagline;incluye:string[]}[]`, `seo: {title;description}`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/components/zakumi/__tests__/services.test.ts
import { describe, expect, it } from "vitest";
import { SERVICIOS, SERVICE_SLUGS } from "../services";

const all = Object.values(SERVICIOS);
const copy = JSON.stringify(all);

describe("services", () => {
  it("hay 3 servicios con los slugs correctos", () => {
    expect(SERVICE_SLUGS).toEqual(["agentes-ia", "software", "marca"]);
    expect(Object.keys(SERVICIOS).sort()).toEqual([...SERVICE_SLUGS].sort());
  });
  it("cada servicio tiene secciones no vacías", () => {
    for (const s of all) {
      expect(s.incluye.length).toBeGreaterThanOrEqual(4);
      expect(s.ejemplos.length).toBeGreaterThanOrEqual(2);
      expect(s.testimonios.length).toBeGreaterThanOrEqual(2);
      expect(s.planes.length).toBeGreaterThanOrEqual(3);
      expect(s.seo.title.length).toBeGreaterThan(0);
      expect(s.seo.description.length).toBeGreaterThan(0);
    }
  });
  it("los testimonios están marcados como placeholder", () => {
    for (const s of all) for (const t of s.testimonios) expect(t.placeholder).toBe(true);
  });
  it("solo agentes usa CTA de whatsapp y trae waMsg", () => {
    expect(SERVICIOS["agentes-ia"].ctaTipo).toBe("whatsapp");
    expect(SERVICIOS["agentes-ia"].waMsg).toBeTruthy();
    expect(SERVICIOS["software"].ctaTipo).toBe("contacto");
    expect(SERVICIOS["marca"].ctaTipo).toBe("contacto");
  });
  it("REGLA: ningún copy contiene la palabra 'stack'", () => {
    expect(copy.toLowerCase()).not.toMatch(/\bstack\b/);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- services`
Expected: FAIL — `Cannot find module '../services'`.

- [ ] **Step 3: Crear `services.ts` con los 3 servicios**

Crear `src/components/zakumi/services.ts` con los tipos del bloque Interfaces y la copy del spec (sección "Datos"). Estructura exacta:

```ts
export type Capacidad = { titulo: string; desc: string };
export type ServiceExample = { titulo: string; desc: string; img?: string };
export type Testimonio = { quote: string; autor: string; rol: string; placeholder: true };
export type Plan = { nombre: string; tagline: string; incluye: string[] };

export type Service = {
  slug: "agentes-ia" | "software" | "marca";
  num: string;
  nav: string;
  tag: string;
  titulo1: string;
  tituloEm: string;
  intro: string;
  heroImg: string;
  ctaTipo: "whatsapp" | "contacto";
  waMsg?: string;
  incluye: Capacidad[];
  ejemplos: ServiceExample[];
  testimonios: Testimonio[];
  planes: Plan[];
  seo: { title: string; description: string };
};

export const SERVICE_SLUGS: Service["slug"][] = ["agentes-ia", "software", "marca"];

export const SERVICIOS: Record<Service["slug"], Service> = {
  "agentes-ia": {
    slug: "agentes-ia",
    num: "— I.",
    nav: "Agentes IA",
    tag: "Agentes de IA · WhatsApp & Telegram",
    titulo1: "Agentes de IA que atienden",
    tituloEm: "y venden por ti.",
    intro:
      "Responden, asesoran y cierran ventas en WhatsApp, Telegram y redes — 24/7, sin que tú estés. El mismo agente que ya tenemos funcionando, puesto a trabajar para tu negocio.",
    heroImg: "/work/zk-hero-foto.webp",
    ctaTipo: "whatsapp",
    waMsg: "Hola Zakumi, quiero un agente de IA para mi WhatsApp.",
    incluye: [
      { titulo: "Agente de ventas", desc: "Recomienda, arma el pedido y deja al cliente listo para pagar." },
      { titulo: "Atención 24/7", desc: "Contesta en segundos a cualquier hora y resuelve lo repetitivo." },
      { titulo: "Multicanal", desc: "WhatsApp, Telegram, Instagram y la web, con la misma memoria y tu tono." },
      { titulo: "Automatización e integraciones", desc: "Conecta con tu CRM, catálogo, agenda y pasarela de pago." },
      { titulo: "Entrenado con tu negocio", desc: "Aprende tus productos, precios y forma de hablar. No es un bot genérico." },
      { titulo: "Reportes y mejora", desc: "Ves qué preguntan y qué frena la venta; afinamos el agente con esos datos." },
    ],
    ejemplos: [
      { titulo: "Tienda que vende por WhatsApp", desc: "El agente atiende el catálogo, arma el carrito y pasa el pago.", img: "/work/zk-software-foto.webp" },
      { titulo: "Agenda de citas", desc: "Clínicas y salones: agenda, recuerda y reprograma sin llamadas.", img: "/work/zk-form-foto.webp" },
      { titulo: "Soporte de primer nivel", desc: "Resuelve el grueso de las dudas y escala a una persona cuando hace falta.", img: "/work/zk-ink-foto.webp" },
    ],
    testimonios: [
      // TODO: reemplazar por testimonios reales cuando existan.
      { quote: "Pasamos de responder a medianoche a que el agente cierre ventas mientras dormimos.", autor: "Daniela R.", rol: "Tienda de cosmética", placeholder: true },
      { quote: "Dejé de perder mensajes. Cada cliente recibe respuesta al instante.", autor: "Andrés M.", rol: "Importadora", placeholder: true },
    ],
    planes: [
      { nombre: "Esencial", tagline: "Para empezar a no perder clientes.", incluye: ["Un canal (WhatsApp)", "Preguntas frecuentes + catálogo", "Flujo de ventas básico"] },
      { nombre: "Crecimiento", tagline: "Cuando el volumen aprieta.", incluye: ["Multicanal", "Integración con CRM y pagos", "Automatizaciones y reportes"] },
      { nombre: "A medida", tagline: "Operaciones serias.", incluye: ["Agentes especializados", "Integraciones complejas", "Alto volumen"] },
    ],
    seo: {
      title: "Agentes de IA para WhatsApp y Telegram",
      description: "Agentes de IA que atienden y venden 24/7 en WhatsApp, Telegram y redes. Entrenados con tu negocio e integrados a tu CRM. Estudio en Colombia.",
    },
  },
  software: {
    slug: "software",
    num: "— II.",
    nav: "Software",
    tag: "Software & plataformas a medida",
    titulo1: "Software a medida",
    tituloEm: "que sostiene tu crecimiento.",
    intro:
      "Web, apps y plataformas hechas a tu medida, con datos serios y código propio. Del prototipo a producción — nada de plantillas.",
    heroImg: "/work/zk-software-foto.webp",
    ctaTipo: "contacto",
    incluye: [
      { titulo: "Plataformas a medida", desc: "Paneles, portales, marketplaces y herramientas internas que crecen contigo." },
      { titulo: "Web y apps", desc: "Sitios rápidos y aplicaciones que se sienten nativas, con Next.js y React." },
      { titulo: "Bases de datos serias", desc: "Modelado con Postgres pensado para escalar sin sustos." },
      { titulo: "Integraciones", desc: "Pagos, facturación, mensajería, IA y lo que tu operación necesite conectar." },
      { titulo: "Código propio, sin ataduras", desc: "Te entregamos el código y la documentación. La plataforma es tuya." },
      { titulo: "Del prototipo a producción", desc: "Arrancamos con algo funcional rápido y lo llevamos a algo robusto." },
    ],
    ejemplos: [
      { titulo: "Panel de operación", desc: "Pedidos, inventario y clientes en un solo lugar.", img: "/work/zk-form-foto.webp" },
      { titulo: "Portal para clientes", desc: "Cada cliente entra, ve su estado y se autogestiona.", img: "/work/zk-ink-foto.webp" },
      { titulo: "App de producto", desc: "Del MVP que valida al producto que aguanta usuarios reales.", img: "/work/zk-software-foto.webp" },
    ],
    testimonios: [
      // TODO: reemplazar por testimonios reales cuando existan.
      { quote: "Reemplazamos tres hojas de cálculo por una plataforma que de verdad usamos.", autor: "Carolina V.", rol: "Logística", placeholder: true },
      { quote: "Entregaron el código y la documentación. No quedamos amarrados a nadie.", autor: "Felipe G.", rol: "Startup", placeholder: true },
    ],
    planes: [
      { nombre: "Prototipo / MVP", tagline: "Validar rápido.", incluye: ["Algo funcional para probar la idea", "Alcance acotado", "Listo para mostrar a usuarios"] },
      { nombre: "Plataforma", tagline: "Producto en producción.", incluye: ["Sistema completo", "Datos e integraciones", "Desplegado y monitoreado"] },
      { nombre: "Evolución continua", tagline: "Mejorar mes a mes.", incluye: ["Acompañamiento", "Nuevas funciones", "Mantenimiento"] },
    ],
    seo: {
      title: "Software y plataformas a medida en Colombia",
      description: "Web, apps y plataformas a medida con Next.js, React y Postgres. Código propio, del prototipo a producción. Estudio en Colombia.",
    },
  },
  marca: {
    slug: "marca",
    num: "— III.",
    nav: "Marca",
    tag: "Marca · Contenido · Redes",
    titulo1: "Tu marca, viva.",
    tituloEm: "Tus redes, en automático.",
    intro:
      "Identidad con criterio + contenido y publicación automatizada. Presencia todos los días, sin que tengas que estar pendiente.",
    heroImg: "/work/zk-brand-foto2.webp",
    ctaTipo: "contacto",
    incluye: [
      { titulo: "Identidad visual", desc: "Logo, paleta, tipografías y un sistema coherente en todo." },
      { titulo: "Manejo de redes", desc: "Estrategia, calendario y publicación constante en tus canales." },
      { titulo: "Creación de contenido", desc: "Piezas, copy y formatos pensados para tu audiencia." },
      { titulo: "Publicación automatizada", desc: "Programado y publicado a diario, sin que estés encima." },
      { titulo: "Lineamientos de marca", desc: "Una guía para que todo hable con la misma voz." },
      { titulo: "Contenido con IA", desc: "Producción a escala apoyada en IA, con criterio humano." },
    ],
    ejemplos: [
      { titulo: "Marca desde cero", desc: "Le damos identidad y la ponemos a operar en redes.", img: "/work/zk-brand-foto2.webp" },
      { titulo: "Relanzamiento", desc: "Refrescamos la imagen y reactivamos la presencia digital.", img: "/work/zk-ink-foto.webp" },
      { titulo: "Redes en piloto automático", desc: "Calendario mensual + publicación; tú revisas y apruebas.", img: "/work/zk-form-foto.webp" },
    ],
    testimonios: [
      // TODO: reemplazar por testimonios reales cuando existan.
      { quote: "Por fin las redes se ven como una marca de verdad, no improvisadas.", autor: "Laura P.", rol: "Gastronomía", placeholder: true },
      { quote: "Publican por mí todos los días. Yo solo reviso y apruebo.", autor: "Santiago O.", rol: "Servicios", placeholder: true },
    ],
    planes: [
      { nombre: "Identidad", tagline: "El sistema de marca.", incluye: ["Identidad visual completa", "Lineamientos de marca", "Entrega una sola vez"] },
      { nombre: "Marca + Redes", tagline: "Imagen y presencia.", incluye: ["Identidad", "Manejo de redes", "Contenido mensual"] },
      { nombre: "Contenido continuo", tagline: "Siempre presente.", incluye: ["Producción sostenida", "Publicación mensual", "Reportes"] },
    ],
    seo: {
      title: "Marca, contenido y redes en automático",
      description: "Identidad visual con criterio + contenido y publicación automatizada en tus redes. Presencia todos los días. Estudio en Colombia.",
    },
  },
};
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- services`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/zakumi/services.ts src/components/zakumi/__tests__/services.test.ts
git commit -m "feat(servicios): capa de datos de los 3 servicios"
```

---

## Task 2: Refactor — `SiteShell` + `ZakumiHome` (chrome global vs. secciones)

Refactor atómico: se extrae el chrome global a `SiteShell` y las secciones de la home a `ZakumiHome`, se cablea `layout.tsx`/`page.tsx` y se borra `ZakumiLanding.tsx`. Verificado con build + navegador (no hay tests de componente en el proyecto).

**Files:**
- Create: `src/components/site/SiteShell.tsx`, `src/components/zakumi/ZakumiHome.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Delete: `src/components/zakumi/ZakumiLanding.tsx`, `src/components/zakumi/sections/Servicios.tsx`

**Interfaces:**
- Produces: `export function SiteShell({ children }: { children: React.ReactNode })`, `export function ZakumiHome()`.

**Reparto del GSAP de `ZakumiLanding.tsx` (leerlo antes de borrarlo):**

| Bloque en `ZakumiLanding.tsx` | Va a |
|---|---|
| `useEffect` de `--hero-size`/`--orange`/`bg-*` (≈ líneas 49-77) | SiteShell |
| `useEffect` del menú móvil (≈ 79-95) | SiteShell |
| Cortina (≈ 100-132) — **envolver en `if (pathname === "/")`** | SiteShell |
| Barra de progreso `#scroll-fill` (≈ 164-170) | SiteShell |
| Cursor ring/dot + `targets` hover (≈ 540-571) | SiteShell |
| Smooth-scroll de anclas `a[href^="#"]` (≈ 410-422) | SiteShell |
| Entradas del hero (`.hero-copy-stable`, `.hero-meta`, `.hero-deco`, `.scroll-indicator`) (≈ 176-216) | ZakumiHome |
| Marquee (≈ 218-244) | ZakumiHome |
| Reveals de sección (`.section-num, .section-title, ...`) (≈ 251-270) | ZakumiHome |
| Stats tiles + contadores (≈ 288-370) | ZakumiHome |
| Filosofía por palabras (≈ 372-408) | ZakumiHome |
| CRM cards + contador + tecnologías (≈ 433-490) | ZakumiHome |
| Demo del agente (≈ 492-518) | ZakumiHome |
| **`.service` cards (≈ 272-285)** | **BORRAR** (la sección se elimina) |

- [ ] **Step 1: Crear `SiteShell.tsx`**

```tsx
"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, TELEGRAM_ENABLED, TELEGRAM_URL } from "@/components/zakumi/contact";
import { SERVICIOS, SERVICE_SLUGS } from "@/components/zakumi/services";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const TWEAK_DEFAULTS = { heroSize: 8.5, bgMode: "full" as const, accent: "#DB5227" };

const NAV_ITEMS = [
  ...SERVICE_SLUGS.map((s) => ({ href: `/${s}`, label: SERVICIOS[s].nav })),
  { href: "/contacto", label: "Contacto" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [menuOpen, setMenuOpen] = React.useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // useEffect de --hero-size/--orange/bg-* (mover desde ZakumiLanding ≈ 49-77).
  // useEffect del menú móvil (mover ≈ 79-95).
  // useLayoutEffect con gsap.context: cortina (SOLO si isHome), barra de progreso,
  //   cursor, smooth-scroll de anclas. (mover los bloques globales señalados).
  // En cambio de ruta: requestAnimationFrame(() => ScrollTrigger.refresh()).

  return (
    <>
      <div className="bg-base bg-full" id="bg" />
      <div className="grain" />

      {isHome && (
        <div className="curtain" id="curtain">
          <div className="curtain-panel" id="curtain-panel" />
          <div className="curtain-inner"><span>ZAKUMI</span><span className="dot" /><span>ESTUDIO</span></div>
          <div className="curtain-label">CARGANDO · MMXXVI</div>
          <div className="curtain-counter" id="curtain-counter">00</div>
        </div>
      )}

      <div className="scroll-progress"><div className="fill" id="scroll-fill" /></div>

      <div id="app">
        <div className="cursor-ring" ref={ringRef} />
        <div className="cursor-dot" ref={dotRef} />

        <nav className={menuOpen ? "nav-menu-open" : undefined}>
          <div className="nav-logo">
            <Link href="/">ZAKUMI<span style={{ color: "var(--orange)" }}>.</span></Link>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </div>
          <button type="button" className={`nav-toggle${menuOpen ? " is-open" : ""}`}
            aria-expanded={menuOpen} aria-controls="zakumi-mobile-nav" onClick={() => setMenuOpen((o) => !o)}>
            <span className="sr-only">{menuOpen ? "Cerrar menú" : "Abrir menú"}</span>
            <span className="nav-toggle-bars" aria-hidden><span /><span /><span /></span>
          </button>
        </nav>

        <div id="zakumi-mobile-nav" className={`nav-overlay${menuOpen ? " is-open" : ""}`} aria-hidden={!menuOpen}>
          <div className="nav-overlay-backdrop" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="nav-overlay-panel">
            <div className="nav-overlay-heading">Navegación</div>
            {NAV_ITEMS.map(({ href, label }) => (
              <Link key={`m-${href}`} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>
            ))}
          </div>
        </div>

        {children}

        <footer>
          <div>© 2026 ZAKUMI Studio · Colombia</div>
          <a className="footer-social" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
            aria-label={`Síguenos en Instagram — @${INSTAGRAM_HANDLE}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            <span className="footer-handle">@{INSTAGRAM_HANDLE}</span>
          </a>
          <div>IA · Software · Marca</div>
        </footer>
      </div>
    </>
  );
}
```

> Mover los cuerpos de los `useEffect`/`useLayoutEffect` globales **verbatim** desde `ZakumiLanding.tsx` (ver tabla). La cortina debe quedar dentro de `if (isHome) { ... }`. Usar `gsap.context(..., )` y `return () => ctx.revert();`.

- [ ] **Step 2: Crear `ZakumiHome.tsx`**

```tsx
"use client";

import React, { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Hero } from "./sections/Hero";
import { CrmIA } from "./sections/CrmIA";
import { AgentDemo } from "./sections/AgentDemo";
import { ComoTrabajamos } from "./sections/ComoTrabajamos";
import { Filosofia } from "./sections/Filosofia";
import { Proyectos } from "./sections/Proyectos";

gsap.registerPlugin(ScrollTrigger);

export function ZakumiHome() {
  const philosophyLine1 = "IA con criterio humano:".split(" ");
  const philosophyLine2 = ["diseño", "y", "código", "bajo", "el", "mismo"];
  const philosophyEm = ["techo."];
  const philosophyLine3 = ["Sin", "intermediarios."];

  // useLayoutEffect con gsap.context: mover TODOS los bloques de sección señalados
  // en la tabla (hero entrance, marquee, reveals, stats, filosofía, CRM, tecnologías,
  // demo agente). NO incluir el bloque de .service (borrado). Terminar con
  // ScrollTrigger.refresh() y return () => ctx.revert().

  return (
    <>
      <Hero />
      <div className="marquee">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <div className="marquee-item" key={k}>
              <span>Identidad</span><span className="star">✦</span>
              <span>Estrategia</span><span className="star">✦</span>
              <span>Software a medida</span><span className="star">✦</span>
              <span>Producto digital</span><span className="star">✦</span>
              <span>Diseño editorial</span><span className="star">✦</span>
              <span>Sistemas de marca</span><span className="star">✦</span>
            </div>
          ))}
        </div>
      </div>
      <CrmIA />
      <AgentDemo />
      <Proyectos />
      <ComoTrabajamos />
      <Filosofia line1={philosophyLine1} line2={philosophyLine2} em={philosophyEm} line3={philosophyLine3} />
    </>
  );
}
```

- [ ] **Step 3: Cablear `layout.tsx` y `page.tsx`**

En `src/app/layout.tsx`, importar y envolver:

```tsx
import { SiteShell } from "@/components/site/SiteShell";
// ...
      <body className="min-h-full antialiased">
        <JsonLd />
        <SiteShell>{children}</SiteShell>
      </body>
```

`src/app/page.tsx`:

```tsx
import { ZakumiHome } from "@/components/zakumi/ZakumiHome";

export default function Home() {
  return <ZakumiHome />;
}
```

- [ ] **Step 4: Borrar archivos huérfanos**

```bash
git rm src/components/zakumi/ZakumiLanding.tsx src/components/zakumi/sections/Servicios.tsx
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores. (Si `PILARES` queda sin uso, no rompe; se elimina en Task 6.)

- [ ] **Step 6: Verificar en navegador**

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
"$B" goto http://localhost:3000 && "$B" js "new Promise(r=>setTimeout(()=>r(1),5200))"
"$B" js "({curtain: !!document.querySelector('#curtain'), nav: [...document.querySelectorAll('.nav-links a')].map(a=>a.textContent), footer: !!document.querySelector('footer'), servicios: !!document.querySelector('#servicios')})"
"$B" screenshot /tmp/zk-home-refactor.png
```
Expected: `curtain:true`, `nav:["Agentes IA","Software","Marca","Contacto"]`, `footer:true`, `servicios:false`. Hero, marquee, CRM, demo, proyectos, cómo, filosofía visibles con sus animaciones. Cursor y barra de progreso funcionando. Leer el PNG para confirmar visualmente.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(home): SiteShell (chrome global) + ZakumiHome; quitar sección Servicios"
```

---

## Task 3: Ruta `/contacto`

**Files:**
- Create: `src/components/zakumi/sections/ContactoView.tsx`, `src/app/contacto/page.tsx`
- Delete: `src/components/zakumi/sections/Contacto.tsx` (su contenido se reparte: outro → ContactoView, footer → ya está en SiteShell)

**Interfaces:**
- Consumes: `CONTACTO` de `content.ts`; `EMAIL`, `WHATSAPP_URL`, `TELEGRAM_ENABLED`, `TELEGRAM_URL` de `contact.ts`.
- Produces: `export function ContactoView()`.

- [ ] **Step 1: Crear `ContactoView.tsx`**

Copiar el `<section className="outro" id="contacto">…</section>` de `Contacto.tsx` (líneas 14-60) dentro de un componente `ContactoView` (client, con `"use client"`). **No** incluir el `<footer>` (ya vive en SiteShell). Mantener los CTAs (WhatsApp con ícono, email, Telegram condicional).

```tsx
"use client";
import { EMAIL, WHATSAPP_URL, TELEGRAM_ENABLED, TELEGRAM_URL } from "../contact";
import { CONTACTO } from "../content";

export function ContactoView() {
  return (
    <section className="outro" id="contacto">
      {/* …mismo markup del outro actual (h2 + .right con CTAs)… */}
    </section>
  );
}
```

- [ ] **Step 2: Crear `src/app/contacto/page.tsx`**

```tsx
import type { Metadata } from "next";
import { ContactoView } from "@/components/zakumi/sections/ContactoView";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Habla con nuestro agente de IA por WhatsApp o escríbenos. Estudio de marca, agentes de IA y software a medida en Colombia.",
  alternates: { canonical: "/contacto" },
};

export default function ContactoPage() {
  return <ContactoView />;
}
```

- [ ] **Step 3: Borrar `Contacto.tsx`**

```bash
git rm src/components/zakumi/sections/Contacto.tsx
```

- [ ] **Step 4: Build + navegador**

Run: `npx tsc --noEmit && npm run build`
```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
"$B" goto http://localhost:3000/contacto && "$B" js "new Promise(r=>setTimeout(()=>r(1),1200))"
"$B" js "({h2: !!document.querySelector('.outro h2'), wa: !!document.querySelector('a[href*=\"wa.me\"]'), footer: !!document.querySelector('footer'), curtain: !!document.querySelector('#curtain')})"
```
Expected: `h2:true`, `wa:true`, `footer:true`, `curtain:false` (no cortina fuera de home).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(contacto): vista /contacto independiente"
```

---

## Task 4: Plantilla `ServicePage` + estilos

**Files:**
- Create: `src/components/zakumi/sections/ServicePage.tsx`
- Modify: `src/styles/zakumi-design.css`

**Interfaces:**
- Consumes: `Service` de `services.ts`; `waLink` de `contact.ts`.
- Produces: `export function ServicePage({ data }: { data: Service })`.

- [ ] **Step 1: Crear `ServicePage.tsx`**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { waLink } from "../contact";
import type { Service } from "../services";

gsap.registerPlugin(ScrollTrigger);

export function ServicePage({ data }: { data: Service }) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // Reveal editorial: por cada sección .reveal, sus .reveal-item entran escalonados (stagger).
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((section) => {
        const items = section.querySelectorAll<HTMLElement>(".reveal-item");
        gsap.from(items.length ? items : [section], {
          opacity: 0, y: 30, duration: 0.7, ease: "power3.out", stagger: 0.08,
          scrollTrigger: { trigger: section, start: "top 82%", once: true },
        });
      });
    }, root);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  const isWa = data.ctaTipo === "whatsapp" && !!data.waMsg;

  return (
    <main className="service-view" ref={root}>
      {/* Intro asimétrica, mismo lenguaje del hero */}
      <section className="service-intro reveal">
        <div className="service-intro-text">
          <div className="hero-tag reveal-item"><span className="line" /><span className="dot" /><span>{data.tag}</span></div>
          <h1 className="reveal-item"><span>{data.titulo1}</span><br /><em style={{ fontStyle: "italic", color: "var(--orange)" }}>{data.tituloEm}</em></h1>
          <p className="service-lead reveal-item">{data.intro}</p>
          <div className="reveal-item">
            {isWa ? (
              <a className="cta" style={{ opacity: 1 }} href={waLink(data.waMsg!)} target="_blank" rel="noopener noreferrer">
                <span>Habla con nuestro agente</span><span className="arrow">→</span>
              </a>
            ) : (
              <Link className="cta" style={{ opacity: 1 }} href="/contacto"><span>Solicitar cotización</span><span className="arrow">→</span></Link>
            )}
          </div>
        </div>
        <figure className="service-intro-visual reveal-item">
          <Image src={data.heroImg} alt="" fill sizes="(max-width: 900px) 100vw, 46vw" style={{ objectFit: "cover" }} priority />
        </figure>
      </section>

      {/* Lo que incluye — filas editoriales con índice (counter) + hairline, NO tarjetas */}
      <section className="service-block service-incluye reveal">
        <header className="block-head reveal-item"><span className="section-num">Lo que incluye</span></header>
        <ul className="incluye-list">
          {data.incluye.map((c) => (
            <li className="incluye-row reveal-item" key={c.titulo}>
              <h3>{c.titulo}</h3>
              <p>{c.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Ejemplos — imagen con zoom en hover + motivo ↗ */}
      <section className="service-block service-ejemplos reveal">
        <header className="block-head reveal-item"><span className="section-num">Ejemplos</span></header>
        <div className="ejemplos-grid">
          {data.ejemplos.map((e) => (
            <article className="ejemplo-card reveal-item" key={e.titulo}>
              {e.img && (
                <div className="ejemplo-img">
                  <Image src={e.img} alt="" fill sizes="(max-width: 900px) 100vw, 32vw" style={{ objectFit: "cover" }} />
                </div>
              )}
              <h3>{e.titulo} <span className="ejemplo-arrow" aria-hidden>↗</span></h3>
              <p>{e.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Testimonios — citas editoriales en Playfair */}
      <section className="service-block service-testimonios reveal">
        <header className="block-head reveal-item"><span className="section-num">Lo que dicen</span></header>
        <div className="testimonios-grid">
          {data.testimonios.map((t) => (
            <blockquote className="testimonio reveal-item" key={t.autor}>
              <p>“{t.quote}”</p>
              <footer><span className="t-autor">{t.autor}</span> · {t.rol}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Planes — sin cifras; el del medio destacado en naranja (guiño al pilar Marca) */}
      <section className="service-block service-planes reveal">
        <header className="block-head reveal-item"><span className="section-num">Planes</span></header>
        <div className="planes-grid">
          {data.planes.map((p, i) => (
            <div className={`plan-card reveal-item${i === 1 ? " plan-featured" : ""}`} key={p.nombre}>
              <h3>{p.nombre}</h3>
              <p className="plan-tagline">{p.tagline}</p>
              <ul>{p.incluye.map((it) => <li key={it}>{it}</li>)}</ul>
              <Link className={`cta${i === 1 ? "" : " cta-ghost"}`} href="/contacto" style={{ opacity: 1 }}><span>Solicitar cotización</span><span className="arrow">→</span></Link>
            </div>
          ))}
        </div>
        <p className="planes-nota reveal-item">Cotizamos por proyecto o por mes según tu alcance. Trabajamos con presupuestos pensados para el mercado colombiano — escríbenos y armamos una propuesta a tu medida.</p>
      </section>

      {/* Cierre → /contacto */}
      <section className="service-cierre reveal">
        <h2 className="reveal-item">¿Lo armamos para tu negocio?</h2>
        <div className="reveal-item"><Link className="cta" href="/contacto" style={{ opacity: 1 }}><span>Hablemos</span><span className="arrow">→</span></Link></div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Añadir estilos en `zakumi-design.css`**

Añadir un bloque `/* ——— ServicePage ——— */` siguiendo las **Design & Animation Guidelines**:
editorial, no "card grid". `.incluye` son **filas con índice (counter) + hairline** (no tarjetas);
ejemplos con **zoom de imagen en hover** y motivo `↗`; testimonios como **citas en Playfair**;
planes con el **del medio destacado en naranja** (guiño al pilar Marca). Solo tokens existentes.

```css
  /* ——— ServicePage (lenguaje editorial del sitio) ——— */
  .service-view { padding-top: 9rem; }

  /* Intro asimétrica, como el hero */
  .service-intro {
    display: grid; grid-template-columns: 1.05fr 0.95fr; gap: clamp(2rem, 4vw, 4.5rem);
    align-items: center; padding: 1rem 4vw 5rem;
  }
  .service-intro h1 {
    font-family: var(--font-playfair), serif; font-weight: 400;
    font-size: clamp(2.6rem, 4.6vw, 4.6rem); line-height: 1.03; letter-spacing: -0.02em;
    color: var(--paper); margin: 0.8rem 0 1.4rem;
  }
  .service-lead {
    font-size: clamp(1.05rem, 1.5vw, 1.35rem); line-height: 1.6; color: var(--slate);
    max-width: 52ch; margin-bottom: 2.2rem;
  }
  .service-intro-visual {
    position: relative; aspect-ratio: 4/3; overflow: hidden;
    border-left: 1px solid rgba(118,130,142,0.18);
  }
  .service-intro-visual::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(10,12,18,0) 40%, rgba(10,12,18,0.55) 100%);
  }

  /* Bloques con divisor hairline editorial */
  .service-block { padding: clamp(3rem, 6vw, 6rem) 4vw; max-width: 1320px; border-top: 1px solid rgba(118,130,142,0.16); }
  .block-head { margin-bottom: clamp(1.5rem, 3vw, 3rem); }

  /* Lo que incluye — filas con índice (counter), sin tarjetas */
  .incluye-list { list-style: none; margin: 0; padding: 0; counter-reset: inc; }
  .incluye-row {
    counter-increment: inc; display: grid; grid-template-columns: 3rem minmax(0, 20ch) 1fr;
    gap: 1.5rem; align-items: baseline; padding: 1.6rem 0; border-top: 1px solid rgba(118,130,142,0.16);
  }
  .incluye-row:first-child { border-top: none; }
  .incluye-row::before {
    content: counter(inc, decimal-leading-zero); color: var(--orange);
    font-family: var(--font-playfair), serif; font-size: 1rem;
  }
  .incluye-row h3 { font-family: var(--font-playfair), serif; font-weight: 400; font-size: clamp(1.2rem, 1.8vw, 1.7rem); color: var(--paper); }
  .incluye-row p { color: var(--slate); line-height: 1.55; max-width: 52ch; }

  /* Ejemplos — imagen con zoom en hover + ↗ */
  .ejemplos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(1.25rem, 2.5vw, 2.5rem); }
  .ejemplo-img { position: relative; aspect-ratio: 16/11; overflow: hidden; }
  .ejemplo-img img { transition: transform 0.7s cubic-bezier(0.2,0.8,0.2,1); }
  .ejemplo-card:hover .ejemplo-img img { transform: scale(1.06); }
  .ejemplo-card h3 { font-family: var(--font-playfair), serif; font-weight: 400; font-size: 1.4rem; color: var(--paper); margin: 1rem 0 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
  .ejemplo-card p { color: var(--slate); line-height: 1.55; }
  .ejemplo-arrow { color: var(--orange); transition: transform 0.3s ease; }
  .ejemplo-card:hover .ejemplo-arrow { transform: translate(3px, -3px); }

  /* Testimonios — citas editoriales */
  .testimonios-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: clamp(2rem, 4vw, 4rem); }
  .testimonio p { font-family: var(--font-playfair), serif; font-style: italic; font-size: clamp(1.3rem, 2vw, 1.7rem); line-height: 1.45; color: var(--paper); }
  .testimonio footer { margin-top: 1.25rem; color: var(--slate); font-size: 0.8rem; letter-spacing: 0.18em; text-transform: uppercase; }
  .testimonio .t-autor { color: var(--paper); }

  /* Planes — el del medio destacado en naranja */
  .planes-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(1rem, 2vw, 1.75rem); align-items: start; }
  .plan-card { border: 1px solid rgba(118,130,142,0.18); padding: clamp(1.75rem, 2.5vw, 2.5rem); display: flex; flex-direction: column; gap: 1rem; }
  .plan-card h3 { font-family: var(--font-playfair), serif; font-weight: 400; font-size: 1.6rem; color: var(--paper); }
  .plan-tagline { color: var(--orange); font-style: italic; font-family: var(--font-playfair), serif; }
  .plan-card ul { list-style: none; padding: 0; margin: 0.5rem 0 1.5rem; display: grid; gap: 0.6rem; color: var(--slate); flex: 1; }
  .plan-card li { padding-left: 1.25rem; position: relative; }
  .plan-card li::before { content: '—'; position: absolute; left: 0; color: var(--orange); }
  .plan-featured { background: var(--orange); border-color: var(--orange); }
  .plan-featured h3, .plan-featured .plan-tagline, .plan-featured ul, .plan-featured li { color: var(--black); }
  .plan-featured .plan-tagline { opacity: 0.8; }
  .plan-featured li::before { color: var(--black); }
  .planes-nota { margin-top: 2.5rem; color: var(--slate); max-width: 64ch; line-height: 1.6; }

  /* Cierre */
  .service-cierre { padding: clamp(4rem, 8vw, 7rem) 4vw; border-top: 1px solid rgba(118,130,142,0.16); }
  .service-cierre h2 { font-family: var(--font-playfair), serif; font-weight: 400; font-size: clamp(2.2rem, 4vw, 3.6rem); color: var(--paper); margin-bottom: 1.75rem; max-width: 16ch; }

  @media (max-width: 900px) {
    .ejemplos-grid { grid-template-columns: 1fr 1fr; }
    .testimonios-grid, .planes-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .service-view { padding-top: 6.5rem; }
    .service-intro { grid-template-columns: 1fr; }
    .ejemplos-grid { grid-template-columns: 1fr; }
    .incluye-row { grid-template-columns: 2rem 1fr; }
    .incluye-row p { grid-column: 2 / -1; }
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores. (Aún no hay ruta que lo use; se prueba en Task 5.)

- [ ] **Step 4: Commit**

```bash
git add src/components/zakumi/sections/ServicePage.tsx src/styles/zakumi-design.css
git commit -m "feat(servicios): plantilla ServicePage + estilos"
```

---

## Task 5: Rutas de servicio (`/agentes-ia`, `/software`, `/marca`)

**Files:**
- Create: `src/app/agentes-ia/page.tsx`, `src/app/software/page.tsx`, `src/app/marca/page.tsx`

**Interfaces:**
- Consumes: `SERVICIOS` de `services.ts`; `ServicePage` de `sections/ServicePage`.

- [ ] **Step 1: Crear las 3 `page.tsx`**

`src/app/agentes-ia/page.tsx` (las otras dos idénticas cambiando el slug):

```tsx
import type { Metadata } from "next";
import { ServicePage } from "@/components/zakumi/sections/ServicePage";
import { SERVICIOS } from "@/components/zakumi/services";

const data = SERVICIOS["agentes-ia"];

export const metadata: Metadata = {
  title: data.seo.title,
  description: data.seo.description,
  alternates: { canonical: "/agentes-ia" },
};

export default function Page() {
  return <ServicePage data={data} />;
}
```

`software/page.tsx`: `SERVICIOS["software"]`, canonical `/software`.
`marca/page.tsx`: `SERVICIOS["marca"]`, canonical `/marca`.

- [ ] **Step 2: Build**

Run: `npx tsc --noEmit && npm run build`
Expected: build con 5 rutas estáticas (`/`, `/agentes-ia`, `/software`, `/marca`, `/contacto`).

- [ ] **Step 3: Verificar en navegador las 3 rutas**

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
for r in agentes-ia software marca; do
  "$B" goto "http://localhost:3000/$r" && "$B" js "new Promise(res=>setTimeout(()=>res(1),1200))"
  "$B" js "({path: location.pathname, h1: document.querySelector('.service-intro h1')?.innerText, incluye: document.querySelectorAll('.incluye-card').length, planes: document.querySelectorAll('.plan-card').length, cierreLink: document.querySelector('.service-cierre a')?.getAttribute('href')})"
  "$B" screenshot "/tmp/zk-$r.png"
done
```
Expected por ruta: `h1` correcto, `incluye>=4`, `planes>=3`, `cierreLink:"/contacto"`. Leer los 3 PNG. En `/agentes-ia` el CTA del intro debe ir a `wa.me`.

- [ ] **Step 4: Commit**

```bash
git add src/app/agentes-ia src/app/software src/app/marca
git commit -m "feat(servicios): rutas /agentes-ia, /software, /marca"
```

---

## Task 6: Wiring del hero + limpieza de PILARES

**Files:**
- Modify: `src/components/zakumi/content.ts`, `src/components/zakumi/sections/Hero.tsx`, `src/components/zakumi/__tests__/content.test.ts`, `src/styles/zakumi-design.css`

**Interfaces:**
- Consumes: `SERVICE_SLUGS` (para validar hrefs en test).
- Produces: `HeroSlide.href: string`.

- [ ] **Step 1: Actualizar el test de content (quitar PILARES, exigir href en slides)**

En `src/components/zakumi/__tests__/content.test.ts`: quitar `PILARES` del import y la aserción `expect(PILARES).toHaveLength(3)` (dejar `STATS` toHaveLength 4). Añadir:

```ts
import { HERO_SLIDES } from "../content";
it("cada slide del hero enlaza a una ruta de servicio", () => {
  expect(HERO_SLIDES.map((s) => s.href)).toEqual(["/agentes-ia", "/software", "/marca"]);
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test -- content`
Expected: FAIL (`href` no existe en HERO_SLIDES).

- [ ] **Step 3: Añadir `href` a `HeroSlide` y a los 3 slides; eliminar `PILARES`**

En `content.ts`: añadir `href: string;` al type `HeroSlide` y `href: "/agentes-ia"` / `"/software"` / `"/marca"` a cada slide respectivamente. Eliminar el `export const PILARES` y su type `Pilar` (ya no se usa).

- [ ] **Step 4: Hero CTA → Link**

En `Hero.tsx`: `import Link from "next/link";`. Reemplazar el `<a className="cta" href={waLink(slide.waMsg)} …>` del slide por:

```tsx
<Link className="cta" href={slide.href} style={{ opacity: 1 }} aria-label={`${slide.cta} — ${slide.tag}`}>
  <span>{slide.cta}</span><span className="arrow">→</span>
</Link>
```
(Quitar el import de `waLink`/`TELEGRAM_*` si dejan de usarse en Hero.)

- [ ] **Step 5: Quitar CSS de `.service`/`.services` (grid de pilares)**

En `zakumi-design.css`, eliminar las reglas de `.services`, `.service`, `.service-arrow`, `.service-num`, `.service-meta`, `.zakumi-servicios-section`, `.servicios-head*`, `.servicios-lead`, `.servicios-tags`, `.servicios-visual*` (la sección ya no existe). **No** tocar las nuevas `.service-view`/`.service-block`/etc.

- [ ] **Step 6: Tests + build + navegador**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: tests PASS, build OK.
```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
"$B" goto http://localhost:3000 && "$B" js "new Promise(r=>setTimeout(()=>r(1),5200))"
"$B" js "[...document.querySelectorAll('.hero-ctas a')].map(a=>({t:a.textContent,href:a.getAttribute('href')}))"
```
Expected: el CTA del slide activo apunta a `/agentes-ia` (no a `wa.me`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(hero): CTAs enlazan a las vistas de servicio; eliminar PILARES y CSS de pilares"
```

---

## Task 7: SEO (sitemap + JSON-LD)

**Files:**
- Modify: `src/app/sitemap.ts`, `src/components/site/JsonLd.tsx`
- Test: `src/components/zakumi/__tests__/services.test.ts` (extender) o nuevo `sitemap` check vía build.

**Interfaces:**
- Consumes: `SERVICE_SLUGS` de `services.ts`.

- [ ] **Step 1: `sitemap.ts` con 5 URLs**

```ts
import type { MetadataRoute } from "next";
import { SERVICE_SLUGS } from "@/components/zakumi/services";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = ["", ...SERVICE_SLUGS.map((s) => `/${s}`), "/contacto"];
  return paths.map((p) => ({
    url: `${siteUrl}${p}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.8,
  }));
}
```

- [ ] **Step 2: JSON-LD `Service` (3 entidades)**

En `JsonLd.tsx`, añadir un `Service` por cada servicio (nombre, descripción de `seo.description`, `provider` = la Organization, `areaServed` = "CO", `url` = `${siteUrl}/${slug}`). Mantener Organization + WebSite. Importar `SERVICIOS`/`SERVICE_SLUGS`.

- [ ] **Step 3: Build + verificar**

Run: `npm run build`
```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"
"$B" goto http://localhost:3000/sitemap.xml && "$B" js "document.body.innerText.match(/<loc>/g)?.length"
"$B" goto http://localhost:3000/agentes-ia && "$B" js "[...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s=>s.textContent.includes('Service'))"
```
Expected: 5 `<loc>` en el sitemap; JSON-LD con `Service` presente.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(seo): sitemap con 5 rutas + JSON-LD de servicios"
```

---

## Self-Review (cobertura del spec)

- Eliminar Servicios de la home → Task 2 ✓
- 4 rutas top-level → Tasks 3, 5 ✓
- Plantilla con intro/incluye/ejemplos/testimonios/planes/CTA → Task 4 ✓
- Precios sin cifras + framing Colombia → Task 1 (planes) + Task 4 (`.planes-nota`) ✓
- Testimonios placeholder marcados → Task 1 (`placeholder:true` + `// TODO`) ✓
- Nav a rutas + logo→home + footer global → Task 2 ✓
- Hero CTA → vista; bot WhatsApp en /agentes-ia → Task 6 + Task 4 ✓
- Cortina solo en `/` → Task 2 (`isHome`) ✓
- SEO por página + sitemap + JSON-LD → Tasks 3, 5, 7 ✓
- No "stack", es-CO → Task 1 test ✓
- Reparto GSAP global/sección → Task 2 (tabla) ✓
