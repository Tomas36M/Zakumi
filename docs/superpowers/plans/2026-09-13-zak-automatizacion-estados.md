# Automatización de estados de negocio (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un negocio de prospección avance de estado solo (`nuevo` →
`contactado` → `respondido`/`interesado`) sin que Tomás tenga que ir a
Prospección a marcarlo a mano, sin pisar nunca un estado que él haya puesto
manualmente.

**Architecture:** Un único helper (`avanzarEstadoNegocio`/`avanzarEstadosNegocio`
en `src/lib/admin/estado-negocio.ts`) hace el único `UPDATE` con candado
(`estado_fijado_manual = false`) y avance forward-only (`estado < nuevoEstado`,
gratis porque Postgres compara enums por orden de declaración). Los tres
puntos que hoy contactan a un negocio (`despacho.ts` de voz, `enviarTandaZak`,
y el nuevo hook en `abrirChatZak`/`enviarManual`) llaman a ese helper. La
reconciliación de `respondido`/`interesado` que YA existe
(`sincronizarEstadosZak` + `avancesDeEstado`) se ajusta para respetar el mismo
candado y se engancha al polling de 12s que ya corre en la bandeja, en vez de
correr solo al abrir la consola.

**Tech Stack:** Next.js (App Router) + TypeScript + Supabase (Postgres) +
vitest. Sin librerías nuevas.

**Spec:** `docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md`
(Decisiones 1-4; esta es solo la Fase 1 de las 6 del spec — el resto queda
para planes siguientes).

## Global Constraints

- No hay entorno de test contra una base Postgres real en este repo: todos
  los tests mockean `SupabaseClient` a mano (objeto con closures, sin
  librería de mocking), un doble local por archivo de test — no hay un
  helper compartido, no inventar uno nuevo.
- `avanzarEstadoNegocio`/`avanzarEstadosNegocio` nunca lanza: en error,
  loguea con `console.error` y devuelve `{ error: string }`.
- Ningún caller nuevo debe pasar `"descartado"` como destino del helper — no
  hay guarda de tipos para eso (Postgres lo dejaría "avanzar" porque es el
  último del enum); si algún día hace falta, se agrega ahí, no antes.
- La migración SQL no se aplica sola: hay que correrla a mano en el SQL
  editor de Supabase. El código de este plan compila y sus tests (todos con
  Supabase mockeado) pasan sin ella — pero **contra la base real**, nada de
  esto tiene efecto hasta que la columna exista.
- **Testing, con criterio y sin inventar cobertura que no pedía nadie:** la
  lógica nueva y aislada (el helper, `avancesDeEstado`, el candado en
  `actions.ts`) lleva TDD completo porque son funciones puras o con un doble
  de Supabase barato de armar. Los cuatro call-sites que solo agregan "si hay
  negocioId, llama al helper" (`despacho.ts`, `enviarTandaZak`,
  `abrirChatZak`, `enviarManual`) NO tenían tests antes de este plan y
  arrastran dependencias pesadas (ElevenLabs, el bot Flask, `verifySession`)
  — levantar un mock completo de esas funciones solo para cubrir una línea
  nueva es desproporcionado. Se verifican leyendo el diff con cuidado (parte
  del propio paso) y con la suite completa + el checklist manual del final.

---

## Task 1: Migración SQL — `estado_fijado_manual`

**Files:**
- Create: `supabase/zak-automatizacion.sql`

**Interfaces:**
- Produces: la columna `public.negocios.estado_fijado_manual boolean not null
  default false`, que consumen todas las tareas siguientes.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/zak-automatizacion.sql
--
-- Automatiza los avances de estado de negocios (ver
-- docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md).
-- Idempotente: solo `add column if not exists`. Correr en el SQL editor
-- de Supabase — no hay migración automática en este repo.

alter table public.negocios
  add column if not exists estado_fijado_manual boolean not null default false;

comment on column public.negocios.estado_fijado_manual is
  'true en cuanto un humano cambia el estado a mano (actualizarNegocio o '
  'cambiarEstadoLote). Desde ahí la automatización deja el negocio en paz.';
```

- [ ] **Step 2: Verificar que el archivo es válido SQL a simple vista**

No hay forma de correr esto contra una base real desde este entorno. Léelo
una vez más: dos `alter table`, un `comment on column`, todo con
`if not exists` para poder correrlo más de una vez sin error.

- [ ] **Step 3: Commit**

```bash
git add supabase/zak-automatizacion.sql
git commit -m "feat(db): agrega negocios.estado_fijado_manual"
```

**Nota para el humano (no es parte del plan de código):** antes de probar
cualquier cosa de este plan contra la base real, correr este archivo en el
SQL editor de Supabase.

---

## Task 2: El helper `avanzarEstadoNegocio` / `avanzarEstadosNegocio`

**Files:**
- Create: `src/lib/admin/estado-negocio.ts`
- Test: `src/lib/admin/__tests__/estado-negocio.test.ts`

**Interfaces:**
- Consumes: `EstadoNegocio` de `src/lib/admin/negocios.ts` (ya existe:
  `"nuevo" | "contactado" | "respondido" | "interesado" | "cliente" |
  "descartado"`).
- Produces:
  - `avanzarEstadosNegocio(supabase: SupabaseClient, negocioIds: string[],
    nuevoEstado: EstadoNegocio): Promise<{ error: string | null }>`
  - `avanzarEstadoNegocio(supabase: SupabaseClient, negocioId: string,
    nuevoEstado: EstadoNegocio): Promise<{ error: string | null }>`
  Las tareas 6-9 importan estas dos funciones.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/admin/__tests__/estado-negocio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { avanzarEstadoNegocio, avanzarEstadosNegocio } from "../estado-negocio";

type Filtro = [string, unknown];

/** Supabase falso: solo entiende la cadena que usa el helper
 * (`update().in()/.eq(...).eq(...).lt(...)`), y guarda cada llamada
 * completa (los campos del update + todos los filtros, en orden) para
 * poder inspeccionarla en el assert. */
function supabaseFalso(error: { message: string } | null = null) {
  const llamadas: { campos: Record<string, unknown>; filtros: Filtro[] }[] = [];
  const cliente = {
    from() {
      return {
        update(campos: Record<string, unknown>) {
          const filtros: Filtro[] = [];
          const encadenable = {
            eq(col: string, val: unknown) {
              filtros.push([col, val]);
              return encadenable;
            },
            in(col: string, val: unknown) {
              filtros.push([col, val]);
              return encadenable;
            },
            async lt(col: string, val: unknown) {
              filtros.push([col, val]);
              llamadas.push({ campos, filtros });
              return { error };
            },
          };
          return encadenable;
        },
      };
    },
  };
  return { cliente: cliente as never, llamadas };
}

describe("avanzarEstadosNegocio", () => {
  it("actualiza con el candado y el avance forward-only correctos", async () => {
    const { cliente, llamadas } = supabaseFalso();

    const r = await avanzarEstadosNegocio(cliente, ["n-1", "n-2"], "contactado");

    expect(r).toEqual({ error: null });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]!.campos).toEqual({ estado: "contactado" });
    expect(llamadas[0]!.filtros).toEqual([
      ["id", ["n-1", "n-2"]],
      ["estado_fijado_manual", false],
      ["estado", "contactado"],
    ]);
  });

  it("con una lista vacía no llama a Supabase para nada", async () => {
    const { cliente, llamadas } = supabaseFalso();

    const r = await avanzarEstadosNegocio(cliente, [], "contactado");

    expect(r).toEqual({ error: null });
    expect(llamadas).toHaveLength(0);
  });

  it("un error de Supabase se devuelve, nunca se lanza", async () => {
    const { cliente } = supabaseFalso({ message: "conexión perdida" });

    const r = await avanzarEstadosNegocio(cliente, ["n-1"], "contactado");

    expect(r).toEqual({ error: "conexión perdida" });
  });
});

describe("avanzarEstadoNegocio", () => {
  it("es azúcar de avanzarEstadosNegocio con un solo id envuelto en array", async () => {
    const { cliente, llamadas } = supabaseFalso();

    await avanzarEstadoNegocio(cliente, "n-1", "respondido");

    expect(llamadas[0]!.filtros[0]).toEqual(["id", ["n-1"]]);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/lib/admin/__tests__/estado-negocio.test.ts`
Expected: FAIL — `Cannot find module '../estado-negocio'` (el archivo de
implementación todavía no existe).

- [ ] **Step 3: Escribir la implementación mínima**

Crear `src/lib/admin/estado-negocio.ts`:

```ts
// Un solo lugar donde vive el candado de estado_fijado_manual y el avance
// forward-only de negocios.estado. Postgres compara el enum estado_negocio
// por orden de declaración (nuevo < contactado < respondido < interesado <
// cliente < descartado), así que `estado < nuevoEstado` ya es forward-only
// sin tabla de orden aparte. Nunca pasar "descartado" como nuevoEstado: al
// ser el último del enum, cualquier negocio "avanzaría" hacia él. SOLO
// SERVIDOR.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoNegocio } from "./negocios";

/**
 * Avanza el estado de uno o más negocios en un solo UPDATE atómico. No toca
 * los que ya se fijaron a mano (`estado_fijado_manual`) ni los que ya están
 * en un estado igual o más avanzado. Nunca lanza.
 */
export async function avanzarEstadosNegocio(
  supabase: SupabaseClient,
  negocioIds: string[],
  nuevoEstado: EstadoNegocio,
): Promise<{ error: string | null }> {
  if (negocioIds.length === 0) return { error: null };

  const { error } = await supabase
    .from("negocios")
    .update({ estado: nuevoEstado })
    .in("id", negocioIds)
    .eq("estado_fijado_manual", false)
    .lt("estado", nuevoEstado);

  if (error) {
    console.error("[avanzarEstadosNegocio]", nuevoEstado, error.message);
    return { error: error.message };
  }
  return { error: null };
}

/** Azúcar para el caso más común: un solo negocio. */
export async function avanzarEstadoNegocio(
  supabase: SupabaseClient,
  negocioId: string,
  nuevoEstado: EstadoNegocio,
): Promise<{ error: string | null }> {
  return avanzarEstadosNegocio(supabase, [negocioId], nuevoEstado);
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/lib/admin/__tests__/estado-negocio.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/estado-negocio.ts src/lib/admin/__tests__/estado-negocio.test.ts
git commit -m "feat: avanzarEstadoNegocio — único helper con candado manual y forward-only"
```

---

## Task 3: `avancesDeEstado` respeta `estado_fijado_manual`

**Files:**
- Modify: `src/lib/admin/zak.ts:396-420`
- Test: `src/lib/admin/__tests__/zak.test.ts:145-197`

**Interfaces:**
- Consumes: nada nuevo (sigue siendo pura).
- Produces: `avancesDeEstado(prospectos: Prospecto[], actuales: { id: string;
  estado: EstadoNegocio; estado_fijado_manual: boolean }[]): AvanceEstado[]`
  — el tipo de `actuales` gana el campo `estado_fijado_manual` (antes era
  solo `{ id, estado }`). La Task 4 pasa este campo desde `sincronizarEstadosZak`.

- [ ] **Step 1: Actualizar los tests existentes y agregar el caso nuevo**

En `src/lib/admin/__tests__/zak.test.ts`, el `describe("avancesDeEstado", ...)`
(líneas 145-197) pasa objetos `{ id, estado }` en su segundo argumento — con
el tipo nuevo hace falta agregarles `estado_fijado_manual`. Reemplazar el
bloque completo (líneas 145-197) por:

```ts
describe("avancesDeEstado", () => {
  it("respondido avanza desde nuevo/contactado; interesado desde donde sea", () => {
    const avances = avancesDeEstado(
      [
        prospecto({ negocio_id: "a", estado_envio: "respondido" }),
        prospecto({ negocio_id: "b", estado_envio: "leido", interesado: true }),
        prospecto({ negocio_id: "c", estado_envio: "respondido", interesado: true }),
      ],
      [
        { id: "a", estado: "contactado", estado_fijado_manual: false },
        { id: "b", estado: "nuevo", estado_fijado_manual: false },
        { id: "c", estado: "respondido", estado_fijado_manual: false },
      ],
    );
    expect(avances).toEqual([
      { id: "a", a: "respondido" },
      { id: "b", a: "interesado" },
      { id: "c", a: "interesado" },
    ]);
  });

  it("forward-only: no retrocede ni repite", () => {
    const avances = avancesDeEstado(
      [
        // Ya interesado en el CRM: el respondido del funnel no lo baja.
        prospecto({ negocio_id: "a", estado_envio: "respondido" }),
        // Ya interesado en ambos lados: nada que hacer.
        prospecto({ negocio_id: "b", interesado: true }),
      ],
      [
        { id: "a", estado: "interesado", estado_fijado_manual: false },
        { id: "b", estado: "interesado", estado_fijado_manual: false },
      ],
    );
    expect(avances).toEqual([]);
  });

  it("jamás toca cliente ni descartado, ni negocios sin prospecto", () => {
    const avances = avancesDeEstado(
      [
        prospecto({ negocio_id: "a", interesado: true }),
        prospecto({ negocio_id: "b", estado_envio: "respondido" }),
        prospecto({ negocio_id: null, estado_envio: "respondido" }),
      ],
      [
        { id: "a", estado: "cliente", estado_fijado_manual: false },
        { id: "b", estado: "descartado", estado_fijado_manual: false },
        { id: "sin-prospecto", estado: "nuevo", estado_fijado_manual: false },
      ],
    );
    expect(avances).toEqual([]);
  });

  it("ignora un negocio fijado a mano aunque el funnel diga que avanzó", () => {
    const avances = avancesDeEstado(
      [
        prospecto({ negocio_id: "a", estado_envio: "respondido" }),
        prospecto({ negocio_id: "b", interesado: true }),
      ],
      [
        { id: "a", estado: "nuevo", estado_fijado_manual: true },
        { id: "b", estado: "contactado", estado_fijado_manual: true },
      ],
    );
    expect(avances).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/admin/__tests__/zak.test.ts`
Expected: FAIL — error de tipos (TS) porque `actuales` no acepta
`estado_fijado_manual` todavía, y el último test ("ignora un negocio fijado
a mano...") falla en runtime aunque compilara, porque `avancesDeEstado`
todavía no filtra por ese campo.

- [ ] **Step 3: Actualizar `avancesDeEstado`**

En `src/lib/admin/zak.ts`, reemplazar (líneas 396-420):

```ts
export function avancesDeEstado(
  prospectos: Prospecto[],
  actuales: { id: string; estado: EstadoNegocio }[],
): AvanceEstado[] {
  const porNegocio = new Map(
    prospectos
      .filter((p) => p.negocio_id !== null)
      .map((p) => [p.negocio_id as string, p]),
  );
  const avances: AvanceEstado[] = [];
  for (const n of actuales) {
    const p = porNegocio.get(n.id);
    if (!p) continue;
    if (n.estado === "cliente" || n.estado === "descartado") continue;
    if (p.interesado && n.estado !== "interesado") {
      avances.push({ id: n.id, a: "interesado" });
    } else if (
      p.estado_envio === "respondido" &&
      (n.estado === "nuevo" || n.estado === "contactado")
    ) {
      avances.push({ id: n.id, a: "respondido" });
    }
  }
  return avances;
}
```

por:

```ts
export function avancesDeEstado(
  prospectos: Prospecto[],
  actuales: { id: string; estado: EstadoNegocio; estado_fijado_manual: boolean }[],
): AvanceEstado[] {
  const porNegocio = new Map(
    prospectos
      .filter((p) => p.negocio_id !== null)
      .map((p) => [p.negocio_id as string, p]),
  );
  const avances: AvanceEstado[] = [];
  for (const n of actuales) {
    const p = porNegocio.get(n.id);
    if (!p) continue;
    if (n.estado === "cliente" || n.estado === "descartado") continue;
    if (n.estado_fijado_manual) continue;
    if (p.interesado && n.estado !== "interesado") {
      avances.push({ id: n.id, a: "interesado" });
    } else if (
      p.estado_envio === "respondido" &&
      (n.estado === "nuevo" || n.estado === "contactado")
    ) {
      avances.push({ id: n.id, a: "respondido" });
    }
  }
  return avances;
}
```

(Un solo `if` nuevo: `if (n.estado_fijado_manual) continue;`. El JSDoc que
está justo encima de esta función en el archivo real ya dice "forward-only:
jamás retrocede... jamás toca cliente ni descartado" — se le puede agregar
una frase sobre el candado manual si se quiere, no es obligatorio para que
el test pase.)

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/admin/__tests__/zak.test.ts`
Expected: PASS (todos, incluido el nuevo caso).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/zak.ts src/lib/admin/__tests__/zak.test.ts
git commit -m "feat: avancesDeEstado respeta estado_fijado_manual"
```

---

## Task 4: `sincronizarEstadosZak` lee y pasa `estado_fijado_manual`

**Files:**
- Modify: `src/lib/admin/zak-actions.ts:198-239`

**Interfaces:**
- Consumes: `avancesDeEstado` de la Task 3 (nueva firma, con
  `estado_fijado_manual` en `actuales`).
- Produces: sin cambio de firma pública (`sincronizarEstadosZak(): Promise<{
  respondidos: number; interesados: number } | { error: string }>`), la
  Task 10 lo sigue llamando igual.

**Nota de alcance:** este archivo (`zak-actions.ts`) no tiene tests hoy (es
un "use server" con `verifySession()` + llamadas al bot Flask; no hay
`zak-actions.test.ts`). El cambio es mecánico — agregar una columna al
`select` y pasarla en el objeto que ya arma — y se verifica leyendo el diff
más la suite completa en la Task 11, no con un test nuevo.

- [ ] **Step 1: Ampliar el `select` y el tipo que arma `sincronizarEstadosZak`**

En `src/lib/admin/zak-actions.ts`, dentro de `sincronizarEstadosZak` (líneas
198-239), cambiar:

```ts
  const { data, error } = await supabase.from("negocios").select("id, estado").in("id", ids);
  if (error || !data) {
    console.error("[sincronizarEstadosZak] negocios:", error?.message);
    return { error: "No se pudieron leer los estados actuales del CRM." };
  }

  const avances = avancesDeEstado(
    r.data,
    data as { id: string; estado: EstadoNegocio }[],
  );
```

por:

```ts
  const { data, error } = await supabase
    .from("negocios")
    .select("id, estado, estado_fijado_manual")
    .in("id", ids);
  if (error || !data) {
    console.error("[sincronizarEstadosZak] negocios:", error?.message);
    return { error: "No se pudieron leer los estados actuales del CRM." };
  }

  const avances = avancesDeEstado(
    r.data,
    data as { id: string; estado: EstadoNegocio; estado_fijado_manual: boolean }[],
  );
```

El resto de la función (líneas 223-238: separar `aRespondido`/`aInteresado`
y aplicar los dos `update().in(...)`) queda exactamente igual — ya reciben
solo los ids que `avancesDeEstado` decidió que SÍ deben avanzar, y esa
función ya excluye los fijados a mano desde la Task 3.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `zak-actions.ts` ni a
`avancesDeEstado`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/zak-actions.ts
git commit -m "feat: sincronizarEstadosZak lee estado_fijado_manual"
```

---

## Task 5: Candado en `actualizarNegocio` y `cambiarEstadoLote`

**Files:**
- Modify: `src/lib/admin/actions.ts:174-225` (`actualizarNegocio`) y
  `src/lib/admin/actions.ts:227-257` (`cambiarEstadoLote`)
- Test: `src/lib/admin/__tests__/actions.test.ts` (agregar, ya existe el
  archivo con el mock de `verifySession`/`next/cache`)

**Interfaces:**
- Produces: ambas funciones mantienen su firma pública; el único cambio de
  comportamiento observable es que el `UPDATE` que mandan a Supabase incluye
  `estado_fijado_manual: true` cuando tocan `estado`.

- [ ] **Step 1: Escribir los tests que fallan**

`src/lib/admin/__tests__/actions.test.ts` ya define, en el bloque
`vi.hoisted`, `verifySessionMock` y mockea `../dal` y `next/cache` (líneas
1-13) — se reusa tal cual. Agregar al final del archivo (después del
`describe("importarNegocios", ...)` existente):

```ts
/** Doble de Supabase para `.update(fila).eq("id", id)` /
 * `.update(fila).in("id", ids).select("id")`: guarda cada update completo
 * (los campos que mandó) para poder inspeccionarlo en el assert. */
function supabaseFalsoUpdate() {
  const actualizado: Record<string, unknown>[] = [];
  const cliente = {
    from: () => ({
      update: (campos: Record<string, unknown>) => {
        actualizado.push(campos);
        return {
          eq: async () => ({ error: null }),
          in: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        };
      },
    }),
  };
  return { cliente: cliente as never, actualizado };
}

describe("actualizarNegocio — candado manual", () => {
  beforeEach(() => {
    verifySessionMock.mockClear();
  });

  it("fija estado_fijado_manual cuando el cambio incluye estado", async () => {
    const { cliente, actualizado } = supabaseFalsoUpdate();
    verifySessionMock.mockResolvedValue({ supabase: cliente });
    const { actualizarNegocio } = await import("../actions");

    const res = await actualizarNegocio("n-1", { estado: "contactado" });

    expect(res).toEqual({ error: null });
    expect(actualizado[0]).toEqual({ estado: "contactado", estado_fijado_manual: true });
  });

  it("un cambio que no toca estado no agrega estado_fijado_manual", async () => {
    const { cliente, actualizado } = supabaseFalsoUpdate();
    verifySessionMock.mockResolvedValue({ supabase: cliente });
    const { actualizarNegocio } = await import("../actions");

    await actualizarNegocio("n-1", { nombre: "Panadería Nueva" });

    expect(actualizado[0]).not.toHaveProperty("estado_fijado_manual");
  });
});

describe("cambiarEstadoLote — candado manual", () => {
  beforeEach(() => {
    verifySessionMock.mockClear();
  });

  it("fija estado_fijado_manual en el cambio en lote", async () => {
    const { cliente, actualizado } = supabaseFalsoUpdate();
    verifySessionMock.mockResolvedValue({ supabase: cliente });
    const { cambiarEstadoLote } = await import("../actions");

    await cambiarEstadoLote(["n-1", "n-2"], "descartado");

    expect(actualizado[0]).toEqual({ estado: "descartado", estado_fijado_manual: true });
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npx vitest run src/lib/admin/__tests__/actions.test.ts`
Expected: FAIL en los 3 tests nuevos — el primero y el tercero porque
`actualizado[0]` no incluye `estado_fijado_manual` todavía.

- [ ] **Step 3: Agregar el candado en `actualizarNegocio`**

En `src/lib/admin/actions.ts`, dentro de `actualizarNegocio` (línea 192-195),
cambiar:

```ts
  if ("estado" in cambios) {
    if (!esEstado(cambios.estado)) return { error: "Estado no válido." };
    fila.estado = cambios.estado;
  }
```

por:

```ts
  if ("estado" in cambios) {
    if (!esEstado(cambios.estado)) return { error: "Estado no válido." };
    fila.estado = cambios.estado;
    fila.estado_fijado_manual = true;
  }
```

- [ ] **Step 4: Agregar el candado en `cambiarEstadoLote`**

En la misma función (líneas 245-249), cambiar:

```ts
  const { data, error } = await supabase
    .from("negocios")
    .update({ estado })
    .in("id", ids)
    .select("id");
```

por:

```ts
  const { data, error } = await supabase
    .from("negocios")
    .update({ estado, estado_fijado_manual: true })
    .in("id", ids)
    .select("id");
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `npx vitest run src/lib/admin/__tests__/actions.test.ts`
Expected: PASS (los de `importarNegocios` que ya existían + los 3 nuevos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/actions.ts src/lib/admin/__tests__/actions.test.ts
git commit -m "feat: actualizarNegocio y cambiarEstadoLote fijan estado_fijado_manual"
```

---

## Task 6: `despacho.ts` (voz) usa el helper

**Files:**
- Modify: `src/lib/voz/despacho.ts:107-114`

**Interfaces:**
- Consumes: `avanzarEstadoNegocio` de la Task 2
  (`@/lib/admin/estado-negocio`).

**Nota de alcance:** `despacharLlamadaZak` no tiene test hoy (llama a
ElevenLabs, `agenteZakVoz`, `contarLlamadasHoy` — mockear todo eso para
cubrir una línea que ya está cubierta por la Task 2 no es proporcional). Se
verifica leyendo el diff y con la suite completa en la Task 11.

- [ ] **Step 1: Importar el helper**

En `src/lib/voz/despacho.ts`, agregar al bloque de imports (después de la
línea 8):

```ts
import { avanzarEstadoNegocio } from "@/lib/admin/estado-negocio";
```

- [ ] **Step 2: Reemplazar el update ad-hoc**

Cambiar (líneas 107-114):

```ts
  if (negocioId) {
    const { error } = await supabase
      .from("negocios")
      .update({ estado: "contactado" })
      .eq("id", negocioId)
      .eq("estado", "nuevo");
    if (error) console.error("[despacharLlamadaZak] estado del negocio:", error.message);
  }
```

por:

```ts
  if (negocioId) {
    await avanzarEstadoNegocio(supabase, negocioId, "contactado");
  }
```

(`avanzarEstadoNegocio` ya loguea el error internamente — no hace falta
repetir el `console.error` acá.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/voz/despacho.ts
git commit -m "refactor: despacharLlamadaZak usa avanzarEstadoNegocio"
```

---

## Task 7: `enviarTandaZak` usa el helper

**Files:**
- Modify: `src/lib/admin/zak-actions.ts:1-137`

**Interfaces:**
- Consumes: `avanzarEstadosNegocio` de la Task 2 (`./estado-negocio`).

**Nota de alcance:** mismo criterio que la Task 6 — `enviarTandaZak` no
tenía test antes de este plan (crea tandas reales contra el bot Flask); se
verifica por lectura + suite completa.

- [ ] **Step 1: Importar el helper**

En `src/lib/admin/zak-actions.ts`, agregar a los imports (cerca de la línea
16-19, junto a los otros imports de `./zak`):

```ts
import { avanzarEstadosNegocio } from "./estado-negocio";
```

- [ ] **Step 2: Reemplazar el update ad-hoc**

Cambiar (líneas 116-128):

```ts
  // 'contactado' solo para los creados y solo desde 'nuevo': un negocio que ya
  // respondió o se interesó por otra vía no retrocede.
  const idsCreados = procesados
    .filter((n) => !duplicadosTels.has(sinMas(n.telefono as string)))
    .map((n) => n.id);
  if (idsCreados.length > 0) {
    const { error: e2 } = await supabase
      .from("negocios")
      .update({ estado: "contactado" })
      .in("id", idsCreados)
      .eq("estado", "nuevo");
    if (e2) console.error("[enviarTandaZak] estados:", e2.message);
  }
```

por:

```ts
  // 'contactado' solo para los creados: avanzarEstadosNegocio ya es
  // forward-only y respeta el candado manual.
  const idsCreados = procesados
    .filter((n) => !duplicadosTels.has(sinMas(n.telefono as string)))
    .map((n) => n.id);
  if (idsCreados.length > 0) {
    await avanzarEstadosNegocio(supabase, idsCreados, "contactado");
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/zak-actions.ts
git commit -m "refactor: enviarTandaZak usa avanzarEstadosNegocio"
```

---

## Task 8: `abrirChatZak` dispara `contactado`

**Files:**
- Modify: `src/lib/admin/zak-actions.ts:146-191`
- Modify: `src/components/admin/bots/Conversaciones.tsx:346-357`
- Modify: `src/components/admin/bots/NuevoChatZak.tsx:80-91`

**Interfaces:**
- Consumes: `avanzarEstadoNegocio` (ya importado en la Task 7, mismo
  archivo).
- Produces: `abrirChatZak(telefonoBruto: string, verticalSlug?: string,
  negocioId?: string): Promise<{ ok: true } | { error: string }>` — nuevo
  tercer parámetro opcional; las dos llamadas existentes se actualizan para
  pasarlo.

**Nota de alcance:** mismo criterio que la Task 6 (sin test nuevo dedicado;
`abrirChatZak` llama a `catalogoVerticales` y `enviarPlantillaDirecta`,
ninguna mockeada hoy). Se verifica leyendo el diff + la Task 11.

- [ ] **Step 1: Agregar el parámetro y la llamada al helper**

En `src/lib/admin/zak-actions.ts`, cambiar la firma (línea 146-149):

```ts
export async function abrirChatZak(
  telefonoBruto: string,
  verticalSlug?: string,
): Promise<{ ok: true } | { error: string }> {
```

por:

```ts
export async function abrirChatZak(
  telefonoBruto: string,
  verticalSlug?: string,
  negocioId?: string,
): Promise<{ ok: true } | { error: string }> {
```

Y cambiar el final de la función (líneas 188-190):

```ts
  revalidatePath("/admin/zak");
  return { ok: true };
}
```

por:

```ts
  if (negocioId) {
    await avanzarEstadoNegocio(supabase, negocioId, "contactado");
  }
  revalidatePath("/admin/zak");
  return { ok: true };
}
```

También hay que importar `avanzarEstadoNegocio` junto al
`avanzarEstadosNegocio` de la Task 7 — dejar la línea de import como:

```ts
import { avanzarEstadoNegocio, avanzarEstadosNegocio } from "./estado-negocio";
```

- [ ] **Step 2: Pasar `negocioId` desde el chat (Reabrir con plantilla)**

En `src/components/admin/bots/Conversaciones.tsx`, dentro de
`reabrirConPlantilla` (líneas 346-357), cambiar:

```ts
  function reabrirConPlantilla(slug: string) {
    if (!telefono) return;
    setAvisoChat(null);
    startOperar(async () => {
      const res = await abrirChatZak(telefono, slug);
```

por:

```ts
  function reabrirConPlantilla(slug: string) {
    if (!telefono) return;
    setAvisoChat(null);
    startOperar(async () => {
      const res = await abrirChatZak(telefono, slug, fichaActual?.negocioId);
```

(`fichaActual` ya está definido más arriba en el componente, línea 400:
`const fichaActual = telefono ? fichas[telefono] : undefined;` — nada que
agregar ahí.)

- [ ] **Step 3: Pasar `negocioId` desde "+ Nuevo chat"**

En `src/components/admin/bots/NuevoChatZak.tsx`, dentro de `saludar()`
(líneas 80-91), cambiar:

```ts
  function saludar() {
    if (!puedeEnviar || !telefono) return;
    setAviso(null);
    startEnviar(async () => {
      const res = await abrirChatZak(telefono, slug);
```

por:

```ts
  function saludar() {
    if (!puedeEnviar || !telefono) return;
    setAviso(null);
    startEnviar(async () => {
      const res = await abrirChatZak(telefono, slug, elegido?.negocioId);
```

(`elegido` es el estado `FichaNegocio | null` que ya se llena al elegir un
resultado de la búsqueda, línea 36 — `undefined` cuando escribieron un
teléfono suelto sin match, que es exactamente cuándo no hay negocio que
avanzar.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/zak-actions.ts src/components/admin/bots/Conversaciones.tsx src/components/admin/bots/NuevoChatZak.tsx
git commit -m "feat: abrirChatZak avanza a contactado cuando se conoce el negocio"
```

---

## Task 9: `enviarManual` dispara `contactado`

**Files:**
- Modify: `src/lib/admin/bots-actions.ts:353-368`
- Modify: `src/components/admin/bots/Conversaciones.tsx:329-344`

**Interfaces:**
- Produces: `enviarManual(id: number, telefono: string, texto: string,
  negocioId?: string): Promise<{ error: string | null }>` — nuevo cuarto
  parámetro opcional.

**Nota de alcance:** mismo criterio que las tareas 6-8.

- [ ] **Step 1: Agregar el parámetro y la llamada al helper**

En `src/lib/admin/bots-actions.ts`, revisar los imports del archivo: si no
existe ya un import de `verifySession` que devuelva `{ supabase }` en otra
función de este archivo, confirmar el import (`import { verifySession }
from "./dal";` ya existe, solo cambia cómo se usa acá). Agregar también:

```ts
import { avanzarEstadoNegocio } from "./estado-negocio";
```

Cambiar (líneas 353-368):

```ts
export async function enviarManual(
  id: number,
  telefono: string,
  texto: string,
): Promise<{ error: string | null }> {
  await verifySession();
  const tel = typeof telefono === "string" ? telefono.trim() : "";
  const msj = typeof texto === "string" ? texto.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !tel || !msj) {
    return { error: "Teléfono y mensaje son obligatorios." };
  }

  const r = await enviarManualApi(id, tel, msj);
  if (!r.ok) return { error: mensajeDe(r.error) };
  return { error: null };
}
```

por:

```ts
export async function enviarManual(
  id: number,
  telefono: string,
  texto: string,
  negocioId?: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  const tel = typeof telefono === "string" ? telefono.trim() : "";
  const msj = typeof texto === "string" ? texto.trim() : "";
  if (!Number.isInteger(id) || id <= 0 || !tel || !msj) {
    return { error: "Teléfono y mensaje son obligatorios." };
  }

  const r = await enviarManualApi(id, tel, msj);
  if (!r.ok) return { error: mensajeDe(r.error) };

  if (negocioId) {
    await avanzarEstadoNegocio(supabase, negocioId, "contactado");
  }
  return { error: null };
}
```

- [ ] **Step 2: Pasar `negocioId` desde el chat**

En `src/components/admin/bots/Conversaciones.tsx`, dentro de `enviar()`
(líneas 329-344), cambiar:

```ts
  function enviar() {
    if (!telefono || !mensaje.trim()) return;
    setAvisoChat(null);
    startOperar(async () => {
      const res = await enviarManual(instanciaId, telefono, mensaje);
```

por:

```ts
  function enviar() {
    if (!telefono || !mensaje.trim()) return;
    setAvisoChat(null);
    startOperar(async () => {
      const res = await enviarManual(instanciaId, telefono, mensaje, fichaActual?.negocioId);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/bots-actions.ts src/components/admin/bots/Conversaciones.tsx
git commit -m "feat: enviarManual avanza a contactado cuando se conoce el negocio"
```

---

## Task 10: Sincronizar respondido/interesado en cada tick del polling

**Files:**
- Modify: `src/components/admin/bots/Conversaciones.tsx:74-80,215-229`
- Modify: `src/components/admin/bots/ZakView.tsx:246-257`

**Interfaces:**
- Consumes: `sincronizar` (función ya existente en `ZakView.tsx`, definida
  en las líneas 124-140, sin cambios).
- Produces: `Conversaciones` gana la prop opcional `onTickLista?: () =>
  void`, invocada al final de cada tick del polling de 12s de la lista.

- [ ] **Step 1: Agregar la prop `onTickLista` al tipo `Props`**

En `src/components/admin/bots/Conversaciones.tsx`, dentro del `type Props`
(líneas 38-48), agregar después de `vozZak?: EstadoVozZak;`:

```ts
  /** Se llama al final de cada tick del polling de la lista (12s). Hoy lo
   *  usa Zak para mantener el CRM al día (respondido/interesado) sin
   *  depender de que alguien reabra la consola. */
  onTickLista?: () => void;
```

- [ ] **Step 2: Recibir la prop y llamarla en `refrescarLista`**

En la firma del componente (líneas 74-80), agregar `onTickLista` a la
desestructuración:

```ts
export function Conversaciones({
  instanciaId,
  esZak = false,
  abrirInicial = null,
  verticales,
  vozZak,
  onTickLista,
}: Props) {
```

Y en `refrescarLista` (líneas 215-229), envolver el cuerpo en `finally`:

```ts
  const refrescarLista = useCallback(async () => {
    try {
      const res = await fetch(
        `/admin/api/bots/${instanciaId}/conversaciones?offset=${offsetRef.current}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { conversaciones: Conversacion[] };
      if (mismoJson(conversacionesRef.current, data.conversaciones)) return;
      conversacionesRef.current = data.conversaciones;
      setConversaciones(data.conversaciones);
      void cruzarConCrm(data.conversaciones.map((c) => c.phone));
    } catch {
      // tick silencioso: se reintenta en el próximo
    } finally {
      onTickLista?.();
    }
  }, [instanciaId, cruzarConCrm, onTickLista]);
```

(Solo dos cambios sobre el código actual: el `finally { onTickLista?.(); }`
al final del `try/catch`, y `onTickLista` agregado al array de deps del
`useCallback`.)

- [ ] **Step 3: Conectar `ZakView` — pasar `sincronizar(true)` como tick**

En `src/components/admin/bots/ZakView.tsx`, dentro del bloque `{tab ===
"bandeja" && (...)}` (líneas 247-257), agregar la prop:

```tsx
        {tab === "bandeja" && (
          <Conversaciones
            // Otro deep-link = otra bandeja: remontar en vez de sincronizar props→estado.
            key={telefonoInicial ?? "bandeja"}
            instanciaId={ID_ZAK}
            esZak
            abrirInicial={telefonoInicial}
            verticales={verticales}
            vozZak={vozZak}
            onTickLista={() => sincronizar(true)}
          />
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/bots/Conversaciones.tsx src/components/admin/bots/ZakView.tsx
git commit -m "feat: sincroniza respondido/interesado en cada tick del polling de la bandeja"
```

---

## Task 11: Verificación completa de la fase

**Files:** ninguno nuevo — solo correr y revisar.

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: todos los tests pasan (incluidos los 8 nuevos de las tareas 2, 3 y
5, y los que ya existían).

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso (confirma que Next.js no tropieza con las firmas
nuevas de `abrirChatZak`/`enviarManual` en ningún otro call site que este
plan no haya tocado).

- [ ] **Step 4: Checklist manual (requiere la migración de la Task 1 ya
  corrida en Supabase, y `npm run dev` levantado)**

Avisar al usuario que confirme estos puntos a mano en `/admin/zak` (no son
automatizables sin credenciales reales del bot/Supabase):

- "+ Nuevo chat" a un negocio del CRM en estado `nuevo` → después de
  saludar, revisar en `/admin/prospeccion` que ese negocio pasó a
  `contactado` solo.
- Un negocio puesto a mano en `descartado` (desde `FichaNegocio`, ficha en
  `/admin/prospeccion`) que después recibe un mensaje por WhatsApp → sigue
  en `descartado` (no lo revive el polling).
- Un negocio en `contactado` cuyo prospecto responde en el bot → dentro de
  ~15 segundos (sin recargar `/admin/zak`) pasa a `respondido` en
  `/admin/prospeccion`.
- "Reabrir con plantilla" sobre un chat vencido de un negocio en `nuevo` →
  pasa a `contactado`.

- [ ] **Step 5: Commit final si el checklist manual movió algo**

Si el checklist manual no requirió cambios de código, no hay nada que
commitear en este paso — es solo verificación. Si algo falló y se corrigió,
seguir el ciclo normal (test → fix → commit) sobre la tarea correspondiente.
