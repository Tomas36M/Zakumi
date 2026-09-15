# Fase 6 — Paginación de Territorios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/territorios` (el grid) pagina de 25 en 25 en vez de traer
todos los territorios sin límite en cada carga.

**Architecture:** Un módulo puro nuevo (`paginacion.ts`) sanea el `?pagina=`
de la URL y calcula el rango `.range()` de PostgREST. La página server
component de Territorios lee ese parámetro, pide la página exacta con
`count: "exact"`, y un componente de UI nuevo (`Paginador`) pinta
Anterior/Siguiente debajo del grid con links reales (`<Link href="?pagina=N">`
— navegación de servidor de verdad, no estado de cliente: es la manera
correcta de paginar una lista que vive en la base de datos).

**Tech Stack:** Next.js 16 App Router + TypeScript + Tailwind v4 + Supabase
(PostgREST `.range()` + `count: "exact"`). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md`
(Decisión 14). Esta es la Fase 6, la última de 6, del spec.

## Global Constraints

- **Cero tests de componentes/route handlers en este repo** (`vitest.config.ts`:
  `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts"]`). El
  único código con test en esta fase es `paginacion.ts` (Task 1, lógica pura,
  sin Supabase, sin JSX) — TDD real (RED/GREEN). `Paginador.tsx` y los
  cambios a `page.tsx`/`TerritoriosView.tsx` NO llevan test.
- **El spec fue escrito cuando Territorios todavía vivía DENTRO de
  `/admin/prospeccion`** (antes de que la rama paralela `feat/panel-rediseno`
  lo promoviera a su propia entrada del Sidebar, `/admin/territorios`, ya
  reflejada en este código — la misma realidad que corrigió la Fase 5).
  Decisión 14 dice literalmente "`prospeccion/page.tsx` reemplaza `.select("*")`
  sin límite por `.range()`" — **esta fase NO toca `prospeccion/page.tsx`**.
  Esa página todavía trae `territorios` sin límite (`select("*").order(...)`,
  línea ~26), pero ese fetch alimenta el MAPA (la cara "Territorio" de
  Prospección, `ProspeccionView.tsx` → dibuja los polígonos), no una lista —
  un mapa necesita ver TODOS los polígonos existentes a la vez para que
  Tomás sepa qué áreas ya cubrió antes de dibujar una nueva; paginar el mapa
  rompería exactamente el caso de uso que resuelve (nunca se vería "todo lo
  ya barrido" junto). El problema real que Decisión 14 identificó —una
  consulta sin límite que crece con el tiempo— vive hoy en
  `/admin/territorios/page.tsx` (el grid, `TerritoriosView.tsx`), que se
  promovió a pantalla propia DESPUÉS de escrito el spec: ahí es donde esta
  fase pagina. Si algún día el número de territorios vuelve pesado el fetch
  del mapa, ese es un problema distinto (ej. carga por viewport) — fuera de
  alcance aquí.
- **25 por página** (`TERRITORIOS_POR_PAGINA`), confirmado por Tomás.
- **`?pagina=N` en la URL, navegación de servidor real** (un `<Link
  href="/admin/territorios?pagina=N">` normal, sin `useParametroUrl` ni
  `history.replaceState`) — a diferencia de las pestañas (`?tab=`), que
  evitan un round-trip al servidor a propósito, una página de una lista que
  vive en la base de datos SÍ necesita volver a pedirle datos al servidor en
  cada cambio de página. No repliques el patrón de `useParametroUrl` acá.
- **No mentir sobre cuántos hay.** Si `?pagina=` pide una página más allá de
  las que existen, no se pinta "Ningún territorio todavía" (eso significa
  "cero territorios en total", no "esta página vino vacía") — se redirige a
  la última página válida. Ver Task 3, Step 2.

---

### Task 1: `paginacion.ts` — saneo del parámetro y cálculo del rango (TDD)

**Files:**
- Create: `src/lib/admin/paginacion.ts`
- Test: `src/lib/admin/__tests__/paginacion.test.ts`

**Interfaces:**
- Produces: `TERRITORIOS_POR_PAGINA: number`, `paginaDesdeParam(valor:
  string | undefined): number`, `rangoDePagina(pagina: number, porPagina:
  number): [number, number]`. La Task 3 los consume.

- [ ] **Step 1: Escribir los tests (deben fallar — el archivo no existe)**

Crear `src/lib/admin/__tests__/paginacion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paginaDesdeParam, rangoDePagina } from "../paginacion";

describe("paginaDesdeParam", () => {
  it("cae a la página 1 sin parámetro", () => {
    expect(paginaDesdeParam(undefined)).toBe(1);
  });

  it("cae a la página 1 con texto que no es un número", () => {
    expect(paginaDesdeParam("abc")).toBe(1);
  });

  it("cae a la página 1 con cero", () => {
    expect(paginaDesdeParam("0")).toBe(1);
  });

  it("cae a la página 1 con un número negativo", () => {
    expect(paginaDesdeParam("-3")).toBe(1);
  });

  it("cae a la página 1 con un decimal", () => {
    expect(paginaDesdeParam("2.5")).toBe(1);
  });

  it("acepta un entero positivo válido", () => {
    expect(paginaDesdeParam("3")).toBe(3);
  });

  it("acepta un entero positivo con ceros a la izquierda", () => {
    expect(paginaDesdeParam("007")).toBe(7);
  });
});

describe("rangoDePagina", () => {
  it("la página 1 empieza en 0", () => {
    expect(rangoDePagina(1, 25)).toEqual([0, 24]);
  });

  it("la página 2 continúa donde termina la 1", () => {
    expect(rangoDePagina(2, 25)).toEqual([25, 49]);
  });

  it("funciona con un tamaño de página distinto", () => {
    expect(rangoDePagina(3, 10)).toEqual([20, 29]);
  });
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npx vitest run src/lib/admin/__tests__/paginacion.test.ts`
Expected: FAIL — `Cannot find module '../paginacion'` (el archivo no existe
todavía).

- [ ] **Step 3: Implementación mínima**

Crear `src/lib/admin/paginacion.ts`:

```ts
// Paginación de listas que viven en Supabase: sanear el ?pagina= de la URL
// y calcular el rango de PostgREST (.range(), inclusive en ambos extremos).
// Lógica pura y genérica a propósito — la primera lista de este panel que
// pagina de verdad (a diferencia del tope+conteo de negocios en
// Prospección), para que la próxima que lo necesite no reinvente esto.

export const TERRITORIOS_POR_PAGINA = 25;

/**
 * Sanea el ?pagina= de la URL: cualquier cosa que no sea un entero ≥ 1 cae
 * a la página 1 — un link viejo o un valor escrito a mano nunca revienta la
 * pantalla, solo la manda al principio.
 */
export function paginaDesdeParam(valor: string | undefined): number {
  if (valor === undefined) return 1;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** El rango [desde, hasta] para `.range()` de Supabase/PostgREST. */
export function rangoDePagina(pagina: number, porPagina: number): [number, number] {
  const desde = (pagina - 1) * porPagina;
  return [desde, desde + porPagina - 1];
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `npx vitest run src/lib/admin/__tests__/paginacion.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/paginacion.ts src/lib/admin/__tests__/paginacion.test.ts
git commit -m "feat: paginacion.ts — saneo de ?pagina= y cálculo de rango (TDD)"
```

---

### Task 2: `Paginador` — componente de UI

**Files:**
- Create: `src/components/admin/ui/Paginador.tsx`

**Interfaces:**
- Consumes: nada de la Task 1 directamente (recibe `pagina`/`totalPaginas`
  ya calculados como props).
- Produces: `<Paginador pagina totalPaginas hrefDePagina />`. La Task 3 lo
  consume.

- [ ] **Step 1: Crear el componente**

Crear `src/components/admin/ui/Paginador.tsx`:

```tsx
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  pagina: number;
  totalPaginas: number;
  /** Arma el href de una página dada — cada pantalla decide su propio querystring. */
  hrefDePagina: (pagina: number) => string;
};

const ESTILO_BASE =
  "inline-flex h-control items-center justify-center rounded-full px-4 text-sm font-medium transition-colors";

/**
 * Paginador simple: Anterior / Página X de Y / Siguiente. Links reales
 * (navegación de servidor) — no hay nada que paginar en el cliente cuando
 * la lista vive en la base de datos. No se pinta con una sola página.
 */
export function Paginador({ pagina, totalPaginas, hrefDePagina }: Props) {
  if (totalPaginas <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-3 py-2" aria-label="Paginación">
      {pagina > 1 ? (
        <Link
          href={hrefDePagina(pagina - 1)}
          className={cn(ESTILO_BASE, "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta")}
        >
          Anterior
        </Link>
      ) : (
        <span className={cn(ESTILO_BASE, "text-tinta-40 opacity-50")}>Anterior</span>
      )}

      <span className="text-xs text-tinta-40">
        Página {pagina} de {totalPaginas}
      </span>

      {pagina < totalPaginas ? (
        <Link
          href={hrefDePagina(pagina + 1)}
          className={cn(ESTILO_BASE, "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta")}
        >
          Siguiente
        </Link>
      ) : (
        <span className={cn(ESTILO_BASE, "text-tinta-40 opacity-50")}>Siguiente</span>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores (nadie lo usa todavía, así que no puede romper nada).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ui/Paginador.tsx
git commit -m "feat: componente Paginador (Anterior / Página X de Y / Siguiente)"
```

---

### Task 3: Conectar la paginación en Territorios

**Files:**
- Modify: `src/app/admin/(panel)/territorios/page.tsx`
- Modify: `src/components/admin/territorios/TerritoriosView.tsx`

**Interfaces:**
- Consumes: `TERRITORIOS_POR_PAGINA`/`paginaDesdeParam`/`rangoDePagina`
  (Task 1), `Paginador` (Task 2).

- [ ] **Step 1: `territorios/page.tsx` — pedir la página exacta**

Reemplazar el archivo completo por:

```tsx
import { redirect } from "next/navigation";
import { paginaDesdeParam, rangoDePagina, TERRITORIOS_POR_PAGINA } from "@/lib/admin/paginacion";
import { TerritoriosView } from "@/components/admin/territorios/TerritoriosView";
import { verifySession } from "@/lib/admin/dal";
import { cuentasTerritoriosServidor, type Territorio } from "@/lib/admin/territorios";

export const metadata = { title: "Territorios" };

export default async function TerritoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  // Next 16: los layouts NO se re-renderizan — el check va en CADA page.
  const { supabase } = await verifySession();

  const { pagina: paginaParam } = await searchParams;
  const pagina = paginaDesdeParam(paginaParam);
  const [desde, hasta] = rangoDePagina(pagina, TERRITORIOS_POR_PAGINA);

  const [territoriosRes, totalLeadsRes] = await Promise.all([
    supabase
      .from("territorios")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(desde, hasta),
    // Total de leads en TODOS los territorios, independiente de la página:
    // la cifra del header no puede ser "los leads de esta página" sin
    // decirlo — sería una cuenta que parece el total y no lo es.
    supabase
      .from("negocios")
      .select("*", { count: "exact", head: true })
      .not("territorio_id", "is", null),
  ]);
  if (territoriosRes.error) console.error("[territorios] lista:", territoriosRes.error.message);
  if (totalLeadsRes.error) {
    console.error("[territorios] total de leads:", totalLeadsRes.error.message);
  }

  const filas = (territoriosRes.data as Territorio[]) ?? [];
  const totalTerritorios = territoriosRes.count ?? 0;
  const totalPaginasReal = Math.ceil(totalTerritorios / TERRITORIOS_POR_PAGINA);

  // ?pagina= más allá de lo que existe: no es "no hay territorios", es un
  // link viejo o una página escrita a mano — a la última página válida, no
  // a una pantalla vacía que miente.
  if (territoriosRes.error === null && totalTerritorios > 0 && pagina > totalPaginasReal) {
    redirect(`/admin/territorios?pagina=${totalPaginasReal}`);
  }

  // Cuentas exactas por territorio (count en el servidor): solo de esta
  // página — el grid es una lista de cifras y no puede heredar el tope de
  // 900 de la pantalla del mapa.
  const cuentas = territoriosRes.error ? null : await cuentasTerritoriosServidor(supabase, filas);

  return (
    <TerritoriosView
      territorios={filas}
      cuentas={cuentas}
      fallaTerritorios={territoriosRes.error !== null}
      pagina={pagina}
      totalPaginas={Math.max(1, totalPaginasReal)}
      totalTerritorios={totalTerritorios}
      totalLeadsGlobal={totalLeadsRes.error ? null : (totalLeadsRes.count ?? 0)}
    />
  );
}
```

- [ ] **Step 2: `TerritoriosView.tsx` — recibir las nuevas props y pintar el paginador**

En `src/components/admin/territorios/TerritoriosView.tsx`:

1. Agregar el import:

```ts
import { Paginador } from "@/components/admin/ui/Paginador";
```

2. Reemplazar el bloque de `type Props` por:

```tsx
type Props = {
  territorios: Territorio[];
  /** Cuentas exactas del servidor (solo de esta página), o `null` si esa consulta falló. */
  cuentas: CuentasPorTerritorio | null;
  /** La consulta de territorios falló: la lista vacía no es «no hay». */
  fallaTerritorios: boolean;
  pagina: number;
  totalPaginas: number;
  /** Cuenta exacta de TODOS los territorios (no solo los de esta página). */
  totalTerritorios: number;
  /** Total de leads en TODOS los territorios, o `null` si esa consulta falló. */
  totalLeadsGlobal: number | null;
};
```

3. Reemplazar la firma de la función y quitar el cálculo local de
   `totalLeads` (ahora llega como prop — sumar solo lo que hay en esta
   página daría una cifra que parece el total y no lo es):

```tsx
export function TerritoriosView({
  territorios,
  cuentas,
  fallaTerritorios,
  pagina,
  totalPaginas,
  totalTerritorios,
  totalLeadsGlobal,
}: Props) {
  const router = useRouter();
  const mapa = useMemo(() => new Map(Object.entries(cuentas ?? {})), [cuentas]);
  const cruces = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const t of territorios) m.set(t.id, poligonoSeCruza(t.poligono));
    return m;
  }, [territorios]);
```

(Se quita por completo el `useMemo` de `totalLeads` que sumaba
`Object.values(cuentas ?? {})` — esa cuenta ahora es global y llega ya
calculada desde el servidor.)

4. Reemplazar el `contador` del `<PageHeader>` por:

```tsx
contador={
  <>
    <strong className="text-tinta-85">{totalTerritorios}</strong>{" "}
    {totalTerritorios === 1 ? "territorio" : "territorios"}
    {totalLeadsGlobal !== null && (
      <>
        {" "}
        ·{" "}
        <strong className="text-tinta-85">{totalLeadsGlobal}</strong> leads
      </>
    )}
  </>
}
```

(Antes el contador entero desaparecía si `cuentas` fallaba, aunque el
conteo de territorios en sí nunca dependió de esa consulta. Ahora el
número de territorios siempre se sabe — sale de `count: "exact"` sobre la
misma consulta paginada, no de `cuentas` — y solo la cifra de leads se
oculta si su propia consulta falló.)

5. Justo después del `<GridCards>` que ya existe (dentro del mismo bloque
   condicional — el paginador va DESPUÉS de `</GridCards>` pero sigue
   dentro del `else` de `fallaTerritorios ? ... : territorios.length === 0
   ? ... : (...)`), agregar el paginador:

```tsx
        ) : (
          <>
            <GridCards>
              {territorios.map((t) => (
                <TarjetaTerritorioCard
                  key={t.id}
                  territorio={t}
                  resumen={resumenDeTerritorio(t, mapa)}
                  cruzado={cruces.get(t.id) ?? false}
                  onAbrir={(id) => router.push(`/admin/territorios/${id}`)}
                />
              ))}
            </GridCards>
            <Paginador
              pagina={pagina}
              totalPaginas={totalPaginas}
              hrefDePagina={(p) => `/admin/territorios?pagina=${p}`}
            />
          </>
        )}
```

(Antes ese último bloque era `<GridCards>...</GridCards>` solo, como hijo
directo del ternario — ahora es un fragment `<>...</>` con `GridCards` y
`Paginador` adentro, para no cambiar la estructura de los otros dos
branches del ternario.)

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint "src/app/admin/(panel)/territorios/page.tsx" src/components/admin/territorios/TerritoriosView.tsx`
Expected: 0 errores/warnings.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(panel)/territorios/page.tsx" src/components/admin/territorios/TerritoriosView.tsx
git commit -m "feat: /admin/territorios pagina de 25 en 25"
```

---

### Task 4: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Confirmar que `prospeccion/page.tsx` no se tocó**

Run: `git diff acfed1e..HEAD --stat -- "src/app/admin/(panel)/prospeccion/page.tsx"`
Expected: sin salida (el archivo no aparece en el diff de esta fase — ver
Global Constraints, por qué es intencional).

- [ ] **Step 2: Suite completa**

Run: `npm test`
Expected: 651 + 10 (los tests nuevos de `paginacion.ts`) = 661/661.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Checklist de QA manual (queda pendiente de verificación humana)**

Escribir en el reporte de esta task, textual, para que Tomás la corra
(idealmente con más de 25 territorios sembrados para ver una segunda
página de verdad; si hay menos de 25 hoy, al menos confirmar que el
paginador NO aparece con una sola página):

- [ ] `/admin/territorios` con ≤25 territorios: se ve exactamente igual que
      antes, sin paginador visible.
- [ ] Con >25 territorios: aparece "Página 1 de N" debajo del grid,
      "Anterior" deshabilitado/gris en la página 1.
- [ ] Click en "Siguiente" navega a `?pagina=2` y muestra los siguientes 25.
- [ ] En la última página, "Siguiente" queda deshabilitado/gris.
- [ ] El contador del header ("N territorios · M leads") muestra el TOTAL
      real (todas las páginas), no solo los de la página visible.
- [ ] Escribir a mano `/admin/territorios?pagina=9999` con pocos
      territorios redirige a la última página válida, no muestra "Ningún
      territorio todavía".
- [ ] `/admin/prospeccion?tab=territorio` (el mapa) se ve exactamente
      igual que antes — sigue mostrando TODOS los territorios dibujados a
      la vez, sin paginar.

- [ ] **Step 6: Commit (solo si hiciera falta alguna corrección)**

Si algún paso anterior encontró un problema y hubo que corregirlo:

```bash
git add -A
git commit -m "fix: ajuste final de la paginación de Territorios"
```

Si todos los pasos dieron bien, no hay nada que commitear en esta task —
reportar `DONE` igual, sin diff.
