# Fase 5 — Breadcrumb en las vistas de nivel superior

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada vista de nivel superior del Sidebar del panel `/admin` muestra dónde
está parado el usuario (`migas`, un breadcrumb de texto plano) en vez de
depender solo del título. `PageHeader` gana la prop; las 10 vistas la usan.

**Architecture:** `PageHeader` (`src/components/admin/ui/PageHeader.tsx`) gana
una prop opcional `migas: string[]`, renderizada como una línea de texto plano
(sin links) por encima del título, ej. `Encontrar clientes / Territorio`. Tres
vistas (Bots, Voz, Equipo) todavía no usan `PageHeader` — tienen un `<header>`
escrito a mano — así que primero migran a `PageHeader` y de paso ganan `migas`.
Las otras 7 vistas ya usan `PageHeader`: solo agregan la prop.

**Tech Stack:** Next.js 16 App Router + TypeScript + Tailwind v4. Sin cambios
de esquema, sin Server Actions nuevas, sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md`
(Decisión 13). Esta es la Fase 5 de 6 del spec.

## Global Constraints

- **Cero tests de componentes/route handlers en este repo** (`vitest.config.ts`:
  `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts"]`). Todos
  los cambios de esta fase son de componentes React (`.tsx`) — ningún task
  agrega un test. La verificación es `tsc --noEmit` + `npm test` (no debe
  bajar de 651 pasando) + revisión manual visual.
- **`migas` es `string[]` plano — sin links, sin objetos.** Coincide
  literalmente con la Decisión 13 del spec. No conviertas los segmentos en
  `<Link>`: son solo texto ("dónde estoy", no "a dónde puedo ir" — para eso ya
  está el Sidebar).
- **El spec fue escrito antes de que `Territorios` se agregara como entrada
  propia del Sidebar** (lo trajo la rama paralela `feat/panel-rediseno`, ya
  reflejada en este código). El spec dice "8 vistas del Sidebar + Métricas = 9
  vistas"; hoy el Sidebar tiene 10 entradas
  (`src/components/admin/Sidebar.tsx:28-40`, `SECCIONES`). Esta fase cubre las
  **10**, incluyendo Territorios — es la misma regla del spec (toda vista de
  nivel superior del Sidebar), no un cambio de alcance.
- **No toca `/admin/territorios/[id]` (`TerritorioDetalleView.tsx`) ni
  `/admin/bots/[id]` (`AgenteView.tsx`) ni `/admin/voz/[id]`
  (`FichaAgenteVoz.tsx`).** Son vistas de detalle, un nivel más adentro de una
  vista de nivel superior — la misma exclusión que el spec ya aplica al header
  del chat de Zak (Decisión 8: "no es una vista de nivel superior"). Ya tienen
  su propio breadcrumb ad-hoc (ej. `TerritorioDetalleView.tsx` ya arma
  `<Link>Territorios</Link> / ...` a mano en su `subtitulo`) — no se toca.
- **No renombres ni reordenes las 10 entradas de `SECCIONES`** — el texto de
  cada `migas[0]` es literal el mismo string que ya usa `SECCIONES[i].label`
  hoy (ver la tabla de la Task 3), no una nueva etiqueta.

---

### Task 1: `PageHeader` gana la prop `migas`

**Files:**
- Modify: `src/components/admin/ui/PageHeader.tsx`

**Interfaces:**
- Produces: `PageHeader`'s `Props` type gana `migas?: string[]`. Las Tasks 2 y
  3 consumen esta prop.

- [ ] **Step 1: Agregar la prop al tipo y renderizarla**

Editar `src/components/admin/ui/PageHeader.tsx` completo así:

```tsx
import { cn } from "@/lib/cn";

type Props = {
  titulo: string;
  /** La coletilla editorial en cursiva naranja («el censo de la calle»). */
  coletilla?: string;
  /** Línea pequeña bajo el título (la instancia de Zak, qué es esta pantalla). */
  subtitulo?: React.ReactNode;
  /** Dónde está parado el usuario, ej. ["Zak", "Bandeja"]. Sin links: para
   *  navegar ya está el Sidebar, esto solo dice dónde se está. */
  migas?: string[];
  /** Cifras a la derecha («75 negocios · 40 sin web»). */
  contador?: React.ReactNode;
  /** El nivel de navegación de la pantalla: <Caras>, <Tabs> o la semana. */
  navegacion?: React.ReactNode;
  acciones?: React.ReactNode;
};

/**
 * Cabecera de página dentro de la isla principal. Una sola fila que aprovecha
 * el ancho: título a la izquierda, navegación en medio, cifras y acciones a
 * la derecha. Antes cada pantalla copiaba este markup a mano y la navegación
 * ocupaba una fila entera debajo.
 */
export function PageHeader({
  titulo,
  coletilla,
  subtitulo,
  migas,
  contador,
  navegacion,
  acciones,
}: Props) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-5 py-3">
      <div className="min-w-0">
        {migas && migas.length > 0 && (
          <p className="truncate text-xs text-tinta-40">{migas.join(" / ")}</p>
        )}
        <h1 className="text-lg font-semibold text-tinta">
          {titulo}
          {coletilla && (
            <>
              {" "}
              <span className="font-editorial text-base font-normal italic text-acento">
                {coletilla}
              </span>
            </>
          )}
        </h1>
        {subtitulo && <p className="text-xs text-tinta-60">{subtitulo}</p>}
      </div>

      {navegacion && <div className="min-[900px]:ml-auto">{navegacion}</div>}

      {(contador || acciones) && (
        <div className={cn("flex items-center gap-3", !navegacion && "ml-auto")}>
          {contador && <span className="text-xs text-tinta-40">{contador}</span>}
          {acciones && <div className="flex items-center gap-2">{acciones}</div>}
        </div>
      )}
    </header>
  );
}
```

(Solo cambió: `migas` en `Props`, en la destructuración, y el nuevo `<p>` de
migas antes del `<h1>`. Todo lo demás queda idéntico byte a byte.)

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores (nadie más pasa `migas` todavía, así que no rompe a nadie
— la prop es opcional).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ui/PageHeader.tsx
git commit -m "feat: PageHeader gana la prop migas (breadcrumb de texto)"
```

---

### Task 2: Bots, Voz y Equipo migran su header a mano hacia `PageHeader`

Estas tres vistas nunca usaron `PageHeader` — tienen un `<header>` escrito a
mano. Migran ahora y de paso ganan `migas`, igual que las otras 7.

**Files:**
- Modify: `src/components/admin/bots/BotsView.tsx`
- Modify: `src/components/admin/voz/VozView.tsx`
- Modify: `src/app/admin/(panel)/equipo/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` de la Task 1 (`titulo`, `migas`, `contador`,
  `acciones`, `subtitulo`).

- [ ] **Step 1: `BotsView.tsx` — reemplazar el `<header>` a mano**

En `src/components/admin/bots/BotsView.tsx`, agregar el import:

```ts
import { PageHeader } from "@/components/admin/ui/PageHeader";
```

Y reemplazar exactamente este bloque (dentro del `return`, primer hijo de
`<Cockpit>`):

```tsx
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">Bots</h1>
        {cola && (
          <span className="text-xs text-tinta-40">
            {cola.jobs_pendientes} en cola · {cola.jobs_trabajando} respondiendo ·{" "}
            {cola.jobs_fallidos} fallidos
          </span>
        )}
        <Button variante="primaria" onClick={() => setCreando(true)}>
          Nuevo bot
        </Button>
      </header>
```

por:

```tsx
      <PageHeader
        titulo="Bots"
        migas={["Bots"]}
        contador={
          cola && (
            <>
              {cola.jobs_pendientes} en cola · {cola.jobs_trabajando} respondiendo ·{" "}
              {cola.jobs_fallidos} fallidos
            </>
          )
        }
        acciones={
          <Button variante="primaria" onClick={() => setCreando(true)}>
            Nuevo bot
          </Button>
        }
      />
```

No toques nada más del archivo (el resto del `return`, los imports que ya
existían, `Button` ya está importado).

- [ ] **Step 2: `VozView.tsx` — reemplazar el `<header>` a mano**

En `src/components/admin/voz/VozView.tsx`, agregar el import:

```ts
import { PageHeader } from "@/components/admin/ui/PageHeader";
```

Y reemplazar exactamente este bloque:

```tsx
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">Voz</h1>
        <span className="text-xs text-tinta-40">
          {deClientes.length === 1 ? "1 agente" : `${deClientes.length} agentes`}
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={() => setTelefonia((v) => !v)}>Telefonía</Button>
          <Button onClick={() => setBiblioteca((v) => !v)} disabled={voces === null}>
            Voces en español
          </Button>
          <Button
            variante="primaria"
            onClick={() => setCreando((v) => !v)}
            disabled={voces === null}
          >
            {creando ? "Cancelar" : "Nuevo agente de voz"}
          </Button>
        </div>
      </header>
```

por:

```tsx
      <PageHeader
        titulo="Voz"
        migas={["Voz"]}
        contador={deClientes.length === 1 ? "1 agente" : `${deClientes.length} agentes`}
        acciones={
          <>
            <Button onClick={() => setTelefonia((v) => !v)}>Telefonía</Button>
            <Button onClick={() => setBiblioteca((v) => !v)} disabled={voces === null}>
              Voces en español
            </Button>
            <Button
              variante="primaria"
              onClick={() => setCreando((v) => !v)}
              disabled={voces === null}
            >
              {creando ? "Cancelar" : "Nuevo agente de voz"}
            </Button>
          </>
        }
      />
```

No toques nada más del archivo.

- [ ] **Step 3: `equipo/page.tsx` — reemplazar el `<header>` a mano**

En `src/app/admin/(panel)/equipo/page.tsx`, agregar el import:

```ts
import { PageHeader } from "@/components/admin/ui/PageHeader";
```

Y reemplazar exactamente este bloque:

```tsx
      <header className="border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">Equipo</h1>
        <p className="text-xs text-tinta-60">
          Quién administra Zakumi. Un admin ve TODO: CRM, clientes, pagos y todos
          los bots — promueve solo a gente de la casa. Las cuentas de clientes
          del portal no se tocan desde aquí (eso vive en la ficha de cada cliente).
        </p>
      </header>
```

por:

```tsx
      <PageHeader
        titulo="Equipo"
        migas={["Equipo"]}
        subtitulo="Quién administra Zakumi. Un admin ve TODO: CRM, clientes, pagos y todos
          los bots — promueve solo a gente de la casa. Las cuentas de clientes
          del portal no se tocan desde aquí (eso vive en la ficha de cada cliente)."
      />
```

No toques nada más del archivo (`Cockpit`/`CockpitBody` ya envuelven esto,
no cambian).

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint src/components/admin/bots/BotsView.tsx src/components/admin/voz/VozView.tsx "src/app/admin/(panel)/equipo/page.tsx"`
Expected: 0 errores/warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/bots/BotsView.tsx src/components/admin/voz/VozView.tsx "src/app/admin/(panel)/equipo/page.tsx"
git commit -m "refactor: Bots, Voz y Equipo migran su header a mano a PageHeader (+ migas)"
```

---

### Task 3: `migas` en las 7 vistas que ya usan `PageHeader`

**Files:**
- Modify: `src/components/admin/prospeccion/ProspeccionView.tsx`
- Modify: `src/components/admin/territorios/TerritoriosView.tsx`
- Modify: `src/components/admin/bots/ZakView.tsx`
- Modify: `src/app/admin/(panel)/metricas/page.tsx`
- Modify: `src/app/admin/(panel)/solicitudes/page.tsx`
- Modify: `src/components/admin/agenda/AgendaView.tsx`
- Modify: `src/components/admin/clientes/ClientesView.tsx`

**Interfaces:**
- Consumes: `PageHeader` de la Task 1 (prop `migas`).

Cada archivo ya tiene un `<PageHeader ...>` con `titulo=` — agregar una línea
`migas={...}` a ESE mismo `<PageHeader>` (no crear uno nuevo, no reordenar las
props existentes; agregarla donde quede prolija, ej. justo debajo de
`coletilla` o de `titulo`). Los siete casos, exactos:

- [ ] **Step 1: `ProspeccionView.tsx`**

Ese archivo ya tiene una variable `cara: CaraProspeccion` (`"territorio" |
"leads"`) en scope donde está el `<PageHeader>` (se usa dos líneas abajo en
`activa={cara}`). Agregar:

```tsx
migas={["Encontrar clientes", cara === "leads" ? "Leads" : "Territorio"]}
```

- [ ] **Step 2: `TerritoriosView.tsx`**

Sin pestañas internas — un solo segmento:

```tsx
migas={["Territorios"]}
```

- [ ] **Step 3: `ZakView.tsx`**

Ese archivo ya tiene `tab: PestanaZak` y `cara: CaraZak` en scope (se usan en
`navegacion` dos líneas abajo), y ya importa `LABEL_CHAT`/`LABEL_VOZ` — están
definidos arriba del componente exactamente así:

```ts
const LABEL_CHAT: Record<(typeof PESTANAS_CHAT)[number], string> = { ... };
const LABEL_VOZ: Record<PestanaVoz, string> = { ... };
```

Agregar al `<PageHeader>`:

```tsx
migas={[
  "Zak",
  cara === "chat" ? LABEL_CHAT[tab as PestanaChat] : LABEL_VOZ[tab as PestanaVoz],
]}
```

Esto necesita importar el tipo `PestanaChat` desde
`@/lib/admin/zak-caras` (ya se importan `PestanaVoz`/`PestanaZak` de ahí en
este archivo — agregar `PestanaChat` a esa misma línea de `import type`).

- [ ] **Step 4: `metricas/page.tsx`**

Sin pestañas internas:

```tsx
migas={["Métricas"]}
```

- [ ] **Step 5: `solicitudes/page.tsx`**

Sin pestañas internas:

```tsx
migas={["Solicitudes"]}
```

- [ ] **Step 6: `AgendaView.tsx`**

`NavegacionSemana` es un selector de semana, no pestañas — un solo segmento:

```tsx
migas={["Agenda"]}
```

- [ ] **Step 7: `ClientesView.tsx`**

Ese archivo ya tiene `vista: VistaClientes` en scope y una constante `VISTAS`
arriba del componente:

```ts
const VISTAS = [
  { id: "cobros", label: "Próximos cobros" },
  { id: "clientes", label: "Clientes" },
] as const;
```

Agregar al `<PageHeader>`:

```tsx
migas={["Clientes", VISTAS.find((v) => v.id === vista)?.label ?? "Clientes"]}
```

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run:
```bash
npx eslint src/components/admin/prospeccion/ProspeccionView.tsx src/components/admin/territorios/TerritoriosView.tsx src/components/admin/bots/ZakView.tsx "src/app/admin/(panel)/metricas/page.tsx" "src/app/admin/(panel)/solicitudes/page.tsx" src/components/admin/agenda/AgendaView.tsx src/components/admin/clientes/ClientesView.tsx
```
Expected: 0 errores/warnings.

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/prospeccion/ProspeccionView.tsx src/components/admin/territorios/TerritoriosView.tsx src/components/admin/bots/ZakView.tsx "src/app/admin/(panel)/metricas/page.tsx" "src/app/admin/(panel)/solicitudes/page.tsx" src/components/admin/agenda/AgendaView.tsx src/components/admin/clientes/ClientesView.tsx
git commit -m "feat: migas en las 7 vistas que ya usaban PageHeader"
```

---

### Task 4: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Grep de cobertura — las 10 vistas de nivel superior pasan `migas`**

Run: `grep -rn "migas=" src -l`

Expected: exactamente estos 10 archivos (mismo orden que `SECCIONES` en
`Sidebar.tsx`):
```
src/components/admin/prospeccion/ProspeccionView.tsx
src/components/admin/territorios/TerritoriosView.tsx
src/components/admin/bots/ZakView.tsx
src/app/admin/(panel)/metricas/page.tsx
src/app/admin/(panel)/solicitudes/page.tsx
src/components/admin/agenda/AgendaView.tsx
src/components/admin/clientes/ClientesView.tsx
src/components/admin/bots/BotsView.tsx
src/components/admin/voz/VozView.tsx
src/app/admin/(panel)/equipo/page.tsx
```

Si falta o sobra alguno, es un defecto de esta fase — no cerrar la task hasta
que coincida exactamente.

- [ ] **Step 2: Suite completa**

Run: `npm test`
Expected: 651/651 (esta fase no agrega tests — ver Global Constraints).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Checklist de QA manual (queda pendiente de verificación humana)**

Escribir en el reporte de esta task, textual, para que Tomás la corra:

- [ ] `/admin/prospeccion` muestra "Encontrar clientes / Territorio" (o
      "/ Leads" al cambiar de cara) arriba del título.
- [ ] `/admin/territorios` muestra "Territorios".
- [ ] `/admin/zak` muestra "Zak / Bandeja" (u otra pestaña al cambiar).
- [ ] `/admin/metricas` muestra "Métricas".
- [ ] `/admin/solicitudes` muestra "Solicitudes".
- [ ] `/admin/agenda` muestra "Agenda".
- [ ] `/admin/clientes` muestra "Clientes / Próximos cobros" (o "/ Clientes").
- [ ] `/admin/bots` se ve igual que antes (header, contador, botón "Nuevo
      bot") más el nuevo "Bots" arriba del título.
- [ ] `/admin/voz` se ve igual que antes (contador, los 3 botones) más "Voz"
      arriba del título.
- [ ] `/admin/equipo` se ve igual que antes (subtítulo incluido) más
      "Equipo" arriba del título.
- [ ] En ningún caso el breadcrumb hace wrap raro ni empuja el título a una
      segunda línea en desktop (~1280px de ancho).

- [ ] **Step 6: Commit (si hiciera falta alguno de corrección)**

Solo si el Step 1 encontró un archivo faltante y hubo que agregarlo:

```bash
git add -A
git commit -m "fix: completa la cobertura de migas en las 10 vistas de nivel superior"
```

Si el Step 1 ya dio 10/10, no hay nada que commitear en esta task — reportar
`DONE` igual, sin diff.
