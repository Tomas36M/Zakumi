# Cuota gratuita y confirmación reforzada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el panel sepa cuántas consultas facturadas lleva este mes, ofrezca barrer solo lo que cabe en las 1.000 gratis de Google, y exija escribir el monto cuando un barrido se pase de esa cuota.

**Architecture:** Una fila por consulta facturada en una tabla nueva (`consultas_places`), escrita por los dos únicos sitios que le pagan a Google: el RPC atómico del barrido y el handler de la búsqueda de texto. La página lee un agregado del mes y lo baja como prop; el diálogo recorta el plan a la cuota restante con una función pura y pide el monto por escrito solo cuando la tanda se pasa.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-cuota-y-confirmacion-design.md`

## Global Constraints

- **Idioma: español (`es-CO`)** en código, comentarios, tests y copy visible.
- **Vitest, no Jest.** Tests en `src/lib/admin/__tests__/*.test.ts`; el config solo recoge `src/**/__tests__/**/*.test.ts`.
- **El repo NO usa prettier.** Nunca `npx prettier --write` — reformatea el archivo entero. Indentar a mano.
- **Tailwind no ve plantillas**: las clases van literales en el código.
- **Next 16: los layouts NO se re-renderizan.** El check de sesión va en cada page/action/handler.
- **`GOOGLE_PLACES_API_KEY` jamás baja al browser**, y ningún cuerpo de error de Google o Supabase llega al cliente.
- **`CUOTA_GRATIS_MENSUAL = 1_000`** — verificado el 2026-09-01: SKU *Places API Nearby Search Enterprise* (`772E-9975-BE34`), Free Usage Cap 1.000/mes.
- **`PRECIO_POR_LLAMADA_USD = 0.035`** ya existe en `src/lib/admin/barrido.ts`. No duplicarlo.
- **Commits explícitos.** `git add <ruta>`. **Nunca `git add -A`** — el checkout es compartido.
- Línea base: **376 tests**, `tsc --noEmit` limpio, `npm run build` compila, lint limpio salvo seis archivos preexistentes (`src/app/(site)/privacidad/page.tsx`, `src/app/(site)/terminos/page.tsx`, `src/components/admin/Sidebar.tsx`, tres bajo `src/components/admin/bots/`). **Dejar esos seis en paz.**
- **NO conectarse a Supabase ni ejecutar SQL.** El usuario aplica los `.sql` a mano; su base ya tiene `prospeccion.sql` y el parche de `teselas_saturadas`.
- **No tocar `CLAUDE.md`** — tiene un conflicto pendiente con otra sesión.

---

### Task 1: La tabla y el registro dentro del RPC

**Files:**
- Modify: `supabase/prospeccion.sql`
- Create: `supabase/prospeccion-parches.sql` (append a la sección existente)

**Interfaces:**
- Consumes: nada
- Produces: tabla `public.consultas_places`; `public.anotar_tesela(uuid, text, text, boolean, int, int)` — seis argumentos

- [ ] **Step 1: Confirmar la firma que hay hoy**

```bash
grep -n "create or replace function public.anotar_tesela" -A6 supabase/prospeccion.sql
```

Esperado: cuatro parámetros (`p_territorio uuid`, `p_clave text`, `p_vertical text`, `p_saturada boolean default false`). Es la firma que hay que dropear antes de crear la nueva. **Si son otros, parar** — la base del usuario ya tiene dos versiones aplicadas y una tercera mal dropeada dejaría tres conviviendo.

- [ ] **Step 2: Añadir la tabla**

En `supabase/prospeccion.sql`, después del bloque de `territorios`:

```sql
-- ---- consultas_places: una fila por consulta facturada a Google ------------
-- `territorios.llamadas` es un contador acumulado sin fecha: sirve para decir
-- cuánto costó UN territorio, no para responder "¿cuánto va del mes?" ni "¿por
-- qué gasté US$40 el martes?". Esta tabla es ese registro.
--
-- Sin columna de costo a propósito: el precio es PRECIO_POR_LLAMADA_USD en el
-- código. Guardarlo aquí duplicaría una verdad que ya existe y se
-- desincronizaría el día que Google cambie la tarifa.
create table if not exists public.consultas_places (
  id            bigint generated always as identity primary key,
  -- on delete set null: borrar un territorio no puede borrar el registro de lo
  -- que se pagó por él. El gasto ocurrió.
  territorio_id uuid references public.territorios (id) on delete set null,
  clave         text,   -- clave de trabajo "lat,lng@radio#vertical"; null si es búsqueda
  vertical      text,   -- null si es búsqueda
  resultados    int,
  insertados    int,
  origen        text not null default 'barrido'
                  check (origen in ('barrido', 'busqueda')),
  creado_en     timestamptz not null default now()
);

create index if not exists consultas_places_creado_en_idx
  on public.consultas_places (creado_en desc);

alter table public.consultas_places enable row level security;

drop policy if exists consultas_places_solo_admin on public.consultas_places;
create policy consultas_places_solo_admin on public.consultas_places
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

revoke all on public.consultas_places from public, anon;
```

- [ ] **Step 3: Extender el RPC a seis argumentos**

Reemplazar el `create or replace function public.anotar_tesela(...)` existente. **El `drop function` de la firma vieja va ANTES y no es opcional**: cambiar la aridad deja las dos versiones conviviendo, y en esta base ya pasó una vez.

```sql
-- Sube de 4 a 6 argumentos: ahora también registra la fila en consultas_places.
-- Va DENTRO de la misma función para que contar y registrar no puedan
-- divergir — si el UPDATE del contador ocurre, la fila del registro ocurre.
drop function if exists public.anotar_tesela(uuid, text, text, boolean);

create or replace function public.anotar_tesela(
  p_territorio  uuid,
  p_clave       text,
  p_vertical    text,
  p_saturada    boolean default false,
  p_resultados  int default null,
  p_insertados  int default null
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update territorios
     set llamadas       = llamadas + 1,
         teselas_hechas = case when teselas_hechas ? p_clave
                                then teselas_hechas
                                else teselas_hechas || to_jsonb(p_clave) end,
         teselas_saturadas = case
                               when not p_saturada then teselas_saturadas
                               when teselas_saturadas ? p_clave then teselas_saturadas
                               else teselas_saturadas || to_jsonb(p_clave) end,
         verticales     = case when p_vertical = any(verticales)
                                then verticales
                                else array_append(verticales, p_vertical) end,
         ultimo_barrido = now()
   where id = p_territorio;

  if not found then
    raise exception 'territorio % no existe', p_territorio
      using errcode = 'no_data_found';
  end if;

  insert into public.consultas_places
    (territorio_id, clave, vertical, resultados, insertados, origen)
  values
    (p_territorio, p_clave, p_vertical, p_resultados, p_insertados, 'barrido');
end;
$$;

revoke all on function public.anotar_tesela(uuid, text, text, boolean, int, int) from public, anon;
grant execute on function public.anotar_tesela(uuid, text, text, boolean, int, int) to authenticated;
```

`security invoker` se mantiene: la RLS de `territorios` y la de `consultas_places` son la barrera. Con `definer` la política no aplicaría y cualquier autenticado podría escribir.

- [ ] **Step 4: Añadir el delta al archivo de parches**

`supabase/prospeccion-parches.sql` ya existe para bases que corrieron una versión anterior. Añadir una sección nueva, envuelta en `begin;`/`commit;`, con: la tabla, su índice, su RLS, el `drop function` de la firma de cuatro, el `create or replace` de la de seis, y los `revoke`/`grant`. Comentar cuáles statements son no-op en una base que ya tiene lo anterior.

- [ ] **Step 5: Verificar que nada se rompió**

```bash
npm test
npx tsc --noEmit
```

Esperado: 376 tests, typecheck limpio. Este task solo añade SQL.

- [ ] **Step 6: Commit**

```bash
git add supabase/prospeccion.sql supabase/prospeccion-parches.sql
git commit -m "cuota: tabla consultas_places y el RPC que la escribe"
```

---

### Task 2: Leer el consumo del mes

**Files:**
- Modify: `src/lib/admin/territorios.ts`
- Create: `src/lib/admin/__tests__/cuota.test.ts`
- Modify: `src/lib/admin/barrido.ts`

**Interfaces:**
- Consumes: `PRECIO_POR_LLAMADA_USD` de `barrido.ts`
- Produces:
  - `CUOTA_GRATIS_MENSUAL = 1_000` (en `barrido.ts`, junto al precio)
  - `restanteDeCuota(consumidas: number): number`
  - `type EstadoCuota = { consumidas: number; restantes: number; agotada: boolean }`
  - `estadoDeCuota(consumidas: number): EstadoCuota`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/admin/__tests__/cuota.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CUOTA_GRATIS_MENSUAL, estadoDeCuota, restanteDeCuota } from "../barrido";

describe("restanteDeCuota", () => {
  it("sin consumo, queda la cuota entera", () => {
    expect(restanteDeCuota(0)).toBe(CUOTA_GRATIS_MENSUAL);
  });

  it("descuenta lo consumido", () => {
    expect(restanteDeCuota(300)).toBe(CUOTA_GRATIS_MENSUAL - 300);
  });

  it("nunca devuelve negativo: pasarse de la cuota deja cero, no deuda", () => {
    expect(restanteDeCuota(CUOTA_GRATIS_MENSUAL + 500)).toBe(0);
  });

  it("justo en el tope deja cero", () => {
    expect(restanteDeCuota(CUOTA_GRATIS_MENSUAL)).toBe(0);
  });
});

describe("estadoDeCuota", () => {
  it("no está agotada mientras quede una", () => {
    expect(estadoDeCuota(CUOTA_GRATIS_MENSUAL - 1)).toEqual({
      consumidas: CUOTA_GRATIS_MENSUAL - 1,
      restantes: 1,
      agotada: false,
    });
  });

  it("agotada exactamente en el tope", () => {
    expect(estadoDeCuota(CUOTA_GRATIS_MENSUAL).agotada).toBe(true);
  });

  it("un consumo negativo o basura se trata como cero, no rompe la pantalla", () => {
    expect(estadoDeCuota(-5).restantes).toBe(CUOTA_GRATIS_MENSUAL);
    expect(estadoDeCuota(Number.NaN).restantes).toBe(CUOTA_GRATIS_MENSUAL);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- cuota
```

Esperado: FAIL — `CUOTA_GRATIS_MENSUAL`, `restanteDeCuota` y `estadoDeCuota` no existen.

- [ ] **Step 3: Implementar en `barrido.ts`**

Junto a `PRECIO_POR_LLAMADA_USD`:

```ts
/** Consultas que Google no cobra cada mes en este SKU. Verificado el
 * 2026-09-01 en la tabla de precios de Maps Platform: SKU "Places API Nearby
 * Search Enterprise" (772E-9975-BE34), Free Usage Cap 1.000. Si Google la
 * cambia, se cambia acá. */
export const CUOTA_GRATIS_MENSUAL = 1_000;

export type EstadoCuota = {
  consumidas: number;
  restantes: number;
  agotada: boolean;
};

/** Lo que queda de cuota. Nunca negativo: pasarse no genera deuda, solo
 * significa que a partir de ahí todo se paga. */
export function restanteDeCuota(consumidas: number): number {
  const usadas = Number.isFinite(consumidas) && consumidas > 0 ? consumidas : 0;
  return Math.max(0, CUOTA_GRATIS_MENSUAL - usadas);
}

export function estadoDeCuota(consumidas: number): EstadoCuota {
  const usadas = Number.isFinite(consumidas) && consumidas > 0 ? consumidas : 0;
  const restantes = restanteDeCuota(usadas);
  return { consumidas: usadas, restantes, agotada: restantes === 0 };
}
```

- [ ] **Step 4: Añadir el lector de datos**

En `src/lib/admin/territorios.ts`:

```ts
/** Consultas facturadas en el mes calendario en curso.
 *
 * OJO con lo que este número NO es: cuenta lo que ESTE panel registró desde que
 * existe la tabla. No ve consumo anterior a la migración, ni el de nada más que
 * use la misma key de Google. Hoy este panel es el único consumidor de Places
 * del proyecto, así que es exacto — deja de serlo el día que eso cambie, y
 * nadie recibe un aviso cuando pasa. La pantalla debe decir de dónde sale. */
export async function consultasDelMes(
  supabase: SupabaseClient,
): Promise<number | null> {
  const desde = new Date();
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("consultas_places")
    .select("*", { count: "exact", head: true })
    .gte("creado_en", desde.toISOString());

  if (error) {
    console.error("[cuota] error contando consultas del mes:", error.message);
    return null; // null = "no sé", que la vista debe distinguir de 0
  }
  return count ?? 0;
}
```

Importar el tipo del cliente igual que lo hacen los otros lectores del archivo.

- [ ] **Step 5: Correr los tests**

```bash
npm test -- cuota
npx tsc --noEmit
```

Esperado: PASS y typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/barrido.ts src/lib/admin/territorios.ts src/lib/admin/__tests__/cuota.test.ts
git commit -m "cuota: constante, aritmética pura y lector del consumo del mes"
```

---

### Task 3: Los dos escritores registran

**Files:**
- Modify: `src/app/admin/api/territorio/[id]/barrer/route.ts`
- Modify: `src/app/admin/api/places/search/route.ts`

**Interfaces:**
- Consumes: `anotar_tesela` de seis argumentos (Task 1)
- Produces: filas en `consultas_places` desde las dos rutas que le pagan a Google

- [ ] **Step 1: Pasar los contadores al RPC del barrido**

En `barrer/route.ts`, la llamada a `.rpc("anotar_tesela", {...})` gana dos parámetros:

```ts
      p_resultados: crudos.length,
      p_insertados: insertados,
```

`crudos.length` es lo que devolvió Google antes de recortar; `insertados` es lo que entró a `negocios`. Los nombres de los otros cuatro no cambian.

- [ ] **Step 2: Registrar la búsqueda de texto**

`places/search/route.ts` no pasa por `anotar_tesela` —no toca territorios— así que inserta su propia fila. Después de que Google responda `ok` y antes de devolver los resultados:

```ts
  // La búsqueda suelta también le paga a Google con la misma key, y hasta ahora
  // no se contaba en ningún lado: el contador del mes se quedaba corto justo en
  // lo que el usuario no ve.
  //
  // Si este insert falla, la búsqueda NO falla. Perder una anotación es malo;
  // romper una búsqueda ya pagada es peor.
  const { error: errorRegistro } = await sesion.supabase
    .from("consultas_places")
    .insert({
      territorio_id: null,
      clave: null,
      vertical: null,
      resultados: (data.places ?? []).length,
      insertados: null,
      origen: "busqueda",
    });
  if (errorRegistro) {
    console.error("[places] no se registró la consulta:", errorRegistro.message);
  }
```

- [ ] **Step 3: Verificar**

```bash
npm test
npx tsc --noEmit
npm run build
```

Esperado: 376 tests, typecheck limpio, build compila. Ninguna de las dos rutas tiene test unitario (necesitan red y sesión); la verificación real es el paso manual de la Task 6.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/api/territorio/[id]/barrer/route.ts" "src/app/admin/api/places/search/route.ts"
git commit -m "cuota: las dos rutas que pagan registran su consulta"
```

---

### Task 4: Recortar el plan a la cuota

**Files:**
- Modify: `src/lib/admin/plan-barrido.ts`
- Modify: `src/lib/admin/__tests__/plan-barrido.test.ts`

**Interfaces:**
- Consumes: `Trabajo` de `plan-barrido.ts`
- Produces: `recortarACuota(plan: readonly Trabajo[], restantes: number): Trabajo[]`

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/lib/admin/__tests__/plan-barrido.test.ts`:

```ts
import { recortarACuota } from "../plan-barrido";

describe("recortarACuota", () => {
  const plan = (n: number): Trabajo[] =>
    Array.from({ length: n }, (_, i) => ({
      tesela: { centro: { lat: 4.72, lng: -74.28 }, radio: 400, clave: `t${i}` },
      vertical: "ferreteria",
      profundidad: 0,
      clave: `t${i}#ferreteria`,
    }));

  it("recorta a lo que queda de cuota", () => {
    expect(recortarACuota(plan(10), 4)).toHaveLength(4);
  });

  it("si el plan entero cabe, no recorta nada", () => {
    const p = plan(3);
    expect(recortarACuota(p, 10)).toHaveLength(3);
  });

  it("sin cuota restante devuelve vacío: no hay nada gratis que barrer", () => {
    expect(recortarACuota(plan(10), 0)).toEqual([]);
  });

  it("una cuota negativa se trata como cero", () => {
    expect(recortarACuota(plan(10), -3)).toEqual([]);
  });

  it("conserva el orden: lo pendiente de una celda saturada va primero y no se pierde por el recorte", () => {
    const p = plan(5);
    expect(recortarACuota(p, 2).map((t) => t.clave)).toEqual([p[0].clave, p[1].clave]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
npm test -- plan-barrido
```

Esperado: FAIL — `recortarACuota` no existe.

- [ ] **Step 3: Implementar**

En `src/lib/admin/plan-barrido.ts`:

```ts
/** El plan recortado a lo que quepa en la cuota gratuita que queda.
 *
 * Corta por el final y respeta el orden, que importa: `planDeBarrido` pone
 * primero las hijas pendientes de celdas saturadas, y ésas son las únicas que
 * un plan futuro NO puede regenerar. Recortar por el principio las tiraría. */
export function recortarACuota(
  plan: readonly Trabajo[],
  restantes: number,
): Trabajo[] {
  const cabe = Number.isFinite(restantes) && restantes > 0 ? Math.floor(restantes) : 0;
  return plan.slice(0, cabe);
}
```

- [ ] **Step 4: Correr los tests**

```bash
npm test -- plan-barrido
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/plan-barrido.ts src/lib/admin/__tests__/plan-barrido.test.ts
git commit -m "cuota: recortar el plan a lo que queda de gratis"
```

---

### Task 5: El diálogo — cuota, botón gratis y monto escrito

**Files:**
- Modify: `src/app/admin/(panel)/prospeccion/page.tsx`
- Modify: `src/components/admin/prospeccion/ProspeccionView.tsx`
- Modify: `src/components/admin/prospeccion/TerritorioView.tsx`
- Modify: `src/components/admin/prospeccion/DialogoBarrer.tsx`

**Interfaces:**
- Consumes: `consultasDelMes` (Task 2), `estadoDeCuota`/`CUOTA_GRATIS_MENSUAL` (Task 2), `recortarACuota` (Task 4)
- Produces: `DialogoBarrer` acepta `consultasMes: number | null`

- [ ] **Step 1: Bajar el dato desde la página**

En `page.tsx`, añadir `consultasDelMes(supabase)` al `Promise.all` que ya trae negocios, cuenta y territorios, y pasar el resultado como prop hasta `DialogoBarrer`, por el mismo camino que `fallaTerritorios`. **`null` significa "no sé"** y debe llegar como `null`, no como `0`: la pantalla no puede afirmar que quedan 1.000 gratis cuando no pudo leer el consumo.

- [ ] **Step 2: Mostrar la cuota en el diálogo**

`estadoDeCuota` recibe `number`, y `consultasMes` es `number | null`. **No lo fuerces con `?? 0`**: eso afirmaría que quedan 1.000 gratis justo cuando no pudimos leer el consumo, que es la mentira más cara que puede decir esta pantalla. Trátalo como los otros fallos de carga:

```tsx
  // null = "no pudimos leerlo", que NO es lo mismo que cero. Si se colapsan,
  // un fallo de lectura se presenta como cuota intacta y el usuario gasta
  // creyendo que no cuesta.
  const cuota = consultasMes === null ? null : estadoDeCuota(consultasMes);
```

Sobre el bloque de costo:

- Si `cuota === null`: *"No se pudo leer cuánto llevas gastado este mes. La cifra de abajo es el precio de lista."* — y **no se ofrece el botón de gratis**, porque no se puede saber qué cabe.
- Si hay dato: *"Este mes llevas {cuota.consumidas} de {CUOTA_GRATIS_MENSUAL} consultas gratis, según lo que este panel lleva registrado."*
- Si `cuota.agotada`: decirlo, con el enlace a las métricas de Google Cloud que ya está en este diálogo. **No se bloquea nada** — se sigue pudiendo barrer escribiendo el monto (paso 4).

La coletilla *"según lo que este panel lleva registrado"* no es humildad decorativa: el número es exacto solo mientras este panel sea el único consumidor de la key, y nadie avisa cuando eso cambia.

- [ ] **Step 3: El botón de barrer solo lo gratis**

Segundo botón, junto al principal. Se ofrece **solo** cuando hay dato de cuota, quedan consultas gratis, y la tanda se pasa de ellas. Si el plan entero cabe, no se ofrece — sería idéntico al principal, y dos botones que hacen lo mismo confunden.

La condición de ofrecerlo, explícita — las tres tienen que darse:

```tsx
  const planGratis = cuota ? recortarACuota(plan, cuota.restantes) : [];
  // Se ofrece solo si hay dato, queda algo gratis, Y la tanda se pasa. Si el
  // plan entero cabe, este botón haría lo mismo que el principal.
  const ofrecerGratis = cuota !== null && planGratis.length > 0 && planGratis.length < plan.length;
```

Su etiqueta dice cuántas barre: `Barrer las {planGratis.length} gratis`. Al confirmar, llama a `onConfirmar` con `planGratis` y con `llamadasAprobadas` igual a `planGratis.length`.

Debajo, una línea que diga que el territorio queda a medias y que reanudar el mes que viene no vuelve a pagar lo ya barrido.

- [ ] **Step 4: El monto escrito**

Cuando la tanda **supera** lo que queda de cuota, el botón principal se deshabilita hasta que el campo tenga el monto exacto.

- Se compara contra el monto **sin el símbolo de moneda**, tolerando espacios alrededor. `formatoUsd` devuelve algo como `US$ 42,00` (con espacio duro, `\u00a0`, en `es-CO`), así que **no basta con `.replace("US$", "")`**:

```tsx
  /** Lo que hay que teclear: el monto sin moneda ni espacios. Se compara así
   * —y no contra una palabra fija— porque un monto hay que ir a buscarlo al
   * botón: para copiarlo, hay que mirarlo. Una palabra se teclea de memoria. */
  const esperado = formatoUsd(tanda.costoUsd).replace(/[^\d.,]/g, "");
  const coincide = escrito.replace(/[^\d.,]/g, "") === esperado;
```
- El campo lleva su `<Field>` con label, y el botón deshabilitado explica por qué vía `aria-describedby`.
- **No mover el foco automáticamente al campo**: quien navega con teclado debe pasar por él, no encontrárselo puesto.
- Si la tanda cabe entera en la cuota, **no hay campo**. Un clic y a barrer.

Copiar el patrón de `<Field>`/`<Input>` de `DibujarTerritorio.tsx`, que ya nombra un territorio en un diálogo.

- [ ] **Step 5: Verificar**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Esperado: 376 tests (este task no añade lógica pura), typecheck limpio, lint solo con los seis preexistentes, build compila.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/(panel)/prospeccion/page.tsx" src/components/admin/prospeccion/ProspeccionView.tsx src/components/admin/prospeccion/TerritorioView.tsx src/components/admin/prospeccion/DialogoBarrer.tsx
git commit -m "cuota: el diálogo dice cuánto queda gratis, ofrece barrerlo y pide el monto para pasarse"
```

---

### Task 6: El SQL que le toca pegar a Tomás, y la verificación

**Files:**
- Modify: `supabase/prospeccion-parches.sql`
- Create: el bloque de verificación en el informe

**Interfaces:**
- Consumes: todo lo anterior
- Produces: el snippet exacto para una base que ya tiene `prospeccion.sql` + el parche de `teselas_saturadas`

- [ ] **Step 1: Aislar el delta**

La base del usuario ya tiene: `territorios`, `teselas_saturadas`, y `anotar_tesela` de **cuatro** argumentos. Lo genuinamente nuevo es: la tabla `consultas_places` con su índice y su RLS, el `drop function` de la firma de cuatro, y el `create or replace` de la de seis con sus `revoke`/`grant`.

Escribirlo como una sección propia, envuelta en `begin;`/`commit;`, con un comentario por statement diciendo si es no-op en esa base.

- [ ] **Step 2: Verificar a mano que es re-ejecutable**

Leer el bloque como lo leería Postgres, en orden, sobre esa base. Confirmar que `create table if not exists`, `create index if not exists`, `drop policy if exists` + `create policy` y `create or replace function` son todos idempotentes, y que **no hay ningún statement destructivo** — a diferencia del bloque del enum `ciudad`, que sí lo era y por eso lleva guarda.

- [ ] **Step 3: Escribir la consulta de comprobación**

```sql
-- Debe devolver exactamente una fila: anotar_tesela(uuid,text,text,boolean,integer,integer)
select p.oid::regprocedure
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'anotar_tesela';

-- Debe existir y estar vacía.
select count(*) from public.consultas_places;
```

Si la primera devuelve **dos** filas, el `drop function` no corrió y hay dos versiones conviviendo: la de cuatro seguirá recibiendo llamadas del código viejo y no registrará nada.

- [ ] **Step 4: Commit**

```bash
git add supabase/prospeccion-parches.sql
git commit -m "cuota: el delta de SQL para una base ya migrada"
```

---

## Antes de mergear

- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — los cuatro verdes.
- [ ] **El SQL corrido ANTES del deploy.** El código nuevo llama a `anotar_tesela` con seis argumentos; contra la firma de cuatro, cada tesela devolvería `contabilizada: false` y la pantalla pintaría el banner rojo de cobros no contabilizados en todo el barrido. Falla ruidosamente, no en silencio — pero falla.
- [ ] Una búsqueda de texto suelta y un barrido de una tesela, comprobando que **ambos** dejan su fila en `consultas_places` con el `origen` correcto.
- [ ] Que el contador del diálogo suba después de barrer.
- [ ] Que con la cuota agotada el botón principal exija el monto, y que escribirlo mal no lo habilite.
