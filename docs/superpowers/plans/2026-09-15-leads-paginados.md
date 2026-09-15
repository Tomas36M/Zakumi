# Leads paginados — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La lista de Leads (en Encontrar clientes y en la página de un territorio) pagina de a 50
contra la base entera, y la cabecera y las caras de Encontrar clientes dicen las cifras reales de la
base, no las de los 900 cargados.

**Architecture:** Un módulo puro (`leads-consulta.ts`) traduce el filtro de la lista a querystring,
de vuelta, y a condiciones de la consulta de Supabase. Un route handler `GET /admin/api/leads` responde
la página, el total, los conteos por estado y (a pedido) las opciones de los selects. `NegociosView`
pide cada página con `fetch` y guarda `?pagina=` en la URL. Los dueños de la página (Prospección y
Territorio) resuelven la ficha de un lead con su lista cargada o por id. La page de Prospección suma un
conteo de «sin web» y las cifras de la cabecera salen de un helper puro.

**Tech Stack:** Next.js 16 App Router + TypeScript + Tailwind v4 + Supabase (PostgREST `count: "exact"`,
`head: true`, `.range()`, `ilike` sobre el índice trigram existente) + Vitest. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-15-leads-paginados-design.md`

## Global Constraints

- Worktree `/Users/tom/Desktop/Zakumi/.claude/worktrees/feat+leads-paginados`, rama `feat/leads-paginados`.
  Todo comando corre desde ahí; nunca `cd` a otro checkout.
- El guard del worktree rechaza Bash complejo (heredocs, bucles, `[ ] && { }`): un comando simple por
  paso. Los textos largos (cuerpo de la PR) y los logs van al scratchpad de la sesión, fuera del repo;
  en los comandos de este plan ese directorio se escribe `<scratchpad>` (su ruta cambia por sesión y la
  da el system prompt).
- Códigos de salida reales: `comando; echo "exit=$?"`. Nunca un `| tail` que tape el código.
- Commits con archivos explícitos (`git add <rutas>`), nunca `git add -A` ni `git add .`. Cada mensaje
  termina con la línea `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` (segundo `-m`).
- **Repo público:** ni nombres de prospectos, ni teléfonos, ni cifras reales del CRM en código, tests,
  commits o PR. Los ejemplos usan cifras y nombres inventados.
- Español en código y copy. Sin «stack» ni spanglish en el copy visible.
- Lecturas en route handlers; server actions solo para mutaciones. Cada handler vuelve a verificar la
  sesión (`getSesionAdmin`): en Next 16 los layouts no se re-renderizan.
- **Sin SQL nuevo y sin variables de entorno nuevas.**
- `LEADS_POR_PAGINA = 50`, igual a `TANDA_MAX_BOT`. *Max rows* de Supabase = 1000: toda lectura con
  filas pide como mucho 1000 por consulta; los conteos van con `head: true`.
- React: nada de setState síncrono en el cuerpo de un efecto (`react-hooks/set-state-in-effect`). Los
  setState van en la continuación async de un `fetch` o dentro de un `setTimeout`.
- **No tipar funciones con una interfaz genérica sobre el query builder de supabase-js**
  (`<Q extends ConsultaFiltrable<Q>>` o parecido): da TS2589 «Type instantiation is excessively deep»
  (comprobado con `tsc` el 15 sep). Se usa el tipo concreto `ConsultaNegocios` (Task 2).
- Tests: Vitest en entorno node, solo `src/**/__tests__/**/*.test.ts`. En este repo no hay tests de
  componentes ni de route handlers: los componentes y la ruta se verifican con `tsc`, `eslint`,
  `next build` y QA manual. Dobles de Supabase hechos a mano y pasados `as never` (patrón de
  `src/lib/admin/__tests__/estado-negocio.test.ts`).
- «Sin web» es `sitio_web is null`: los dos escritores de la columna normalizan con `urlHttpONull`
  (URL válida o `null`), así que coincide con `esSinWeb` y con la RPC `cuentas_por_territorio`.

---

### Task 1: Filtro ↔ querystring de la lista (TDD)

**Files:**
- Create: `src/lib/admin/leads-consulta.ts`
- Modify: `src/lib/admin/paginacion.ts` (añadir `LEADS_POR_PAGINA` debajo de `TERRITORIOS_POR_PAGINA`)
- Test: `src/lib/admin/__tests__/leads-consulta.test.ts`

**Interfaces:**
- Consumes: `FiltroLeads`, `FILTRO_VACIO` (`src/lib/admin/filtros-leads.ts`); `ESTADOS`, `EstadoNegocio`,
  `Negocio` (`src/lib/admin/negocios.ts`); `paginaDesdeParam(valor: string | undefined): number`
  (`src/lib/admin/paginacion.ts`); `TANDA_MAX_BOT` (`src/lib/admin/zak.ts`, solo en el test).
- Produces:
  - `LEADS_POR_PAGINA: number` (= 50) en `paginacion.ts`.
  - `type OpcionesLeads = { ciudades: string[]; categorias: string[] }`
  - `type RespuestaLeads = { filas: Negocio[]; total: number; pagina: number; conteos: Record<EstadoNegocio, number>; opciones?: OpcionesLeads }`
  - `filtroDesdeParams(params: URLSearchParams): { filtro: FiltroLeads; pagina: number }`
  - `paramsDeFiltro(filtro: FiltroLeads, pagina: number): URLSearchParams` — orden fijo de claves:
    `q, estado, ciudad, categoria, telefono, web, territorio, pagina`.

- [ ] **Step 1: Escribir los tests (fallan: el módulo no existe)**

Crear `src/lib/admin/__tests__/leads-consulta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FILTRO_VACIO, type FiltroLeads } from "../filtros-leads";
import { filtroDesdeParams, paramsDeFiltro } from "../leads-consulta";
import { LEADS_POR_PAGINA } from "../paginacion";
import { TANDA_MAX_BOT } from "../zak";

const TERRITORIO = "3f1c2b9a-8d7e-4c6b-9a5f-1e2d3c4b5a69";

const COMPLETO: FiltroLeads = {
  q: "el tornillo",
  ciudad: "Bogotá",
  estados: ["respondido"],
  categoria: "ferreteria",
  telefono: "con",
  web: "sin",
  territorio: TERRITORIO,
};

describe("filtroDesdeParams", () => {
  it("sin parámetros es el filtro vacío en la página 1", () => {
    expect(filtroDesdeParams(new URLSearchParams())).toEqual({ filtro: FILTRO_VACIO, pagina: 1 });
  });

  it("lee cada filtro válido y la página", () => {
    const params = new URLSearchParams({
      q: "el tornillo",
      estado: "respondido",
      ciudad: "Bogotá",
      categoria: "ferreteria",
      telefono: "con",
      web: "sin",
      territorio: TERRITORIO,
      pagina: "3",
    });
    expect(filtroDesdeParams(params)).toEqual({ filtro: COMPLETO, pagina: 3 });
  });

  it("descarta un estado que no existe en el pipeline", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ estado: "vip" }));
    expect(filtro.estados).toEqual([]);
  });

  it("teléfono y web fuera de su dominio caen a «todos»", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ telefono: "fijo", web: "quizas" }));
    expect(filtro.telefono).toBe("todos");
    expect(filtro.web).toBe("todos");
  });

  it("recorta el texto: sin espacios de sobra y como mucho 80 caracteres", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ q: `  ${"a".repeat(100)}  ` }));
    expect(filtro.q).toBe("a".repeat(80));
  });

  it("un territorio que no es un id válido cae a «todos»", () => {
    const { filtro } = filtroDesdeParams(new URLSearchParams({ territorio: "no-es-un-id" }));
    expect(filtro.territorio).toBe("todos");
  });

  it("una página inválida cae a la 1", () => {
    expect(filtroDesdeParams(new URLSearchParams({ pagina: "-2" })).pagina).toBe(1);
  });
});

describe("paramsDeFiltro", () => {
  it("el filtro vacío en la página 1 no manda nada", () => {
    expect(paramsDeFiltro(FILTRO_VACIO, 1).toString()).toBe("");
  });

  it("solo manda lo que se aparta de los valores por defecto", () => {
    expect(paramsDeFiltro({ ...FILTRO_VACIO, web: "sin" }, 2).toString()).toBe("web=sin&pagina=2");
  });

  it("manda el texto sin espacios de sobra", () => {
    expect(paramsDeFiltro({ ...FILTRO_VACIO, q: "  el tornillo " }, 1).get("q")).toBe("el tornillo");
  });

  it("ida y vuelta con filtroDesdeParams sin perder nada", () => {
    expect(filtroDesdeParams(paramsDeFiltro(COMPLETO, 4))).toEqual({ filtro: COMPLETO, pagina: 4 });
  });
});

describe("LEADS_POR_PAGINA", () => {
  it("una página es exactamente una tanda de Zak: «seleccionar la página» cabe en un envío", () => {
    expect(LEADS_POR_PAGINA).toBe(TANDA_MAX_BOT);
  });
});
```

- [ ] **Step 2: Ver los tests fallar**

Run: `npx vitest run src/lib/admin/__tests__/leads-consulta.test.ts; echo "exit=$?"`
Expected: FAIL — `Failed to resolve import "../leads-consulta"` (y `exit=1`).

- [ ] **Step 3: Implementar**

En `src/lib/admin/paginacion.ts`, debajo de `export const TERRITORIOS_POR_PAGINA = 25;`:

```ts
/** La lista de Leads pagina de a 50: una página es exactamente una tanda de Zak
 * (`TANDA_MAX_BOT`), así «seleccionar la página» cabe en un envío. */
export const LEADS_POR_PAGINA = 50;
```

Crear `src/lib/admin/leads-consulta.ts`:

```ts
// La lista de Leads pagina contra la base: el navegador pide cada página a
// GET /admin/api/leads con los filtros en el querystring. Aquí vive lo que
// comparten la ruta y la lista —el contrato de la respuesta y la traducción
// filtro ↔ querystring— para que los dos lados no puedan decir cosas distintas.

import { FILTRO_VACIO, type FiltroLeads } from "./filtros-leads";
import { ESTADOS, type EstadoNegocio, type Negocio } from "./negocios";
import { paginaDesdeParam } from "./paginacion";

/** Los valores que existen en la base para los selects de ciudad y categoría. */
export type OpcionesLeads = { ciudades: string[]; categorias: string[] };

/** Lo que responde GET /admin/api/leads. */
export type RespuestaLeads = {
  /** La página respondida, de la más reciente a la más antigua. */
  filas: Negocio[];
  /** Cuántos negocios de la base cumplen TODOS los filtros. */
  total: number;
  /** La página que de verdad se respondió (la última, si se pidió una más allá). */
  pagina: number;
  /** Cuántos hay en cada estado con todos los filtros MENOS el de estado. */
  conteos: Record<EstadoNegocio, number>;
  /** Solo cuando se pidió con `opciones=1` y la lectura no falló. */
  opciones?: OpcionesLeads;
};

const LARGO_MAX_TEXTO = 80;
const ESTADOS_VALIDOS = new Set<string>(ESTADOS.map((e) => e.valor));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El filtro y la página desde el querystring. Todo lo que llega del navegador
 * se sanea: lo que no es un valor válido cae al valor por defecto, nunca a un
 * error de la base.
 */
export function filtroDesdeParams(params: URLSearchParams): { filtro: FiltroLeads; pagina: number } {
  const estado = params.get("estado");
  const telefono = params.get("telefono");
  const web = params.get("web");
  const territorio = params.get("territorio");
  return {
    filtro: {
      q: (params.get("q") ?? "").trim().slice(0, LARGO_MAX_TEXTO).trim(),
      ciudad: params.get("ciudad") || FILTRO_VACIO.ciudad,
      estados: estado !== null && ESTADOS_VALIDOS.has(estado) ? [estado as EstadoNegocio] : [],
      categoria: params.get("categoria") || FILTRO_VACIO.categoria,
      telefono: telefono === "con" || telefono === "sin" ? telefono : "todos",
      web: web === "con" || web === "sin" ? web : "todos",
      territorio: territorio !== null && UUID.test(territorio) ? territorio : FILTRO_VACIO.territorio,
    },
    pagina: paginaDesdeParam(params.get("pagina") ?? undefined),
  };
}

/**
 * El querystring de un filtro: solo las claves que se apartan del valor por
 * defecto, en un orden fijo (la lista usa el texto como clave de su consulta).
 * La lista filtra por UN estado: de `estados` viaja el primero.
 */
export function paramsDeFiltro(filtro: FiltroLeads, pagina: number): URLSearchParams {
  const params = new URLSearchParams();
  const q = filtro.q.trim();
  const estado = filtro.estados[0];
  if (q) params.set("q", q);
  if (estado) params.set("estado", estado);
  if (filtro.ciudad !== FILTRO_VACIO.ciudad) params.set("ciudad", filtro.ciudad);
  if (filtro.categoria !== FILTRO_VACIO.categoria) params.set("categoria", filtro.categoria);
  if (filtro.telefono !== "todos") params.set("telefono", filtro.telefono);
  if (filtro.web !== "todos") params.set("web", filtro.web);
  if (filtro.territorio !== FILTRO_VACIO.territorio) params.set("territorio", filtro.territorio);
  if (pagina > 1) params.set("pagina", String(pagina));
  return params;
}
```

- [ ] **Step 4: Ver los tests pasar**

Run: `npx vitest run src/lib/admin/__tests__/leads-consulta.test.ts; echo "exit=$?"`
Expected: PASS — 12 tests, `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/leads-consulta.ts src/lib/admin/paginacion.ts src/lib/admin/__tests__/leads-consulta.test.ts
git commit -m "leads: filtro ↔ querystring de la lista paginada, saneado y de ida y vuelta" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Filtros en la consulta, total, opciones y tramo en pantalla (TDD)

**Files:**
- Modify: `src/lib/admin/leads-consulta.ts`
- Modify: `src/lib/admin/paginacion.ts` (añadir `totalDePaginas` y `acotarPagina` al final)
- Modify: `src/lib/admin/negocios.ts:88` (`ciudadesDe` acepta filas parciales)
- Modify: `src/lib/admin/filtros-leads.ts:63` (`categoriasDe` acepta filas parciales)
- Test: `src/lib/admin/__tests__/leads-consulta.test.ts`, `src/lib/admin/__tests__/paginacion.test.ts`

**Interfaces:**
- Consumes: todo lo de la Task 1; `patronBusqueda(q: string): string` (`src/lib/admin/zak.ts`);
  `ciudadesDe`, `conteoPorEstado` (`negocios.ts`); `categoriasDe` (`filtros-leads.ts`).
- Produces:
  - `consultaNegocios(supabase: SupabaseClient, soloConteo: boolean)` y
    `type ConsultaNegocios = ReturnType<typeof consultaNegocios>`
  - `aplicarFiltros(query: ConsultaNegocios, filtro: FiltroLeads, opciones?: { sinEstado?: boolean }): ConsultaNegocios`
  - `totalDeConteos(conteos: Record<EstadoNegocio, number>, estados: readonly EstadoNegocio[]): number`
  - `opcionesDe(filas: readonly Pick<Negocio, "ciudad" | "categoria">[]): OpcionesLeads`
  - `rangoEnPantalla(pagina: number, filas: number, porPagina: number): { desde: number; hasta: number } | null`
  - En `paginacion.ts`: `totalDePaginas(total: number, porPagina: number): number` (≥ 1) y
    `acotarPagina(pagina: number, total: number, porPagina: number): number`
  - `ciudadesDe(negocios: readonly Pick<Negocio, "ciudad">[]): string[]` y
    `categoriasDe(negocios: readonly Pick<Negocio, "categoria">[]): string[]` (firmas ensanchadas; los
    llamadores de hoy siguen compilando).

- [ ] **Step 1: Escribir los tests (fallan: las funciones no existen)**

En `src/lib/admin/__tests__/leads-consulta.test.ts`, reemplazar la línea
`import { filtroDesdeParams, paramsDeFiltro } from "../leads-consulta";` por:

```ts
import {
  aplicarFiltros,
  filtroDesdeParams,
  opcionesDe,
  paramsDeFiltro,
  rangoEnPantalla,
  totalDeConteos,
} from "../leads-consulta";
import { conteoPorEstado } from "../negocios";
```

Y añadir al final del archivo:

```ts
/** Consulta falsa: registra cada condición que se le aplica, en orden, y se
 * devuelve a sí misma como el query builder de Supabase. */
function consultaFalsa() {
  const llamadas: unknown[][] = [];
  const consulta = {
    eq(columna: string, valor: unknown) {
      llamadas.push(["eq", columna, valor]);
      return consulta;
    },
    in(columna: string, valores: unknown) {
      llamadas.push(["in", columna, valores]);
      return consulta;
    },
    is(columna: string, valor: unknown) {
      llamadas.push(["is", columna, valor]);
      return consulta;
    },
    not(columna: string, operador: string, valor: unknown) {
      llamadas.push(["not", columna, operador, valor]);
      return consulta;
    },
    ilike(columna: string, patron: string) {
      llamadas.push(["ilike", columna, patron]);
      return consulta;
    },
  };
  return { consulta: consulta as never, llamadas };
}

describe("aplicarFiltros", () => {
  it("el filtro vacío no toca la consulta", () => {
    const { consulta, llamadas } = consultaFalsa();
    expect(aplicarFiltros(consulta, FILTRO_VACIO)).toBe(consulta);
    expect(llamadas).toEqual([]);
  });

  it("traduce cada filtro a su condición en la base, en orden", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, COMPLETO);
    expect(llamadas).toEqual([
      ["eq", "ciudad", "Bogotá"],
      ["eq", "categoria", "ferreteria"],
      ["eq", "territorio_id", TERRITORIO],
      ["in", "estado", ["respondido"]],
      ["not", "telefono", "is", null],
      ["is", "sitio_web", null],
      ["ilike", "nombre", "%el tornillo%"],
    ]);
  });

  it("sinEstado deja fuera solo el filtro de estado (los conteos de la franja)", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, COMPLETO, { sinEstado: true });
    expect(llamadas.map((l) => l[1])).toEqual([
      "ciudad",
      "categoria",
      "territorio_id",
      "telefono",
      "sitio_web",
      "nombre",
    ]);
  });

  it("sin teléfono y con web son las condiciones contrarias", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, { ...FILTRO_VACIO, telefono: "sin", web: "con" });
    expect(llamadas).toEqual([
      ["is", "telefono", null],
      ["not", "sitio_web", "is", null],
    ]);
  });

  it("escapa los comodines del texto: «50%» busca el porcentaje literal", () => {
    const { consulta, llamadas } = consultaFalsa();
    aplicarFiltros(consulta, { ...FILTRO_VACIO, q: "50%" });
    expect(llamadas).toEqual([["ilike", "nombre", "%50\\%%"]]);
  });
});

describe("totalDeConteos", () => {
  const conteos = { ...conteoPorEstado([]), nuevo: 30, contactado: 12, respondido: 5, descartado: 3 };

  it("sin estado elegido, el total es la suma de los seis", () => {
    expect(totalDeConteos(conteos, [])).toBe(50);
  });

  it("con un estado elegido, el total es el de ese estado", () => {
    expect(totalDeConteos(conteos, ["contactado"])).toBe(12);
  });
});

describe("opcionesDe", () => {
  it("ciudades y categorías sin repetir, sin vacíos y en orden alfabético", () => {
    expect(
      opcionesDe([
        { ciudad: "Chía", categoria: "ferreteria" },
        { ciudad: "Bogotá", categoria: null },
        { ciudad: "Chía", categoria: "belleza" },
        { ciudad: null, categoria: "ferreteria" },
      ]),
    ).toEqual({ ciudades: ["Bogotá", "Chía"], categorias: ["belleza", "ferreteria"] });
  });
});

describe("rangoEnPantalla", () => {
  it("la primera página llena va del 1 al 50", () => {
    expect(rangoEnPantalla(1, 50, 50)).toEqual({ desde: 1, hasta: 50 });
  });

  it("la última página corta termina en la última fila", () => {
    expect(rangoEnPantalla(3, 12, 50)).toEqual({ desde: 101, hasta: 112 });
  });

  it("sin filas no hay tramo", () => {
    expect(rangoEnPantalla(1, 0, 50)).toBeNull();
  });
});
```

En `src/lib/admin/__tests__/paginacion.test.ts`, reemplazar la línea de import por
`import { acotarPagina, paginaDesdeParam, rangoDePagina, totalDePaginas } from "../paginacion";` y
añadir al final:

```ts
describe("totalDePaginas", () => {
  it("una lista vacía es una página (vacía), no cero páginas", () => {
    expect(totalDePaginas(0, 50)).toBe(1);
  });

  it("una página llena justa no abre otra", () => {
    expect(totalDePaginas(50, 50)).toBe(1);
  });

  it("una fila de más abre la siguiente", () => {
    expect(totalDePaginas(51, 50)).toBe(2);
  });
});

describe("acotarPagina", () => {
  it("una página que existe se respeta", () => {
    expect(acotarPagina(2, 120, 50)).toBe(2);
  });

  it("una página más allá de la última cae a la última", () => {
    expect(acotarPagina(9, 120, 50)).toBe(3);
  });

  it("sin filas, cualquier página cae a la 1", () => {
    expect(acotarPagina(4, 0, 50)).toBe(1);
  });
});
```

- [ ] **Step 2: Ver los tests fallar**

Run: `npx vitest run src/lib/admin/__tests__/leads-consulta.test.ts src/lib/admin/__tests__/paginacion.test.ts; echo "exit=$?"`
Expected: FAIL — `TypeError: … aplicarFiltros is not a function` (y lo mismo con las demás funciones nuevas), `exit=1`.
Los 12 tests de la Task 1 y los 10 de paginación que ya existían siguen en verde.

- [ ] **Step 3: Implementar**

En `src/lib/admin/negocios.ts`, cambiar la firma de `ciudadesDe` (cuerpo igual):

```ts
export function ciudadesDe(negocios: readonly Pick<Negocio, "ciudad">[]): string[] {
```

En `src/lib/admin/filtros-leads.ts`, cambiar la firma de `categoriasDe` (cuerpo igual):

```ts
export function categoriasDe(negocios: readonly Pick<Negocio, "categoria">[]): string[] {
```

Al final de `src/lib/admin/paginacion.ts`:

```ts
/** Cuántas páginas hacen falta para `total` filas. Al menos una: una lista
 * vacía es una página vacía, no cero páginas. */
export function totalDePaginas(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/** La página pedida, o la última que existe si se pidió una más allá (un
 * enlace viejo, filas que se borraron): nunca una página vacía que miente. */
export function acotarPagina(pagina: number, total: number, porPagina: number): number {
  return Math.min(pagina, totalDePaginas(total, porPagina));
}
```

En `src/lib/admin/leads-consulta.ts`, reemplazar el bloque de imports por:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoriasDe, FILTRO_VACIO, type FiltroLeads } from "./filtros-leads";
import { ciudadesDe, ESTADOS, type EstadoNegocio, type Negocio } from "./negocios";
import { paginaDesdeParam } from "./paginacion";
import { patronBusqueda } from "./zak";
```

Y añadir al final del archivo:

```ts
/**
 * La consulta de negocios sobre la que se aplican los filtros: con filas, o
 * solo el conteo (`head: true` no trae filas y no le afecta el tope de 1.000).
 *
 * Existe para darle NOMBRE al tipo del query builder: una interfaz genérica
 * sobre el builder de supabase-js no compila (TS2589, instanciación demasiado
 * profunda); con este tipo concreto sí.
 */
export function consultaNegocios(supabase: SupabaseClient, soloConteo: boolean) {
  return soloConteo
    ? supabase.from("negocios").select("*", { count: "exact", head: true })
    : supabase.from("negocios").select("*");
}

export type ConsultaNegocios = ReturnType<typeof consultaNegocios>;

/**
 * Los mismos recortes que `filtrarLeads` hace en memoria, hechos por la base.
 * `sinEstado` deja fuera el de estado: la franja cuenta cada estado con todos
 * los demás filtros aplicados.
 */
export function aplicarFiltros(
  query: ConsultaNegocios,
  filtro: FiltroLeads,
  { sinEstado = false }: { sinEstado?: boolean } = {},
): ConsultaNegocios {
  let q = query;
  if (filtro.ciudad !== FILTRO_VACIO.ciudad) q = q.eq("ciudad", filtro.ciudad);
  if (filtro.categoria !== FILTRO_VACIO.categoria) q = q.eq("categoria", filtro.categoria);
  if (filtro.territorio !== FILTRO_VACIO.territorio) q = q.eq("territorio_id", filtro.territorio);
  if (!sinEstado && filtro.estados.length > 0) q = q.in("estado", [...filtro.estados]);
  if (filtro.telefono === "con") q = q.not("telefono", "is", null);
  if (filtro.telefono === "sin") q = q.is("telefono", null);
  // «Sin web» es `sitio_web is null`: los dos escritores de la columna la
  // normalizan con `urlHttpONull` (URL válida o null), así que coincide con
  // `esSinWeb` y con la RPC `cuentas_por_territorio`.
  if (filtro.web === "sin") q = q.is("sitio_web", null);
  if (filtro.web === "con") q = q.not("sitio_web", "is", null);
  const texto = filtro.q.trim();
  if (texto) q = q.ilike("nombre", patronBusqueda(texto));
  return q;
}

/** El total filtrado sale de sumar los conteos por estado: los del estado
 * elegido o, sin estado, los seis. Así la ruta no gasta un conteo más. */
export function totalDeConteos(
  conteos: Record<EstadoNegocio, number>,
  estados: readonly EstadoNegocio[],
): number {
  const cuales: readonly EstadoNegocio[] = estados.length > 0 ? estados : ESTADOS.map((e) => e.valor);
  return cuales.reduce((suma, e) => suma + conteos[e], 0);
}

/** Las opciones de los selects desde las filas leídas (solo ciudad y categoría). */
export function opcionesDe(filas: readonly Pick<Negocio, "ciudad" | "categoria">[]): OpcionesLeads {
  return { ciudades: ciudadesDe(filas), categorias: categoriasDe(filas) };
}

/** Qué tramo del total está en pantalla («del 51 al 100»); null sin filas. */
export function rangoEnPantalla(
  pagina: number,
  filas: number,
  porPagina: number,
): { desde: number; hasta: number } | null {
  if (filas === 0) return null;
  const desde = (pagina - 1) * porPagina + 1;
  return { desde, hasta: desde + filas - 1 };
}
```

- [ ] **Step 4: Ver los tests pasar y el tipado en verde**

Run: `npx vitest run src/lib/admin/__tests__/leads-consulta.test.ts src/lib/admin/__tests__/paginacion.test.ts; echo "exit=$?"`
Expected: PASS — 23 tests en `leads-consulta.test.ts` y 16 en `paginacion.test.ts`, `exit=0`.

Run: `npx tsc --noEmit -p .; echo "exit=$?"`
Expected: sin salida, `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/leads-consulta.ts src/lib/admin/paginacion.ts src/lib/admin/negocios.ts src/lib/admin/filtros-leads.ts src/lib/admin/__tests__/leads-consulta.test.ts src/lib/admin/__tests__/paginacion.test.ts
git commit -m "leads: los filtros de la lista como condiciones de la consulta, el total desde los conteos y la página acotada" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: La ruta `GET /admin/api/leads`

**Files:**
- Create: `src/app/admin/api/leads/route.ts`

**Interfaces:**
- Consumes: `getSesionAdmin(): Promise<Sesion | null>` (`src/lib/admin/dal.ts`, `sesion.supabase`);
  `filtroDesdeParams`, `consultaNegocios`, `aplicarFiltros`, `totalDeConteos`, `opcionesDe`,
  `OpcionesLeads`, `RespuestaLeads` (Tasks 1-2); `ESTADOS`, `EstadoNegocio`, `Negocio`;
  `LEADS_POR_PAGINA`, `acotarPagina`, `rangoDePagina`.
- Produces: `GET /admin/api/leads?pagina=&q=&estado=&ciudad=&categoria=&telefono=&web=&territorio=&opciones=1`
  → 200 `RespuestaLeads` · 401 `{ error: "no_autorizado" }` · 502 `{ error: "crm" }`.

- [ ] **Step 1: Escribir la ruta**

Crear `src/app/admin/api/leads/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSesionAdmin } from "@/lib/admin/dal";
import {
  aplicarFiltros,
  consultaNegocios,
  filtroDesdeParams,
  opcionesDe,
  totalDeConteos,
  type OpcionesLeads,
  type RespuestaLeads,
} from "@/lib/admin/leads-consulta";
import { ESTADOS, type EstadoNegocio, type Negocio } from "@/lib/admin/negocios";
import { acotarPagina, LEADS_POR_PAGINA, rangoDePagina } from "@/lib/admin/paginacion";

/** El techo de filas por consulta de PostgREST (*Max rows* del proyecto). */
const FILAS_POR_LECTURA = 1000;
/** Lecturas máximas para las opciones: 50.000 negocios. Pasado eso toca una
 * RPC con `distinct` (ver «Límites» en el spec). */
const MAX_LECTURAS_OPCIONES = 50;

/**
 * Una página de la lista de Leads con sus cifras, contra la base entera.
 *
 * - `conteos`: seis conteos `head` en paralelo, con todos los filtros menos el
 *   de estado (la franja de estados). Sumados dan `total`.
 * - `filas`: la página pedida o, si se pidió una más allá, la última que existe.
 * - `opciones` (solo con `opciones=1`): ciudades y categorías del territorio
 *   filtrado. Si esa lectura falla, la respuesta sale sin ellas.
 *
 * Lectura = route handler: una server action se encolaría detrás de las
 * mutaciones en cada cambio de filtro.
 */
export async function GET(request: Request) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const { filtro, pagina } = filtroDesdeParams(params);
  const { supabase } = sesion;

  const cuentas = await Promise.all(
    ESTADOS.map((e) =>
      aplicarFiltros(consultaNegocios(supabase, true), filtro, { sinEstado: true }).eq("estado", e.valor),
    ),
  );
  const fallida = cuentas.find((c) => c.error);
  if (fallida?.error) {
    console.error("[api/leads] conteos:", fallida.error.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  const conteos = Object.fromEntries(
    ESTADOS.map((e, i) => [e.valor, cuentas[i]?.count ?? 0]),
  ) as Record<EstadoNegocio, number>;
  const total = totalDeConteos(conteos, filtro.estados);
  const paginaReal = acotarPagina(pagina, total, LEADS_POR_PAGINA);
  const [desde, hasta] = rangoDePagina(paginaReal, LEADS_POR_PAGINA);

  const [filas, opciones] = await Promise.all([
    // Desempate por id: un barrido inserta muchas filas con la misma fecha, y
    // sin él las páginas repetirían o saltarían filas.
    aplicarFiltros(consultaNegocios(supabase, false), filtro)
      .order("created_at", { ascending: false })
      .order("id")
      .range(desde, hasta),
    params.get("opciones") === "1" ? leerOpciones(supabase, filtro.territorio) : Promise.resolve(null),
  ]);
  if (filas.error) {
    console.error("[api/leads] filas:", filas.error.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }

  const cuerpo: RespuestaLeads = {
    filas: (filas.data ?? []) as Negocio[],
    total,
    pagina: paginaReal,
    conteos,
    ...(opciones ? { opciones } : {}),
  };
  return NextResponse.json(cuerpo);
}

/** Ciudades y categorías distintas del territorio (o de toda la base), leídas
 * de a 1000 filas. `null` si la base falló: la lista las vuelve a pedir. */
async function leerOpciones(supabase: SupabaseClient, territorio: string): Promise<OpcionesLeads | null> {
  const filas: Pick<Negocio, "ciudad" | "categoria">[] = [];
  for (let lectura = 0; lectura < MAX_LECTURAS_OPCIONES; lectura++) {
    const [desde, hasta] = rangoDePagina(lectura + 1, FILAS_POR_LECTURA);
    // Un builder nuevo por vuelta: el de supabase-js acumula sus parámetros.
    const base = supabase.from("negocios").select("ciudad, categoria");
    const consulta = territorio === "todos" ? base : base.eq("territorio_id", territorio);
    const { data, error } = await consulta.order("id").range(desde, hasta);
    if (error) {
      console.error("[api/leads] opciones:", error.message);
      return null;
    }
    const lote = (data ?? []) as Pick<Negocio, "ciudad" | "categoria">[];
    filas.push(...lote);
    if (lote.length < FILAS_POR_LECTURA) break;
  }
  return opcionesDe(filas);
}
```

- [ ] **Step 2: Verificar tipado y lint**

Run: `npx tsc --noEmit -p .; echo "exit=$?"`
Expected: sin salida, `exit=0`.

Run: `npx eslint src/app/admin/api/leads/route.ts; echo "exit=$?"`
Expected: sin salida, `exit=0`.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/api/leads/route.ts
git commit -m "leads: GET /admin/api/leads — una página de 50 con el total, los conteos por estado y las opciones de la base" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: La ficha de un lead que no está en la lista cargada (TDD + hook)

**Files:**
- Modify: `src/lib/admin/ficha-fetch.ts` (añadir `fichaConLista`)
- Test: `src/lib/admin/__tests__/ficha-fetch.test.ts`
- Create: `src/components/admin/leads/useFichaNegocio.ts`

**Interfaces:**
- Consumes: `FichaFetch`, `EstadoFicha`, `estadoFicha(leadId, ultimo)` (`src/lib/admin/ficha-fetch.ts`);
  `GET /admin/api/negocios/[id]` → `{ negocio: Negocio | null }` (400 con id malformado).
- Produces:
  - `fichaConLista(leadId: string | null, enLista: Negocio | null, ultimo: FichaFetch | null): EstadoFicha`
  - `useFichaNegocio(leadId: string | null, cargados: readonly Negocio[]): EstadoFicha & { recargar: () => void }`
    (lo usan ProspeccionView y TerritorioDetalleView en la Task 6).

- [ ] **Step 1: Escribir los tests (fallan: la función no existe)**

En `src/lib/admin/__tests__/ficha-fetch.test.ts`, cambiar el import a
`import { estadoFicha, fichaConLista, type FichaFetch } from "../ficha-fetch";` y añadir al final:

```ts
describe("fichaConLista", () => {
  it("el lead está en la lista cargada: esa fila manda, sin esperar ningún fetch", () => {
    expect(fichaConLista("n1", negocio, null)).toEqual({ ...REPOSO, negocio });
  });

  it("la lista manda aunque haya un fetch viejo del mismo id", () => {
    const viejo = { ...negocio, nombre: "Nombre viejo" };
    expect(fichaConLista("n1", negocio, { leadId: "n1", negocio: viejo, fallo: false })).toEqual({
      ...REPOSO,
      negocio,
    });
  });

  it("no está en la lista: cargando mientras llega el fetch por id", () => {
    expect(fichaConLista("n1", null, null)).toEqual({ ...REPOSO, cargando: true });
  });

  it("una fila de la lista con OTRO id no se muestra nunca", () => {
    expect(fichaConLista("n1", { ...negocio, id: "n2" }, null)).toEqual({ ...REPOSO, cargando: true });
  });

  it("modal cerrado: reposo", () => {
    expect(fichaConLista(null, negocio, null)).toEqual(REPOSO);
  });
});
```

- [ ] **Step 2: Ver los tests fallar**

Run: `npx vitest run src/lib/admin/__tests__/ficha-fetch.test.ts; echo "exit=$?"`
Expected: FAIL — `TypeError: … fichaConLista is not a function`, `exit=1`. Los 6 de `estadoFicha` siguen en verde.

- [ ] **Step 3: Implementar la función**

Al final de `src/lib/admin/ficha-fetch.ts`:

```ts
/**
 * La ficha cuando el dueño ya tiene una lista cargada (los negocios del mapa o
 * los de un territorio): si el lead está ahí, esa fila manda —viva tras cada
 * `router.refresh()`—; si no (un lead más antiguo que el tope de esa lista),
 * lo que diga el fetch por id.
 */
export function fichaConLista(
  leadId: string | null,
  enLista: Negocio | null,
  ultimo: FichaFetch | null,
): EstadoFicha {
  if (leadId !== null && enLista?.id === leadId) {
    return { negocio: enLista, cargando: false, fallo: false, noExiste: false };
  }
  return estadoFicha(leadId, ultimo);
}
```

- [ ] **Step 4: Ver los tests pasar**

Run: `npx vitest run src/lib/admin/__tests__/ficha-fetch.test.ts; echo "exit=$?"`
Expected: PASS — 11 tests, `exit=0`.

- [ ] **Step 5: Escribir el hook**

Crear `src/components/admin/leads/useFichaNegocio.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { fichaConLista, type EstadoFicha, type FichaFetch } from "@/lib/admin/ficha-fetch";
import type { Negocio } from "@/lib/admin/negocios";

/**
 * El negocio de la ficha abierta (`?lead=`) para un dueño que ya tiene una
 * lista cargada. Si el lead está en `cargados`, sale de ahí; si no —la lista de
 * Leads pagina la base entera y el lead puede ser de cualquier página—, se trae
 * por GET /admin/api/negocios/[id].
 *
 * Mismo patrón que el chat de Zak: un solo estado, escrito desde la
 * continuación async, y cargando / fallo / ya no existe derivados
 * (`fichaConLista`). `recargar` vuelve a pedir la fila traída por id después
 * de editarla en la ficha.
 */
export function useFichaNegocio(
  leadId: string | null,
  cargados: readonly Negocio[],
): EstadoFicha & { recargar: () => void } {
  const enLista = leadId === null ? null : (cargados.find((n) => n.id === leadId) ?? null);
  const falta = leadId !== null && enLista === null;
  const [ultimo, setUltimo] = useState<FichaFetch | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!falta || leadId === null) return;
    let cancelado = false;
    void (async () => {
      let negocio: Negocio | null = null;
      let fallo = false;
      try {
        const res = await fetch(`/admin/api/negocios/${leadId}`);
        // Un id malformado (400: un ?lead= cortado o editado a mano) no puede
        // existir: es «ya no existe», no un fallo que se arregle reintentando.
        if (res.status !== 400) {
          if (!res.ok) throw new Error(String(res.status));
          negocio = ((await res.json()) as { negocio: Negocio | null }).negocio;
        }
      } catch {
        fallo = true;
      }
      if (!cancelado) setUltimo({ leadId, negocio, fallo });
    })();
    return () => {
      cancelado = true;
    };
  }, [falta, leadId, version]);

  return {
    ...fichaConLista(leadId, enLista, ultimo),
    recargar: () => setVersion((v) => v + 1),
  };
}
```

- [ ] **Step 6: Verificar tipado y lint**

Run: `npx tsc --noEmit -p .; echo "exit=$?"`
Expected: `exit=0`.

Run: `npx eslint src/components/admin/leads/useFichaNegocio.ts src/lib/admin/ficha-fetch.ts; echo "exit=$?"`
Expected: `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/admin/ficha-fetch.ts src/lib/admin/__tests__/ficha-fetch.test.ts src/components/admin/leads/useFichaNegocio.ts
git commit -m "leads: la ficha de un lead sale de la lista cargada o, si no está, por id" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `Paginador` con botones

**Files:**
- Modify: `src/components/admin/ui/Paginador.tsx` (reescritura; `TerritoriosView` sigue pasando `hrefDePagina`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `<Paginador pagina totalPaginas hrefDePagina />` (como hoy) **o**
  `<Paginador pagina totalPaginas onPagina={(pagina: number) => void} />`. Uno de los dos, nunca ambos.

- [ ] **Step 1: Reescribir el componente**

Reemplazar el contenido de `src/components/admin/ui/Paginador.tsx` por:

```tsx
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  pagina: number;
  totalPaginas: number;
} & (
  | {
      /** Links reales: la pantalla vuelve al servidor por cada página (Territorios). */
      hrefDePagina: (pagina: number) => string;
      onPagina?: never;
    }
  | {
      /** Botones: quien pagina pide la página por su cuenta, sin re-renderizar
       * la page (la lista de Leads, que vive junto al mapa). */
      onPagina: (pagina: number) => void;
      hrefDePagina?: never;
    }
);

const ESTILO_BASE =
  "inline-flex h-control items-center justify-center rounded-full px-4 text-sm font-medium transition-colors";
const ESTILO_ACTIVO = "bg-isla-alta text-tinta-85 hover:bg-acento-10 hover:text-tinta";

/**
 * Paginador simple: Anterior / Página X de Y / Siguiente. Con `hrefDePagina`
 * son links de verdad; con `onPagina`, botones. No se pinta con una sola
 * página.
 */
export function Paginador({ pagina, totalPaginas, hrefDePagina, onPagina }: Props) {
  if (totalPaginas <= 1) return null;

  function paso(destino: number, habilitado: boolean, texto: string) {
    if (!habilitado) {
      return (
        <span className={cn(ESTILO_BASE, "text-tinta-40")} aria-disabled="true">
          {texto}
        </span>
      );
    }
    if (hrefDePagina) {
      return (
        <Link href={hrefDePagina(destino)} className={cn(ESTILO_BASE, ESTILO_ACTIVO)}>
          {texto}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => onPagina?.(destino)} className={cn(ESTILO_BASE, ESTILO_ACTIVO)}>
        {texto}
      </button>
    );
  }

  return (
    <nav className="flex items-center justify-center gap-3 py-2" aria-label="Paginación">
      {paso(pagina - 1, pagina > 1, "Anterior")}
      <span className="text-xs text-tinta-40">
        Página {pagina} de {totalPaginas}
      </span>
      {paso(pagina + 1, pagina < totalPaginas, "Siguiente")}
    </nav>
  );
}
```

- [ ] **Step 2: Verificar tipado y lint**

Run: `npx tsc --noEmit -p .; echo "exit=$?"`
Expected: `exit=0` (Territorios sigue compilando con `hrefDePagina`).

Run: `npx eslint src/components/admin/ui/Paginador.tsx; echo "exit=$?"`
Expected: `exit=0`.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ui/Paginador.tsx
git commit -m "ui: el Paginador también pagina con botones, sin volver al servidor" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: La lista de Leads paginada contra la ruta

**Files:**
- Modify: `src/components/admin/negocios/FiltrosLeads.tsx` (reescritura)
- Modify: `src/components/admin/negocios/TablaLeads.tsx:16-17` y `:49`
- Modify: `src/components/admin/negocios/NegociosView.tsx` (reescritura)
- Modify: `src/components/admin/prospeccion/ProspeccionView.tsx:77-82` y `:253-272`
- Modify: `src/components/admin/territorios/TerritorioDetalleView.tsx:36-37`, `:49-58`, `:190-208`

**Interfaces:**
- Consumes: `paramsDeFiltro`, `rangoEnPantalla`, `OpcionesLeads`, `RespuestaLeads` (Tasks 1-2);
  `LEADS_POR_PAGINA`, `paginaDesdeParam`, `totalDePaginas`; `GET /admin/api/leads` (Task 3);
  `useFichaNegocio` (Task 4); `Paginador` con `onPagina` (Task 5); `useParametroUrl(clave)` →
  `[valor: string | null, poner: (valor: string | null) => void]`; `useTandaZak(onHecho?)` →
  `{ contactar, enviando, aviso, dialogo }`; `hayFiltro`, `FILTRO_VACIO`; `conteoPorEstado`.
- Produces:
  - `NegociosView` props: `{ territorios?: Territorio[]; className?: string; onAbrirLead: (id: string) => void; territorioFijo?: string; recarga?: string }`
    (ya no recibe `negocios`; `territorioFijo` pasa de boolean al id).
  - `FiltrosLeads` props: `{ filtro; onCambiar; opciones: OpcionesLeads; territorios; total: number | null; enPantalla: { desde: number; hasta: number } | null; conteos; ocultarTerritorio? }`
    (ya no recibe `negocios` ni `visibles`).

Sin tests nuevos: son componentes (convención del repo). La lógica que deciden ya está probada en las
Tasks 1, 2 y 4.

- [ ] **Step 1: Reescribir `FiltrosLeads`**

Reemplazar el contenido de `src/components/admin/negocios/FiltrosLeads.tsx` por:

```tsx
"use client";

import { useMemo } from "react";
import type { FiltroLeads, FiltroTelefono, FiltroWeb } from "@/lib/admin/filtros-leads";
import type { OpcionesLeads } from "@/lib/admin/leads-consulta";
import type { EstadoNegocio } from "@/lib/admin/negocios";
import type { Territorio } from "@/lib/admin/territorios";
import { cn } from "@/lib/cn";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { FranjaEstados } from "./FranjaEstados";

type Props = {
  filtro: FiltroLeads;
  onCambiar: (filtro: FiltroLeads) => void;
  /** Las ciudades y categorías que existen en la base (las trae la ruta de la lista). */
  opciones: OpcionesLeads;
  territorios: readonly Territorio[];
  /** Cuántos negocios de la base cumplen los filtros; null hasta la primera respuesta. */
  total: number | null;
  /** El tramo de ese total que está en pantalla; null sin filas. */
  enPantalla: { desde: number; hasta: number } | null;
  /** Cuántos hay en cada estado con los demás filtros aplicados. */
  conteos: Record<EstadoNegocio, number>;
  /** En la página de un territorio el territorio ya está elegido: sin select. */
  ocultarTerritorio?: boolean;
};

/** Si el valor elegido ya no está entre las opciones (cambió el territorio), el
 * select lo sigue mostrando: un filtro activo nunca queda invisible. */
function conElegido(opciones: readonly string[], elegido: string, vacio: string): readonly string[] {
  return elegido === vacio || opciones.includes(elegido) ? opciones : [elegido, ...opciones];
}

/** La isla de búsqueda de la lista de leads: texto, estados y selects. */
export function FiltrosLeads({
  filtro,
  onCambiar,
  opciones,
  territorios,
  total,
  enPantalla,
  conteos,
  ocultarTerritorio = false,
}: Props) {
  const ciudades = conElegido(opciones.ciudades, filtro.ciudad, "todas");
  const categorias = conElegido(opciones.categorias, filtro.categoria, "todas");
  const territoriosOrdenados = useMemo(
    () => [...territorios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [territorios],
  );

  function poner<K extends keyof FiltroLeads>(clave: K, valor: FiltroLeads[K]) {
    onCambiar({ ...filtro, [clave]: valor });
  }

  return (
    <Island role="search" className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Input
            type="search"
            className="h-12 min-w-64 flex-1 px-5 text-base"
            value={filtro.q}
            onChange={(e) => poner("q", e.target.value)}
            placeholder="Buscar negocio por nombre — El Tornillo…"
            aria-label="Buscar por nombre"
          />
          <p className="whitespace-nowrap">
            <span className="font-editorial text-3xl italic text-tinta">{total ?? "—"}</span>
            <span className="text-sm text-tinta-40">
              {" "}
              {total === 1 ? "negocio" : "negocios"}
              {total !== null && enPantalla && enPantalla.hasta - enPantalla.desde + 1 < total && (
                <>
                  {" "}
                  · del {enPantalla.desde} al {enPantalla.hasta}
                </>
              )}
            </span>
          </p>
        </div>
        <FranjaEstados
          conteos={conteos}
          activo={filtro.estados[0] ?? null}
          onElegir={(estado) => poner("estados", estado ? [estado] : [])}
        />
        <div
          className={cn(
            "grid grid-cols-2 gap-3",
            ocultarTerritorio ? "min-[900px]:grid-cols-4" : "min-[900px]:grid-cols-5",
          )}
        >
          <Field label="Ciudad">
            <Select value={filtro.ciudad} onChange={(e) => poner("ciudad", e.target.value)}>
              <option value="todas">Todas</option>
              {ciudades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select value={filtro.categoria} onChange={(e) => poner("categoria", e.target.value)}>
              <option value="todas">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Teléfono">
            <Select
              value={filtro.telefono}
              onChange={(e) => poner("telefono", e.target.value as FiltroTelefono)}
            >
              <option value="todos">Todos</option>
              <option value="con">Con teléfono</option>
              <option value="sin">Sin teléfono</option>
            </Select>
          </Field>
          <Field label="Sitio web">
            <Select value={filtro.web} onChange={(e) => poner("web", e.target.value as FiltroWeb)}>
              <option value="todos">Todos</option>
              <option value="sin">Sin web</option>
              <option value="con">Con web</option>
            </Select>
          </Field>
          {!ocultarTerritorio && (
            // En celular son cinco campos en dos columnas: el último ocupa la
            // fila entera en vez de quedar solo a medias.
            <div className="col-span-2 min-[900px]:col-span-1">
              <Field label="Territorio">
                <Select value={filtro.territorio} onChange={(e) => poner("territorio", e.target.value)}>
                  <option value="todos">Todos</option>
                  {territoriosOrdenados.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </div>
      </div>
    </Island>
  );
}
```

- [ ] **Step 2: Ajustar `TablaLeads` a «la página»**

En `src/components/admin/negocios/TablaLeads.tsx`, reemplazar:

```tsx
  /** Ya filtrados. */
  negocios: Negocio[];
```

por:

```tsx
  /** La página visible de la lista (hasta 50, ya filtrados por la base). */
  negocios: Negocio[];
```

y reemplazar `aria-label="Seleccionar todos los filtrados"` por `aria-label="Seleccionar esta página"`.

- [ ] **Step 3: Reescribir `NegociosView`**

Reemplazar el contenido de `src/components/admin/negocios/NegociosView.tsx` por:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarNegocio, cambiarEstadoLote, eliminarNegocios } from "@/lib/admin/actions";
import { FILTRO_VACIO, hayFiltro, type FiltroLeads } from "@/lib/admin/filtros-leads";
import {
  paramsDeFiltro,
  rangoEnPantalla,
  type OpcionesLeads,
  type RespuestaLeads,
} from "@/lib/admin/leads-consulta";
import { conteoPorEstado, labelEstado, type EstadoNegocio } from "@/lib/admin/negocios";
import { LEADS_POR_PAGINA, paginaDesdeParam, totalDePaginas } from "@/lib/admin/paginacion";
import type { Territorio } from "@/lib/admin/territorios";
import { contactables } from "@/lib/admin/zak";
import { cn } from "@/lib/cn";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Paginador } from "@/components/admin/ui/Paginador";
import { useParametroUrl } from "@/components/admin/ui/useParametroUrl";
import { AccionesLote } from "./AccionesLote";
import { FiltrosLeads } from "./FiltrosLeads";
import { TablaLeads } from "./TablaLeads";
import { useTandaZak } from "./useTandaZak";

type Props = {
  territorios?: Territorio[];
  /** Viaja al <Cockpit>: la cara Leads de /admin/prospeccion y la página de un
   * territorio montan esta vista DENTRO de otro cockpit, y dos cockpits
   * anidados con la altura fija de viewport se desbordan (vuelve el scroll de
   * página). Ahí se le pasa
   * `min-[900px]:h-auto min-[900px]:min-h-0 min-[900px]:flex-1`. */
  className?: string;
  /** Abrir la ficha de un lead (el modal lo monta el dueño de la página). */
  onAbrirLead: (id: string) => void;
  /** La lista vive en la página de UN territorio: su id. Sin select de territorio. */
  territorioFijo?: string;
  /** Cuando cambia, la página actual se vuelve a pedir: el dueño cambió algo por
   * fuera de la lista (la ficha de un lead, un envío, la cuenta de la base). */
  recarga?: string;
};

const OPCIONES_VACIAS: OpcionesLeads = { ciudades: [], categorias: [] };
const CONTEOS_VACIOS = conteoPorEstado([]);
/** Espera tras el último tecleo antes de pedir: una consulta por palabra, no por letra. */
const ESPERA_TECLEO_MS = 300;

/** La última respuesta que llegó y la consulta que la pidió. */
type Resultado = { clave: string; respuesta: RespuestaLeads };

/** La lista de leads, paginada de a 50 contra la base entera: filtros arriba
 * fijos, la página debajo, acciones en lote sobre lo seleccionado. */
export function NegociosView({
  territorios = [],
  className,
  onAbrirLead,
  territorioFijo,
  recarga = "",
}: Props) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();
  const [filtro, setFiltro] = useState<FiltroLeads>(FILTRO_VACIO);
  // El texto que ya viaja a la base: `filtro.q` 300 ms después del último tecleo.
  const [qAplicada, setQAplicada] = useState("");
  const [paginaParam, ponerPagina] = useParametroUrl("pagina");
  const pagina = paginaDesdeParam(paginaParam ?? undefined);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [fallida, setFallida] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<OpcionesLeads | null>(null);
  // De qué territorio son las opciones que ya llegaron. Ref y no estado: pedir
  // o no las opciones no debe cambiar la clave de la consulta (sería otro fetch).
  const opcionesDe = useRef<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<ReadonlySet<string>>(new Set());
  const [estadoLote, setEstadoLote] = useState<EstadoNegocio>("contactado");
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar();

  function recargar() {
    setIntento((i) => i + 1);
  }

  const tanda = useTandaZak(() => {
    setSeleccionados(new Set());
    recargar();
  });
  const ocupado = guardando || tanda.enviando;

  const consulta = paramsDeFiltro(
    { ...filtro, q: qAplicada, territorio: territorioFijo ?? filtro.territorio },
    pagina,
  ).toString();
  const clave = `${consulta}#${recarga}#${intento}`;

  // El buscador: aplica el texto cuando se deja de teclear, y entonces vuelve a
  // la página 1 y suelta la selección (los setState van dentro del timeout).
  useEffect(() => {
    const q = filtro.q.trim();
    if (q === qAplicada) return;
    const espera = setTimeout(() => {
      setQAplicada(q);
      ponerPagina(null);
      setSeleccionados(new Set());
    }, ESPERA_TECLEO_MS);
    return () => clearTimeout(espera);
  }, [filtro.q, qAplicada, ponerPagina]);

  // La página: una consulta por clave. La respuesta vieja que llega tarde se
  // descarta (`activo`) y el fetch en vuelo se cancela.
  useEffect(() => {
    const control = new AbortController();
    let activo = true;
    const params = new URLSearchParams(consulta);
    const territorio = params.get("territorio") ?? "todos";
    if (opcionesDe.current !== territorio) params.set("opciones", "1");
    void (async () => {
      try {
        const res = await fetch(`/admin/api/leads?${params.toString()}`, { signal: control.signal });
        if (!res.ok) throw new Error(String(res.status));
        const respuesta = (await res.json()) as RespuestaLeads;
        if (!activo) return;
        setResultado({ clave, respuesta });
        setFallida(null);
        if (respuesta.opciones) {
          opcionesDe.current = territorio;
          setOpciones(respuesta.opciones);
        }
        // Se pidió una página que ya no existe (filas borradas, enlace viejo):
        // la ruta respondió la última y la URL se corrige para decir la verdad.
        if (respuesta.pagina !== pagina) {
          ponerPagina(respuesta.pagina > 1 ? String(respuesta.pagina) : null);
        }
      } catch {
        if (activo) setFallida(clave);
      }
    })();
    return () => {
      activo = false;
      control.abort();
    };
  }, [clave, consulta, pagina, ponerPagina]);

  const respuesta = resultado?.respuesta ?? null;
  const cargando = resultado?.clave !== clave && fallida !== clave;
  const fallo = fallida === clave;
  const filas = respuesta?.filas ?? [];
  const total = respuesta?.total ?? 0;
  const paginaVista = respuesta?.pagina ?? pagina;
  const elegidos = filas.filter((n) => seleccionados.has(n.id));
  const seleccionActiva = elegidos.map((n) => n.id);
  const contactablesZak = contactables(elegidos);

  function cambiarFiltro(nuevo: FiltroLeads) {
    // FiltrosLeads cambia una clave por vez. El texto espera al buscador (efecto
    // de arriba); cualquier otro filtro vuelve a la página 1 y suelta la selección ya.
    const soloTexto = nuevo.q !== filtro.q;
    setFiltro(nuevo);
    if (soloTexto) return;
    ponerPagina(null);
    setSeleccionados(new Set());
  }

  function irAPagina(n: number) {
    ponerPagina(n > 1 ? String(n) : null);
    setSeleccionados(new Set());
  }

  function alternar(id: string) {
    setSeleccionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function alternarTodos() {
    // «Todos» es la página visible: exactamente una tanda de Zak.
    const todos = filas.length > 0 && filas.every((n) => seleccionados.has(n.id));
    setSeleccionados(todos ? new Set() : new Set(filas.map((n) => n.id)));
  }

  function aplicarLote() {
    setAviso(null);
    startGuardar(async () => {
      const res = await cambiarEstadoLote(seleccionActiva, estadoLote);
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      setAviso(`${res.actualizados} negocios pasaron a «${labelEstado(estadoLote)}».`);
      setSeleccionados(new Set());
      recargar();
      router.refresh();
    });
  }

  async function eliminarLote() {
    const n = seleccionActiva.length;
    const ok = await confirmar({
      titulo: `¿Eliminar ${n} negocio(s) del CRM?`,
      mensaje:
        "Se borran también sus notas. Los clientes convertidos no se tocan y las conversaciones de Zak siguen en su bandeja.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    setAviso(null);
    startGuardar(async () => {
      const res = await eliminarNegocios(seleccionActiva);
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      setAviso(`${res.eliminados} negocio(s) eliminados.`);
      setSeleccionados(new Set());
      recargar();
      router.refresh();
    });
  }

  function contactarConZak() {
    const fuera = seleccionActiva.length - contactablesZak.length;
    void tanda.contactar(
      contactablesZak,
      fuera > 0 ? `${fuera} quedan fuera: sin celular, cliente o descartado.` : undefined,
    );
  }

  function cambiarEstado(id: string, estado: EstadoNegocio) {
    startGuardar(async () => {
      await actualizarNegocio(id, { estado });
      recargar();
      router.refresh();
    });
  }

  return (
    <Cockpit className={className}>
      {dialogo}
      {tanda.dialogo}
      {/* El buscador se queda fijo arriba; la página scrollea debajo. */}
      <div className="shrink-0 px-5 pt-4">
        <FiltrosLeads
          filtro={filtro}
          onCambiar={cambiarFiltro}
          opciones={opciones ?? OPCIONES_VACIAS}
          territorios={territorios}
          total={respuesta ? total : null}
          enPantalla={rangoEnPantalla(paginaVista, filas.length, LEADS_POR_PAGINA)}
          conteos={respuesta?.conteos ?? CONTEOS_VACIOS}
          ocultarTerritorio={territorioFijo !== undefined}
        />
      </div>

      <CockpitBody>
        {seleccionActiva.length > 0 && (
          <AccionesLote
            cantidad={seleccionActiva.length}
            contactables={contactablesZak.length}
            guardando={ocupado}
            estadoLote={estadoLote}
            onEstadoLote={setEstadoLote}
            onAplicar={aplicarLote}
            onContactar={contactarConZak}
            onEliminar={() => void eliminarLote()}
          />
        )}

        {aviso && <Banner>{aviso}</Banner>}
        {tanda.aviso && <Banner>{tanda.aviso}</Banner>}
        {fallo && (
          <Banner variante="error">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                No se pudo cargar la lista de negocios
                {respuesta ? ": lo que ves es de la consulta anterior." : "."}
              </span>
              <Button onClick={recargar}>Reintentar</Button>
            </div>
          </Banner>
        )}

        {respuesta === null ? (
          !fallo && (
            <p role="status" className="px-3 py-6 text-sm text-tinta-40">
              Cargando…
            </p>
          )
        ) : (
          <div
            aria-busy={cargando}
            className={cn("flex flex-col gap-3 transition-opacity", cargando && "opacity-60")}
          >
            {cargando && (
              <p role="status" className="px-3 text-xs text-tinta-40">
                Cargando…
              </p>
            )}
            {total === 0 ? (
              hayFiltro(filtro) ? (
                <EmptyState titulo="Ningún negocio coincide con esos filtros." />
              ) : (
                <EmptyState
                  titulo="Todavía no hay negocios."
                  detalle="Ve a Territorio, dibuja el área que quieras trabajar y bárrela: los negocios con teléfono que haya adentro aterrizan solos en esta lista."
                />
              )
            ) : (
              <>
                <TablaLeads
                  negocios={filas}
                  seleccionados={seleccionados}
                  guardando={ocupado}
                  onAlternar={alternar}
                  onAlternarTodos={alternarTodos}
                  onEstado={cambiarEstado}
                  onAbrir={onAbrirLead}
                />
                <Paginador
                  pagina={paginaVista}
                  totalPaginas={totalDePaginas(total, LEADS_POR_PAGINA)}
                  onPagina={irAPagina}
                />
              </>
            )}
          </div>
        )}
      </CockpitBody>
    </Cockpit>
  );
}
```

- [ ] **Step 4: `ProspeccionView` — la ficha por id y la lista sin `negocios`**

En `src/components/admin/prospeccion/ProspeccionView.tsx`:

Añadir el import (junto a `useFichaLead`):

```tsx
import { useFichaNegocio } from "@/components/admin/leads/useFichaNegocio";
```

Reemplazar:

```tsx
  // La ficha del lead (modal) es del shell, no de las caras: Territorio está
  // siempre montada y Leads solo a veces — dos modales leyendo `?lead=` se
  // abrirían a la vez. Se guarda el id; el negocio se resuelve en cada render
  // para que tras `router.refresh()` el modal vea la fila nueva.
  const [leadId, abrirLead] = useFichaLead();
  const leadAbierto = leadId ? (negocios.find((n) => n.id === leadId) ?? null) : null;
```

por:

```tsx
  // La ficha del lead (modal) es del shell, no de las caras: Territorio está
  // siempre montada y Leads solo a veces — dos modales leyendo `?lead=` se
  // abrirían a la vez. Se guarda el id; el negocio sale de los negocios del
  // mapa (vivos tras `router.refresh()`) o, si es más antiguo que ese tope —la
  // lista de Leads pagina la base entera—, se trae por id.
  const [leadId, abrirLead] = useFichaLead();
  const ficha = useFichaNegocio(leadId, negocios);
  // Sube cuando la ficha cambia algo: la lista de Leads vuelve a pedir su página.
  const [versionLista, setVersionLista] = useState(0);
```

Reemplazar el bloque desde `{cara === "leads" && (` hasta el cierre de `<FichaLeadModal … />` por:

```tsx
      {cara === "leads" && (
        <NegociosView
          territorios={territorios}
          className={COCKPIT_ANIDADO}
          onAbrirLead={abrirLead}
          // También cuando cambia la cuenta de la base: un barrido que sigue
          // corriendo con la cara Leads a la vista.
          recarga={`${versionLista}:${negociosTotal ?? ""}`}
        />
      )}

      <FichaLeadModal
        leadId={leadId}
        negocio={ficha.negocio}
        cargando={ficha.cargando}
        fallo={ficha.fallo}
        noExiste={ficha.noExiste}
        vozZak={vozZak}
        onCerrar={() => abrirLead(null)}
        onCambio={() => {
          ficha.recargar();
          setVersionLista((v) => v + 1);
          router.refresh();
        }}
        onEliminado={() => {
          abrirLead(null);
          setVersionLista((v) => v + 1);
          router.refresh();
        }}
      />
```

- [ ] **Step 5: `TerritorioDetalleView` — la lista por id del territorio**

En `src/components/admin/territorios/TerritorioDetalleView.tsx`:

Añadir el import (junto a `useFichaLead`):

```tsx
import { useFichaNegocio } from "@/components/admin/leads/useFichaNegocio";
```

Reemplazar el comentario de la prop:

```tsx
  /** Los negocios de este territorio, topados a TOPE_LEADS. */
```

por:

```tsx
  /** Los negocios de este territorio, topados a TOPE_LEADS: alimentan
   * «Contactar a los nuevos» y la ficha. La lista pagina aparte, por la ruta. */
```

Reemplazar:

```tsx
  const [ocupado, startAccion] = useTransition();
  const tanda = useTandaZak();

  const negocio = useMemo(
    () => (leadId ? (negocios.find((n) => n.id === leadId) ?? null) : null),
    [negocios, leadId],
  );
```

por:

```tsx
  const [ocupado, startAccion] = useTransition();
  // Sube cuando algo cambia por fuera de la lista (la ficha, «Contactar a los
  // nuevos»): la lista vuelve a pedir su página.
  const [versionLista, setVersionLista] = useState(0);
  const tanda = useTandaZak(() => setVersionLista((v) => v + 1));

  // La ficha abierta: de los locales que cargó la página o, si el lead es más
  // antiguo que ese tope, traída por id.
  const ficha = useFichaNegocio(leadId, negocios);
```

Reemplazar:

```tsx
        <NegociosView
          negocios={negocios}
          territorioFijo
          className={COCKPIT_ANIDADO}
          onAbrirLead={abrirLead}
        />
```

por:

```tsx
        <NegociosView
          territorioFijo={t.id}
          recarga={`${versionLista}:${cuenta?.leads ?? ""}`}
          className={COCKPIT_ANIDADO}
          onAbrirLead={abrirLead}
        />
```

Reemplazar:

```tsx
      <FichaLeadModal
        leadId={leadId}
        negocio={negocio}
        vozZak={vozZak}
        onCerrar={() => abrirLead(null)}
        onCambio={() => router.refresh()}
        onEliminado={() => {
          abrirLead(null);
          router.refresh();
        }}
      />
```

por:

```tsx
      <FichaLeadModal
        leadId={leadId}
        negocio={ficha.negocio}
        cargando={ficha.cargando}
        fallo={ficha.fallo}
        noExiste={ficha.noExiste}
        vozZak={vozZak}
        onCerrar={() => abrirLead(null)}
        onCambio={() => {
          ficha.recargar();
          setVersionLista((v) => v + 1);
          router.refresh();
        }}
        onEliminado={() => {
          abrirLead(null);
          setVersionLista((v) => v + 1);
          router.refresh();
        }}
      />
```

- [ ] **Step 6: Verificar tipado, lint y tests**

Run: `npx tsc --noEmit -p .; echo "exit=$?"`
Expected: `exit=0`.

Run: `npx eslint src/components/admin src/lib/admin; echo "exit=$?"`
Expected: `exit=0`, sin avisos de `react-hooks`.

Run: `npx vitest run; echo "exit=$?"`
Expected: todo en verde, `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/negocios/FiltrosLeads.tsx src/components/admin/negocios/TablaLeads.tsx src/components/admin/negocios/NegociosView.tsx src/components/admin/prospeccion/ProspeccionView.tsx src/components/admin/territorios/TerritorioDetalleView.tsx
git commit -m "leads: la lista pide cada página de 50 a la ruta, con la página en la URL y la ficha de cualquier página" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Cifras exactas en la cabecera y en las caras, y avisos de recorte honestos (TDD)

**Files:**
- Modify: `src/lib/admin/prospeccion-caras.ts`
- Test: `src/lib/admin/__tests__/prospeccion-caras.test.ts`
- Modify: `src/app/admin/(panel)/prospeccion/page.tsx`
- Modify: `src/components/admin/prospeccion/ProspeccionView.tsx`
- Modify: `src/components/admin/territorios/TerritorioDetalleView.tsx` (aviso de recorte)

**Interfaces:**
- Consumes: `estadoCenso(cargados, total)`, `TOPE_LEADS`, `esSinWeb` (`negocios.ts`); `plural` (`caras.ts`).
- Produces:
  - `type Cifra = { n: number; mas: boolean } | null`
  - `textoCifra(c: Cifra): string` → `"2400"`, `"900+"` o `"—"`
  - `cifrasCabecera(d: { cargados: number; sinWebCargados: number; total: number | null; sinWebTotal: number | null; fallaCargados: boolean }): { leads: Cifra; sinWeb: Cifra }`
  - `carasProspeccion(d: { territorios: number; leads: Cifra; sinWeb: Cifra; barriendo: boolean })`
    (antes `leads` y `sinWeb` eran `number`; su único llamador es `ProspeccionView`).
  - `ProspeccionView` recibe la prop nueva `sinWebTotal: number | null`.

- [ ] **Step 1: Escribir los tests (fallan: las funciones no existen)**

En `src/lib/admin/__tests__/prospeccion-caras.test.ts`, cambiar el import a
`import { caraDe, carasProspeccion, cifrasCabecera, pestanaInicial } from "../prospeccion-caras";` y
añadir al final:

```ts
describe("cifrasCabecera", () => {
  const BASE = {
    cargados: 900,
    sinWebCargados: 300,
    total: 2400,
    sinWebTotal: 610,
    fallaCargados: false,
  };

  it("con las cuentas de la base, las cifras son exactas aunque el mapa venga topado", () => {
    expect(cifrasCabecera(BASE)).toEqual({
      leads: { n: 2400, mas: false },
      sinWeb: { n: 610, mas: false },
    });
  });

  it("sin cuentas y con la lista en el tope: un piso («900+»), no un total", () => {
    expect(cifrasCabecera({ ...BASE, total: null, sinWebTotal: null })).toEqual({
      leads: { n: 900, mas: true },
      sinWeb: { n: 300, mas: true },
    });
  });

  it("sin cuentas pero con la lista completa: lo cargado es el total", () => {
    expect(
      cifrasCabecera({ ...BASE, cargados: 120, sinWebCargados: 40, total: null, sinWebTotal: null }),
    ).toEqual({ leads: { n: 120, mas: false }, sinWeb: { n: 40, mas: false } });
  });

  it("falla solo la cuenta de sin web con la lista recortada: piso de lo cargado", () => {
    expect(cifrasCabecera({ ...BASE, sinWebTotal: null })).toEqual({
      leads: { n: 2400, mas: false },
      sinWeb: { n: 300, mas: true },
    });
  });

  it("sin lista y sin cuentas no hay cifra: nunca un cero inventado", () => {
    expect(
      cifrasCabecera({ cargados: 0, sinWebCargados: 0, total: null, sinWebTotal: null, fallaCargados: true }),
    ).toEqual({ leads: null, sinWeb: null });
  });
});

describe("carasProspeccion", () => {
  it("el detalle de las caras usa las cifras de la base", () => {
    const caras = carasProspeccion({
      territorios: 4,
      leads: { n: 2400, mas: false },
      sinWeb: { n: 610, mas: false },
      barriendo: false,
    });
    expect(caras.map((c) => c.detalle)).toEqual(["4 territorios · 2400 leads", "2400 leads · 610 sin web"]);
  });

  it("un piso se dice con «+» y lo que no se sabe con «—»", () => {
    const caras = carasProspeccion({
      territorios: 1,
      leads: { n: 900, mas: true },
      sinWeb: null,
      barriendo: false,
    });
    expect(caras.map((c) => c.detalle)).toEqual(["1 territorio · 900+ leads", "900+ leads · — sin web"]);
  });

  it("un solo lead va en singular", () => {
    const caras = carasProspeccion({
      territorios: 1,
      leads: { n: 1, mas: false },
      sinWeb: { n: 1, mas: false },
      barriendo: false,
    });
    expect(caras[1]?.detalle).toBe("1 lead · 1 sin web");
  });
});
```

- [ ] **Step 2: Ver los tests fallar**

Run: `npx vitest run src/lib/admin/__tests__/prospeccion-caras.test.ts; echo "exit=$?"`
Expected: FAIL — `TypeError: … cifrasCabecera is not a function`, y los de `carasProspeccion` fallan
porque el detalle sale como `"4 territorios · [object Object] leads"`. `exit=1`.

- [ ] **Step 3: Implementar**

En `src/lib/admin/prospeccion-caras.ts`, reemplazar la línea
`import { plural, type CaraDef } from "./caras";` por:

```ts
import { plural, type CaraDef } from "./caras";
import { estadoCenso, TOPE_LEADS } from "./negocios";
```

Reemplazar la función `carasProspeccion` entera (y su comentario) por:

```ts
/**
 * Una cifra de la cabecera. `mas` = es un piso («900+»), no el total; `null` =
 * no se sabe (fallaron la lista y la cuenta) y se pinta «—», nunca un cero.
 */
export type Cifra = { n: number; mas: boolean } | null;

export function textoCifra(c: Cifra): string {
  return c === null ? "—" : `${c.n}${c.mas ? "+" : ""}`;
}

/** «1 lead», «900+ leads», «— leads». */
function conUnidad(c: Cifra, singular: string, pluralForm: string): string {
  return c !== null && c.n === 1 && !c.mas ? `1 ${singular}` : `${textoCifra(c)} ${pluralForm}`;
}

/**
 * Las cifras de la cabecera y de las caras: las cuentas exactas de la base
 * cuando llegaron. Si una falló, sale de los negocios cargados para el mapa, y
 * se marca como piso si esa lista pudo quedar recortada.
 */
export function cifrasCabecera(d: {
  cargados: number;
  sinWebCargados: number;
  total: number | null;
  sinWebTotal: number | null;
  /** Falló la consulta de los negocios cargados: lo cargado no dice nada. */
  fallaCargados: boolean;
}): { leads: Cifra; sinWeb: Cifra } {
  const completa = estadoCenso(d.cargados, d.total).tipo === "completo";
  const leads: Cifra =
    d.total !== null
      ? { n: d.total, mas: false }
      : d.fallaCargados
        ? null
        : { n: d.cargados, mas: d.cargados >= TOPE_LEADS };
  const sinWeb: Cifra =
    d.sinWebTotal !== null
      ? { n: d.sinWebTotal, mas: false }
      : d.fallaCargados
        ? null
        : { n: d.sinWebCargados, mas: !completa };
  return { leads, sinWeb };
}

/**
 * Las tarjetas de la cabecera con sus contadores vivos. `barriendo` marca la
 * cara de Territorio con un punto que late: desde Leads tiene que verse que
 * al otro lado se está gastando plata.
 */
export function carasProspeccion(d: {
  territorios: number;
  leads: Cifra;
  sinWeb: Cifra;
  barriendo: boolean;
}): CaraDef<CaraProspeccion>[] {
  return [
    {
      id: "territorio",
      label: "Territorio",
      detalle: `${plural(d.territorios, "territorio", "territorios")} · ${conUnidad(d.leads, "lead", "leads")}`,
      punto: d.barriendo ? { titulo: "Hay un barrido en curso", pulsa: true } : null,
    },
    {
      id: "leads",
      label: "Leads",
      detalle: `${conUnidad(d.leads, "lead", "leads")} · ${textoCifra(d.sinWeb)} sin web`,
      punto: null,
    },
  ];
}
```

- [ ] **Step 4: Ver los tests pasar**

Run: `npx vitest run src/lib/admin/__tests__/prospeccion-caras.test.ts; echo "exit=$?"`
Expected: PASS — 14 tests, `exit=0`.

- [ ] **Step 5: La page cuenta «sin web» en la base**

En `src/app/admin/(panel)/prospeccion/page.tsx`, reemplazar:

```tsx
  const [negocios, cuenta, territorios, consultasMes, zakVoz] = await Promise.all([
    supabase
      .from("negocios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(TOPE_LEADS),
    supabase.from("negocios").select("*", { count: "exact", head: true }),
```

por:

```tsx
  const [negocios, cuenta, cuentaSinWeb, territorios, consultasMes, zakVoz] = await Promise.all([
    supabase
      .from("negocios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(TOPE_LEADS),
    supabase.from("negocios").select("*", { count: "exact", head: true }),
    // «Sin web» de la base entera para la cabecera: la misma definición que la
    // RPC cuentas_por_territorio (sitio_web is null).
    supabase.from("negocios").select("*", { count: "exact", head: true }).is("sitio_web", null),
```

Debajo de `if (cuenta.error) console.error("[prospección] cuenta de negocios:", cuenta.error.message);` añadir:

```tsx
  if (cuentaSinWeb.error) {
    console.error("[prospección] cuenta de sin web:", cuentaSinWeb.error.message);
  }
```

Y en el JSX, debajo de la prop `negociosTotal={…}`, añadir:

```tsx
      sinWebTotal={cuentaSinWeb.error ? null : (cuentaSinWeb.count ?? null)}
```

- [ ] **Step 6: `ProspeccionView` — cifras de la base y avisos del mapa**

En `src/components/admin/prospeccion/ProspeccionView.tsx`:

Reemplazar el import de `@/lib/admin/prospeccion-caras` por:

```tsx
import {
  caraDe,
  carasProspeccion,
  cifrasCabecera,
  pestanaInicial,
  textoCifra,
  type CaraProspeccion,
} from "@/lib/admin/prospeccion-caras";
```

En `type Props`, debajo de `negociosTotal: number | null;` añadir:

```tsx
  /** Cuántos negocios SIN WEB hay en la base (count exacto), o null si esa
   * cuenta falló. */
  sinWebTotal: number | null;
```

Añadir `sinWebTotal,` a la desestructuración de props, debajo de `negociosTotal,`.

Reemplazar el bloque desde `const sinWeb = negocios.filter(esSinWeb).length;` hasta
`const censo = estadoCenso(negocios.length, negociosTotal);` (incluido su comentario) por:

```tsx
  // El censo del MAPA: la lista de negocios viene topada por `page.tsx`. La
  // comparación es contra las filas que DE VERDAD llegaron, no contra el tope:
  // si quien recortó fue el ajuste "Max rows" de Supabase, la consulta vuelve
  // capada y sin error, y esta es la única señal de que el mapa pinta un tope y
  // no un censo. Si la cuenta exacta FALLÓ, `estadoCenso` trata "la lista llegó
  // justo al tope" como su propia señal de recorte.
  const censo = estadoCenso(negocios.length, negociosTotal);

  // Las cifras de la cabecera y de las caras son las de la base (conteos
  // exactos del servidor). Si una cuenta falló, se dicen como piso («900+») o
  // «—»: nunca la cifra de lo cargado presentada como la de la base.
  const cifras = cifrasCabecera({
    cargados: negocios.length,
    sinWebCargados: negocios.filter(esSinWeb).length,
    total: negociosTotal,
    sinWebTotal,
    fallaCargados: fallaNegocios,
  });
```

Reemplazar:

```tsx
  // Los avisos ocupan una banda propia solo cuando hay alguno: una banda
  // vacía le roba 16px al mapa por nada.
  const hayAvisos =
    fallaNegocios || (cara === "leads" && aviso !== null) || censo.tipo !== "completo";
```

por:

```tsx
  // Los avisos ocupan una banda propia solo cuando hay alguno: una banda
  // vacía le roba 16px al mapa por nada. El recorte de 900 es del mapa: la
  // lista de Leads pagina la base entera y no lo tiene.
  const hayAvisos =
    fallaNegocios ||
    (cara === "leads" && aviso !== null) ||
    (cara === "territorio" && censo.tipo !== "completo");
```

En `<Caras caras={carasProspeccion({…})}`, reemplazar `leads: negocios.length,` y `sinWeb,` por:

```tsx
              leads: cifras.leads,
              sinWeb: cifras.sinWeb,
```

Reemplazar el `contador={…}` entero por:

```tsx
        contador={
          <>
            <strong className="text-tinta-85">{textoCifra(cifras.leads)}</strong> negocios ·{" "}
            <strong className="text-tinta-85">{textoCifra(cifras.sinWeb)}</strong> sin web ·{" "}
            <strong className="text-tinta-85">{territorios.length}</strong> territorios
          </>
        }
```

Reemplazar el banner de `fallaNegocios` por:

```tsx
          {fallaNegocios && (
            <Banner variante="error">
              No se pudieron cargar los negocios del mapa: faltan pines y las cifras por
              territorio están incompletas. Recarga la página para reintentar.
            </Banner>
          )}
```

Reemplazar los dos banners de censo (`censo.tipo === "recortado"` y `censo.tipo === "recortado_sin_conteo"`,
con su comentario) por:

```tsx
          {/* Un censo que no dice que está recortado no es un censo. El tope es
              del mapa: la lista de Leads pagina la base entera. */}
          {cara === "territorio" && censo.tipo === "recortado" && (
            <Banner variante="error">
              El mapa cargó los <strong>{negocios.length}</strong> negocios más recientes de{" "}
              <strong>{censo.total}</strong>: los pines y las cifras por territorio del mapa
              cuentan solo esos. La lista de Leads y las cifras de arriba cuentan la base entera.
            </Banner>
          )}
          {cara === "territorio" && censo.tipo === "recortado_sin_conteo" && (
            <Banner variante="error">
              El mapa cargó <strong>{negocios.length}</strong> negocios, su tope, y la cuenta de
              cuántos hay en la base falló: es casi seguro que faltan pines. La lista de Leads
              pagina la base entera y sí los tiene. Recarga la página para reintentar la cuenta.
            </Banner>
          )}
```

- [ ] **Step 7: `TerritorioDetalleView` — el aviso habla de lo que sigue topado**

En `src/components/admin/territorios/TerritorioDetalleView.tsx`, reemplazar:

```tsx
          {censo.tipo !== "completo" && (
            <Banner variante="error">
              Este territorio tiene más locales de los que caben en pantalla: se muestran los{" "}
              <strong>{negocios.length}</strong> más recientes
              {censo.tipo === "recortado" && <> de {censo.total}</>}.
            </Banner>
          )}
```

por:

```tsx
          {censo.tipo !== "completo" && (
            <Banner variante="error">
              «Contactar a los nuevos» cuenta solo los <strong>{negocios.length}</strong> locales más
              recientes{censo.tipo === "recortado" && <> de {censo.total}</>}. Los más antiguos que
              sigan en Nuevo se contactan desde la lista: filtra por «Nuevo» y selecciona la página.
            </Banner>
          )}
```

- [ ] **Step 8: Verificar tipado, lint y tests**

Run: `npx tsc --noEmit -p .; echo "exit=$?"`
Expected: `exit=0`.

Run: `npx eslint "src/app/admin/(panel)/prospeccion" src/components/admin src/lib/admin; echo "exit=$?"`
Expected: `exit=0`.

Run: `npx vitest run; echo "exit=$?"`
Expected: todo en verde, `exit=0`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/admin/prospeccion-caras.ts src/lib/admin/__tests__/prospeccion-caras.test.ts "src/app/admin/(panel)/prospeccion/page.tsx" src/components/admin/prospeccion/ProspeccionView.tsx src/components/admin/territorios/TerritorioDetalleView.tsx
git commit -m "prospección: la cabecera y las caras cuentan la base entera; el aviso de 900 queda en el mapa" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verificación completa, revisión y PR

**Files:**
- Ninguno nuevo en el repo (la revisión puede tocar los de las Tasks 1-7).
- Fuera del repo: cuerpo de la PR en el scratchpad; memoria en `~/memory/`.

**Interfaces:**
- Consumes: la rama con las Tasks 1-7.
- Produces: la PR abierta contra `main` y la memoria al día.

- [ ] **Step 1: Suite, tipado y lint**

Run: `npx vitest run; echo "exit=$?"`
Expected: todo en verde, `exit=0`.

Run: `npx tsc --noEmit -p .; echo "exit=$?"`
Expected: `exit=0`.

Run: `npx eslint src; echo "exit=$?"`
Expected: `exit=0`.

- [ ] **Step 2: Build de producción con su código de salida real**

Run: `npx next build > <scratchpad>/build-leads.log 2>&1; echo "build exit=$?"`
Expected: `build exit=0`. Leer las últimas líneas del log con Read: debe figurar `ƒ /admin/api/leads` en la
tabla de rutas.

- [ ] **Step 3: Revisión de código**

Correr `/code-review` sobre la rama. Para cada hallazgo: verificarlo contra el código. Si es real, primero
un test que lo reproduzca (en los módulos puros) y después el arreglo. Luego repetir el Step 1 y
commitear con archivos explícitos. Los hallazgos descartados se anotan en la PR con su motivo.

- [ ] **Step 4: Nada interno en lo que se publica**

Run: `git log origin/main..HEAD --format=%B; echo "exit=$?"`
Run: `git diff origin/main --stat; echo "exit=$?"`
Revisar a ojo que ningún mensaje, test o texto nombre un prospecto, un teléfono o una cifra real del CRM.

- [ ] **Step 5: Push y PR**

Run: `git push -u origin feat/leads-paginados; echo "exit=$?"`

Escribir el cuerpo en `<scratchpad>/pr-leads-paginados.md` (archivo fuera del repo), con estas secciones:
**Qué pasaba** (la lista, los chips y la cabecera contaban solo los 900 más recientes), **Qué cambia**
(ruta `GET /admin/api/leads`, páginas de 50 = una tanda, página en la URL, ficha de cualquier página,
cabecera y caras con cifras de la base, aviso de 900 solo en el mapa, aviso del territorio sobre
«Contactar a los nuevos»), **Sin SQL ni variables de entorno**, **Límites** (6 conteos + 1 consulta por
cambio de filtro; opciones leídas de a 1000; el mapa sigue topado en 900), **Hallazgos de la revisión**,
**Verificación** (tests, `tsc`, `eslint`, `build`) y **Prueba manual después de mergear** (lista del
Step 6). Termina con la línea `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Run: `gh pr create --base main --head feat/leads-paginados --title 'leads: la lista pagina de a 50 contra la base entera y la cabecera cuenta de verdad' --body-file <scratchpad>/pr-leads-paginados.md; echo "exit=$?"`
Expected: la URL de la PR, `exit=0`.

- [ ] **Step 6: Prueba manual que queda para Tomás (con sesión en el panel)**

1. Encontrar clientes → Leads: la cabecera dice «N negocios · M sin web · T territorios», sin «900 de», y
   las caras usan las mismas cifras.
2. La isla dice «N negocios · del 1 al 50»; «Siguiente» muestra «del 51 al 100» y la URL lleva `?pagina=2`.
3. Tocar un chip de estado: el total baja, vuelve a la página 1 y los chips suman lo mismo que «Todos».
4. Buscar por nombre un negocio antiguo (de los que no entraban en los 900): aparece.
5. Seleccionar la página → «Que Zak los contacte» → el diálogo ofrece como mucho 50.
6. Abrir la ficha de un lead de la última página: carga; cambiarle el estado actualiza la fila en la lista.
7. Página de un territorio: la lista pagina solo sus locales y «Contactar a los nuevos» sigue igual.
8. Cara Territorio: el aviso de 900 sale ahí, con el texto del mapa; en la cara Leads no sale.

- [ ] **Step 7: Memoria**

- `~/memory/projects/zakumi.md`: sección de la PR (qué cambió, la ruta y su contrato, la regla del tipo
  concreto `ConsultaNegocios` por el TS2589, el aviso de 900 que ahora es solo del mapa, lo que falta
  probar a mano).
- `~/memory/index.md`: actualizar la línea de Zakumi con la PR abierta.
- `~/memory/log.md`: `## 2026-09-15 — PR de Leads paginados abierta (lista de 50 contra la base, cifras reales en la cabecera)`.
