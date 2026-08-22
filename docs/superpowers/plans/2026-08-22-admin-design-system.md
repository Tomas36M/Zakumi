# Design System del Panel Admin ("islas Zakumi") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el design system del panel `/admin` (tokens Tailwind v4 + kit de componentes propio con look "islas" estilo Scribe en colores Zakumi) y re-vestir el panel completo página por página, eliminando `admin.css` y las ~215 clases `adm-*`.

**Architecture:** Tokens semánticos en un `@theme` de Tailwind v4 (`src/styles/admin-theme.css`, importado en el grafo de `globals.css` para que cada token compile a utilidades reales). Kit de componentes client-safe en `src/components/admin/ui/` (variantes con objetos tipados + `cn()`, sin cva). El CSS de la landing (`zakumi-design.css`) se desacopla moviéndolo al layout de `(site)`; `admin.css` convive con un bloque `:root` puente durante la migración y se borra al final. Shell nueva: sidebar de islas colapsable + contenido como isla principal.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 (CSS-first, `@theme`), clsx + tailwind-merge, lucide-react, @radix-ui/react-dialog, vitest (node-only).

**Spec:** `docs/superpowers/specs/2026-08-22-admin-design-system-design.md`

## Global Constraints

- **Fase solo visual**: NO tocar server actions (`src/lib/admin/*-actions.ts`), route handlers (`src/app/admin/api/**`), `src/lib/bots/api.ts`, SQL de Supabase ni el bot Python. Solo JSX/clases/CSS y los 3 archivos nuevos de lib (`cn.ts`, `formato.ts`, sidebar-store).
- **Los estados degradados se conservan literales**: cada banner "Sin conexión con el bot desde las HH:MM", cada estado vacío y cada mensaje de error existente debe seguir renderizándose con el mismo texto (solo cambia el envoltorio visual).
- **Copy 100% es-CO**, prohibida la palabra "stack" en textos de UI. Nombres de código en español, como el resto del repo.
- **La landing queda idéntica**: cualquier tarea que toque `globals.css`, `(site)/layout.tsx` o `src/app/layout.tsx` exige verificación visual de la landing antes de commitear.
- Tokens: fondo `#0A0C12`, isla `#10131B`, isla-alta `#161A24`, acento `#DB5227` (+85/25/10), tinta `#EEEEF0` (+85/60/40), vivo `#2EC27E`, peligro `#FF375F`, radios isla `24px` / fila `14px` / píldora `rounded-full`, altura de control `38px`, aire `10px`.
- Si una utilidad de token con nombre no compila (p. ej. `h-control`), usar la sintaxis arbitraria de Tailwind v4 con la variable: `h-(--spacing-control)`, `bg-(--color-isla)`. Consultar `node_modules/next/dist/docs/` ante cualquier duda de Next 16 (ver `AGENTS.md`).
- **`git add` solo con rutas explícitas** — el working tree tiene archivos sin trackear de otro trabajo (portal de clientes, videos, PDF) que NO deben entrar en ningún commit de este plan.
- Tests: vitest es node-only (sin jsdom); TDD aplica a lógica pura (`cn`, `formato`). Los componentes UI se verifican con `npm run build` + QA visual (no hay infra de component testing y no se añade en esta fase).
- **Desviación consciente del spec** (aprobar con Tomás si molesta): `Select` v1 es un `<select>` nativo estilizado como píldora, no el port completo de Scribe (portal + flip + búsqueda). Ninguna pantalla actual necesita búsqueda en dropdowns; el port se hará en la fase de configurabilidad (verticales), que sí lo necesita.

---

### Task 1: Rama, dependencias y helper `cn()`

**Files:**
- Create: `src/lib/cn.ts`
- Test: `src/lib/__tests__/cn.test.ts`
- Modify: `package.json` (vía npm install)

**Interfaces:**
- Produces: `cn(...entradas: ClassValue[]): string` — combina clases y resuelve conflictos de Tailwind a favor de la última. Todos los componentes del kit la importan como `import { cn } from "@/lib/cn"`.

- [ ] **Step 1: Crear la rama de trabajo**

OJO: `feat/portal-clientes` tiene trabajo AJENO a este plan (commit `7500296`, portal de
clientes). La rama nueva sale de `main` y se traen SOLO los dos commits de documentos:

```bash
git checkout main
git checkout -b feat/admin-design-system
git cherry-pick f418301   # spec: design system del panel — islas Zakumi
# El plan se copia en su versión final directo de la otra rama (sin cherry-pick,
# para no depender de hashes del propio plan):
git checkout feat/portal-clientes -- docs/superpowers/plans/2026-08-22-admin-design-system.md
git add docs/superpowers/plans/2026-08-22-admin-design-system.md
git commit -m "plan: design system del panel — 14 tareas, kit completo con código"
```

(Los archivos sin trackear del working tree —portal, videos, PDF— se quedan donde están;
por eso los `git add` de este plan van siempre con rutas explícitas.)

- [ ] **Step 2: Instalar dependencias**

```bash
npm install clsx tailwind-merge lucide-react @radix-ui/react-dialog
```

Verificar: `git diff package.json` muestra solo esas 4 dependencias añadidas.

- [ ] **Step 3: Escribir el test que falla**

Mirar primero cómo importan los tests existentes (`src/lib/admin/__tests__/*.test.ts`) — si usan rutas relativas, usar `../../cn`; si usan alias `@/`, usar `@/lib/cn`. Crear `src/lib/__tests__/cn.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("combina clases condicionales y descarta falsy", () => {
    expect(cn("bg-isla", false && "oculto", undefined, "text-tinta")).toBe(
      "bg-isla text-tinta",
    );
  });

  it("resuelve conflictos de Tailwind a favor de la última clase", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-xs")).toBe("text-xs");
  });
});
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/__tests__/cn.test.ts`
Expected: FAIL — `Cannot find module '../cn'`.

- [ ] **Step 5: Implementar `cn`**

```ts
// src/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases; ante conflicto de utilidades Tailwind gana la última. */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npx vitest run`
Expected: PASS (los nuevos y todos los existentes).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/cn.ts src/lib/__tests__/cn.test.ts
git commit -m "admin: dependencias del design system + helper cn()"
```

---

### Task 2: Desacoplar el CSS de la landing del panel

**Files:**
- Modify: `src/app/globals.css` (2 líneas)
- Modify: `src/app/(site)/layout.tsx` (añadir 1 import)
- Modify: `src/styles/admin.css` (añadir bloque puente al inicio)

**Interfaces:**
- Produces: el panel deja de heredar `zakumi-design.css`; `admin.css` se sostiene solo con el bloque `:root` puente. La landing carga su CSS desde `(site)/layout.tsx`.

- [ ] **Step 1: Capturar la landing ANTES del cambio**

```bash
npm run dev
```

Con el navegador headless (skill browse/agent-browser): captura de `http://localhost:3000` (home completa) y `http://localhost:3000/agentes-ia`. Guardar en el scratchpad como referencia.

- [ ] **Step 2: Editar `src/app/globals.css`**

Contenido completo del archivo tras la edición:

```css
@import "tailwindcss";
```

- [ ] **Step 3: Añadir el import en `src/app/(site)/layout.tsx`**

Añadir como primera línea de imports:

```tsx
import "@/styles/zakumi-design.css";
```

- [ ] **Step 4: Añadir el bloque puente al inicio de `src/styles/admin.css`**

Insertar ANTES del comentario de cabecera (valores copiados literales de `zakumi-design.css:1-14`; el puente muere con `admin.css` en la Task 14):

```css
/* ——— PUENTE (temporal): tokens que admin.css leía de zakumi-design.css.
   Se borra junto con este archivo al final de la migración. ——— */
:root {
  --black: #0A0C12;
  --navy: #023661;
  --charcoal: #3F3A42;
  --slate: #76828E;
  --orange: #DB5227;
  --paper: #f5efe3;
  --live: #2EC27E;
  --ink-2: #98A3AE;
}
body {
  background: var(--black); /* mismo valor que pone la landing: sin conflicto */
}
```

- [ ] **Step 5: Verificar la landing DESPUÉS y el panel**

- Capturas de las mismas 2 URLs y comparación visual contra las del Step 1: deben ser idénticas (fuentes, cortina de entrada, nav, colores).
- `http://localhost:3000/admin/login`: el formulario se ve igual que antes (sigue oscuro, con los colores de siempre).
- Navegar a `/admin/mapa` (redirige a login si no hay sesión — suficiente con que no haya flash blanco ni texto sin estilo).

- [ ] **Step 6: Build y tests**

Run: `npm run build && npm test`
Expected: build limpio, tests verdes.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css "src/app/(site)/layout.tsx" src/styles/admin.css
git commit -m "admin: desacoplar zakumi-design.css del panel (import en (site) + puente en admin.css)"
```

---

### Task 3: Tokens del design system (`admin-theme.css`)

**Files:**
- Create: `src/styles/admin-theme.css`
- Modify: `src/app/globals.css` (1 import)
- Modify: `src/app/admin/layout.tsx` (clase `panel` en el wrapper)

**Interfaces:**
- Produces: utilidades Tailwind `bg-fondo`, `bg-isla`, `bg-isla-alta`, `bg-velo`, `bg-acento(-85/-25/-10)`, `text-tinta(-85/-60/-40)`, `text-acento`, `bg-vivo`, `text-peligro`, `border-hairline`, `bg-estado-{nuevo,contactado,respondido,interesado,cliente,descartado}`, `rounded-isla`, `rounded-fila`, `h-control`, `p-aire`, `gap-aire`, `font-editorial`. Clase base `.panel` (fondo, tinta, fuente, focus ring, reduced-motion, `.barra-fina` para scrollbars).

- [ ] **Step 1: Crear `src/styles/admin-theme.css`**

```css
/* ============================================================================
   Design system del panel — tokens "islas Zakumi".
   Vive en el grafo de globals.css para que @theme genere utilidades reales.
   Look: islas flotantes redondeadas sobre el negro Zakumi, cero sombras
   (profundidad por capas), un solo acento naranja, interactivos en píldora.
   ========================================================================== */

@theme {
  /* Superficies (solo modo oscuro) */
  --color-fondo: #0A0C12;
  --color-isla: #10131B;
  --color-isla-alta: #161A24;
  --color-velo: rgb(22 26 36 / 0.6);

  /* Acento — único: el naranja Zakumi */
  --color-acento: #DB5227;
  --color-acento-85: rgb(219 82 39 / 0.85);
  --color-acento-25: rgb(219 82 39 / 0.25);
  --color-acento-10: rgb(219 82 39 / 0.1);

  /* Tinta — jerarquía por alpha */
  --color-tinta: #EEEEF0;
  --color-tinta-85: rgb(238 238 240 / 0.85);
  --color-tinta-60: rgb(238 238 240 / 0.6);
  --color-tinta-40: rgb(238 238 240 / 0.4);

  /* Semánticos */
  --color-vivo: #2EC27E;
  --color-peligro: #FF375F;
  --color-hairline: rgb(238 238 240 / 0.08);

  /* Estados del pipeline (mismos valores que .adm-shell en admin.css) */
  --color-estado-nuevo: #76828E;
  --color-estado-contactado: #E8B24A;
  --color-estado-respondido: #5FA8D3;
  --color-estado-interesado: #DB5227;
  --color-estado-cliente: #2EC27E;
  --color-estado-descartado: #3F3A42;

  /* Radios: isla para regiones, fila para items de lista; píldora = rounded-full */
  --radius-isla: 24px;
  --radius-fila: 14px;

  /* Ritmo: aire entre islas, altura única de control */
  --spacing-aire: 10px;
  --spacing-control: 38px;

  /* Playfair para acentos editoriales (la var la pone next/font en <html>) */
  --font-editorial: var(--font-playfair), "Playfair Display", serif;
}

/* ——— Base del panel (bajo .panel, puesto por src/app/admin/layout.tsx) ——— */
.panel {
  min-height: 100dvh;
  background: var(--color-fondo);
  color: var(--color-tinta);
  font-family: var(--font-sans), "Instrument Sans", system-ui, sans-serif;
  font-size: 0.875rem;
  line-height: 1.5;
}
.panel *:focus-visible {
  outline: 2px solid var(--color-acento);
  outline-offset: 2px;
}
.panel ::selection {
  background: var(--color-acento);
  color: #fff;
}
@media (prefers-reduced-motion: reduce) {
  .panel *,
  .panel *::before,
  .panel *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

/* Scrollbar fino y VISIBLE para zonas de datos (opt-in; nunca ocultar). */
.panel .barra-fina {
  scrollbar-width: thin;
  scrollbar-color: rgb(238 238 240 / 0.15) transparent;
}
.panel .barra-fina::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.panel .barra-fina::-webkit-scrollbar-thumb {
  background: rgb(238 238 240 / 0.15);
  border-radius: 999px;
}
```

- [ ] **Step 2: Importarlo en `src/app/globals.css`**

Contenido completo del archivo tras la edición:

```css
@import "tailwindcss";
@import "../styles/admin-theme.css";
```

- [ ] **Step 3: Añadir la clase base en `src/app/admin/layout.tsx`**

Cambiar la línea del wrapper:

```tsx
return <div className="adm-shell panel">{children}</div>;
```

(`adm-shell` se queda hasta la Task 14: las páginas sin migrar leen sus variables `--estado-*`/`--superficie` de ahí.)

- [ ] **Step 4: Verificar que los tokens compilan a utilidades**

Prueba rápida: añadir temporalmente `className="rounded-isla bg-isla h-control p-aire"` a cualquier div del login, correr `npm run dev`, inspeccionar en el navegador que las 4 utilidades existen y aplican los valores (24px, #10131B, 38px, 10px). Quitar la prueba.

- [ ] **Step 5: Build, tests y verificación de la landing**

Run: `npm run build && npm test`
Expected: verde. La landing no cambia (los tokens en `:root` son inertes ahí): captura rápida de la home y comparación.

- [ ] **Step 6: Commit**

```bash
git add src/styles/admin-theme.css src/app/globals.css src/app/admin/layout.tsx
git commit -m "admin: tokens del design system (islas Zakumi) en @theme + base .panel"
```

---

### Task 4: `formato.ts` — consolidar las 6 copias de fechas

**Files:**
- Create: `src/lib/admin/formato.ts`
- Test: `src/lib/admin/__tests__/formato.test.ts`
- Modify: `src/components/admin/bots/Conversaciones.tsx:22-31` (borrar `fechaCorta` local, importar)
- Modify: `src/components/admin/bots/ZakView.tsx:49-58` (ídem)
- Modify: `src/components/admin/bots/Actividad.tsx:20-29` (ídem)
- Modify: `src/components/admin/bots/PromptEditor.tsx:15-24` (ídem)
- Modify: `src/components/admin/bots/BotsView.tsx:11-17` (borrar `horaBogota` local, importar)
- Modify: `src/lib/admin/cartera.ts:68-72` (delegar `hoyBogota` en formato.ts re-exportando)

**Interfaces:**
- Produces: `fechaCorta(iso: string | null): string` (vacío si null, el input crudo si no parsea, "22 ago, 10:30 a. m." si parsea — es-CO/Bogotá), `horaBogota(fecha?: Date): string`, `hoyBogota(): string` ("YYYY-MM-DD"). Import: `import { fechaCorta } from "@/lib/admin/formato"` (o relativo, según el estilo del archivo).

- [ ] **Step 1: Escribir el test que falla**

`src/lib/admin/__tests__/formato.test.ts` (mirar el estilo de import de los tests vecinos y replicarlo):

```ts
import { describe, expect, it } from "vitest";
import { fechaCorta, horaBogota, hoyBogota } from "../formato";

describe("fechaCorta", () => {
  it("devuelve vacío con null", () => {
    expect(fechaCorta(null)).toBe("");
  });

  it("devuelve el input crudo si no es fecha", () => {
    expect(fechaCorta("no-es-fecha")).toBe("no-es-fecha");
  });

  it("formatea en es-CO zona Bogotá (UTC-5)", () => {
    const r = fechaCorta("2026-08-22T15:30:00Z");
    expect(r).toContain("22");
    expect(r.toLowerCase()).toContain("ago");
    expect(r).toContain("10:30");
  });
});

describe("horaBogota", () => {
  it("convierte a hora de Bogotá", () => {
    expect(horaBogota(new Date("2026-08-22T15:30:00Z"))).toContain("10:30");
  });
});

describe("hoyBogota", () => {
  it("devuelve YYYY-MM-DD", () => {
    expect(hoyBogota()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/admin/__tests__/formato.test.ts`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `src/lib/admin/formato.ts`**

```ts
/**
 * Formateo de fechas del panel: SIEMPRE es-CO y America/Bogota.
 * Única fuente — antes había 6 copias locales de estas funciones.
 */

const FORMATO_CORTO = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** "22 ago, 10:30 a. m." — vacío si null, el input crudo si no parsea. */
export function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return FORMATO_CORTO.format(fecha);
}

const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** "10:30 a. m." en Bogotá (por defecto: ahora). */
export function horaBogota(fecha: Date = new Date()): string {
  return FORMATO_HORA.format(fecha);
}

const FORMATO_DIA_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
});

/** Hoy en Bogotá como "YYYY-MM-DD" (en-CA formatea ISO). */
export function hoyBogota(): string {
  return FORMATO_DIA_ISO.format(new Date());
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/admin/__tests__/formato.test.ts`
Expected: PASS.

- [ ] **Step 5: Reemplazar las 6 copias**

En los 4 componentes con `fechaCorta` local (`Conversaciones.tsx`, `ZakView.tsx`, `Actividad.tsx`, `PromptEditor.tsx`): borrar la función local y añadir `import { fechaCorta } from "@/lib/admin/formato";`. Nota: en `Actividad.tsx` y `PromptEditor.tsx` la firma local era `(iso: string)` — la nueva acepta `string | null`, es un superset, compila igual.

En `BotsView.tsx`: borrar `horaBogota` local (líneas 11-17) e importarla.

En `cartera.ts`: borrar el cuerpo de `hoyBogota` (líneas 68-72) y reemplazar por re-export para no romper a sus consumidores:

```ts
export { hoyBogota } from "./formato";
```

- [ ] **Step 6: Verificar todo**

Run: `npx vitest run && npm run build`
Expected: verde (los tests de cartera existentes siguen pasando con el re-export).

Verificar que no quedó ninguna copia: `grep -rn "new Intl.DateTimeFormat" src/components/admin src/lib/admin --include="*.ts*" | grep -v formato` → solo usos legítimos que no sean estas 3 funciones (si aparece otro duplicado, migrarlo también).

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/formato.ts src/lib/admin/__tests__/formato.test.ts \
  src/components/admin/bots/Conversaciones.tsx src/components/admin/bots/ZakView.tsx \
  src/components/admin/bots/Actividad.tsx src/components/admin/bots/PromptEditor.tsx \
  src/components/admin/bots/BotsView.tsx src/lib/admin/cartera.ts
git commit -m "admin: formato.ts consolida las 6 copias de fechas es-CO/Bogotá"
```

---

### Task 5: Kit A — Button, IconButton, Island, PageHeader, Badge

**Files:**
- Create: `src/components/admin/ui/Button.tsx`
- Create: `src/components/admin/ui/IconButton.tsx`
- Create: `src/components/admin/ui/Island.tsx`
- Create: `src/components/admin/ui/PageHeader.tsx`
- Create: `src/components/admin/ui/Badge.tsx`

**Interfaces:**
- Consumes: `cn` (Task 1), tokens (Task 3).
- Produces:
  - `Button({ variante?: "primaria" | "fantasma" | "peligro", ...props de <button> })` — default `fantasma`, default `type="button"`.
  - `IconButton({ etiqueta: string, ...props de <button> })` — cuadrado 36px, aria-label obligatorio.
  - `Island({ titulo?: ReactNode, acciones?: ReactNode, ...props de <section> })`.
  - `PageHeader({ titulo: string, acciones?: ReactNode })`.
  - `Badge({ tono: TonoBadge, children })` con `TonoBadge = "nuevo" | "contactado" | "respondido" | "interesado" | "cliente" | "descartado" | "vivo" | "peligro" | "neutro"`.

- [ ] **Step 1: Crear `Button.tsx`**

```tsx
import { cn } from "@/lib/cn";

type Variante = "primaria" | "fantasma" | "peligro";

const VARIANTES: Record<Variante, string> = {
  primaria: "bg-acento text-white hover:bg-acento-85",
  fantasma: "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta",
  peligro: "bg-peligro/10 text-peligro hover:bg-peligro/20",
};

type Props = React.ComponentProps<"button"> & { variante?: Variante };

/** Botón-píldora del panel. Default fantasma; type="button" salvo que se pida submit. */
export function Button({ variante = "fantasma", className, type, ...props }: Props) {
  return (
    <button
      type={type ?? "button"}
      {...props}
      className={cn(
        "inline-flex h-control items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        VARIANTES[variante],
        className,
      )}
    />
  );
}
```

- [ ] **Step 2: Crear `IconButton.tsx`**

```tsx
import { cn } from "@/lib/cn";

type Props = React.ComponentProps<"button"> & {
  /** Nombre accesible: va a aria-label y title. */
  etiqueta: string;
};

export function IconButton({ etiqueta, className, type, ...props }: Props) {
  return (
    <button
      type={type ?? "button"}
      aria-label={etiqueta}
      title={etiqueta}
      {...props}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-tinta-60 transition-colors hover:bg-isla-alta hover:text-tinta disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    />
  );
}
```

- [ ] **Step 3: Crear `Island.tsx`**

```tsx
import { cn } from "@/lib/cn";

type Props = React.ComponentProps<"section"> & {
  titulo?: React.ReactNode;
  acciones?: React.ReactNode;
};

/** La card-región del panel: superficie isla, radio isla. Base de toda página. */
export function Island({ titulo, acciones, className, children, ...props }: Props) {
  return (
    <section {...props} className={cn("rounded-isla bg-isla p-4", className)}>
      {(titulo != null || acciones != null) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {titulo != null ? (
            <h2 className="text-sm font-semibold text-tinta-85">{titulo}</h2>
          ) : (
            <span />
          )}
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Crear `PageHeader.tsx`**

```tsx
type Props = {
  titulo: string;
  acciones?: React.ReactNode;
};

/** Cabecera de página dentro de la isla principal. */
export function PageHeader({ titulo, acciones }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
      <h1 className="text-lg font-semibold text-tinta">{titulo}</h1>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
    </header>
  );
}
```

- [ ] **Step 5: Crear `Badge.tsx`**

```tsx
import { cn } from "@/lib/cn";

const TONOS = {
  nuevo: "bg-estado-nuevo/15 text-estado-nuevo",
  contactado: "bg-estado-contactado/15 text-estado-contactado",
  respondido: "bg-estado-respondido/15 text-estado-respondido",
  interesado: "bg-estado-interesado/15 text-estado-interesado",
  cliente: "bg-estado-cliente/15 text-estado-cliente",
  descartado: "bg-estado-descartado/40 text-tinta-60",
  vivo: "bg-vivo/15 text-vivo",
  peligro: "bg-peligro/15 text-peligro",
  neutro: "bg-isla-alta text-tinta-60",
} as const;

export type TonoBadge = keyof typeof TONOS;

type Props = {
  tono: TonoBadge;
  className?: string;
  children: React.ReactNode;
};

export function Badge({ tono, className, children }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: verde (los componentes aún no tienen consumidores; TypeScript los chequea igual).

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ui/Button.tsx src/components/admin/ui/IconButton.tsx \
  src/components/admin/ui/Island.tsx src/components/admin/ui/PageHeader.tsx \
  src/components/admin/ui/Badge.tsx
git commit -m "admin/ui: Button, IconButton, Island, PageHeader, Badge"
```

---

### Task 6: Kit B — Field, Input, TextArea, Select, Toggle

**Files:**
- Create: `src/components/admin/ui/Field.tsx` (Field + Input + TextArea + Select en un archivo: cambian juntos)
- Create: `src/components/admin/ui/Toggle.tsx`

**Interfaces:**
- Consumes: `cn` (Task 1), tokens (Task 3), `ChevronDown` de lucide-react.
- Produces:
  - `Field({ label: string, error?: string, children })` — envuelve cualquier control.
  - `Input(props de <input>)` — píldora 38px, fondo isla-alta, sin borde.
  - `TextArea(props de <textarea>)` — radio fila (multilínea no lleva píldora).
  - `Select(props de <select>)` — nativo estilizado con chevron. (Port completo de Scribe: diferido a la fase de configurabilidad.)
  - `Toggle({ activo: boolean, onCambiar: (v: boolean) => void, etiqueta?: string })`.

- [ ] **Step 1: Crear `Field.tsx`**

```tsx
"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

export function Field({ label, error, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-tinta-60">{label}</span>
      {children}
      {error && <span className="text-xs text-peligro">{error}</span>}
    </label>
  );
}

const RELLENO =
  "w-full border-0 bg-isla-alta text-sm text-tinta placeholder:text-tinta-40 " +
  "focus:outline-2 focus:outline-acento disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input {...props} className={cn("h-control rounded-full px-4", RELLENO, className)} />
  );
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn("min-h-24 rounded-fila p-3 leading-relaxed", RELLENO, className)}
    />
  );
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative inline-flex w-full">
      <select
        {...props}
        className={cn("h-control appearance-none rounded-full px-4 pr-9", RELLENO, className)}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-40"
      />
    </span>
  );
}
```

- [ ] **Step 2: Crear `Toggle.tsx`**

```tsx
"use client";

import { cn } from "@/lib/cn";

type Props = {
  activo: boolean;
  onCambiar: (valor: boolean) => void;
  etiqueta?: string;
  disabled?: boolean;
};

export function Toggle({ activo, onCambiar, etiqueta, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      className="inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50"
    >
      <span
        className={cn(
          "flex h-4 w-7 items-center rounded-full p-0.5 transition-colors",
          activo ? "justify-end bg-acento" : "justify-start bg-tinta-40/40",
        )}
      >
        <span className="h-3 w-3 rounded-full bg-white transition-transform" />
      </span>
      {etiqueta && <span className="text-sm text-tinta-85">{etiqueta}</span>}
    </button>
  );
}
```

- [ ] **Step 3: Build y commit**

Run: `npm run build` — Expected: verde.

```bash
git add src/components/admin/ui/Field.tsx src/components/admin/ui/Toggle.tsx
git commit -m "admin/ui: Field/Input/TextArea/Select + Toggle"
```

---

### Task 7: Kit C — Tabs, ListRow, ChatBubble

**Files:**
- Create: `src/components/admin/ui/Tabs.tsx`
- Create: `src/components/admin/ui/ListRow.tsx`
- Create: `src/components/admin/ui/ChatBubble.tsx`

**Interfaces:**
- Consumes: `cn`, tokens.
- Produces:
  - `Tabs<T extends string>({ pestanas: readonly { id: T; label: ReactNode }[], activa: T, onCambiar: (id: T) => void })` — segmented control de píldoras; reemplaza las 2 copias de `adm-tabs` (`ZakView.tsx:155`, `AgenteView.tsx:140`).
  - `ListRow({ activa?: boolean, interactiva?: boolean, ...props de <div> })` — fila redondeada con hover.
  - `ChatBubble({ lado: "cliente" | "agente", autor: string, hora?: string, tonoAutor?: "acento" | "neutro", children })` — reemplaza las 2 copias de burbujas (`LabsChat.tsx:134`, `Conversaciones.tsx:329`).

- [ ] **Step 1: Crear `Tabs.tsx`**

```tsx
"use client";

import { cn } from "@/lib/cn";

type Pestana<T extends string> = { id: T; label: React.ReactNode };

type Props<T extends string> = {
  pestanas: readonly Pestana<T>[];
  activa: T;
  onCambiar: (id: T) => void;
};

/** Segmented control de píldoras. Genérico: T es la unión de ids de pestañas. */
export function Tabs<T extends string>({ pestanas, activa, onCambiar }: Props<T>) {
  return (
    <div
      role="tablist"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-isla-alta p-1"
    >
      {pestanas.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={p.id === activa}
          onClick={() => onCambiar(p.id)}
          className={cn(
            "h-8 shrink-0 rounded-full px-3.5 text-sm transition-colors",
            p.id === activa
              ? "bg-acento text-white"
              : "text-tinta-60 hover:bg-acento-10 hover:text-tinta",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crear `ListRow.tsx`**

```tsx
import { cn } from "@/lib/cn";

type Props = React.ComponentProps<"div"> & {
  /** Fila seleccionada/abierta: fondo acento suave. */
  activa?: boolean;
  /** false para filas puramente informativas (sin hover ni cursor). */
  interactiva?: boolean;
};

export function ListRow({ activa, interactiva = true, className, ...props }: Props) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-fila px-3 py-2.5 transition-colors",
        interactiva && "cursor-pointer hover:bg-isla-alta",
        activa && "bg-acento-10 hover:bg-acento-10",
        className,
      )}
    />
  );
}
```

- [ ] **Step 3: Crear `ChatBubble.tsx`**

Patrón Scribe adaptado: NO hay burbujas simétricas. El cliente lleva fondo y ancho acotado; el agente (Zak o el humano del panel) va a ancho completo con el autor como etiqueta de color.

```tsx
import { cn } from "@/lib/cn";

type Props = {
  /** cliente = con fondo, ancho acotado; agente = ancho completo, autor en color. */
  lado: "cliente" | "agente";
  autor: string;
  hora?: string;
  /** Color de la etiqueta de autor del agente (acento = Zak/Tú; neutro = sistema). */
  tonoAutor?: "acento" | "neutro";
  children: React.ReactNode;
};

export function ChatBubble({ lado, autor, hora, tonoAutor = "acento", children }: Props) {
  if (lado === "cliente") {
    return (
      <div className="flex justify-start">
        <div className="w-fit max-w-[85%] rounded-fila bg-isla-alta px-4 py-2.5">
          <p className="mb-1 text-xs text-tinta-40">
            {autor}
            {hora ? ` · ${hora}` : ""}
          </p>
          <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-tinta">
            {children}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full">
      <p
        className={cn(
          "mb-1 text-xs font-medium tracking-wide",
          tonoAutor === "acento" ? "text-acento" : "text-tinta-60",
        )}
      >
        {autor}
        {hora ? <span className="font-normal text-tinta-40"> · {hora}</span> : null}
      </p>
      <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-tinta-85">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build y commit**

Run: `npm run build` — Expected: verde.

```bash
git add src/components/admin/ui/Tabs.tsx src/components/admin/ui/ListRow.tsx \
  src/components/admin/ui/ChatBubble.tsx
git commit -m "admin/ui: Tabs, ListRow, ChatBubble"
```

---

### Task 8: Kit D — Skeleton, EmptyState, Banner, Modal

**Files:**
- Create: `src/components/admin/ui/Skeleton.tsx`
- Create: `src/components/admin/ui/EmptyState.tsx`
- Create: `src/components/admin/ui/Banner.tsx`
- Create: `src/components/admin/ui/Modal.tsx`

**Interfaces:**
- Consumes: `cn`, tokens, `@radix-ui/react-dialog`.
- Produces:
  - `Skeleton({ className? })` — barra `animate-pulse`; el ancho/alto lo pone el consumidor por className.
  - `EmptyState({ titulo: string, detalle?: string, accion?: ReactNode })`.
  - `Banner({ variante?: "aviso" | "error", children })` — para TODOS los estados degradados.
  - `Modal({ abierto: boolean, onCerrar: (abierto: boolean) => void, titulo: string, children })`.

- [ ] **Step 1: Crear `Skeleton.tsx`**

```tsx
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-full bg-isla-alta", className)} />;
}
```

- [ ] **Step 2: Crear `EmptyState.tsx`**

```tsx
type Props = {
  titulo: string;
  detalle?: string;
  accion?: React.ReactNode;
};

/** Estado vacío centrado, dos niveles de texto (patrón Scribe). */
export function EmptyState({ titulo, detalle, accion }: Props) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center select-none">
      <p className="text-base font-medium text-tinta-85">{titulo}</p>
      {detalle && <p className="max-w-sm text-sm text-tinta-60">{detalle}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Crear `Banner.tsx`**

```tsx
import { cn } from "@/lib/cn";

type Props = {
  variante?: "aviso" | "error";
  className?: string;
  children: React.ReactNode;
};

/** Estados degradados ("sin conexión con el bot desde las 10:30") y errores. */
export function Banner({ variante = "aviso", className, children }: Props) {
  return (
    <div
      role={variante === "error" ? "alert" : "status"}
      className={cn(
        "rounded-fila border px-4 py-2.5 text-sm",
        variante === "aviso" && "border-hairline bg-isla-alta text-tinta-60",
        variante === "error" && "border-peligro/30 bg-peligro/10 text-peligro",
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Crear `Modal.tsx`**

```tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "@/components/admin/ui/IconButton";

type Props = {
  abierto: boolean;
  onCerrar: (abierto: boolean) => void;
  titulo: string;
  children: React.ReactNode;
};

/** Modal de velo con blur (cero sombras: profundidad por capas). */
export function Modal({ abierto, onCerrar, titulo, children }: Props) {
  return (
    <Dialog.Root open={abierto} onOpenChange={onCerrar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-isla border border-hairline bg-velo p-6 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Dialog.Title className="text-base font-medium text-tinta">{titulo}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton etiqueta="Cerrar">
                <X className="h-4 w-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 5: Build y commit**

Run: `npm run build` — Expected: verde.

```bash
git add src/components/admin/ui/Skeleton.tsx src/components/admin/ui/EmptyState.tsx \
  src/components/admin/ui/Banner.tsx src/components/admin/ui/Modal.tsx
git commit -m "admin/ui: Skeleton, EmptyState, Banner, Modal"
```

---

### Task 9: Shell — sidebar de islas colapsable

**Files:**
- Create: `src/components/admin/ui/sidebar-store.ts`
- Create: `src/components/admin/Sidebar.tsx`
- Modify: `src/app/admin/(panel)/layout.tsx` (reescritura completa, 17 líneas hoy)
- Delete: `src/components/admin/AdminNav.tsx`
- Modify: `src/styles/admin.css` (ajustar `.adm-shell` y `.adm-main` a la shell nueva)

**Interfaces:**
- Consumes: `cn`, tokens, `IconButton` (Task 5), `logout` de `@/lib/admin/actions` (existente), `StatusGlobal` de `@/lib/bots/tipos` (existente), iconos lucide.
- Produces: `useSidebarColapsado(): boolean` + `alternarSidebar(): void` (store con `useSyncExternalStore` + localStorage `"zk-sidebar-colapsado"`); `<Sidebar />` (client). El layout `(panel)` pasa a: viewport `p-aire gap-aire` + Sidebar + `<main>` isla.

- [ ] **Step 1: Crear `sidebar-store.ts`**

```ts
"use client";

import { useSyncExternalStore } from "react";

/** Colapso del sidebar persistido. Patrón useSyncExternalStore + localStorage:
 *  sin contexto, sin hydration mismatch (el servidor siempre ve expandido). */

const CLAVE = "zk-sidebar-colapsado";
const oyentes = new Set<() => void>();

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

function instantanea(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function instantaneaServidor(): boolean {
  return false;
}

export function alternarSidebar(): void {
  try {
    localStorage.setItem(CLAVE, instantanea() ? "0" : "1");
  } catch {
    /* sin storage no hay persistencia, pero tampoco crash */
  }
  for (const oyente of oyentes) oyente();
}

export function useSidebarColapsado(): boolean {
  return useSyncExternalStore(suscribir, instantanea, instantaneaServidor);
}
```

- [ ] **Step 2: Crear `Sidebar.tsx`**

Conserva `saludDe` + `useSaludBots` de `AdminNav.tsx` (cópialos literales — el semáforo junto a "Bots" con poll de 60s a `/admin/api/bots/status` es funcionalidad, no estilo). Estructura completa:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  Boxes,
  LogOut,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  Users,
  X,
} from "lucide-react";
import { logout } from "@/lib/admin/actions";
import type { StatusGlobal } from "@/lib/bots/tipos";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/admin/ui/IconButton";
import { alternarSidebar, useSidebarColapsado } from "@/components/admin/ui/sidebar-store";

const SECCIONES = [
  { href: "/admin/mapa", label: "Mapa", Icono: Map },
  { href: "/admin/negocios", label: "Negocios", Icono: Store },
  { href: "/admin/zak", label: "Zak", Icono: Bot },
  { href: "/admin/clientes", label: "Clientes", Icono: Users },
  { href: "/admin/bots", label: "Bots", Icono: Boxes },
] as const;

type Salud = "ok" | "atencion" | "problema";

function saludDe(status: StatusGlobal): Salud {
  if (status.cola.jobs_fallidos > 0) return "problema";
  if (status.cola.jobs_pendientes > 5 || status.cola.edad_del_job_mas_viejo_s > 120) {
    return "atencion";
  }
  return "ok";
}

/** Punto de salud junto a "Bots": enterarse de una caída sin entrar a la página. */
function useSaludBots(): Salud | null {
  const [salud, setSalud] = useState<Salud | null>(null);

  useEffect(() => {
    let activo = true;
    async function poll() {
      try {
        const res = await fetch("/admin/api/bots/status");
        if (!activo) return;
        if (!res.ok) throw new Error(String(res.status));
        setSalud(saludDe((await res.json()) as StatusGlobal));
      } catch {
        if (activo) setSalud("problema");
      }
    }
    void poll();
    const timer = setInterval(poll, 60_000);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, []);

  return salud;
}

const COLOR_SALUD: Record<Salud, string> = {
  ok: "bg-vivo",
  atencion: "bg-estado-contactado",
  problema: "bg-peligro",
};

const TITULO_SALUD: Record<Salud, string> = {
  ok: "Bots al día",
  atencion: "Cola de mensajes acumulada",
  problema: "Jobs fallidos o sin conexión",
};

/** Contenido del sidebar: islas apiladas (marca / navegación / usuario). */
function ContenidoSidebar({
  colapsado,
  onNavegar,
}: {
  colapsado: boolean;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const salud = useSaludBots();

  return (
    <div className="flex h-full flex-col gap-aire">
      <div className="flex items-center justify-between rounded-isla bg-isla px-3 py-3">
        {!colapsado && (
          <Link href="/admin/mapa" className="pl-1 text-sm font-bold tracking-wide text-tinta">
            ZAKUMI <span className="font-editorial text-acento italic">Panel</span>
          </Link>
        )}
        <IconButton
          etiqueta={colapsado ? "Expandir menú" : "Colapsar menú"}
          onClick={alternarSidebar}
          className="max-[899px]:hidden"
        >
          {colapsado ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </IconButton>
      </div>

      <nav className="flex flex-1 flex-col gap-1 rounded-isla bg-isla p-2">
        {SECCIONES.map(({ href, label, Icono }) => {
          const activa = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavegar}
              title={label}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-full px-3 text-sm transition-colors",
                colapsado && "justify-center px-0",
                activa
                  ? "bg-acento-10 font-medium text-acento"
                  : "text-tinta-60 hover:bg-isla-alta hover:text-tinta",
              )}
            >
              <Icono className="h-4 w-4 shrink-0" />
              {!colapsado && <span className="truncate">{label}</span>}
              {href === "/admin/bots" && salud && (
                <span
                  title={TITULO_SALUD[salud]}
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    COLOR_SALUD[salud],
                    !colapsado && "ml-auto",
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-isla bg-isla p-2">
        <form action={logout}>
          <button
            type="submit"
            title="Salir"
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-sm text-tinta-60 transition-colors hover:bg-isla-alta hover:text-tinta",
              colapsado && "justify-center px-0",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!colapsado && <span>Salir</span>}
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar() {
  const colapsado = useSidebarColapsado();
  const [movilAbierto, setMovilAbierto] = useState(false);
  const pathname = usePathname();

  // Cerrar el overlay móvil al navegar.
  useEffect(() => {
    setMovilAbierto(false);
  }, [pathname]);

  return (
    <>
      {/* Desktop: columna estática colapsable */}
      <aside
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 min-[900px]:block",
          colapsado ? "w-14" : "w-60",
        )}
      >
        <ContenidoSidebar colapsado={colapsado} />
      </aside>

      {/* Móvil: botón flotante + overlay con velo */}
      <IconButton
        etiqueta="Abrir menú"
        onClick={() => setMovilAbierto(true)}
        className="fixed bottom-4 left-4 z-40 bg-isla-alta backdrop-blur min-[900px]:hidden"
      >
        <Menu className="h-4 w-4" />
      </IconButton>
      {movilAbierto && (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMovilAbierto(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col p-aire">
            <div className="mb-aire self-end">
              <IconButton etiqueta="Cerrar menú" onClick={() => setMovilAbierto(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">
              <ContenidoSidebar colapsado={false} onNavegar={() => setMovilAbierto(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Reescribir `src/app/admin/(panel)/layout.tsx`**

Contenido completo (conservar el comentario de auth — sigue siendo cierto):

```tsx
import { Sidebar } from "@/components/admin/Sidebar";

// Chrome del panel. SIN check de sesión a propósito: en Next 16 los layouts
// no se re-renderizan al navegar, así que la auth vive en el proxy y en
// verifySession() dentro de cada page/action/handler.
export default function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh gap-aire p-aire">
      <Sidebar />
      <main className="adm-main barra-fina min-w-0 flex-1 overflow-y-auto rounded-isla bg-isla">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Borrar `AdminNav.tsx` y ajustar el CSS legado**

```bash
git rm src/components/admin/AdminNav.tsx
```

En `src/styles/admin.css`:
- `.adm-shell`: quitar `display: flex; flex-direction: column;` (la estructura la pone ahora el layout; dejar las variables `--estado-*`/`--superficie*`/`--hairline*`, colores y fuente).
- `.adm-main`: quitar cualquier `max-width`/`margin` de centrado si lo tiene; dejar su padding interno (las páginas sin migrar lo necesitan). Borrar el bloque `/* ——— Topbar ——— */` completo (`.adm-topbar*`, `.adm-salud*`): ya no tiene consumidores.

- [ ] **Step 5: Verificación visual completa**

`npm run dev` + navegador: login → panel. Chequear: sidebar con las 5 secciones e iconos, sección activa en naranja, colapso con persistencia (recargar la página: se mantiene), semáforo junto a Bots, overlay móvil (viewport angosto), logout funciona, y CADA página legada (`mapa`, `negocios`, `zak`, `clientes`, `bots`) renderiza dentro de la isla principal sin romperse (se verán "viejas por dentro" — correcto en esta etapa).

- [ ] **Step 6: Build, tests y commit**

Run: `npm run build && npm test` — Expected: verde.

```bash
git add src/components/admin/ui/sidebar-store.ts src/components/admin/Sidebar.tsx \
  "src/app/admin/(panel)/layout.tsx" src/styles/admin.css
# (el borrado de AdminNav.tsx ya quedó staged por el git rm del Step 4)
git commit -m "admin: shell de islas — sidebar colapsable reemplaza al topbar"
```

---

## Tareas de migración por página (10-14)

**Procedimiento común** — cada tarea de página aplica esta tabla a TODOS los archivos listados de la página (nunca media página), y termina con: `npm run build && npm test` verdes, QA visual de la página (incluidos sus estados degradados), `grep -n "adm-" <archivos migrados>` → 0 resultados, y commit.

| Antes (`adm-*`) | Después |
|---|---|
| `adm-cta` | `<Button variante="primaria">` |
| `adm-cta-ghost` | `<Button>` (o `<IconButton etiqueta>` si es solo icono) |
| `adm-field` + `adm-field-label` + `adm-input` | `<Field label><Input /></Field>` (Select/TextArea según control) |
| `adm-badge--*`, chips de estado | `<Badge tono="...">` (tono = estado del pipeline, `vivo`, `peligro` o `neutro`) |
| Cards de sección (`adm-bot-card`, `adm-zak-tanda`, `adm-producto`, `adm-360-oportunidad`) | `<Island titulo acciones>` |
| Filas seleccionables (`adm-conv-item`, `adm-resultado`, filas de tabla) | `<ListRow activa onClick>` |
| Barra de pestañas (`adm-tabs` + `useState` propio) | `<Tabs pestanas activa onCambiar>` (el `useState<Pestana>` se queda en la vista) |
| Burbujas de chat | `<ChatBubble lado autor hora>` |
| Banners "sin conexión…" / errores | `<Banner>` / `<Banner variante="error">` (texto idéntico) |
| Estados vacíos | `<EmptyState titulo detalle>` |
| "Cargando…" | `<Skeleton className="h-3 w-2/3" />` ×3 (o el texto existente dentro de `EmptyState`) |
| `window.confirm` | SE QUEDA (cambiarlo es funcionalidad, no estilo) |
| Fechas formateadas a mano | `fechaCorta`/`horaBogota` de `@/lib/admin/formato` (ya migradas en Task 4) |
| Layout de página | Cuerpo directo en la isla `<main>`: `<PageHeader titulo acciones>` + contenido con `px-5 py-4`; sub-regiones como `<Island>` solo si son bloques separados de verdad |

Regla de adaptación: los nombres de props/campos de datos reales de cada componente mandan sobre los ejemplos del plan — el ejecutor lee el componente antes de tocarlo. Prohibido cambiar lógica: hooks, fetches, polling, transiciones y server actions quedan intactos.

---

### Task 10: Migrar `/admin/zak` (cockpit + componentes compartidos de chat)

**Files:**
- Modify: `src/components/admin/bots/ZakView.tsx` (6 pestañas → `<Tabs>`; tandas/métricas/interesados con `Island`/`ListRow`/`Badge`)
- Modify: `src/components/admin/bots/Conversaciones.tsx` (lista de chats → `ListRow`; mensajes → `ChatBubble`; envío manual → `Input` + `Button`)
- Modify: `src/components/admin/bots/LabsChat.tsx` (mensajes → `ChatBubble`; composer → `Input` + `Button`)
- Modify: `src/components/admin/bots/PromptEditor.tsx` (editor → `TextArea`; versiones → `ListRow`; diff 409 conserva su presentación lado a lado)
- Modify: `src/components/admin/bots/Actividad.tsx` (actividad/jobs/leads → `ListRow` + `Badge`)
- Modify: `src/app/admin/(panel)/zak/page.tsx` (si trae markup propio con `adm-*`)

**Interfaces:**
- Consumes: todo el kit (Tasks 5-8), `fechaCorta` (Task 4).
- Produces: `Conversaciones`, `LabsChat`, `PromptEditor` y `Actividad` migrados sirven también a `/admin/bots/[id]` (Task 13 casi no los toca — se migran UNA vez aquí).

- [ ] **Step 1: Migrar `ZakView.tsx`** — pestañas con el genérico:

```tsx
const PESTANAS = [
  { id: "bandeja", label: "Bandeja" },
  { id: "interesados", label: "Interesados" },
  { id: "tandas", label: "Tandas" },
  { id: "metricas", label: "Métricas" },
  { id: "prompt", label: "Prompt" },
  { id: "labs", label: "Labs" },
] as const satisfies readonly { id: Pestana; label: string }[];

<Tabs pestanas={PESTANAS} activa={pestana} onCambiar={setPestana} />
```

(el tipo `Pestana` y el `useState` existentes se conservan). El banner degradado de `ZakView.tsx:144` pasa a `<Banner>` con el MISMO texto.

- [ ] **Step 2: Migrar los mensajes de `Conversaciones.tsx` y `LabsChat.tsx`** — patrón (adaptar campos reales):

```tsx
{mensajes.map((m) => (
  <ChatBubble
    key={m.id}
    lado={m.rol === "user" ? "cliente" : "agente"}
    autor={m.rol === "user" ? "Cliente" : "Zak"}
    hora={fechaCorta(m.creado_en)}
  >
    {m.contenido}
  </ChatBubble>
))}
```

En Labs quien escribe ES el cliente de prueba: sus mensajes van con `lado="cliente"` y `autor="Tú (cliente)"`. En la Bandeja, si el mensaje salió del envío manual del panel, `autor="Tú"` con `lado="agente"`. El contenedor de scroll lleva `barra-fina` y conserva la lógica de scroll/paginación existente (bloques de 50, "Más recientes / Más antiguas" como `<Button>`).

- [ ] **Step 3: Migrar `PromptEditor.tsx` y `Actividad.tsx`** con la tabla común (el flujo 409 → diff + rollback no se toca: solo clases).

- [ ] **Step 4: Verificación funcional completa del cockpit**

Con sesión: las 6 pestañas cambian, la Bandeja lista y abre chats, el envío manual sigue (no enviar a clientes reales: probar con el chat propio de Tomás si hay, o solo verificar que el form no rompió), Labs responde (o degrada con `Banner` si Railway no contesta), Prompt guarda y muestra versiones, deep-link `/admin/zak?telefono=...` sigue abriendo el chat.

- [ ] **Step 5: Grep, build, tests y commit**

```bash
grep -rn "adm-" src/components/admin/bots/ZakView.tsx src/components/admin/bots/Conversaciones.tsx \
  src/components/admin/bots/LabsChat.tsx src/components/admin/bots/PromptEditor.tsx \
  src/components/admin/bots/Actividad.tsx   # → 0 resultados
npm run build && npm test
git add src/components/admin/bots/ZakView.tsx src/components/admin/bots/Conversaciones.tsx \
  src/components/admin/bots/LabsChat.tsx src/components/admin/bots/PromptEditor.tsx \
  src/components/admin/bots/Actividad.tsx "src/app/admin/(panel)/zak/page.tsx"
git commit -m "admin: cockpit de Zak re-vestido con el kit (Tabs, ChatBubble, Islands)"
```

---

### Task 11: Migrar `/admin/negocios`

**Files:**
- Modify: `src/components/admin/negocios/NegociosView.tsx`
- Modify: `src/app/admin/(panel)/negocios/page.tsx` (si trae markup con `adm-*`)

**Interfaces:**
- Consumes: kit + `Badge` con tonos = estados del pipeline.

- [ ] **Step 1: Migrar `NegociosView.tsx`** con la tabla común. Decisiones específicas:
  - La tabla del pipeline pasa a lista de `<ListRow>` con grid interno: `<ListRow className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3">` (checkbox de lote · nombre+detalle · `<Badge tono={estado}>` · teléfono · acciones). Ajustar las columnas a las que la tabla real tenga hoy.
  - Filtros de estado → píldoras `<Button>` o `<Tabs>` según sean excluyentes (mirar el comportamiento actual y conservarlo).
  - "🧡 Que Zak los contacte" (`NegociosView.tsx:271`) → `<Button variante="primaria">` con icono `Bot` de lucide en vez del emoji; el texto se conserva.
  - El link por fila a `/admin/zak?telefono=…` (`NegociosView.tsx:382`) se conserva como `<IconButton>` con icono `MessageSquare` (lucide) + `title`.
  - Selección en lote, cambio de estado (Select del kit) y eliminar en lote (`Button variante="peligro"` + su `window.confirm` intacto) siguen funcionando igual.

- [ ] **Step 2: Verificación funcional**: filtrar, seleccionar varios, cambiar estado (verificar que la nota automática del trigger sigue apareciendo — es de BD, no debería ni notarse), botón de Zak, eliminar en lote con confirm.

- [ ] **Step 3: Grep, build, tests y commit**

```bash
grep -rn "adm-" src/components/admin/negocios/ # → 0
npm run build && npm test
git add src/components/admin/negocios/NegociosView.tsx "src/app/admin/(panel)/negocios/page.tsx"
git commit -m "admin: negocios re-vestido — pipeline como filas píldora con Badge de estado"
```

---

### Task 12: Migrar `/admin/clientes` + ficha 360

**Files:**
- Modify: `src/components/admin/clientes/ClientesView.tsx`
- Modify: `src/components/admin/clientes/FichaCliente.tsx`
- Modify: `src/components/admin/clientes/Ficha360.tsx`
- Modify: `src/components/admin/clientes/NuevoClienteForm.tsx`
- Modify: `src/components/admin/clientes/ProductoForm.tsx`
- Modify: `src/components/admin/clientes/VincularBot.tsx`
- Modify: `src/app/admin/(panel)/clientes/page.tsx` y `src/app/admin/(panel)/clientes/[id]/page.tsx` (si traen markup con `adm-*`)

**Interfaces:**
- Consumes: kit completo.

- [ ] **Step 1: Migrar los 6 componentes** con la tabla común. Decisiones específicas:
  - Semáforo vencido/por vencer → `<Badge tono="peligro">` / `<Badge tono="contactado">` (amarillo) / `<Badge tono="vivo">` — mapear a los estados reales de `semaforoCobro`.
  - Ficha 360: productos (`adm-producto`) y oportunidades (`adm-360-oportunidad`) → `<Island>` por sección con `<ListRow interactiva={false}>` por item.
  - Estado vivo del bot vinculado: `<Badge tono="vivo">` cuando conectado, `<Banner>` cuando degradado (texto idéntico al actual).
  - Formularios (`NuevoClienteForm`, `ProductoForm`, `VincularBot`) → `Field`/`Input`/`Select` + `Button`. El select de VincularBot con lista viva conserva su carga/validación.

- [ ] **Step 2: Verificación funcional**: crear cliente de prueba, añadir producto, vincular/desvincular bot (o ver su degradado), y BORRAR el cliente de prueba al final desde la misma UI si existe la acción (si no existe, dejarlo con nombre "PRUEBA DS — borrar").

- [ ] **Step 3: Grep, build, tests y commit**

```bash
grep -rn "adm-" src/components/admin/clientes/ # → 0
npm run build && npm test
git add src/components/admin/clientes/ "src/app/admin/(panel)/clientes/"
git commit -m "admin: clientes y ficha 360 re-vestidos con el kit"
```

---

### Task 13: Migrar `/admin/bots`

**Files:**
- Modify: `src/components/admin/bots/BotsView.tsx`
- Modify: `src/components/admin/bots/NuevoBotForm.tsx`
- Modify: `src/components/admin/bots/AgenteView.tsx`
- Modify: `src/app/admin/(panel)/bots/page.tsx` y `src/app/admin/(panel)/bots/[id]/page.tsx` (si traen markup con `adm-*`)

**Interfaces:**
- Consumes: kit + los componentes compartidos ya migrados en Task 10 (`Conversaciones`, `LabsChat`, `PromptEditor`, `Actividad`).

- [ ] **Step 1: Migrar los 3 componentes** con la tabla común. Decisiones específicas:
  - `adm-bot-card` → `<Island>` por bot con `<Badge tono="vivo">`/`<Badge tono="peligro">` para el estado, en grid `grid gap-aire md:grid-cols-2 xl:grid-cols-3`.
  - El banner "Sin conexión con el bot desde las HH:MM" (`BotsView.tsx:82`) → `<Banner>` con el MISMO texto y la misma `horaBogota` (ya importada de formato.ts).
  - `AgenteView.tsx:140` (la segunda copia de pestañas) → `<Tabs>` genérico, igual que ZakView.
  - Apagado de emergencia → `<Button variante="peligro">` con su `window.confirm` intacto. Duplicar bot → `<Button>`.
  - `NuevoBotForm` (form con 5 plantillas por vertical) → `Field`/`Input`/`Select`/`TextArea`. OJO regla existente: jamás reenviar credenciales redactadas `•••` — no tocar esa lógica.

- [ ] **Step 2: Verificación funcional**: lista de bots con polling 30s, entrar a una ficha, las 4 pestañas (ya migradas) funcionan, `bots/1` sigue redirigiendo a `/admin/zak`.

- [ ] **Step 3: Grep, build, tests y commit**

```bash
grep -rn "adm-" src/components/admin/bots/ # → 0 (ya migrados los 5 de Task 10 + estos 3)
npm run build && npm test
git add src/components/admin/bots/BotsView.tsx src/components/admin/bots/NuevoBotForm.tsx \
  src/components/admin/bots/AgenteView.tsx "src/app/admin/(panel)/bots/"
git commit -m "admin: consola de bots re-vestida con el kit"
```

---

### Task 14: Migrar `/admin/mapa`, login y limpieza final

**Files:**
- Modify: `src/components/admin/mapa/MapaView.tsx`, `SearchPanel.tsx`, `FichaNegocio.tsx`, `NuevoNegocioForm.tsx` (`MapCanvas.tsx` solo su contenedor)
- Modify: `src/components/admin/LoginForm.tsx` y `src/app/admin/login/page.tsx`
- Modify: `src/app/admin/layout.tsx` (quitar import de admin.css y clase `adm-shell`)
- Modify: `src/app/admin/(panel)/layout.tsx` (quitar clase `adm-main`)
- Delete: `src/styles/admin.css`

**Interfaces:**
- Consumes: kit completo.
- Produces: cero clases `adm-*` en el repo; `admin.css` eliminado (criterios de éxito 2 y 4 del spec).

- [ ] **Step 1: Migrar el mapa.** El DOM interno de Google Maps NO se toca (AdvancedMarker/InfoWindow renderizan lo suyo): `MapCanvas` se envuelve en `rounded-isla overflow-hidden` para que el mapa herede la esquina redondeada. `SearchPanel` y `FichaNegocio` → `<Island>` flotantes/laterales con `Field`/`Input`/`Button`/`Badge`; resultados de búsqueda → `<ListRow>`. Los pins (`adm-pin--*`) conservan sus colores vía los tokens `--color-estado-*`. La búsqueda "solo negocios con teléfono" y el form manual funcionan igual.

- [ ] **Step 2: Migrar `LoginForm.tsx`**: `<Island>` centrada `max-w-sm`, `Field`/`Input` (email + password), `<Button variante="primaria" type="submit">`, error de credenciales como `<Banner variante="error">` con el texto actual.

- [ ] **Step 3: Limpieza final.**

- `src/app/admin/layout.tsx`: quitar `import "@/styles/admin.css";` y dejar el wrapper como `<div className="panel">{children}</div>`.
- `src/app/admin/(panel)/layout.tsx`: quitar `adm-main` del `<main>` (quedan las utilidades) y darle el padding que aportaba: el contenido de página ya usa `px-5 py-4` desde las tareas 10-13; verificar visualmente.
- `git rm src/styles/admin.css` (muere con él el bloque puente de la Task 2).
- Verificación dura: `grep -rn "adm-" src/` → **0 resultados**. `grep -rn "admin.css" src/` → 0.

- [ ] **Step 4: Verificación final completa.**

- `npm run build && npm test` → verde.
- Recorrido visual completo: login → mapa → negocios → zak (6 pestañas) → clientes → ficha 360 → bots → ficha bot. Todos los estados degradados visibles apagando el acceso al bot si es posible (o al menos verificando que los `<Banner>` renderizan donde antes).
- Landing: captura de la home comparada con la referencia de Task 2 — idéntica.

- [ ] **Step 5: Commit final**

```bash
git add src/components/admin/mapa/ src/components/admin/LoginForm.tsx \
  src/app/admin/login/ src/app/admin/layout.tsx "src/app/admin/(panel)/layout.tsx"
# (el borrado de admin.css ya quedó staged por el git rm del Step 3)
git commit -m "admin: mapa y login re-vestidos; admin.css eliminado — design system completo"
```

---

## Verificación de cierre (criterios del spec)

1. Landing idéntica píxel a píxel (capturas Task 2 vs Task 14).
2. `grep -rn "adm-" src/` → 0; `src/styles/admin.css` no existe.
3. Todo botón/input/tab/chip sale de `src/components/admin/ui/`; 1 sola implementación de fechas (`formato.ts`).
4. Look isla en todo el panel: fondo `#0A0C12`, islas 24px, píldoras naranjas, sidebar colapsable.
5. `npm run build && npm test` verdes; los ~15 estados degradados renderizan con sus textos originales.
