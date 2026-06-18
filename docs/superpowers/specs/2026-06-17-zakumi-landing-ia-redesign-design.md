# Rediseño de la landing de Zakumi — AI-first (Enfoque B)

**Fecha:** 2026-06-17
**Estado:** Aprobado el diseño · pendiente revisión del spec por el usuario
**Tipo:** Reposicionamiento de mensaje + nuevas secciones + animaciones GSAP (no es un sitio nuevo)

---

## 1. Contexto y objetivo

La landing actual posiciona a Zakumi como **"estudio de marca & software"** (titular: *"Creamos marcas. Desarrollamos el futuro."*), con 2 servicios: identidad de marca y software a medida. Vive en un solo componente cliente: `src/components/zakumi/ZakumiLanding.tsx` (~1175 líneas), estilos en `src/styles/zakumi-design.css`, SEO en `src/components/site/JsonLd.tsx` y `src/app/layout.tsx`.

**Objetivo:** reposicionar a Zakumi como un **estudio AI-first** cuyo producto protagonista son los **agentes de IA de venta/atención** (WhatsApp/Telegram/redes), respaldado por **software serio** (CRM con IA multimodelo, plataformas grandes y sostenibles) y servicios de **marca y contenido**. El visitante debe poder **hablar con un agente de IA real** (demo en vivo del producto) como conversión principal.

**Qué NO es:** no es un rediseño visual desde cero. La piel se conserva.

## 2. Decisiones tomadas (brainstorming)

| Decisión | Resultado |
|---|---|
| Posicionamiento | **IA como protagonista**; marca/web/software como soporte |
| CTA principal | **Demo en vivo**: el botón lleva a un agente de IA real en WhatsApp |
| Servicios | 3 pilares: **IA & Automatización**, **Software & Plataformas**, **Marca & Contenido** |
| Estructura narrativa | **Enfoque B** — "Estudio de IA & software" (equilibrado, con credibilidad técnica) |
| Hero | Titular: ***Tu mejor vendedor es inteligencia artificial.*** |
| Canal de contacto | **WhatsApp principal**; **Telegram preparado pero apagado** (flag) hasta que exista |
| Proyectos | **Placeholders elegantes** por ahora |

## 3. Reglas globales (aplican a todo)

1. **Idioma:** 100% español (es-CO). Si algún día se traduce, **todo** pasa a inglés; nunca mezclar.
2. **Prohibido la palabra "stack".** Usar *"tecnología", "herramientas", "con qué construimos"*.
3. **Estética conservada:** paleta negro carbón / naranja, tipografías Playfair Display + Inter, cortina inicial, cursor personalizado, marquee, GSAP + ScrollTrigger. Variables CSS y `--hero-size` (solo ≥721px) intactas.
4. **Accesibilidad:** toda animación nueva respeta `prefers-reduced-motion` (cae a estado final estático). Enlaces externos con `rel="noopener noreferrer"`. CTAs con `aria-label`.
5. **Mercado:** Colombia, dominio `zakumistudio.com`, `NEXT_PUBLIC_SITE_URL`.

## 4. Arquitectura de información (orden de secciones)

Navegación → anclas: `Agentes`→`#demo-agente` · `Servicios`→`#servicios` · `CRM`→`#crm` · `Proyectos`→`#proyectos` · `Contacto`→`#contacto`.

1. **Hero** (`#hero`) — agente como héroe + CTA demo
2. **Servicios** — 3 pilares
3. **CRM con IA** — sección producto destacada
4. **Demo del agente** — chat animado (pieza estrella)
5. **Proyectos + "Con qué construimos"** — showcase + tecnologías
6. **Cómo trabajamos** — stats (se mantiene, copy actualizado)
7. **Filosofía** — se mantiene, copy ajustado
8. **Contacto + Footer**

## 5. Diseño por sección

### ① Hero
- **Tag:** "Agentes de IA para WhatsApp & Telegram" (describe el servicio; válido aunque el Telegram propio aún no exista).
- **Titular:** *Tu mejor vendedor* / *es inteligencia artificial.* ("inteligencia artificial" en cursiva Playfair, naranja).
- **Subtítulo:** "Y detrás, software de verdad: CRM con IA, plataformas que escalan y tecnología bien construida."
- **CTA primario:** "Habla con nuestro agente →" → `WHATSAPP_URL`. **CTA secundario (Telegram):** renderizado solo si `TELEGRAM_ENABLED`.
- **GSAP:** cortina + counter (existente) → titular palabra por palabra (reutiliza patrón `.phil-word`) → **burbuja de chat flotante** sobre el carrusel que "escribe" (typing dots) un mensaje de ejemplo en loop sutil.
- **Imagen:** ver §7 — Hero (4:5 vertical).

### ② Servicios — 3 pilares (reemplaza "01 / Servicios")
- **IA & Automatización:** agentes de venta/atención 24/7 en WhatsApp/Telegram, automatización e integraciones (CRM, n8n, APIs).
- **Software & Plataformas:** plataformas grandes y sostenibles, web y apps a medida, bases de datos serias. Construido con Next.js, React, Postgres, TypeScript.
- **Marca & Contenido:** identidad visual, manejo de redes y creación de contenido.
- Cada pilar: número romano, título, descripción, 3–4 etiquetas, flecha ↗.
- **GSAP:** entrada en *stagger* al hacer scroll; leve *tilt*/elevación en hover.

### ③ CRM con IA (sección producto destacada, acento naranja)
- **Titular:** *Un CRM que piensa.*
- **Copy:** "Anthropic, Gemini y OpenAI trabajando para tu equipo de ventas — cada modelo en lo que mejor hace." Clasifica leads, responde, resume conversaciones, agenda y escala a humano cuando hay intención real.
- **GSAP:** mockup de panel construido en código que se **ensambla** al entrar (tarjetas que llegan y encajan) + contador "leads atendidos".
- **Imagen:** ver §7 — CRM (16:10).

### ④ Demo del agente (pieza estrella — construida en código, sin imagen)
- Ventana de chat estilo WhatsApp: un cliente pregunta, el agente responde y **cierra una venta**.
- **GSAP:** timeline secuencial de mensajes (typing dots → mensaje), disparado por ScrollTrigger al entrar; loop sutil opcional.
- **CTA:** "Pruébalo tú mismo →" → `WHATSAPP_URL` (mismo agente real).

### ⑤ Proyectos + "Con qué construimos" (reemplaza "02 / Selección")
- Showcase de proyectos (placeholders elegantes), cada uno etiquetado por rol: plataforma / CRM / agente / web.
- Bloque **"Con qué construimos"**: Next.js · React · Postgres · TypeScript · Tailwind · GSAP · Anthropic · Gemini · OpenAI, como **marquee** horizontal infinito.
- **GSAP:** marquee infinito + reveal de proyectos al scroll.
- **Imagen:** ver §7 — Proyectos (3:2), reemplazables.

### ⑥ Cómo trabajamos (stats — se mantiene)
- Stats actualizados: "3 disciplinas, un equipo" · "24/7 — tus agentes no duermen" · "Multi-modelo de IA" · "Hecho por nosotros, no plantillas".
- **GSAP:** contadores animados (existente).

### ⑦ Filosofía (se mantiene, copy ajustado)
Mantiene el bloque de palabras animadas; texto ajustado a "IA con criterio humano: diseño y código bajo el mismo techo".

### ⑧ Contacto + Footer
- **Titular/Copy:** "Habla con nuestro agente ahora — es el mismo que pondríamos a trabajar para ti."
- CTAs: **WhatsApp** (agente en vivo) · email · **Telegram** (solo si `TELEGRAM_ENABLED`).
- Footer: ya incluye Instagram (`@zakumiestudio`); se añadirá Telegram cuando se active.

## 6. Estrategia técnica

- **Modularización (mejora dirigida):** `ZakumiLanding.tsx` ya es grande (~1175 líneas) y vamos a añadir ~3 secciones con timelines GSAP propios. Extraer las secciones a componentes en `src/components/zakumi/sections/` (`Hero.tsx`, `Servicios.tsx`, `CrmIA.tsx`, `AgentDemo.tsx`, `Proyectos.tsx`, `ComoTrabajamos.tsx`, `Filosofia.tsx`, `Contacto.tsx`), dejando `ZakumiLanding.tsx` como orquestador (estado global, cortina, cursor, registro de ScrollTrigger). Copys y constantes en un módulo `content.ts`; helpers GSAP en `src/components/zakumi/gsap/`. Objetivo: archivos enfocados, navegables y testeables.
- **Constantes de contacto:** `WHATSAPP_*` (existente), nuevas `TELEGRAM_URL` + `TELEGRAM_ENABLED = false`, `INSTAGRAM_*` (existente). El render de Telegram se condiciona a la flag.
- **GSAP:** usar la skill **`gsap-skills`** (`gsap-core`) durante la implementación para timelines/ScrollTrigger correctos. Centralizar el registro de plugins. Guardas de `prefers-reduced-motion`.
- **Next.js:** antes de escribir código, **leer las guías en `node_modules/next/dist/docs/`** (ver `AGENTS.md`: esta versión tiene cambios; no asumir APIs).
- **SEO:** ampliar `makesOffer` en `JsonLd.tsx` con los nuevos servicios (agentes de IA, CRM con IA); actualizar `keywords`/descripciones en `layout.tsx` hacia "agentes de IA WhatsApp Colombia", "automatización de ventas con IA", etc.
- **Imágenes:** se ubican en `/public/work/` (mismo patrón que `HERO_IMAGES`). El usuario las genera en otro modelo a partir de los prompts del §7.

## 7. Prompts de imágenes (el usuario las genera)

**Preámbulo de estilo (común a todas):** *Fondo negro carbón (#0e0f11), acentos naranja cálido (#ff6b35), estética editorial cinematográfica, grano de película sutil, alto contraste, iluminación cálida lateral, mucho espacio negativo, acabado premium, foto/render realista, sin texto superpuesto, contexto colombiano/latino.*

1. **Hero (4:5 vertical)** — *Retrato de una persona joven latina sonriendo mientras mira su celular con una conversación de WhatsApp visible en pantalla; luz naranja lateral, espacio negativo a la izquierda para el titular.*
2. **CRM con IA (16:10 horizontal)** — *Mockup de UI de un CRM oscuro y elegante con acentos naranja: tarjetas de leads con etiquetas "IA respondió", una gráfica de conversión, estilo dashboard premium tipo Linear/Vercel.*
3. **Proyectos (3:2, ×2–3, reemplazables)** — *Mockups de producto en dispositivos (laptop + móvil) mostrando UI real de una plataforma/CRM, composición editorial, reflejo naranja sutil sobre fondo negro.*
4. *(Opcional)* **Textura/agente (1:1)** — *Render abstracto de una red neuronal/nodos naranja sobre negro, sutil, para fondos de sección.*

> El **Demo del agente (§④)** y el mockup del **CRM en movimiento (§③)** se construyen en código con GSAP; las imágenes de arriba son apoyo, no la animación.

## 8. Supuestos y defaults

- WhatsApp: `+57 313 4276879` (sin cambios).
- Email: `zakumiestudio@gmail.com` (sin cambios).
- Telegram: aún no existe → infraestructura lista, render apagado.
- Proyectos: placeholders.
- Hero: imagen 4:5 vertical.

## 9. Fuera de alcance (YAGNI)

- Backend del agente / bot de WhatsApp (se asume desplegado por separado; aquí solo enlazamos).
- CMS, blog, multi-idioma activo, panel de administración.
- Rediseño de paleta/tipografía.
- Integración real de Telegram (solo se deja preparada).

## 10. Criterios de éxito

- El hero comunica "agentes de IA que venden" en <3 s y el CTA principal abre WhatsApp con el agente.
- Las 3 secciones nuevas (pilares, CRM, demo del agente) cargan con sus animaciones GSAP y degradan bien con `prefers-reduced-motion`.
- Todo el copy en español, sin la palabra "stack".
- `npx tsc --noEmit` y `next build` pasan sin errores.
- SEO/JSON-LD reflejan los nuevos servicios; el sitio sigue válido para Colombia (es-CO).
