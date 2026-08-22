# Design system del panel de admin — "islas Zakumi"

**Fecha:** 2026-08-22
**Estado:** aprobado por Tomás (fundación, kit, shell y migración validados por secciones)
**Alcance:** Fase 1 de la mejora del CRM — design system + re-vestido visual del panel completo.

## Contexto y objetivo

El panel `/admin` funciona pero se construyó a mano: 1.646 líneas de `admin.css` con ~215
clases `adm-*`, cero Tailwind, cero componentes compartidos, `border-radius: 0` en todo, y
arrastra las 3.859 líneas de `zakumi-design.css` de la landing (que estila `nav`, `footer`,
`body`, `*` y obliga a workarounds documentados en `AdminNav.tsx:54`).

Tomás pidió: más user friendly, estilos más redondos y bonitos, mejor aprovechamiento de la
pantalla, y un design system para modularizar y no repetir trabajo. **Referencia visual
elegida por él: el dashboard de Scribe** (`/Users/tom/Desktop/Nebula/proto_scribe-main`),
adaptado a los colores de Zakumi.

Esta fase NO añade funcionalidad. Las fases siguientes (con su propio ciclo de spec) se
montan sobre esta base, en este orden acordado:

1. **← esta fase** Design system + re-vestido del panel.
2. Chat manual/copiloto en el cockpit de Zak (intervenir chats reales de WhatsApp, chatear
   con Zak como asistente, iniciar conversaciones nuevas desde el CRM).
3. Indicador real de conexión de WhatsApp (`getStateInstance`, salud del webhook — hoy el
   semáforo del nav solo mide la cola de jobs).
4. Configurabilidad de Zak (personalidad con buena UX, verticales de prospección a BD,
   parámetros técnicos visibles, conocimiento editable).

## Qué copiamos de Scribe (y qué no)

**Copiamos** (el look sale de ~6 decisiones, verificadas explorando su código):

- **Islas flotantes**: el viewport con ~10px de aire, cada región es una card redondeada
  (~24px), nada toca los bordes de la pantalla.
- **Cero sombras**: profundidad con capas translúcidas del mismo tinte + `backdrop-blur`.
- **Dos radios, sin ambigüedad**: isla (24px) para regiones, **píldora total** para todo lo
  interactivo (botones, inputs, tabs, chips), 14px para filas de lista.
- **Un solo acento en 3-4 intensidades** semánticas (10% hover, 25%, 85%, pleno).
- **Ritmo vertical único**: toda altura de control igual (Scribe 35px; nosotros 38px, mejor
  para un CRM con tablas), iconos 16px monocromo heredando `currentColor`.
- Patrones concretos: sidebar como islas apiladas colapsable con estado en `localStorage`,
  segmented control de píldoras, toggle mini, inputs-píldora sin borde con relleno
  translúcido, select con portal + flip por viewport + búsqueda con acentos normalizados,
  skeletons de barras `animate-pulse`, estados vacíos centrados a dos niveles de texto,
  lista agrupada por fecha con filas redondeadas (ideal para conversaciones de WhatsApp),
  mensajes de chat asimétricos (cliente con fondo y a un lado, agente a ancho completo con
  autor en color de acento — sin burbujas simétricas ni avatares).

**NO copiamos** (deuda detectada en Scribe): su carpeta shadcn rota (tokens que no existen),
dos sistemas de tokens a medio migrar (~350 usos de variables sin definir), 224 utilidades
`dark:` que no funcionan con su mecanismo de tema, ~250 variables planas con medidas de
Figma promovidas a token, componentes de 50-60KB, scrollbar oculto global (problema real de
usabilidad en tablas largas), transición global en `*`, fuentes desde raw.githubusercontent.

## Sección 1 — Fundación

### 1a. Desacople del CSS de la landing

Hoy: `src/app/layout.tsx` importa `globals.css` = `@import "tailwindcss"` +
`@import "../styles/zakumi-design.css"`. El admin hereda todo.

Cambio:

- `globals.css` queda solo con `@import "tailwindcss"` (el root layout lo sigue cargando —
  Tailwind disponible en los dos árboles).
- `src/app/(site)/layout.tsx` importa `zakumi-design.css`. La landing no nota nada.
- `src/app/admin/layout.tsx` importa `src/styles/admin-theme.css` (nuevo) además del
  `admin.css` legado, que convive durante la migración y se borra al final.
- Ojo: `admin.css` hoy lee tokens definidos en `zakumi-design.css:1-14` (`--orange`,
  `--black`, `--paper`, `--slate`, `--ink-2`, `--live`, `--charcoal`). `admin-theme.css`
  define sus propios tokens desde el día 1, y durante la convivencia `admin.css` recibe un
  bloque `:root` puente con esas 7 variables para no romper las páginas aún no migradas.

**Verificación obligatoria del desacople**: capturas antes/después de la landing (home +
una página interior) — es el único punto donde podríamos romperla, y es trivial revertir.

### 1b. Tokens — `src/styles/admin-theme.css`

Bloque `@theme` de Tailwind v4 (cada token = utilidad real; el error de Scribe fue tener
tokens que no compilaban a nada). Vocabulario en español, coherente con el repo.

```css
@theme {
  /* Superficies (solo modo oscuro — identidad del panel; nos ahorra el
     sistema dual que a Scribe se le rompió) */
  --color-fondo: #0A0C12;            /* el negro Zakumi, fondo del viewport */
  --color-isla: #10131B;             /* un paso más claro: la card resalta */
  --color-isla-alta: #161A24;        /* superficie sobre superficie (hover fila, input) */
  --color-velo: rgb(22 26 36 / 0.6); /* translúcida para menús/modales, con backdrop-blur */

  /* Acento — único: el naranja Zakumi */
  --color-acento: #DB5227;
  --color-acento-85: rgb(219 82 39 / 0.85);
  --color-acento-25: rgb(219 82 39 / 0.25);
  --color-acento-10: rgb(219 82 39 / 0.10);

  /* Tinta — jerarquía por alpha, sin inventar grises */
  --color-tinta: #EEEEF0;
  --color-tinta-85: rgb(238 238 240 / 0.85);
  --color-tinta-60: rgb(238 238 240 / 0.60);
  --color-tinta-40: rgb(238 238 240 / 0.40);

  /* Semánticos */
  --color-vivo: #2EC27E;             /* conectado / activo */
  --color-peligro: #FF375F;          /* solo destructivo */
  --color-hairline: rgb(238 238 240 / 0.08);

  /* Estados del pipeline (se conservan los 6 actuales) */
  --color-estado-nuevo / contactado / respondido / interesado / cliente / descartado

  /* Radios — dos niveles + filas */
  --radius-isla: 24px;
  --radius-fila: 14px;
  --radius-pildora: 999px;

  /* Ritmo */
  --alto-control: 38px;              /* TODO control interactivo mide esto */
  --aire: 10px;                      /* padding del viewport y gap entre islas */
}
```

Valores exactos de `--color-isla`/`-alta`/`-velo` se afinan con QA visual en el primer paso
(la decisión firme es el gesto: isla más clara que el fondo, jerarquía por capas, cero
sombras).

**Tipografía**: se queda **Instrument Sans** (base 14px, peso 400 — el 300 de Scribe es
demasiado fino para datos) + **Playfair Display itálica** para acentos editoriales que ya
usa el panel (`adm-topbar-panel`, rol de Zak). Las fuentes ya se cargan en el root layout
con `next/font`; no cambia nada.

### 1c. Dependencias nuevas (aprobadas)

- `clsx` + `tailwind-merge` → helper `cn()` en `src/lib/cn.ts`.
- `lucide-react` → iconos 16px monocromo (reemplaza emojis en botones/nav; tree-shaken).
- `@radix-ui/react-dialog` → base accesible del `Modal` (focus trap, escape, portal).
- **Nada de framer-motion ni cva**: animaciones con transiciones CSS (150-300ms,
  `cubic-bezier(.4,0,.2,1)`), variantes con objetos tipados + `cn()`.

## Sección 2 — Kit de componentes

`src/components/admin/ui/` — piezas client-safe, cada una con variantes tipadas, sin lógica
de negocio. API en español como el resto del repo.

| Componente | Notas |
|---|---|
| `Button` | variantes `primaria` (naranja pleno) / `fantasma` / `peligro`; píldora 38px; reemplaza los 54 usos de `adm-cta`/`adm-cta-ghost` |
| `IconButton` | cuadrado 38px redondeado-píldora, hover con velo; soporta contador-badge |
| `Island` | la card-región (`--radius-isla`, fondo isla, padding); prop `titulo` opcional; base de toda página |
| `PageHeader` | título de página + acciones a la derecha; sustituye headers ad-hoc |
| `Tabs` | segmented control de píldoras (genérico `<T extends string>`); reemplaza las 2 copias de barra de pestañas (`ZakView`, `AgenteView`) |
| `Badge` | estados del pipeline (lee `--color-estado-*`), semáforos de cobro, chips |
| `Field` + `Input` + `TextArea` + `Select` | píldoras 38px sin borde con relleno `isla-alta`; error = borde/fondo peligro; `Select` portado del de Scribe (portal, flip según viewport, búsqueda con normalización de acentos); reemplaza los 49/61/37 usos copiados a mano |
| `Toggle` | switch mini (~26×14px), on = acento |
| `ListRow` | fila redondeada (`--radius-fila`) con hover — conversaciones, negocios, resultados del mapa, productos |
| `ChatBubble` | una sola implementación; cliente con fondo `isla-alta` alineado a un lado, Zak/humano a ancho completo con autor en naranja (patrón Scribe, sin burbujas simétricas); reemplaza las 2 copias (`LabsChat.tsx:134`, `Conversaciones.tsx:329`) |
| `Skeleton` | barras/chips `animate-pulse` con fondo velo |
| `EmptyState` | centrado, dos niveles de texto (título medium + subtítulo 60%) |
| `Banner` | los estados degradados ("sin conexión con el bot desde las HH:MM") con un solo componente; variantes `aviso` / `error` |
| `Modal` | sobre Radix Dialog; panel con velo + `backdrop-blur`, radio isla |

Además: **`src/lib/admin/formato.ts`** — consolida `fechaCorta` (×4: `ZakView`,
`Conversaciones`, `Actividad`, `PromptEditor`), `horaBogota` (`BotsView`) y `hoyBogota`
(`cartera.ts`), todo `Intl.DateTimeFormat("es-CO", …America/Bogota)`. Con tests.

Los componentes usan utilidades Tailwind sobre los tokens del `@theme`; no se escriben
clases `adm-*` nuevas nunca más.

## Sección 3 — Shell

La estructura cambia de nav-superior a **sidebar de islas apiladas** (aprobado):

```
viewport  p-(--aire)  bg-fondo  gap-(--aire)
├─ Sidebar (240px ↔ 56px, colapso persistido en localStorage, transición CSS)
│   ├─ isla logo/marca
│   ├─ isla navegación (mapa · negocios · zak · clientes · bots)
│   │    filas-píldora; activa = fondo acento-10 + texto acento
│   │    semáforo de salud del bot junto a su entrada (se conserva useSaludBots)
│   └─ isla usuario (email + salir)
└─ Contenido: isla principal flex-1 con scroll interno
     └─ PageHeader + cuerpo de la página
```

- Colapso 240→56px: solo iconos + tooltip; estado con el patrón
  `useSyncExternalStore` + `localStorage` (sin flash ni hydration mismatch).
- Responsive: bajo ~900px el sidebar pasa a overlay `fixed` con velo clicable; el
  breakpoint exacto se calcula con nuestras medidas, no se hereda el 1044px de Scribe.
- Gana altura vertical para todo el panel — lo que la Bandeja y el cockpit de Zak
  necesitan para la fase 2.
- `AdminNav.tsx` se reemplaza; el aviso "nada de nav/footer desnudos" muere con el
  desacople del CSS.

## Sección 4 — Migración por páginas

Orden aprobado (cada paso deja el panel compilando y usable; `admin.css` se vacía
progresivamente y se borra al final):

1. **Fundación**: desacople + `admin-theme.css` + `cn()` + kit base (`Button`, `Island`,
   `Badge`, `Field/Input`, `Tabs`, `Banner`, `EmptyState`, `Skeleton`) + `formato.ts`.
   Verificación visual de la landing.
2. **Shell**: sidebar + layout de islas. El panel ya "se ve nuevo".
3. **`/admin/zak`** — el cockpit es la estrella y donde viven las fases 2-4. Sus 6 pestañas
   como `Tabs`; Bandeja y Labs con `ChatBubble`/`ListRow`.
4. **`/admin/negocios`** — tabla del pipeline como filas con selección en lote, filtros
   como píldoras, `Badge` de estados.
5. **`/admin/clientes`** + ficha 360.
6. **`/admin/bots`** + ficha del bot (comparte `Conversaciones`/`LabsChat`/`PromptEditor`/
   `Actividad` con Zak vía flag `esZak` — se migran una vez, sirven a los dos).
7. **`/admin/mapa`** al final — la más delicada: el DOM interno de Google Maps
   (AdvancedMarker, InfoWindow) no se re-estila; la isla lo envuelve. `SearchPanel`,
   `FichaNegocio` y formularios sí usan el kit.
8. **`/admin/login`** + limpieza: borrar `admin.css` y el bloque puente.

### Reglas duras de la fase

- **Misma funcionalidad, cero features nuevas.** Nada de streaming, conexión, ni config
  nueva — eso son las fases 2-4.
- **Los ~15 estados degradados se conservan tal cual** (contrato `{ok,data}|{ok:false}` de
  `api.ts` que nunca lanza + banners "sin conexión… desde las HH:MM" + polling). Son diseño
  intencional, no deuda.
- No se toca ni una línea de: server actions, route handlers, `lib/bots/api.ts`, el bot
  Python, SQL de Supabase.
- Scrollbars: finos y visibles en zonas de datos (opt-in `scrollbar` fino), nunca el
  ocultamiento global de Scribe.
- Sin transición global en `*`: transiciones declaradas por componente.

## Pruebas y verificación

- Tests vitest existentes (`src/lib/admin/__tests__/`, `src/lib/bots/__tests__/`) siguen
  verdes en cada paso.
- Test nuevo para `formato.ts` (fechas es-CO / America/Bogota).
- `npm run build` + typecheck por paso de migración.
- QA visual con navegador headless en localhost: landing (antes/después del desacople) y
  cada página migrada. Para las páginas tras el login hace falta sesión de Supabase —
  cuenta de prueba con credenciales directo en `.env.local` (nunca en el chat) o revisión
  manual de Tomás.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El desacople cambia algo sutil en la landing | Es el paso 1, aislado; capturas antes/después; revert trivial |
| Páginas a medio migrar se ven mezcladas | Bloque `:root` puente + migración página por página (nunca media página) |
| El look isla/píldora choca con Google Maps | El mapa se envuelve, no se re-estila; se deja para el final |
| Regresión en estados degradados difíciles de reproducir | No se toca la lógica de datos; solo JSX/clases. Revisión explícita de los banners en cada página migrada |

## Criterios de éxito

1. La landing queda **idéntica** píxel a píxel.
2. `admin.css` eliminado; cero clases `adm-*` en el código.
3. Todo botón/input/tab/chip del panel sale del kit (`components/admin/ui`); las 6 copias
   de formato de fecha reducidas a 1.
4. El panel entero con el look isla: fondo `#0A0C12`, islas redondeadas 24px, interactivos
   en píldora naranja, sidebar colapsable.
5. Tests verdes, build limpio, estados degradados intactos.
