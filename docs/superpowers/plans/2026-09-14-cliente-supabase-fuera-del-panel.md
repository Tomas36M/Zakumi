# El SDK de Supabase fuera de cuatro rutas del panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las fichas en modal del panel lean las notas de un negocio y
los pagos recientes de un cliente por route handlers con el cliente de
servidor, para que el SDK de Supabase para navegador (~250 KB sin comprimir)
deje de viajar a cuatro rutas del admin. De paso, que un negocio borrado
abierto por un enlace viejo diga "ya no existe".

**Architecture:** Dos lecturas con el cliente de servidor viven en
`src/lib/admin/fichas-servidor.ts` (TDD con un Supabase falso). Dos route
handlers finos bajo `/admin/api/` las exponen con el mismo guardia que
`/admin/api/negocios/[id]`. `FichaLeadNotas` y `PagosRecientes` cambian
`createSupabaseBrowser()` por `fetch` a esas rutas, y de paso distinguen "la
lectura falló" de "no hay filas". Aparte, la derivación del estado de la
ficha del chat de Zak sale a una función pura (`estadoFicha`, TDD) que suma
`noExiste` para el 200-con-`null` de la ruta del negocio.

**Tech Stack:** Next.js 16 (route handlers del App Router), React 19,
Supabase (PostgREST), Vitest. Sin SQL, sin dependencias nuevas.

**Spec:** No hay spec. El plan argumenta desde dos hallazgos:
1. Auditoría (artifact "Radiografía Zakumi"), rendimiento, Medio: el
   cliente de Supabase para navegador viaja a `/admin/prospeccion`,
   `/admin/bots/[id]`, `/admin/territorios/[id]` y `/admin/clientes` solo
   porque `FichaLeadNotas` y `PagosRecientes` hacen su lectura desde el
   navegador.
2. Review final del plan de calidad de código, Minor aparcado:
   `/admin/api/negocios/[id]` usa `.maybeSingle()` y responde **200 con
   `negocio: null`** para un negocio borrado, y la ficha del chat de Zak cae
   en el banner "no está en la lista cargada en pantalla", en una pantalla
   sin lista ni filtros.

**Línea base medida** (`.next/diagnostics/route-bundle-stats.json` del build
de `b25de33`, first-load JS sin comprimir). El chunk que contiene el SDK
(buscado por contenido: `X-Client-Info|GoTrueClient|supabase-js`) pesa
**251,079 B** y está en exactamente siete rutas:

| Ruta | First-load | ¿Por qué lo carga? | Después de este plan |
|---|---|---|---|
| `/admin/prospeccion` | 972,778 B | `FichaLeadNotas` | sin el chunk |
| `/admin/bots/[id]` | 878,686 B | `FichaLeadNotas` (vía `Conversaciones`) | sin el chunk |
| `/admin/territorios/[id]` | 832,683 B | `FichaLeadNotas` | sin el chunk |
| `/admin/clientes` | 823,981 B | `PagosRecientes` | sin el chunk |
| `/admin/zak` | 926,724 B | `PlantillasZak` (subida a Storage) | lo conserva |
| `/app/login` | 717,469 B | `BotonGoogle` (OAuth) | lo conserva |
| `/app/registro` | 717,932 B | `BotonGoogle` (OAuth) | lo conserva |

Ninguna otra ruta de `/admin` ni de `/app` lo carga: no viene de un layout.

## Global Constraints

- **Cero tests de componentes y de route handlers** (`vitest.config.ts`:
  `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts"]`). TDD
  solo para `src/lib/admin/fichas-servidor.ts` (Task 1) y
  `src/lib/admin/ficha-fetch.ts` (Task 3).
- **Las dos rutas nuevas van bajo `/admin/api/`** y abren con
  `getSesionAdmin()` → 401 si es `null`. Nunca `getSesion()` a secas en un
  handler del panel: `src/lib/admin/dal.ts` explica que dejaría pasar a
  cualquier registrado del portal. Validan el id con el mismo `UUID` local
  que `src/app/admin/api/negocios/[id]/route.ts` → 400. Una lectura que
  falla → 502 `{ error: "crm" }`.
- **Al terminar, `grep -rln "createSupabaseBrowser" src` lista EXACTAMENTE
  tres archivos:** `src/lib/supabase/browser.ts`,
  `src/components/portal/auth/BotonGoogle.tsx` (OAuth) y
  `src/components/admin/bots/PlantillasZak.tsx` (subida directa a Storage:
  el body de una server action reventaba). Esos dos consumidores sí lo
  necesitan y no se tocan.
- **Una lectura que falla se dice con un banner.** "Todavía no hay notas" y
  "Sin pagos registrados todavía" solo aparecen si la lectura funcionó y
  devolvió cero filas. Hoy los dos componentes pintan la lista vacía también
  cuando la consulta falla (`(data as X[]) ?? []`), y en pagos eso es un
  contador de plata que miente (regla del repo, CLAUDE.md). **Cambio
  visible #1, intencional.**
- **Cambio visible #2, intencional (Task 3):** abrir desde el chat de Zak la
  ficha de un negocio que ya no existe (un `?lead=` viejo, o un
  `leads_overrides.negocio_id` que apunta a una fila borrada) muestra "Este
  negocio ya no existe…" en vez de "no está en la lista cargada en
  pantalla". Territorio y Prospección, que resuelven por lista y no pasan
  `cargando`/`fallo`, no cambian.
- **Los pagos solo cambian al registrar uno.** En el panel no se borran
  productos ni pagos (ningún `.delete()` en `src/lib/admin/cartera-actions.ts`;
  los pagos entran por la RPC `registrar_pago`) y un producto nuevo nace sin
  pagos. Por eso `PagosRecientes` relee con `[clienteId, version]`, sin
  depender de la lista de productos.
- `agregarNota` (server action) no cambia. `FichaLeadModal` sigue montando
  `FichaLeadNotas` con los mismos props.
- La regex `UUID` se copia local en cada ruta nueva, igual que la plantilla.
  Hay 9 copias en `src/`; consolidarlas NO es de este plan.
- **Checkout compartido:** `git add` con paths explícitos, nunca `-A`. Nada
  de `npm install` / `npm ci`.

---

### Task 1: `fichas-servidor.ts` — las dos lecturas con el cliente de servidor (TDD)

**Files:**
- Create: `src/lib/admin/fichas-servidor.ts`
- Test: `src/lib/admin/__tests__/fichas-servidor.test.ts`

**Interfaces:**
- Consumes: `Nota` (`src/lib/admin/negocios.ts`), `Pago`
  (`src/lib/admin/cartera.ts`), `SupabaseClient` (`@supabase/supabase-js`,
  solo tipo).
- Produces (las usa la Task 2):
  - `notasDeNegocio(supabase: SupabaseClient, negocioId: string): Promise<Nota[] | null>`
  - `pagosRecientesDeCliente(supabase: SupabaseClient, clienteId: string): Promise<Pago[] | null>`
  - `PAGOS_RECIENTES = 20`
  - En ambas, `null` = la consulta falló.

- [ ] **Step 1: Los tests primero**

Crear `src/lib/admin/__tests__/fichas-servidor.test.ts` con exactamente:

```ts
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pago } from "../cartera";
import type { Nota } from "../negocios";
import { notasDeNegocio, pagosRecientesDeCliente } from "../fichas-servidor";

type Respuesta = { data: unknown; error: { message: string } | null };
type Llamada = { tabla: string; metodo: string; args: unknown[] };

const METODOS = ["select", "eq", "in", "order", "limit"] as const;

/**
 * Supabase falso: `from(tabla)` devuelve un eslabón encadenable que anota
 * cada llamada (select, eq, in, order, limit) y que, al esperarlo, resuelve
 * lo configurado para esa tabla. Una tabla SIN respuesta configurada
 * responde con error: si el código la consulta cuando no debía, el test lo
 * ve en el resultado y en `llamadas`.
 */
function supabaseFalso(respuestas: Partial<Record<string, Respuesta>>) {
  const llamadas: Llamada[] = [];
  const cliente = {
    from(tabla: string): unknown {
      const respuesta: Respuesta = respuestas[tabla] ?? {
        data: null,
        error: { message: `consulta inesperada a ${tabla}` },
      };
      const eslabon = (): unknown =>
        Object.assign(
          Promise.resolve(respuesta),
          Object.fromEntries(
            METODOS.map(
              (metodo) =>
                [
                  metodo,
                  (...args: unknown[]) => {
                    llamadas.push({ tabla, metodo, args });
                    return eslabon();
                  },
                ] as const,
            ),
          ),
        );
      return eslabon();
    },
  };
  return { cliente: cliente as unknown as SupabaseClient, llamadas };
}

/** Las llamadas hechas sobre una tabla, como [método, ...args]. */
function deTabla(llamadas: Llamada[], tabla: string): unknown[][] {
  return llamadas.filter((l) => l.tabla === tabla).map((l) => [l.metodo, ...l.args]);
}

function nota(extra: Partial<Nota> = {}): Nota {
  return {
    id: "nt1",
    negocio_id: "n1",
    texto: "Llamé, no contestó",
    automatica: false,
    autor: null,
    created_at: "2026-09-14T15:00:00Z",
    ...extra,
  };
}

function pago(extra: Partial<Pago> = {}): Pago {
  return {
    id: "pg1",
    producto_id: "p1",
    fecha: "2026-09-01",
    monto: 150000,
    moneda: "COP",
    nota: null,
    registrado_por: null,
    created_at: "2026-09-01T12:00:00Z",
    ...extra,
  };
}

describe("notasDeNegocio", () => {
  it("trae las notas del negocio, las más nuevas primero", async () => {
    const filas = [nota({ id: "nt2" }), nota()];
    const { cliente, llamadas } = supabaseFalso({ notas: { data: filas, error: null } });

    expect(await notasDeNegocio(cliente, "n1")).toEqual(filas);
    expect(deTabla(llamadas, "notas")).toEqual([
      ["select", "*"],
      ["eq", "negocio_id", "n1"],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("si la consulta falla devuelve null (la ficha avisa), no una lista vacía que miente", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente } = supabaseFalso({ notas: { data: null, error: { message: "boom" } } });

    expect(await notasDeNegocio(cliente, "n1")).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("pagosRecientesDeCliente", () => {
  it("trae los últimos 20 pagos de TODOS los productos del cliente, los más recientes primero", async () => {
    const filas = [pago({ id: "pg2", producto_id: "p2" }), pago()];
    const { cliente, llamadas } = supabaseFalso({
      productos_contratados: { data: [{ id: "p1" }, { id: "p2" }], error: null },
      pagos: { data: filas, error: null },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toEqual(filas);
    // Los productos salen del cliente EN EL SERVIDOR, no de ids del navegador.
    expect(deTabla(llamadas, "productos_contratados")).toEqual([
      ["select", "id"],
      ["eq", "cliente_id", "c1"],
    ]);
    expect(deTabla(llamadas, "pagos")).toEqual([
      ["select", "*"],
      ["in", "producto_id", ["p1", "p2"]],
      ["order", "fecha", { ascending: false }],
      ["limit", 20],
    ]);
  });

  it("un cliente sin productos no consulta pagos y devuelve lista vacía", async () => {
    const { cliente, llamadas } = supabaseFalso({
      productos_contratados: { data: [], error: null },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toEqual([]);
    expect(deTabla(llamadas, "pagos")).toEqual([]);
  });

  it("si falla la lectura de productos devuelve null y no consulta pagos", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente, llamadas } = supabaseFalso({
      productos_contratados: { data: null, error: { message: "boom" } },
      pagos: { data: [pago()], error: null },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toBeNull();
    expect(deTabla(llamadas, "pagos")).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("si falla la lectura de pagos devuelve null, no una lista vacía que miente", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cliente } = supabaseFalso({
      productos_contratados: { data: [{ id: "p1" }], error: null },
      pagos: { data: null, error: { message: "boom" } },
    });

    expect(await pagosRecientesDeCliente(cliente, "c1")).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
```

- [ ] **Step 2: Correr — deben fallar**

Run: `npx vitest run src/lib/admin/__tests__/fichas-servidor.test.ts`
Expected: FAIL — el import `../fichas-servidor` no resuelve (el módulo no
existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/admin/fichas-servidor.ts` con exactamente:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pago } from "./cartera";
import type { Nota } from "./negocios";

// Lecturas de las fichas en modal del panel, con el cliente de SERVIDOR.
// Antes se hacían desde el navegador (FichaLeadNotas, PagosRecientes), y eso
// obligaba a mandar el SDK de Supabase (~250 KB sin comprimir) a cuatro rutas
// del admin. Las exponen los handlers de /admin/api/negocios/[id]/notas y
// /admin/api/clientes/[id]/pagos.
//
// En las dos, `null` = la consulta falló: la ficha lo dice con un banner en
// vez de pintar una lista vacía que no es.

/** Tope de la lista "Pagos recientes" de la ficha del cliente. */
export const PAGOS_RECIENTES = 20;

/** Las notas de un negocio (a mano y automáticas), las más nuevas primero. */
export async function notasDeNegocio(
  supabase: SupabaseClient,
  negocioId: string,
): Promise<Nota[] | null> {
  const { data, error } = await supabase
    .from("notas")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[fichas] notas del negocio:", error.message);
    return null;
  }
  return (data as Nota[]) ?? [];
}

/**
 * Los últimos pagos de TODOS los productos de un cliente, los más recientes
 * primero. Los productos se buscan acá por `cliente_id`: el servidor no
 * confía en una lista de ids que mande el navegador.
 */
export async function pagosRecientesDeCliente(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<Pago[] | null> {
  const productos = await supabase
    .from("productos_contratados")
    .select("id")
    .eq("cliente_id", clienteId);
  if (productos.error) {
    console.error("[fichas] productos del cliente:", productos.error.message);
    return null;
  }

  const ids = ((productos.data as { id: string }[]) ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const pagos = await supabase
    .from("pagos")
    .select("*")
    .in("producto_id", ids)
    .order("fecha", { ascending: false })
    .limit(PAGOS_RECIENTES);
  if (pagos.error) {
    console.error("[fichas] pagos del cliente:", pagos.error.message);
    return null;
  }
  return (pagos.data as Pago[]) ?? [];
}
```

- [ ] **Step 4: Correr — pasan**

Run: `npx vitest run src/lib/admin/__tests__/fichas-servidor.test.ts`
Expected: PASS, 6/6.

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint src/lib/admin/fichas-servidor.ts src/lib/admin/__tests__/fichas-servidor.test.ts`
Expected: sin salida.

Run: `npm test`
Expected: 680/680 (674 + 6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/fichas-servidor.ts src/lib/admin/__tests__/fichas-servidor.test.ts
git commit -m "feat: notas de un negocio y pagos recientes de un cliente con el cliente de servidor (TDD)"
```

---

### Task 2: Las dos rutas, y las fichas leen por ellas

**Files:**
- Create: `src/app/admin/api/negocios/[id]/notas/route.ts`
- Create: `src/app/admin/api/clientes/[id]/pagos/route.ts`
- Modify: `src/components/admin/leads/FichaLeadNotas.tsx` (reemplazo completo)
- Modify: `src/components/admin/clientes/PagosRecientes.tsx` (reemplazo completo)
- Modify: `src/components/admin/clientes/ClienteModal.tsx:79`

**Interfaces:**
- Consumes (Task 1): `notasDeNegocio`, `pagosRecientesDeCliente` desde
  `@/lib/admin/fichas-servidor`. `getSesionAdmin(): Promise<Sesion | null>`
  desde `@/lib/admin/dal` (`sesion.supabase` es el cliente de servidor).
- Produces:
  - `GET /admin/api/negocios/[id]/notas` → 200 `{ notas: Nota[] }` | 401 | 400 | 502.
  - `GET /admin/api/clientes/[id]/pagos` → 200 `{ pagos: Pago[] }` | 401 | 400 | 502.
  - `PagosRecientes` gana el prop `clienteId: string`, obligatorio.
    `productos` se queda: le pone nombre a cada pago.

- [ ] **Step 1: La ruta de notas**

Crear `src/app/admin/api/negocios/[id]/notas/route.ts` (convive con el
`route.ts` que ya existe en `[id]/`) con exactamente:

```ts
import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { notasDeNegocio } from "@/lib/admin/fichas-servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Las notas de un negocio para su ficha en modal (FichaLeadNotas). Existe para
 * que esa lectura no necesite el SDK de Supabase en el navegador, que viajaba
 * a cuatro rutas del panel solo por esto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }

  const notas = await notasDeNegocio(sesion.supabase, id);
  if (notas === null) {
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  return NextResponse.json({ notas });
}
```

- [ ] **Step 2: La ruta de pagos**

Crear `src/app/admin/api/clientes/[id]/pagos/route.ts` con exactamente:

```ts
import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { pagosRecientesDeCliente } from "@/lib/admin/fichas-servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los pagos recientes de un cliente para su ficha en modal (PagosRecientes).
 * Los productos salen del cliente en el servidor, no de una lista de ids que
 * mande el navegador. Existe para que esa lectura no necesite el SDK de
 * Supabase en el navegador, que viajaba a /admin/clientes solo por esto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "id_invalido" }, { status: 400 });
  }

  const pagos = await pagosRecientesDeCliente(sesion.supabase, id);
  if (pagos === null) {
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  return NextResponse.json({ pagos });
}
```

- [ ] **Step 3: `FichaLeadNotas` lee por la ruta**

Reemplazar TODO el contenido de `src/components/admin/leads/FichaLeadNotas.tsx`
por:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { agregarNota } from "@/lib/admin/actions";
import { fechaCorta } from "@/lib/admin/formato";
import type { Nota } from "@/lib/admin/negocios";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { TextArea } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

/**
 * Lee por /admin/api (cliente de servidor), no con el SDK de Supabase en el
 * navegador: ese SDK pesa ~250 KB y viajaba a cuatro rutas del panel solo por
 * esta lectura. `null` = la lectura falló, que no es lo mismo que "no hay
 * notas".
 */
async function leerNotas(negocioId: string): Promise<Nota[] | null> {
  try {
    const res = await fetch(`/admin/api/negocios/${negocioId}/notas`);
    if (!res.ok) return null;
    return ((await res.json()) as { notas: Nota[] }).notas;
  } catch {
    return null;
  }
}

type Props = {
  negocioId: string;
  /** `updated_at` del negocio: cambia con cada guardado y el trigger de la
   * base deja nota automática al cambiar de estado — se vuelven a leer. */
  version: string;
};

/** Las notas del lead: las que se escriben aquí y las automáticas. */
export function FichaLeadNotas({ negocioId, version }: Props) {
  const [guardando, startGuardar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // null = primera lectura en curso; "error" = la última lectura falló.
  const [notas, setNotas] = useState<Nota[] | "error" | null>(null);
  const [notaNueva, setNotaNueva] = useState("");

  useEffect(() => {
    let activo = true;
    leerNotas(negocioId).then((ns) => {
      if (activo) setNotas(ns ?? "error");
    });
    return () => {
      activo = false;
    };
  }, [negocioId, version]);

  return (
    <Island className="bg-isla-alta/50" titulo="Notas" aria-label="Notas del negocio">
      <form
        className="mb-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const texto = notaNueva.trim();
          if (!texto) return;
          setError(null);
          startGuardar(async () => {
            const res = await agregarNota(negocioId, texto);
            if (res.error) {
              setError(res.error);
              return;
            }
            setNotaNueva("");
            setNotas((await leerNotas(negocioId)) ?? "error");
          });
        }}
      >
        <TextArea
          value={notaNueva}
          onChange={(e) => setNotaNueva(e.target.value)}
          placeholder="Qué pasó con este negocio…"
          rows={2}
          maxLength={4000}
        />
        <Button type="submit" className="self-start" disabled={guardando || !notaNueva.trim()}>
          Anotar
        </Button>
      </form>

      {error && <Banner variante="error">{error}</Banner>}

      {notas === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : notas === "error" ? (
        <Banner variante="error">
          No se pudieron cargar las notas. Cierra la ficha y vuelve a abrirla en un momento.
        </Banner>
      ) : notas.length === 0 ? (
        <p className="text-sm text-tinta-40">
          Todavía no hay notas. La primera se escribe sola al cambiar el estado.
        </p>
      ) : (
        <ul className="barra-fina flex max-h-64 flex-col gap-1 overflow-y-auto">
          {notas.map((n) => (
            <li key={n.id}>
              <ListRow interactiva={false} className="flex flex-col gap-0.5">
                <span className="text-xs text-tinta-40">{fechaCorta(n.created_at)}</span>
                <span className={n.automatica ? "text-sm text-tinta-60 italic" : "text-sm text-tinta"}>
                  {n.texto}
                </span>
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </Island>
  );
}
```

- [ ] **Step 4: `PagosRecientes` lee por la ruta**

Reemplazar TODO el contenido de `src/components/admin/clientes/PagosRecientes.tsx`
por:

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatearCOP, type Pago, type ProductoContratado } from "@/lib/admin/cartera";
import { Banner } from "@/components/admin/ui/Banner";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

/**
 * Lee por /admin/api (cliente de servidor), no con el SDK de Supabase en el
 * navegador: ese SDK viajaba a /admin/clientes solo por esta lectura.
 * `null` = la lectura falló, que no es lo mismo que "sin pagos".
 */
async function leerPagos(clienteId: string): Promise<Pago[] | null> {
  try {
    const res = await fetch(`/admin/api/clientes/${clienteId}/pagos`);
    if (!res.ok) return null;
    return ((await res.json()) as { pagos: Pago[] }).pagos;
  } catch {
    return null;
  }
}

type Props = {
  clienteId: string;
  /** Los productos del cliente: solo para ponerle nombre a cada pago. */
  productos: ProductoContratado[];
  /** Cambia con cada pago registrado: se vuelven a leer. */
  version: number;
};

/** Los últimos 20 pagos del cliente. */
export function PagosRecientes({ clienteId, productos, version }: Props) {
  // null = primera lectura en curso; "error" = la última lectura falló. Un
  // error nunca se pinta como "sin pagos": es plata.
  const [pagos, setPagos] = useState<Pago[] | "error" | null>(null);

  // Los pagos solo cambian al registrar uno (`version`): en el panel no se
  // borran productos ni pagos, y un producto nuevo nace sin pagos.
  useEffect(() => {
    let activo = true;
    leerPagos(clienteId).then((ps) => {
      if (activo) setPagos(ps ?? "error");
    });
    return () => {
      activo = false;
    };
  }, [clienteId, version]);

  return (
    <Island className="bg-isla-alta/50" titulo="Pagos recientes" aria-label="Pagos recientes">
      {pagos === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : pagos === "error" ? (
        <Banner variante="error">
          No se pudieron cargar los pagos. Cierra la ficha y vuelve a abrirla en un momento.
        </Banner>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-tinta-40">Sin pagos registrados todavía.</p>
      ) : (
        <ul className="barra-fina flex max-h-56 flex-col gap-1 overflow-y-auto">
          {pagos.map((pg) => {
            const producto = productos.find((p) => p.id === pg.producto_id);
            return (
              <li key={pg.id}>
                <ListRow interactiva={false} className="flex flex-col gap-0.5">
                  <span className="text-xs text-tinta-40">
                    {pg.fecha} · {producto?.nombre ?? "producto"}
                  </span>
                  <span className="text-sm text-tinta">
                    {formatearCOP(pg.monto)}
                    {pg.nota ? ` — ${pg.nota}` : ""}
                  </span>
                </ListRow>
              </li>
            );
          })}
        </ul>
      )}
    </Island>
  );
}
```

- [ ] **Step 5: `ClienteModal` pasa el id**

En `src/components/admin/clientes/ClienteModal.tsx`, reemplazar:

```tsx
            <PagosRecientes productos={productos} version={versionPagos} />
```

por:

```tsx
            <PagosRecientes clienteId={cliente.id} productos={productos} version={versionPagos} />
```

(Está dentro de `{cliente ? (…)}`, así que `cliente` no es `null` ahí.)

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint "src/app/admin/api/negocios/[id]/notas/route.ts" "src/app/admin/api/clientes/[id]/pagos/route.ts" src/components/admin/leads/FichaLeadNotas.tsx src/components/admin/clientes/PagosRecientes.tsx src/components/admin/clientes/ClienteModal.tsx`
Expected: sin salida.

Run: `grep -rln "createSupabaseBrowser" src`
Expected: exactamente estas tres líneas, en cualquier orden:
```
src/lib/supabase/browser.ts
src/components/portal/auth/BotonGoogle.tsx
src/components/admin/bots/PlantillasZak.tsx
```

Run: `npm test`
Expected: 680/680 (esta task no agrega tests).

- [ ] **Step 7: Commit**

```bash
git add "src/app/admin/api/negocios/[id]/notas/route.ts" "src/app/admin/api/clientes/[id]/pagos/route.ts" src/components/admin/leads/FichaLeadNotas.tsx src/components/admin/clientes/PagosRecientes.tsx src/components/admin/clientes/ClienteModal.tsx
git commit -m "perf: notas y pagos de las fichas por /admin/api — el SDK de Supabase sale de cuatro rutas del panel"
```

---

### Task 3: "Este negocio ya no existe" en la ficha del chat de Zak (TDD)

**Files:**
- Create: `src/lib/admin/ficha-fetch.ts`
- Test: `src/lib/admin/__tests__/ficha-fetch.test.ts`
- Modify: `src/components/admin/bots/Conversaciones.tsx`: el import (línea
  13), el tipo `FichaFetch` (líneas 77-78), la derivación (líneas 451-458)
  y los props del modal (líneas 470-472).
- Modify: `src/components/admin/leads/FichaLeadModal.tsx`: props y la
  última rama del render (líneas 108-116).

**Interfaces:**
- Consumes: `Negocio` (`src/lib/admin/negocios.ts`, solo tipo).
- Produces:
  - `type FichaFetch = { leadId: string; negocio: Negocio | null; fallo: boolean }`,
    que se muda desde `Conversaciones.tsx`.
  - `type EstadoFicha = { negocio: Negocio | null; cargando: boolean; fallo: boolean; noExiste: boolean }`
  - `estadoFicha(leadId: string | null, ultimo: FichaFetch | null): EstadoFicha`
  - `FichaLeadModal` gana `noExiste?: boolean` (default `false`).

Esta task no toca ningún archivo de las Tasks 1-2.

- [ ] **Step 1: Los tests primero**

Crear `src/lib/admin/__tests__/ficha-fetch.test.ts` con exactamente:

```ts
import { describe, expect, it } from "vitest";
import type { Negocio } from "../negocios";
import { estadoFicha, type FichaFetch } from "../ficha-fetch";

const negocio = { id: "n1", nombre: "Panadería La Espiga" } as Negocio;
const REPOSO = { negocio: null, cargando: false, fallo: false, noExiste: false };

describe("estadoFicha", () => {
  it("modal cerrado: todo en reposo, aunque quede el último fetch en memoria", () => {
    const ultimo: FichaFetch = { leadId: "n1", negocio, fallo: false };
    expect(estadoFicha(null, ultimo)).toEqual(REPOSO);
  });

  it("abierto y sin fetch terminado: cargando", () => {
    expect(estadoFicha("n1", null)).toEqual({ ...REPOSO, cargando: true });
  });

  it("abierto con el fetch de OTRO negocio: cargando, y nunca muestra el otro", () => {
    const ultimo: FichaFetch = { leadId: "n2", negocio: { ...negocio, id: "n2" }, fallo: false };
    expect(estadoFicha("n1", ultimo)).toEqual({ ...REPOSO, cargando: true });
  });

  it("fetch terminado con el negocio: lo muestra", () => {
    expect(estadoFicha("n1", { leadId: "n1", negocio, fallo: false })).toEqual({
      ...REPOSO,
      negocio,
    });
  });

  it("fetch fallido (red, 5xx): fallo, no «ya no existe»", () => {
    expect(estadoFicha("n1", { leadId: "n1", negocio: null, fallo: true })).toEqual({
      ...REPOSO,
      fallo: true,
    });
  });

  it("fetch que respondió bien pero sin negocio (200 con null): ya no existe", () => {
    expect(estadoFicha("n1", { leadId: "n1", negocio: null, fallo: false })).toEqual({
      ...REPOSO,
      noExiste: true,
    });
  });
});
```

- [ ] **Step 2: Correr — deben fallar**

Run: `npx vitest run src/lib/admin/__tests__/ficha-fetch.test.ts`
Expected: FAIL — el import `../ficha-fetch` no resuelve.

- [ ] **Step 3: Implementar `ficha-fetch.ts`**

Crear `src/lib/admin/ficha-fetch.ts` con exactamente:

```ts
import type { Negocio } from "./negocios";

/**
 * Resultado del último fetch de la ficha de un negocio para el modal del chat
 * de Zak (GET /admin/api/negocios/[id]). `negocio: null` con `fallo: false`
 * es la ruta respondiendo bien sin fila: el negocio ya no existe.
 */
export type FichaFetch = { leadId: string; negocio: Negocio | null; fallo: boolean };

/** Lo que el modal necesita saber, derivado del id abierto y del último fetch. */
export type EstadoFicha = {
  negocio: Negocio | null;
  cargando: boolean;
  fallo: boolean;
  noExiste: boolean;
};

/**
 * El fetch "vigente" es el que coincide con el id abierto ahora mismo. Sin id
 * abierto no hay ficha. Con id abierto y sin fetch que coincida, se está
 * cargando: nunca se muestra el negocio de otro id. Derivado y no guardado
 * como estado, para que el efecto que hace el fetch no tenga que hacer
 * setState síncrono al abrir o cerrar (react-hooks/set-state-in-effect).
 */
export function estadoFicha(leadId: string | null, ultimo: FichaFetch | null): EstadoFicha {
  const vigente = leadId !== null && ultimo?.leadId === leadId ? ultimo : null;
  return {
    negocio: vigente?.negocio ?? null,
    cargando: leadId !== null && vigente === null,
    fallo: vigente?.fallo ?? false,
    noExiste: vigente !== null && !vigente.fallo && vigente.negocio === null,
  };
}
```

- [ ] **Step 4: Correr — pasan**

Run: `npx vitest run src/lib/admin/__tests__/ficha-fetch.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: `Conversaciones` usa `estadoFicha`**

En `src/components/admin/bots/Conversaciones.tsx`:

(a) Justo debajo de la línea

```tsx
import { labelEstado, type Negocio } from "@/lib/admin/negocios";
```

agregar:

```tsx
import { estadoFicha, type FichaFetch } from "@/lib/admin/ficha-fetch";
```

(`Negocio` se sigue usando en el efecto del fetch: no quitarlo.)

(b) Borrar estas dos líneas y la línea en blanco que las sigue (hoy
77-79):

```tsx
/** Resultado del último fetch de la ficha de un negocio para el modal del chat. */
type FichaFetch = { leadId: string; negocio: Negocio | null; fallo: boolean };
```

(c) Reemplazar:

```tsx
  // El fetch "vigente" es el que coincide con el id abierto ahora mismo.
  // Sin id abierto no hay ficha; con id abierto y sin fetch que coincida,
  // se está cargando. Al reabrir el MISMO negocio se muestra al instante lo
  // último cargado mientras el efecto refresca por debajo (antes: esqueleto).
  const fetchVigente = leadId !== null && fichaFetch?.leadId === leadId ? fichaFetch : null;
  const negocioFicha = fetchVigente?.negocio ?? null;
  const negocioCargando = leadId !== null && fetchVigente === null;
  const negocioFallo = fetchVigente?.fallo ?? false;
```

por:

```tsx
  // Cargando / fallo / ya no existe se derivan del id abierto y del último
  // fetch que terminó (estadoFicha, con tests). Al reabrir el MISMO negocio
  // se muestra al instante lo último cargado mientras el efecto refresca.
  const ficha = estadoFicha(leadId, fichaFetch);
```

(d) En el `<FichaLeadModal …>` de ese mismo archivo, reemplazar:

```tsx
          negocio={negocioFicha}
          cargando={negocioCargando}
          fallo={negocioFallo}
```

por:

```tsx
          negocio={ficha.negocio}
          cargando={ficha.cargando}
          fallo={ficha.fallo}
          noExiste={ficha.noExiste}
```

- [ ] **Step 6: `FichaLeadModal` gana `noExiste`**

En `src/components/admin/leads/FichaLeadModal.tsx`:

(a) En `type Props`, justo después de la declaración `fallo?: boolean;` (con
su comentario), agregar:

```tsx
  /** true si el dueño resolvió `negocio` por fetch y la respuesta llegó bien
   *  pero sin fila: el negocio se eliminó o el enlace es viejo. Distinto de
   *  `fallo` (no se pudo consultar) y del banner de "no está en la lista". */
  noExiste?: boolean;
```

(b) En la desestructuración de props, reemplazar:

```tsx
  fallo = false,
  vozZak,
```

por:

```tsx
  fallo = false,
  noExiste = false,
  vozZak,
```

(c) Reemplazar la última rama del render:

```tsx
      ) : (
        // La lista de esta pantalla viene topada (TOPE_LEADS): un enlace a un
        // negocio antiguo puede caer fuera de lo cargado. (El dueño que
        // resuelve por fetch solo cae acá si el negocio ya no existe: la ruta
        // responde 200 con `negocio: null`, no un fallo.)
        <Banner variante="error">
          Este negocio no está en la lista cargada en pantalla. Búscalo en su
          territorio o ajusta los filtros.
        </Banner>
      )}
```

por:

```tsx
      ) : noExiste ? (
        // El dueño resuelve por fetch y la ruta respondió bien, sin fila.
        <Banner>Este negocio ya no existe: se eliminó o el enlace es viejo.</Banner>
      ) : (
        // La lista de esta pantalla viene topada (TOPE_LEADS): un enlace a un
        // negocio antiguo puede caer fuera de lo cargado. El dueño que resuelve
        // por fetch no llega acá: pasa `cargando` / `fallo` / `noExiste`.
        <Banner variante="error">
          Este negocio no está en la lista cargada en pantalla. Búscalo en su
          territorio o ajusta los filtros.
        </Banner>
      )}
```

(`<Banner>` sin `variante` es `"aviso"`: no es un error del sistema, es un
dato.)

- [ ] **Step 7: Verificar**

Run: `grep -n "negocioFicha\|negocioCargando\|negocioFallo\|fetchVigente" src/components/admin/bots/Conversaciones.tsx`
Expected: sin salida.

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint src/lib/admin/ficha-fetch.ts src/lib/admin/__tests__/ficha-fetch.test.ts src/components/admin/bots/Conversaciones.tsx src/components/admin/leads/FichaLeadModal.tsx`
Expected: sin salida. En particular, cero `react-hooks/set-state-in-effect`
en `Conversaciones.tsx`: el efecto del fetch no cambia.

Run: `npm test`
Expected: 686/686 (680 + 6).

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin/ficha-fetch.ts src/lib/admin/__tests__/ficha-fetch.test.ts src/components/admin/bots/Conversaciones.tsx src/components/admin/leads/FichaLeadModal.tsx
git commit -m "fix: la ficha del chat de Zak dice que el negocio ya no existe en vez de «no está en la lista» (TDD)"
```

---

### Task 4: Verificación final, con el número que importa

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Suite, tipos, lint**

Run: `npm test`
Expected: 686/686.

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint src/lib/admin/fichas-servidor.ts src/lib/admin/__tests__/fichas-servidor.test.ts "src/app/admin/api/negocios/[id]/notas/route.ts" "src/app/admin/api/clientes/[id]/pagos/route.ts" src/components/admin/leads/FichaLeadNotas.tsx src/components/admin/clientes/PagosRecientes.tsx src/components/admin/clientes/ClienteModal.tsx src/lib/admin/ficha-fetch.ts src/lib/admin/__tests__/ficha-fetch.test.ts src/components/admin/bots/Conversaciones.tsx src/components/admin/leads/FichaLeadModal.tsx`
Expected: sin salida.

- [ ] **Step 2: Build y el diagnóstico de tamaño**

Run: `npm run build`
Expected: build exitoso, y las dos rutas nuevas aparecen en la tabla como
`ƒ` (dinámicas).

Luego:

```bash
node -e '
const s = require("./.next/diagnostics/route-bundle-stats.json");
const fs = require("fs");
const conSupabase = (p) => /X-Client-Info|GoTrueClient|supabase-js/.test(fs.readFileSync(p, "utf8"));
for (const r of ["/admin/prospeccion", "/admin/bots/[id]", "/admin/territorios/[id]", "/admin/clientes", "/admin/zak", "/app/login", "/app/registro"]) {
  const e = s.find((x) => x.route === r);
  const con = e.firstLoadChunkPaths.filter(conSupabase);
  console.log(r, e.firstLoadUncompressedJsBytes, "B | chunks con supabase:", con.length ? con.map((p) => p.split("/").pop()).join(", ") : "NINGUNO");
}'
```

Expected:
- `/admin/prospeccion`, `/admin/bots/[id]`, `/admin/territorios/[id]` y
  `/admin/clientes` → `NINGUNO`, y cada una baja del orden de 250 KB contra
  la línea base del encabezado del plan.
- `/admin/zak`, `/app/login` y `/app/registro` → siguen con el chunk
  (correcto: `PlantillasZak` y `BotonGoogle` lo necesitan).

Reportar la tabla antes → después de las siete rutas. Si alguna de las
cuatro sigue con el chunk: NO arreglar nada. Reportar BLOCKED con la ruta,
el nombre del chunk y el resultado de `grep -rln "@supabase" src --include=*.tsx`.

- [ ] **Step 3: Checklist de QA manual (queda pendiente de verificación humana)**

Escribir en el reporte, textual:

- [ ] `/admin/prospeccion` → abrir un lead: las notas cargan. Anotar una:
      aparece arriba de la lista.
- [ ] Un territorio → abrir un lead y cambiarle el estado: aparece la nota
      automática sin cerrar la ficha.
- [ ] `/admin/zak`, chat con negocio vinculado → "Ver ficha": notas igual
      que antes.
- [ ] `/admin/clientes` → abrir un cliente con pagos: "Pagos recientes"
      muestra los mismos que antes. Registrar un pago: aparece.
- [ ] DevTools → Network → "Offline", y abrir una ficha de lead y una de
      cliente: los banners dicen "No se pudieron cargar las notas…" / "…los
      pagos…", nunca "Todavía no hay notas" ni "Sin pagos registrados
      todavía".
- [ ] En `/admin/zak`, poner en la URL `lead=` con un UUID que no exista
      (p. ej. `00000000-0000-4000-8000-000000000000`): la ficha dice "Este
      negocio ya no existe: se eliminó o el enlace es viejo."
- [ ] `/admin/clientes`, pestaña Network (JS): ningún chunk trae el SDK de
      Supabase.
- [ ] `/admin/zak` → Plantillas: subir un folleto sigue funcionando (el SDK
      sigue ahí a propósito).

- [ ] **Step 4: Commit (solo si hizo falta alguna corrección)**

Solo si algún paso obligó a corregir código: `git add` con los paths
exactos que cambiaron y
`git commit -m "fix: ajuste final del SDK de Supabase fuera del panel"`.
Si todo dio bien no hay nada que commitear: reportar `DONE` igual, sin diff.
