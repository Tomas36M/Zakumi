# Zakumi — Servicios como vistas independientes (multi-página)

**Fecha:** 2026-06-18
**Rama:** `feat/landing-ia-redesign`
**Estado:** diseño aprobado en arquitectura y plantilla; pendiente revisión de copy.

## Objetivo

Pasar de una landing de una sola página a un sitio multi-página. La sección de
**3 pilares** (`Servicios.tsx`) se **elimina de la home** y cada servicio pasa a tener
su **propia vista** con toda la oferta: qué incluye, ejemplos, testimonios, planes
(sin cifras) y un cierre que lleva a una **vista de contacto** dedicada (`/contacto`).

El **hero (slider de 3 servicios) NO se toca** salvo el destino de su CTA.

## Decisiones (acordadas con el usuario)

1. **Landing:** se elimina la sección `Servicios` (grid de pilares) **sin reemplazo**
   (sin teaser). Los servicios se alcanzan por el menú (nav) y por el slider del hero.
2. **URLs top-level:** `/agentes-ia`, `/software`, `/marca`, `/contacto`.
3. **Precios:** **sin cifras**. Planes por alcance (ej. *Esencial · Crecimiento · A medida*)
   + CTA "Solicitar cotización". Framing accesible para PYMEs/emprendimientos colombianos.
4. **Testimonios:** placeholder realistas, **marcados en código** (`placeholder: true` +
   comentario `TODO`) para reemplazar luego. Sin badge visible en la UI.
5. **Nav:** `[Agentes IA · Software · Marca · Contacto]` (rutas). Logo → home.
   CRM y Proyectos salen del nav y quedan como secciones de la home.
6. **CTA del hero:** el CTA de cada slide lleva a su vista de servicio. En la vista de
   agentes, el botón de **WhatsApp con el bot en vivo** queda protagonista.
7. **Cortina de carga:** solo corre en `/` (home). Las vistas internas cargan sin cortina.

## Arquitectura

Hoy todo vive en `ZakumiLanding.tsx` (un client component) que mezcla el "chrome"
global (cortina, cursor, barra de progreso, fondo, grain, nav) con el GSAP de cada
sección. Se separa en:

### Componentes nuevos / refactor

- **`src/components/site/SiteShell.tsx`** (client) — chrome global, usado en `app/layout.tsx`:
  - Render: `#bg`, `.grain`, `.scroll-progress`, cursor (`.cursor-ring`/`.cursor-dot`),
    `<nav>` + overlay móvil, `<footer>`, y `{children}`.
  - Cortina (`#curtain`) **solo** si `usePathname() === "/"`.
  - GSAP global: cortina (una vez), barra de progreso (`#scroll-fill`), cursor,
    smooth-scroll de anclas `a[href^="#"]`, y `--hero-size`/`--orange`/`bg-*` (lo que
    hoy hace el primer `useEffect`).
  - En cada cambio de ruta (`usePathname`), `requestAnimationFrame(() => ScrollTrigger.refresh())`.
- **`src/components/zakumi/ZakumiHome.tsx`** (client) — contenido de la home:
  - Render: `Hero`, marquee, `CrmIA`, `AgentDemo`, `Proyectos`, `ComoTrabajamos`, `Filosofia`.
    (Sin `Servicios`, sin `Contacto`.)
  - GSAP por sección: entradas del hero, marquee, reveals, stats, CRM, demo agente,
    filosofía, tecnologías (lo que hoy está en el `useLayoutEffect`, **menos** el bloque
    global que sube a `SiteShell` y **menos** la animación de `.service` que se borra).
- **`src/components/zakumi/sections/ServicePage.tsx`** (client) — plantilla de servicio,
  recibe `data: Service` y renderiza las secciones (ver "Plantilla"). Animaciones de
  entrada propias reutilizando el patrón "reveal de sección".
- **`src/components/zakumi/sections/ContactoView.tsx`** (client) — el contenido de la
  vista de contacto (lo que hoy es `.outro` en `Contacto.tsx`). El `<footer>` ya no vive
  aquí (sube a `SiteShell`).
- **`src/components/zakumi/services.ts`** — datos de los 3 servicios (ver "Datos").

### Rutas (App Router)

- `src/app/layout.tsx` — envuelve `{children}` en `<SiteShell>`. Mantiene `<JsonLd />`.
- `src/app/page.tsx` — `metadata` + `<ZakumiHome />`.
- `src/app/agentes-ia/page.tsx` — `metadata` + `<ServicePage data={SERVICIOS["agentes-ia"]} />`.
- `src/app/software/page.tsx` — idem `software`.
- `src/app/marca/page.tsx` — idem `marca`.
- `src/app/contacto/page.tsx` — `metadata` + `<ContactoView />`.

Cada `page.tsx` es server component (exporta `metadata`) e importa el view client.

### Se elimina

- `src/components/zakumi/sections/Servicios.tsx` (componente).
- `PILARES` en `content.ts` (su contenido se absorbe en `services.ts`).
- En `ZakumiLanding.tsx`: el archivo se reemplaza por `SiteShell` + `ZakumiHome`
  (se conserva como referencia hasta migrar y luego se borra).
- El bloque GSAP de `.service` / `.services`.

## Plantilla de la vista de servicio (`ServicePage`)

Orden de secciones (todas con el lenguaje visual actual: tokens, `section-num`,
`section-title`, Playfair/Inter, naranja de marca):

1. **Intro** — eyebrow (`— I. / Agentes de IA`), título grande, propuesta de valor,
   imagen de apoyo y CTA primario. En agentes, CTA = WhatsApp bot en vivo (`waLink`);
   en software/marca, CTA = "Solicitar cotización" → `/contacto`.
2. **Lo que incluye** — grid de capacidades (título + descripción corta). Es "todo lo
   que se vende".
3. **Ejemplos** — escenarios de uso reales (no case studies con cliente, el estudio es
   nuevo). Reutiliza imágenes de `/work/` donde aplique.
4. **Testimonios** — 2–3 placeholder marcados en código.
5. **Planes** — 2–3 planes por alcance, **sin cifras**, cada uno con lo que incluye y CTA
   "Solicitar cotización" → `/contacto`. Nota de framing accesible para Colombia.
6. **CTA final** — banda de cierre → `/contacto`.

## Datos (`services.ts`)

```ts
type ServiceExample = { titulo: string; desc: string; img?: string };
type Testimonio = { quote: string; autor: string; rol: string; placeholder: true };
type Plan = { nombre: string; tagline: string; incluye: string[] };
type Capacidad = { titulo: string; desc: string };
type Service = {
  slug: "agentes-ia" | "software" | "marca";
  num: string;            // "— I." etc
  nav: string;            // etiqueta de nav
  tag: string;            // eyebrow
  titulo1: string;        // h1 línea 1
  tituloEm: string;       // h1 línea 2 (em, naranja)
  intro: string;          // propuesta de valor
  heroImg: string;
  ctaTipo: "whatsapp" | "contacto";
  waMsg?: string;         // mensaje prellenado (solo agentes)
  incluye: Capacidad[];
  ejemplos: ServiceExample[];
  testimonios: Testimonio[];
  planes: Plan[];
  seo: { title: string; description: string };
};
```

### Copy — Agentes de IA (`/agentes-ia`)

- **num:** `— I.` · **nav:** `Agentes IA` · **tag:** `Agentes de IA · WhatsApp & Telegram`
- **titulo1:** `Agentes de IA que atienden`
- **tituloEm:** `y venden por ti.`
- **intro:** "Responden, asesoran y cierran ventas en WhatsApp, Telegram y redes — 24/7,
  sin que tú estés. El mismo agente que ya tenemos funcionando, puesto a trabajar para tu negocio."
- **ctaTipo:** `whatsapp` · **waMsg:** "Hola Zakumi, quiero un agente de IA para mi WhatsApp."
- **heroImg:** `/work/zk-hero-foto.webp`
- **incluye:**
  - Agente de ventas — Recomienda, arma el pedido y deja al cliente listo para pagar.
  - Atención 24/7 — Contesta en segundos a cualquier hora y resuelve lo repetitivo.
  - Multicanal — WhatsApp, Telegram, Instagram y la web, con la misma memoria y tu tono.
  - Automatización e integraciones — Conecta con tu CRM, catálogo, agenda y pasarela de pago.
  - Entrenado con tu negocio — Aprende tus productos, precios y forma de hablar. No es un bot genérico.
  - Reportes y mejora — Ves qué preguntan y qué frena la venta; afinamos el agente con esos datos.
- **ejemplos:**
  - Tienda que vende por WhatsApp — El agente atiende el catálogo, arma el carrito y pasa el pago.
  - Agenda de citas — Clínicas y salones: agenda, recuerda y reprograma sin llamadas.
  - Soporte de primer nivel — Resuelve el grueso de las dudas y escala a una persona cuando hace falta.
- **testimonios (placeholder):**
  - "Pasamos de responder a medianoche a que el agente cierre ventas mientras dormimos." — Daniela R., tienda de cosmética
  - "Dejé de perder mensajes. Cada cliente recibe respuesta al instante." — Andrés M., importadora
- **planes:**
  - Esencial — "Para empezar a no perder clientes." → Un canal (WhatsApp), preguntas frecuentes + catálogo, flujo de ventas básico.
  - Crecimiento — "Cuando el volumen aprieta." → Multicanal, integración con CRM y pagos, automatizaciones, reportes.
  - A medida — "Operaciones serias." → Agentes especializados, integraciones complejas, alto volumen.

### Copy — Software & Plataformas (`/software`)

- **num:** `— II.` · **nav:** `Software` · **tag:** `Software & plataformas a medida`
- **titulo1:** `Software a medida`
- **tituloEm:** `que sostiene tu crecimiento.`
- **intro:** "Web, apps y plataformas hechas a tu medida, con datos serios y código propio.
  Del prototipo a producción — nada de plantillas."
- **ctaTipo:** `contacto`
- **heroImg:** `/work/zk-software-foto.webp`
- **incluye:**
  - Plataformas a medida — Paneles, portales, marketplaces y herramientas internas que crecen contigo.
  - Web y apps — Sitios rápidos y aplicaciones que se sienten nativas, con Next.js y React.
  - Bases de datos serias — Modelado con Postgres pensado para escalar sin sustos.
  - Integraciones — Pagos, facturación, mensajería, IA y lo que tu operación necesite conectar.
  - Código propio, sin ataduras — Te entregamos el código y la documentación. La plataforma es tuya.
  - Del prototipo a producción — Arrancamos con algo funcional rápido y lo llevamos a algo robusto.
- **ejemplos:**
  - Panel de operación — Pedidos, inventario y clientes en un solo lugar.
  - Portal para clientes — Cada cliente entra, ve su estado y se autogestiona.
  - App de producto — Del MVP que valida al producto que aguanta usuarios reales.
- **testimonios (placeholder):**
  - "Reemplazamos tres hojas de cálculo por una plataforma que de verdad usamos." — Carolina V., logística
  - "Entregaron el código y la documentación. No quedamos amarrados a nadie." — Felipe G., startup
- **planes:**
  - Prototipo / MVP — "Validar rápido." → Algo funcional para probar la idea con usuarios.
  - Plataforma — "Producto en producción." → Sistema completo, con datos e integraciones.
  - Evolución continua — "Mejorar mes a mes." → Acompañamiento y nuevas funciones de forma sostenida.

### Copy — Marca & Contenido (`/marca`)

- **num:** `— III.` · **nav:** `Marca` · **tag:** `Marca · Contenido · Redes`
- **titulo1:** `Tu marca, viva.`
- **tituloEm:** `Tus redes, en automático.`
- **intro:** "Identidad con criterio + contenido y publicación automatizada. Presencia
  todos los días, sin que tengas que estar pendiente."
- **ctaTipo:** `contacto`
- **heroImg:** `/work/zk-brand-foto2.webp`
- **incluye:**
  - Identidad visual — Logo, paleta, tipografías y un sistema coherente en todo.
  - Manejo de redes — Estrategia, calendario y publicación constante en tus canales.
  - Creación de contenido — Piezas, copy y formatos pensados para tu audiencia.
  - Publicación automatizada — Programado y publicado a diario, sin que estés encima.
  - Lineamientos de marca — Una guía para que todo hable con la misma voz.
  - Contenido con IA — Producción a escala apoyada en IA, con criterio humano.
- **ejemplos:**
  - Marca desde cero — Le damos identidad y la ponemos a operar en redes.
  - Relanzamiento — Refrescamos la imagen y reactivamos la presencia digital.
  - Redes en piloto automático — Calendario mensual + publicación; tú revisas y apruebas.
- **testimonios (placeholder):**
  - "Por fin las redes se ven como una marca de verdad, no improvisadas." — Laura P., gastronomía
  - "Publican por mí todos los días. Yo solo reviso y apruebo." — Santiago O., servicios
- **planes:**
  - Identidad — "El sistema de marca." → Identidad visual completa, una sola vez.
  - Marca + Redes — "Imagen y presencia." → Identidad + manejo de redes y contenido mensual.
  - Contenido continuo — "Siempre presente." → Producción y publicación sostenida mes a mes.

> Nota de planes (común a los 3, sin cifras): "Cotizamos por proyecto o por mes según tu
> alcance. Trabajamos con presupuestos pensados para el mercado colombiano — escríbenos y
> armamos una propuesta a tu medida."

## Vista de contacto (`/contacto`)

Reutiliza `CONTACTO` de `content.ts` (título + sub) y las acciones actuales: WhatsApp
(`WHATSAPP_URL`), email (`mailto:EMAIL`), Instagram, Telegram (cuando `TELEGRAM_ENABLED`).
Es la misma `.outro` de hoy, ahora como página. El footer lo pone `SiteShell`.
El CTA de cierre de cada vista de servicio enlaza aquí con `<Link href="/contacto">`.

(Opcional, fuera de alcance v1: prellenar el mensaje de WhatsApp según el servicio de
origen vía `?s=...`.)

## Nav y wiring del hero

- `NAV_ITEMS` → `[{href:"/agentes-ia",label:"Agentes IA"},{href:"/software",label:"Software"},
  {href:"/marca",label:"Marca"},{href:"/contacto",label:"Contacto"}]`. Usar `<Link>` de Next.
  Logo → `/`.
- `HERO_SLIDES` (en `content.ts`): añadir `href` por slide (`/agentes-ia`, `/software`, `/marca`).
  En `Hero.tsx`, el CTA de **los tres** slides pasa a `<Link href={slide.href}>` (lleva a su vista).
  El acceso directo al **bot de WhatsApp en vivo** vive como CTA primario **dentro de la vista
  `/agentes-ia`** (`ctaTipo: "whatsapp"`), no como CTA extra en el hero. Así el funnel es:
  hero → vista de servicio → WhatsApp / `/contacto`.

## SEO

- `metadata` por página (`title`, `description`) en cada `page.tsx` usando la copy `seo` de
  cada servicio.
- `sitemap.ts`: añadir las 4 rutas nuevas.
- `JsonLd.tsx`: añadir entidades `Service` (3) y, opcional, `BreadcrumbList`. Mantener
  Organization + WebSite.

## Estilos

Añadir reglas para `ServicePage` en `src/styles/zakumi-design.css` reutilizando los
patrones existentes (`section`, `section-num`, `section-title`, `.cta`, grids tipo
`.services`/`.stats`). Respetar `prefers-reduced-motion`. Mantener la escala visual
generosa (preferencia del usuario). Sin nuevas dependencias.

## No-objetivos (v1)

- Formulario de contacto con backend (se mantienen CTAs a WhatsApp/email).
- Precios con cifras.
- Blog, casos de cliente reales, multi-idioma.
- Prellenado de WhatsApp por servicio en `/contacto`.

## Riesgos

- **Split del GSAP monolítico** es lo más delicado: separar chrome global (→ SiteShell)
  de animaciones de sección (→ ZakumiHome) sin romper ScrollTrigger. Mitigación: migrar
  por partes y verificar en navegador (cortina, cursor, barra de progreso, reveals).
- **ScrollTrigger en navegación SPA:** refrescar en cambio de ruta; limpiar con
  `gsap.context().revert()` al desmontar cada página.
- **Anclas viejas** (`#crm`, `#proyectos`): al salir del nav, asegurarse de que el
  smooth-scroll de anclas siga funcionando dentro de la home.

## Verificación

- `tsc --noEmit` y `next build` limpios.
- Navegar las 5 rutas; cortina solo en `/`; nav y footer en todas; reveals correctos.
- Lighthouse/SEO: cada página con su `<title>`/description; sitemap con 5 URLs.
- `prefers-reduced-motion`: sin animaciones intrusivas.
