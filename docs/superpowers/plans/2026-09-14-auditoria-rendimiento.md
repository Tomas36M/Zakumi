# Correcciones de rendimiento de la Radiografía Zakumi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar cuatro de los seis hallazgos de rendimiento de la
auditoría: la búsqueda de negocios sin índice, los 50 round-trips por página
del grid de Territorios, los 6 conteos del embudo de Métricas, y los ~44KB
gzip de GSAP que las páginas legales del sitio público pagan sin usar.

**Architecture:** Un archivo SQL nuevo e idempotente (`rendimiento.sql`)
trae la extensión `pg_trgm`, un índice GIN sobre `negocios.nombre`, y dos
funciones `security invoker` de solo lectura que agrupan lo que hoy se
cuenta fila por fila — RLS sigue mandando, mismo criterio que
`anotar_tesela`. Del lado de TypeScript, `cuentasTerritoriosServidor` pasa
de N×2 consultas a una llamada RPC más un helper puro (con test) que
rellena con 0/0 los territorios que el `GROUP BY` no devuelve; Métricas
hace lo mismo con su embudo. Para el sitio público, `SiteShell` se parte en
dos: el chrome (nav, menú móvil, footer, y TODO el markup — idéntico en
SSR) se queda donde está sin importar GSAP, y las animaciones se mudan a
un `SiteMotion` que no pinta nada, se carga con `next/dynamic` sin SSR, y
no se monta en `/privacidad` ni `/terminos`.

**Tech Stack:** Next.js 16 + TypeScript + Supabase (Postgres con `pg_trgm`,
funciones SQL) + GSAP 3. Sin dependencias nuevas.

**Spec:** No hay spec — son los hallazgos de rendimiento de la auditoría
de esta sesión (artifact "Radiografía Zakumi").

## Global Constraints

- **Cero tests de componentes/route handlers** (`vitest.config.ts`:
  `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts"]`).
  Solo la Task 2 lleva TDD (el helper puro `cuentasDesdeFilas`). El SQL no
  corre en CI — se verifica a mano en Supabase, con el bloque que la Task 1
  deja en su reporte.
- **`supabase/rendimiento.sql` corre DESPUÉS de `prospeccion.sql` y ANTES
  del deploy** (usa `negocios.territorio_id`, que ese archivo agrega; sin las
  RPC, Territorios pinta sus tarjetas sin cifras y Métricas pinta "—" — un
  hallazgo del review final). Es aditivo e
  idempotente (`create extension if not exists`, `create index if not
  exists`, `create or replace function`) — no necesita "parche" para bases
  que ya corrieron versiones anteriores.
- **Las dos RPC son `security invoker` a propósito.** Un no-admin no ve
  filas de `negocios` (RLS `negocios_solo_admin`) y recibe conteos vacíos,
  nunca los de otro. No cambiar a `definer`.
- **Un territorio sin negocios tiene que salir como `{leads: 0, sinWeb:
  0}`, no ausente.** El `GROUP BY` no devuelve filas para él, y el grid pinta
  cada tarjeta por su id. Esto es exactamente lo que el helper puro y su
  test garantizan — no se puede "simplificar" quitándolo.
- **El markup SSR del sitio público no cambia ni un byte por la Task 4**,
  salvo que en las páginas legales no se renderizan el anillo/punto del
  cursor ni la barra de progreso (sin GSAP quedarían clavados en su
  posición CSS inicial). Todo lo demás —`#bg`, `.grain`, `#curtain` en
  home, `nav`, `footer`, ids y clases— queda igual, porque
  `zakumi-design.css` es "pixel-fiel" al artefacto original (CLAUDE.md) y
  apunta a esos selectores.
- **Un cambio visible menor y aceptado en la Task 4**: hoy el nav entra
  con un `gsap.from` que corre en `useLayoutEffect` al hidratar; ya existe
  una ventana entre el primer pintado SSR y la hidratación en la que el nav
  está en su posición natural antes de "saltar" y deslizarse. Con el chunk
  de GSAP cargado por `dynamic`, esa ventana se alarga lo que tarde el
  chunk (en paralelo, decenas de ms con CDN caliente). No es una regresión
  nueva, es la misma ventana un poco más larga. Se acepta a cambio de que
  `/privacidad` y `/terminos` dejen de cargar GSAP.
- **Deliberadamente FUERA de este plan (no lo toques):**
  - Los tres `.select("*")` sin límite (clientes, territorios del mapa,
    leads_overrides). Ruling: el mapa NECESITA todos los polígonos (ya
    decidido en la Fase 6); la lista de clientes es la cartera de un
    estudio boutique y la de overrides solo tiene filas editadas — ambas
    quedan bajo el tope de 1000 filas de PostgREST que CLAUDE.md documenta
    como el límite real. Un `.limit()` silencioso violaría la regla de "no
    maquillar cifras" del propio repo; uno honesto (count + banner, como
    Prospección) es más de lo que amerita un hallazgo Low. Documentado,
    sin código.
  - Mover el fetch inicial de `PagosRecientes` y `FichaLeadNotas` al
    servidor (el hallazgo del cliente de Supabase de ~66KB gzip en rutas
    del admin). `FichaLeadNotas` vive dentro de `FichaLeadModal`, que el
    plan de calidad de código está por cambiar — este refactor se escribe
    contra ESE árbol, en un plan de seguimiento, no contra el de hoy.

---

### Task 1: `supabase/rendimiento.sql` — índice trgm y dos RPC agrupadas

**Files:**
- Create: `supabase/rendimiento.sql`

**Interfaces:**
- Produces: `public.cuentas_por_territorio(p_ids uuid[]) returns table
  (territorio_id uuid, leads bigint, sin_web bigint)` — la consume la Task
  2. `public.conteo_por_estado() returns table (estado
  public.estado_negocio, n bigint)` — la consume la Task 3. El índice
  `negocios_nombre_trgm_idx` lo usa Postgres solo, sin cambios en el código
  de la búsqueda (`src/app/admin/api/zak/negocios/route.ts` sigue igual).

- [ ] **Step 1: Crear el archivo**

`supabase/rendimiento.sql`:

```sql
-- ============================================================================
-- Rendimiento — índice de búsqueda por nombre y conteos agrupados.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de prospeccion.sql (usa
-- negocios.territorio_id y negocios.sitio_web). Idempotente y aditivo: no
-- cambia datos ni permisos de ninguna tabla.
--
-- Tres cosas:
-- 1. pg_trgm + un índice GIN sobre negocios.nombre. La búsqueda de
--    "+ Nuevo chat" en Zak hace ilike '%q%' en cada tecleo, y un B-tree no
--    sirve para un patrón con % al inicio: hasta ahora era un scan completo
--    de la tabla que el barrido paga expresamente por hacer crecer.
-- 2. cuentas_por_territorio(uuid[]): las cuentas exactas del grid de
--    Territorios en UNA consulta agrupada, en vez de dos por territorio
--    (50 round-trips por página de 25).
-- 3. conteo_por_estado(): el embudo de /admin/metricas en una consulta en
--    vez de seis.
--
-- Las dos funciones son security INVOKER a propósito (mismo criterio que
-- anotar_tesela en prospeccion.sql): RLS sigue mandando. Un no-admin no ve
-- filas de negocios y recibe conteos vacíos — nunca los de otro.
-- ============================================================================

-- Supabase instala las extensiones en el schema `extensions` (que está en
-- el search_path del rol postgres). El opclass va sin calificar a propósito:
-- así también funciona si en esta base pg_trgm ya estaba instalada en
-- `public` por otro camino.
create extension if not exists pg_trgm with schema extensions;

create index if not exists negocios_nombre_trgm_idx
  on public.negocios using gin (nombre gin_trgm_ops);

-- language sql (no plpgsql) a propósito: en una función SQL los nombres de
-- las columnas de salida NO entran en scope del cuerpo, así que
-- `territorio_id` resuelve a la columna de negocios sin ambigüedad.
create or replace function public.cuentas_por_territorio(p_ids uuid[])
returns table (territorio_id uuid, leads bigint, sin_web bigint)
language sql stable
security invoker
set search_path = public
as $$
  select territorio_id,
         count(*)                                  as leads,
         count(*) filter (where sitio_web is null) as sin_web
    from negocios
   where territorio_id = any(p_ids)
   group by territorio_id;
$$;

create or replace function public.conteo_por_estado()
returns table (estado public.estado_negocio, n bigint)
language sql stable
security invoker
set search_path = public
as $$
  select estado, count(*) as n
    from negocios
   group by estado;
$$;

-- El default de Postgres da EXECUTE a public en toda función nueva — se
-- revoca explícito (mismo patrón que anotar_tesela).
revoke all on function public.cuentas_por_territorio(uuid[]) from public, anon;
grant execute on function public.cuentas_por_territorio(uuid[]) to authenticated;
revoke all on function public.conteo_por_estado() from public, anon;
grant execute on function public.conteo_por_estado() to authenticated;
```

- [ ] **Step 2: Verificar la sintaxis lo mejor posible sin Postgres**

Run: `npx tsc --noEmit`
Expected: 0 errores (sanidad — no toca TS).

Releer el archivo completo una vez contra la lista de arriba: `create
extension` → índice → dos funciones → cuatro grants. Los tipos de los
parámetros en `revoke`/`grant` tienen que coincidir EXACTAMENTE con la
firma (`uuid[]` y `()`), o Postgres dice "function does not exist".

- [ ] **Step 3: El bloque de verificación manual, textual, en el reporte**

```sql
-- 1. Correr este archivo completo (idempotente; correrlo dos veces es seguro).
-- 2. Confirmar el índice:
select indexname from pg_indexes
 where tablename = 'negocios' and indexname = 'negocios_nombre_trgm_idx';
-- Debe devolver una fila.
-- 3. Confirmar que Postgres LO USA para la búsqueda de Zak (como admin):
explain (analyze, buffers)
select id, nombre from public.negocios where nombre ilike '%pan%' limit 20;
-- Debe aparecer "Bitmap Index Scan on negocios_nombre_trgm_idx". Si dice
-- "Seq Scan", la tabla es demasiado chica para que el planner lo prefiera
-- (normal con < ~1000 filas) — no es un error; volver a probar cuando crezca.
-- 4. Las RPC, como admin:
select * from public.cuentas_por_territorio(
  array(select id from public.territorios limit 5));
select * from public.conteo_por_estado();
-- Ambas devuelven filas. Un territorio sin negocios NO aparece en la
-- primera — eso lo rellena el código, es lo esperado.
-- 5. Como un usuario NO admin (sesión de cliente del portal):
select * from public.conteo_por_estado();
-- Debe devolver CERO filas (RLS): no un error, no los conteos de otro.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/rendimiento.sql
git commit -m "feat: rendimiento.sql — índice trgm para buscar negocios y dos RPC de conteos agrupados"
```

---

### Task 2: `cuentasTerritoriosServidor` en una sola RPC (TDD)

**Files:**
- Modify: `src/lib/admin/territorios.ts`
- Test: `src/lib/admin/__tests__/territorios.test.ts` (existente o nuevo — ver Step 1)

**Interfaces:**
- Consumes: la RPC `cuentas_por_territorio` (Task 1).
- Produces: `cuentasDesdeFilas(ids, filas): CuentasPorTerritorio` (puro,
  exportado, con test) y `FilaCuentaTerritorio`. La firma de
  `cuentasTerritoriosServidor` NO cambia — su único llamador
  (`src/app/admin/(panel)/territorios/page.tsx`) sigue igual.

- [ ] **Step 1: Los tests primero**

Si `src/lib/admin/__tests__/territorios.test.ts` YA EXISTE, agregar el
`describe` de abajo al final del archivo (y sumar `cuentasDesdeFilas` y
`type FilaCuentaTerritorio` a su import de `../territorios`). Si NO existe,
crearlo con exactamente este contenido:

```ts
import { describe, expect, it } from "vitest";
import { cuentasDesdeFilas, type FilaCuentaTerritorio } from "../territorios";

function fila(extra: Partial<FilaCuentaTerritorio>): FilaCuentaTerritorio {
  return { territorio_id: "a", leads: 0, sin_web: 0, ...extra };
}

describe("cuentasDesdeFilas", () => {
  it("un territorio con fila toma leads y sinWeb de la RPC", () => {
    const r = cuentasDesdeFilas(["a"], [fila({ leads: 5, sin_web: 2 })]);
    expect(r).toEqual({ a: { leads: 5, sinWeb: 2 } });
  });

  it("un territorio SIN fila (sin negocios) sale como 0/0, no ausente", () => {
    // El GROUP BY no devuelve nada para él; el grid pinta la tarjeta por id.
    const r = cuentasDesdeFilas(["a", "b"], [fila({ territorio_id: "a", leads: 3, sin_web: 1 })]);
    expect(r).toEqual({ a: { leads: 3, sinWeb: 1 }, b: { leads: 0, sinWeb: 0 } });
  });

  it("una fila de un id que no se pidió se ignora", () => {
    const r = cuentasDesdeFilas(["a"], [fila({ territorio_id: "z", leads: 9, sin_web: 9 })]);
    expect(r).toEqual({ a: { leads: 0, sinWeb: 0 } });
  });

  it("sin ids devuelve un objeto vacío", () => {
    expect(cuentasDesdeFilas([], [fila({ leads: 1 })])).toEqual({});
  });
});
```

- [ ] **Step 2: Correr — deben fallar (el export no existe)**

Run: `npx vitest run src/lib/admin/__tests__/territorios.test.ts`
Expected: FAIL — `cuentasDesdeFilas` no está exportado de `../territorios`.

- [ ] **Step 3: Implementar**

En `src/lib/admin/territorios.ts`, reemplazar la función
`cuentasTerritoriosServidor` COMPLETA (docstring incluido — busca desde
`/**` + `Cuentas EXACTAS por territorio` hasta el `}` que cierra la
función) por:

```ts
/** Filas crudas de la RPC cuentas_por_territorio (supabase/rendimiento.sql). */
export type FilaCuentaTerritorio = { territorio_id: string; leads: number; sin_web: number };

/**
 * Arma el objeto de cuentas a partir de las filas de la RPC. Puro para
 * probarlo: un territorio sin negocios no aparece en el GROUP BY y tiene
 * que salir como 0/0, no ausente — el grid pinta cada tarjeta por su id.
 */
export function cuentasDesdeFilas(
  ids: readonly string[],
  filas: readonly FilaCuentaTerritorio[],
): CuentasPorTerritorio {
  const porId = new Map(filas.map((f) => [f.territorio_id, f]));
  return Object.fromEntries(
    ids.map((id) => {
      const f = porId.get(id);
      return [id, { leads: f?.leads ?? 0, sinWeb: f?.sin_web ?? 0 }];
    }),
  );
}

/**
 * Cuentas EXACTAS por territorio, contadas en el servidor en UNA consulta
 * agrupada (RPC cuentas_por_territorio, security invoker: RLS sigue
 * mandando). Existe porque `cuentasPorTerritorio` recorre la lista topada
 * a 900 y con más negocios que eso mentiría — y la página Territorios es
 * una lista de cifras. Antes eran dos consultas por territorio en paralelo:
 * 50 round-trips por página de 25.
 * `null` = la consulta falló: la vista lo dice con un banner en vez de
 * pintar ceros que no son.
 */
export async function cuentasTerritoriosServidor(
  supabase: SupabaseClient,
  territorios: readonly Pick<Territorio, "id">[],
): Promise<CuentasPorTerritorio | null> {
  if (territorios.length === 0) return {};
  const ids = territorios.map((t) => t.id);
  const { data, error } = await supabase.rpc("cuentas_por_territorio", { p_ids: ids });
  if (error) {
    console.error("[territorios] cuentas por territorio:", error.message);
    return null;
  }
  return cuentasDesdeFilas(ids, (data ?? []) as FilaCuentaTerritorio[]);
}
```

- [ ] **Step 4: Correr — pasan**

Run: `npx vitest run src/lib/admin/__tests__/territorios.test.ts`
Expected: PASS (4 nuevos, más los que ya hubiera en el archivo).

Run: `npx tsc --noEmit`
Expected: 0 errores — `CuentasPorTerritorio`, `Territorio` y
`SupabaseClient` ya estaban en scope en este archivo.

Run: `npx eslint src/lib/admin/territorios.ts src/lib/admin/__tests__/territorios.test.ts`
Expected: 0 errores/warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/territorios.ts src/lib/admin/__tests__/territorios.test.ts
git commit -m "perf: cuentas por territorio en una RPC agrupada, no 2 consultas por territorio (TDD)"
```

---

### Task 3: El embudo de Métricas en una consulta

**Files:**
- Modify: `src/app/admin/(panel)/metricas/page.tsx`

**Interfaces:**
- Consumes: la RPC `conteo_por_estado` (Task 1). `EmbudoEstados` sigue
  recibiendo `Record<EstadoNegocio, number | null>` — sin cambios ahí.

- [ ] **Step 1: Reemplazar los seis conteos por la RPC**

En `src/app/admin/(panel)/metricas/page.tsx`, reemplazar desde
`const [tandas, ...conteos] = await Promise.all([` hasta la línea
`) as Record<EstadoNegocio, number | null>;` (inclusive — es el bloque que
arma `embudo`, con el `for` de logs y el comentario en el medio) por:

```ts
  const [tandas, conteo] = await Promise.all([
    listarTandas(ID_ZAK),
    // Una consulta agrupada (RPC, security invoker) en vez de seis head-counts
    // en paralelo — supabase/rendimiento.sql.
    supabase.rpc("conteo_por_estado"),
  ]);

  // Un conteo que falla y uno que da 0 de verdad son indistinguibles para
  // quien mira la pantalla (mismo riesgo que prospeccion/page.tsx y
  // negocios.ts ya nombran para esta misma tabla) — al menos que quede en
  // el log del servidor. Si falló, TODOS los tiles se pintan como "—" en vez
  // de 0 (EmbudoEstados.tsx): con una sola consulta no hay fallo parcial.
  if (conteo.error) console.error("[metricas] conteo por estado:", conteo.error.message);

  const porEstado = new Map(
    ((conteo.data ?? []) as { estado: EstadoNegocio; n: number }[]).map((f) => [f.estado, f.n]),
  );
  // Un estado sin negocios no viene en el GROUP BY: es 0, no "—".
  const embudo = Object.fromEntries(
    ESTADOS.map((e) => [e.valor, conteo.error ? null : (porEstado.get(e.valor) ?? 0)]),
  ) as Record<EstadoNegocio, number | null>;
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint "src/app/admin/(panel)/metricas/page.tsx"`
Expected: 0 errores/warnings.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(panel)/metricas/page.tsx"
git commit -m "perf: el embudo de Métricas en una consulta agrupada, no seis"
```

---

### Task 4: GSAP fuera de las páginas legales

**Files:**
- Modify: `src/components/site/SiteShell.tsx`
- Create: `src/components/site/SiteMotion.tsx`

**Interfaces:**
- `SiteShell` conserva su export y su firma (`{ children }`) —
  `src/app/(site)/layout.tsx` no cambia.
- Produces: `SiteMotion({ isHome: boolean })` — solo lo monta `SiteShell`.

- [ ] **Step 1: Crear `SiteMotion.tsx` — todo lo que depende de GSAP, sin pintar nada**

`src/components/site/SiteMotion.tsx`:

```tsx
"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Flag de módulo: la cortina de intro solo debe correr una vez por sesión (no en cada regreso a home via SPA).
let curtainPlayed = false;

/** Entrada del nav: logo y enlaces suben a su sitio. */
function navIntro(tl: gsap.core.Timeline, at: gsap.Position) {
  tl.from(".nav-logo a", { yPercent: 110, duration: 0.9, ease: "expo.out" }, at).from(
    ".nav-links a",
    { yPercent: 100, opacity: 0, stagger: 0.06, duration: 0.7, ease: "expo.out" },
    "<+0.1",
  );
}

/**
 * Todo lo del sitio público que depende de GSAP: cortina, barra de
 * progreso, cursor, smooth-scroll de anclas, intro del nav. No pinta nada —
 * anima los nodos que SiteShell ya renderizó (#curtain, #scroll-fill,
 * .cursor-ring/.cursor-dot), así el markup SSR es idéntico con o sin este
 * componente. SiteShell lo carga con next/dynamic (sin SSR) y NO lo monta
 * en las páginas legales: no llevan animación y no tienen por qué pagar
 * ~44KB gzip de GSAP. El toggle de `nav.scrolled` NO vive acá a propósito:
 * es vanilla en SiteShell, para que funcione también donde esto no se monta.
 */
export function SiteMotion({ isHome }: { isHome: boolean }) {
  const pathname = usePathname();

  // ——— ScrollTrigger refresh al cambiar de breakpoint y de ruta ———
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const onBreakpoint = () => {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    mq.addEventListener("change", onBreakpoint);
    return () => mq.removeEventListener("change", onBreakpoint);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [pathname]);

  // ——— GSAP: cortina (solo home), barra de progreso, smooth-scroll ———
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Cortina — solo en home, y solo la primera vez por sesión
      if (isHome) {
        if (curtainPlayed) {
          // Regreso SPA a home: ocultar la cortina sin animarla de nuevo
          gsap.set("#curtain", { display: "none" });
        } else {
          curtainPlayed = true;
          const counter = { v: 0 };
          const counterEl = document.getElementById("curtain-counter");
          const tl = gsap.timeline();

          if (counterEl) {
            tl.to(counter, {
              v: 100,
              duration: 1.4,
              ease: "power2.inOut",
              onUpdate: () => {
                counterEl.textContent = String(Math.floor(counter.v)).padStart(2, "0");
              },
            })
              .to(
                ".curtain-inner, .curtain-label, .curtain-counter",
                {
                  opacity: 0,
                  y: -20,
                  duration: 0.6,
                  ease: "power3.in",
                },
                "+=0.15",
              )
              .to(
                "#curtain-panel",
                {
                  scaleY: 0,
                  duration: 1.1,
                  ease: "expo.inOut",
                  transformOrigin: "top center",
                },
                "-=0.3",
              )
              .set("#curtain", { display: "none" });

            navIntro(tl, "-=0.7");
          } else {
            navIntro(tl, 0);
          }
        }
      } else {
        // Deep-link a una vista interna. La cortina es un gesto de carga
        // inicial: dispararla al volver a home por SPA parecería una recarga,
        // así que se marca como vista. Pero la página no debe abrir en frío —
        // el nav entra igual, sin cortina.
        curtainPlayed = true;
        // #curtain solo se renderiza en la home, así que no se toca aquí.
        navIntro(gsap.timeline(), 0);
      }

      // Barra de progreso
      gsap.to("#scroll-fill", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
      });

      // Smooth-scroll de anclas
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener("click", (e) => {
          const id = a.getAttribute("href");
          if (id && id.length > 1 && document.querySelector(id)) {
            e.preventDefault();
            gsap.to(window, {
              duration: 1.2,
              scrollTo: { y: id, offsetY: 60 },
              ease: "expo.inOut",
            });
          }
        });
      });
    });

    return () => ctx.revert();
  }, [isHome]);

  // ——— Cursor ring/dot ———
  useEffect(() => {
    const dot = document.querySelector<HTMLDivElement>(".cursor-dot");
    const ring = document.querySelector<HTMLDivElement>(".cursor-ring");
    if (!dot || !ring) return;

    const xDot = gsap.quickTo(dot, "x", { duration: 0.18, ease: "power3" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.18, ease: "power3" });
    const xRing = gsap.quickTo(ring, "x", { duration: 0.5, ease: "power3" });
    const yRing = gsap.quickTo(ring, "y", { duration: 0.5, ease: "power3" });

    const onMove = (e: MouseEvent) => {
      xDot(e.clientX);
      yDot(e.clientY);
      xRing(e.clientX);
      yRing(e.clientY);
    };
    document.addEventListener("mousemove", onMove);

    const enter = () => {
      gsap.to(ring, {
        width: 70,
        height: 70,
        borderColor: "rgba(219,82,39,0.8)",
        duration: 0.4,
        ease: "power3.out",
      });
      gsap.to(dot, { scale: 0, duration: 0.3 });
    };
    const leave = () => {
      gsap.to(ring, {
        width: 40,
        height: 40,
        borderColor: "rgba(245,239,227,0.5)",
        duration: 0.4,
        ease: "power3.out",
      });
      gsap.to(dot, { scale: 1, duration: 0.3 });
    };

    const targets = document.querySelectorAll("a, button, .cta");
    targets.forEach((el) => {
      el.addEventListener("mouseenter", enter);
      el.addEventListener("mouseleave", leave);
    });

    return () => {
      document.removeEventListener("mousemove", onMove);
      targets.forEach((el) => {
        el.removeEventListener("mouseenter", enter);
        el.removeEventListener("mouseleave", leave);
      });
    };
  }, []);

  return null;
}
```

(Es el contenido de los tres efectos GSAP de `SiteShell.tsx` movido tal
cual, con dos diferencias: el `ScrollTrigger.create({ toggleClass:
"scrolled" })` NO viene — se reimplementa en vanilla en `SiteShell` — y el
cursor busca sus nodos con `querySelector` en vez de refs, porque los
nodos los pinta el otro componente.)

- [ ] **Step 2: `SiteShell.tsx` — el chrome, sin GSAP**

Reemplazar el archivo completo por:

```tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { LogoZakumi } from "@/components/brand/LogoZakumi";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/components/zakumi/contact";
import { SERVICIOS, SERVICE_SLUGS } from "@/components/zakumi/services";

// Las animaciones (GSAP, ~44KB gzip) viven en SiteMotion y se cargan aparte,
// sin SSR: el markup de abajo es idéntico con o sin ellas. En las páginas
// legales no se montan — son texto plano y su propio comentario lo dice.
const SiteMotion = dynamic(() => import("./SiteMotion").then((m) => m.SiteMotion), {
  ssr: false,
});

const RUTAS_SIN_ANIMACION = new Set(["/privacidad", "/terminos"]);

const TWEAK_DEFAULTS = { bgMode: "full" as const, accent: "#DB5227" };

const NAV_ITEMS = [
  ...SERVICE_SLUGS.map((s) => ({ href: `/${s}`, label: SERVICIOS[s].nav })),
  { href: "/academia", label: "Academia" },
  { href: "/contacto", label: "Contacto" },
  // «Mi Zakumi» (portal /app) fuera del nav mientras el portal esté apagado
  // (flag PORTAL_ABIERTO en proxy.ts): aún no es presentable.
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const conMovimiento = !RUTAS_SIN_ANIMACION.has(pathname);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // ——— CSS vars: --orange / bg-* ———
  // (Antes esto también seteaba --hero-size, pero ninguna regla del CSS lo
  // consumía: el tamaño del h1 lo manda el clamp de .hero h1.)
  useEffect(() => {
    document.documentElement.style.setProperty("--orange", TWEAK_DEFAULTS.accent);
    const bg = document.getElementById("bg");
    if (bg) {
      const mode = TWEAK_DEFAULTS.bgMode as string;
      bg.classList.toggle("bg-full", mode === "full");
      bg.classList.toggle("bg-mix", mode === "mix");
    }
  }, []);

  // ——— nav.scrolled — vanilla, sin GSAP: también en las páginas legales ———
  // Equivale al ScrollTrigger de antes (start: "top -50" → scrollY > 50).
  useEffect(() => {
    const nav = document.querySelector("nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ——— Menú móvil ———
  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.matchMedia("(min-width: 721px)").matches) setMenuOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="bg-base bg-full" id="bg" />
      <div className="grain" />

      {conMovimiento && <SiteMotion isHome={isHome} />}

      {isHome && (
        <div className="curtain" id="curtain">
          <div className="curtain-panel" id="curtain-panel" />
          <div className="curtain-inner"><span>ZAKUMI</span><span className="dot" /><span>ESTUDIO</span></div>
          <div className="curtain-label">CARGANDO · MMXXVI</div>
          <div className="curtain-counter" id="curtain-counter">00</div>
        </div>
      )}

      {/* Sin GSAP el anillo/punto del cursor y la barra quedarían clavados en
          su posición CSS inicial: en las páginas legales no se pintan. */}
      {conMovimiento && (
        <div className="scroll-progress"><div className="fill" id="scroll-fill" /></div>
      )}

      <div id="app">
        {conMovimiento && (
          <>
            <div className="cursor-ring" />
            <div className="cursor-dot" />
          </>
        )}

        <nav className={menuOpen ? "nav-menu-open" : undefined}>
          <div className="nav-logo">
            <Link href="/" aria-label="Zakumi — inicio"><LogoZakumi decorativo /></Link>
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

Diferencias con el archivo anterior, y solo estas: se van los imports de
`gsap`/`ScrollTrigger`/`ScrollToPlugin`, `useLayoutEffect`, `useRef` y el
`gsap.registerPlugin`; se van `curtainPlayed`, `navIntro`, `dotRef`,
`ringRef` y los tres efectos GSAP (a `SiteMotion`); el efecto de
`--orange` pierde su listener de breakpoint (a `SiteMotion`); entra el
efecto vanilla de `nav.scrolled`; entra `dynamic`/`SiteMotion`/
`RUTAS_SIN_ANIMACION`/`conMovimiento`; y el cursor y la barra de progreso
se pintan solo con `conMovimiento`. El resto del JSX es byte a byte el de
antes.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint src/components/site/SiteShell.tsx src/components/site/SiteMotion.tsx`
Expected: 0 errores/warnings (ojo con `react-hooks/exhaustive-deps` en
`SiteMotion`'s `useLayoutEffect`, que depende de `[isHome]` igual que
antes — no agregar deps de más).

Run: `npm run build`
Expected: build exitoso. En el árbol de rutas de la salida, `/privacidad` y
`/terminos` siguen siendo `○ (Static)`.

- [ ] **Step 4: Commit**

```bash
git add src/components/site/SiteShell.tsx src/components/site/SiteMotion.tsx
git commit -m "perf: GSAP se carga aparte y no se monta en las páginas legales del sitio"
```

---

### Task 5: Verificación final — con el número que importa

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: los de antes + 4 (`cuentasDesdeFilas`), todos pasando.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Build, y leer el diagnóstico de tamaño de Turbopack**

Run: `npm run build`
Expected: build exitoso.

Luego leer `.next/diagnostics/route-bundle-stats.json` (Turbopack lo genera
en el build; es la misma fuente que usó la auditoría) y reportar el "first
load JS" de `/privacidad`, `/terminos`, `/` y `/software`. Referencia de la
auditoría, ANTES de este plan (bytes sin comprimir): `/privacidad` y
`/terminos` **649.3 KB**; `/` **721.8 KB**; `/software` **714.7 KB**.

Expected: `/privacidad` y `/terminos` bajan en el orden de ~100 KB (el
chunk de GSAP + ScrollTrigger + ScrollToPlugin pesa ~112 KB sin comprimir);
`/` y `/software` quedan iguales o suben unos pocos KB (el wrapper de
`dynamic`). Si `/privacidad` NO bajó, `SiteMotion` sigue en el chunk
compartido — revisar que el `import()` sea dinámico de verdad y que nada
más importe `gsap` desde un módulo que las páginas legales carguen.

Si el archivo de diagnóstico no existe en esta versión de Next, decirlo en
el reporte y usar en su lugar `du -sh .next/static/chunks` antes/después no
sirve (mezcla rutas) — en ese caso anotar que la verificación de tamaño
queda para QA manual con la pestaña Network del navegador en `/privacidad`
(no debe aparecer ningún chunk con `gsap` en el nombre o el contenido).

- [ ] **Step 4: Checklist de QA manual (queda pendiente de verificación humana)**

Escribir en el reporte, textual:

**Sitio público:**
- [ ] `/` en una pestaña nueva: la cortina "CARGANDO · MMXXVI" con contador
      corre una vez y se va; el nav entra deslizándose; el anillo del
      cursor sigue al mouse y crece sobre links; la barra de progreso
      arriba se llena al hacer scroll; un link `#ancla` hace smooth-scroll.
- [ ] Navegar por SPA a `/software` y volver a `/`: la cortina NO vuelve a
      correr.
- [ ] `/privacidad` y `/terminos`: texto plano, SIN anillo de cursor, SIN
      barra de progreso, SIN cortina — y el nav SÍ se compacta al hacer
      scroll (`nav.scrolled`, ahora vanilla).
- [ ] En `/privacidad`, pestaña Network: ningún chunk JS con `gsap` se
      descarga. En `/`: sí.

**Admin (requiere haber corrido `supabase/rendimiento.sql`):**
- [ ] `/admin/territorios`: las cifras de leads / sin web de cada tarjeta
      coinciden con las de antes del cambio (mismo territorio, mismos
      números). Un territorio recién dibujado, sin barrer, muestra 0 / 0.
- [ ] `/admin/metricas`: el embudo muestra los mismos conteos por estado
      que antes; un estado sin negocios muestra 0 (no "—").
- [ ] `/admin/zak` → "+ Nuevo chat": la búsqueda por nombre responde igual
      o más rápido (con pocos negocios no se nota — el índice importa
      cuando la tabla crece).

- [ ] **Step 5: Commit (solo si hiciera falta alguna corrección)**

```bash
git add -A
git commit -m "fix: ajuste final de las correcciones de rendimiento"
```

Si todos los pasos dieron bien, no hay nada que commitear — reportar `DONE`
igual, sin diff.
