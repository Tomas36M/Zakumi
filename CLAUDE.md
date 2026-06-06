@AGENTS.md

# Zakumi — contexto para sesiones Claude / Cursor

`AGENTS.md` contiene los avisos de Next.js.

## Qué es

- **ZAKUMI**: estudio boutique de **marca + software**, posicionamiento “Creamos marcas. Desarrollamos el futuro.”
- **Sede / mercado**: **Colombia** (copys y SEO orientados a `es-CO`; no México).
- Dominio público acordado: **`zakumistudio.com`** (`metadataBase` y JSON-LD usan `NEXT_PUBLIC_SITE_URL` o fallback ahí mismo).
- Contacto típico en la landing: `hola@zakumi.studio` (confirmar si pasa todo a `@zakumistudio.com`).

## Stack técnico

- **Next.js** (App Router) + **TypeScript** + **Tailwind v4**.
- Una sola página principal: **`src/app/page.tsx`** → **`src/components/zakumi/ZakumiLanding.tsx`** (componente cliente).
- Estilos canónicos del diseño histórico: **`src/styles/zakumi-design.css`** (no sustituir por “reinterpretaciones” si el cliente pide pixel-fiel al artefacto HTML).
- **GSAP** (ScrollTrigger, ScrollToPlugin): animaciones entrada, stats, filosofía por palabras, marquee, cursor, cortina inicial.
- **Fuentes**: `next/font` — Inter + Playfair Display (`layout.tsx`).

## Decisiones útiles para no romper cosas

- **`--hero-size`**: solo aplicar **≥721px**; en móvil se quita la variable JS para que el **clamp CSS** mande el tamaño del H1.
- Diseño artefacto “Zakumi Landing.html”: la API Anthropic suele responder 403; la fuente de verdad ha sido exports **standalone** cuando haga falta.
- **Menú móvil**: overlay + toggle; breakpoints alineados con el CSS (~720px).
- SEO: **`src/components/site/JsonLd.tsx`** (Organization + WebSite Colombia), metadata en **`layout.tsx`**.

## Repo y despliegue

- **GitHub**: `https://github.com/Tomas36M/Zakumi` (rama `main`).
- **Vercel** como hosting esperado; variable **`NEXT_PUBLIC_SITE_URL`** para URL canónica en producción.

## Memoria multi-sesión (opcional usuario)

Fuera del repo, si aplica tu flujo global: archivos en `~/memory/` (ver `CLAUDE.md` en home del usuario).
