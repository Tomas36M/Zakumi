# Métricas propias + cliente automático + CRUD de leads (Fase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tres cosas del spec que comparten fase porque una alimenta a la
otra: (1) una solicitud que llega a `activa` mueve el negocio a `cliente`
solo; (2) "Métricas" deja de ser una pestaña de Zak y pasa a
`/admin/metricas`, con un embudo de negocios por estado en vez del viejo
contador de "interesados"; (3) los leads que captura el bot (que viven en
un servicio Flask externo) ganan editar/borrar/vincular a un negocio, vía
una tabla-overlay chica en Supabase que nunca toca el Flask.

**Architecture:** (1) reusa el helper `avanzarEstadoNegocio` de la Fase 1
— una columna nueva `solicitudes.negocio_id` (el bot ya sabe con qué
negocio habla) + un hook en `activarSolicitud`. (2) `/admin/metricas` es
una página server component simple (mismo patrón que `/admin/solicitudes`:
`Cockpit`+`PageHeader` directo en la page, sin un shell cliente
intermedio) que hace 6 counts sobre `negocios` para el embudo y trae
`tandas`/`prospectos` para la tasa de respuesta — los mismos datos que
`ZakView.tsx` traía antes, movidos de lugar, no reinventados. (3) los
leads viven en el Flask y no se tocan; una tabla nueva
`leads_overrides` (clave `instancia_id + telefono`) anota
ediciones/borrados-lógicos/vínculos, y el MISMO route handler que ya arma
la respuesta de "actividad" (`/admin/api/bots/[id]/actividad`) hace el
merge server-side con una función pura — el cliente (`Actividad.tsx`)
nunca sabe que el overlay existe, solo ve leads ya mezclados.

**Tech Stack:** Next.js (App Router) + TypeScript + Supabase. Sin
dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md`
(Decisiones 5, 11 y 12 — la sección "Fases" del spec agrupa estas tres en
la Fase 4, aunque la Decisión 5 esté numerada junto a la automatización de
estados de la Fase 1).

## Global Constraints

- **El Flask del bot nunca se escribe.** Todo lo de leads capturados
  (editar/borrar/vincular) escribe SOLO en `leads_overrides`
  (Supabase). El merge pasa por una función pura testeable
  (`mezclarLeads`), no por lógica desparramada en el componente.
- **`solicitudes.negocio_id` puede llegar `null` para siempre** (llamadas
  de voz sin match, o mientras el bot de WhatsApp —fuera de este repo—
  no lo mande). `activarSolicitud` no debe fallar ni comportarse distinto
  cuando es `null`: simplemente no hay negocio que avanzar.
- **`avanzarEstadoNegocio` ya existe** (`src/lib/admin/estado-negocio.ts`,
  Fase 1) — `avanzarEstadoNegocio(supabase, negocioId, nuevoEstado)`, nunca
  lanza, respeta `estado_fijado_manual` y es forward-only. No se reimplementa
  nada de eso acá, solo se llama.
- **`tandas`/`prospectos` como datos se MUDAN, no se duplican.**
  `zak/page.tsx` deja de traerlos (ya no los necesita, Métricas se va) y
  `metricas/page.tsx` los trae en su lugar — el mismo `listarTandas`/
  `listarProspectos` de `@/lib/bots/api`, el mismo cálculo de
  enviados/respondidos/interesados que hacía `ZakView.tsx`.
- Este repo no testea componentes React ni route handlers con vitest
  (`vitest.config.ts`: `environment: "node"`, `include` solo `*.test.ts`).
  Las piezas de lógica pura (`mezclarLeads`, el armado de la fila de
  `registrarSolicitudEntrante`) SÍ llevan TDD — son funciones testeables
  baratas. Los route handlers, server actions y JSX se verifican con
  `npx tsc --noEmit` + `npm run build` + el checklist manual del final,
  igual que en las fases anteriores.

---

## Task 1: SQL — `solicitudes.negocio_id`

**Files:**
- Modify: `supabase/zak-automatizacion.sql`

**Interfaces:**
- Produces: la columna `public.solicitudes.negocio_id uuid references
  public.negocios(id) on delete set null`, que consume la Task 2 y usa la
  Task 4 (leída, no escrita, por `activarSolicitud`).

- [ ] **Step 1: Agregar la columna al archivo existente**

Este archivo ya existe (de la Fase 1, con `negocios.estado_fijado_manual`).
Es idempotente y se corre de nuevo completo en Supabase — no hace falta un
archivo nuevo. Cambiar (contenido actual completo):

```sql
-- supabase/zak-automatizacion.sql
--
-- Automatiza los avances de estado de negocios (ver
-- docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md).
-- Idempotente: solo add column if not exists. Correr en el SQL editor
-- de Supabase — no hay migración automática en este repo.

alter table public.negocios
  add column if not exists estado_fijado_manual boolean not null default false;

comment on column public.negocios.estado_fijado_manual is
  'true en cuanto un humano cambia el estado a mano (FichaNegocio). '
  'Desde ahí la automatización deja el negocio en paz.';
```

por (se agrega el bloque de `solicitudes` al final, el resto queda igual):

```sql
-- supabase/zak-automatizacion.sql
--
-- Automatiza los avances de estado de negocios (ver
-- docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md).
-- Idempotente: solo add column if not exists. Correr en el SQL editor
-- de Supabase — no hay migración automática en este repo.

alter table public.negocios
  add column if not exists estado_fijado_manual boolean not null default false;

comment on column public.negocios.estado_fijado_manual is
  'true en cuanto un humano cambia el estado a mano (FichaNegocio). '
  'Desde ahí la automatización deja el negocio en paz.';

-- Fase 4: vincula una solicitud al negocio de prospección del que salió
-- (cuando se conoce — el bot de WhatsApp todavía no lo manda siempre, ver
-- Decisión 5 del spec). Cuando la solicitud llega a 'activa', esa columna
-- es lo que le dice a activarSolicitud() a qué negocio avanzar a 'cliente'.
alter table public.solicitudes
  add column if not exists negocio_id uuid references public.negocios(id) on delete set null;

create index if not exists solicitudes_negocio_id_idx
  on public.solicitudes (negocio_id) where negocio_id is not null;
```

- [ ] **Step 2: Verificar que el archivo es válido SQL a simple vista**

No hay forma de correr esto contra una base real desde este entorno. Léelo
una vez más: el bloque nuevo tiene `if not exists` en el `alter table` y en
el índice — se puede correr dos veces sin error.

- [ ] **Step 3: Commit**

```bash
git add supabase/zak-automatizacion.sql
git commit -m "feat(db): agrega solicitudes.negocio_id"
```

**Nota para el humano:** correr este archivo (de nuevo, completo) en el SQL
editor de Supabase antes de probar esta fase contra la base real.

---

## Task 2: `Solicitud`/`EntradaSolicitud` ganan `negocio_id`

**Files:**
- Modify: `src/lib/portal/solicitudes.ts`
- Modify: `src/lib/solicitudes/entrada.ts`
- Test: `src/lib/solicitudes/__tests__/entrada.test.ts` (ya existe)

**Interfaces:**
- Produces: `Solicitud.negocio_id: string | null`;
  `EntradaSolicitud.negocioId?: string | null`; la fila que
  `registrarSolicitudEntrante` inserta incluye `negocio_id`. La Task 3
  (el endpoint del bot) y la Task 4 (`activarSolicitud`) consumen esto.

- [ ] **Step 1: Tipo `Solicitud`**

En `src/lib/portal/solicitudes.ts`, dentro del bloque de campos de
"Solicitudes entrantes (voz / WhatsApp)" del tipo `Solicitud` (busca dónde
están `llamada_id`/`conversacion`/`clave_origen` — van agrupados), agregar
un campo nuevo:

```ts
  /** El negocio de prospección del que salió, cuando se conoce (el bot de
   *  WhatsApp no siempre lo manda todavía). Lo usa activarSolicitud() para
   *  avanzar ese negocio a 'cliente' cuando la solicitud se activa. */
  negocio_id: string | null;
```

Agregalo junto a los otros campos de origen (no hace falta que sea
exactamente al final del tipo, pero sí agrupado con `llamada_id`/
`conversacion`/`clave_origen`, no con los campos de cotización/pago).

- [ ] **Step 2: Escribir el test que falla**

En `src/lib/solicitudes/__tests__/entrada.test.ts`, buscá el test
`"agenda y guarda el Meet cuando la fecha es buena"` (o cualquiera que
inspeccione el array `insertado`/la fila armada) y agregá un caso nuevo,
en el mismo `describe` donde estén los demás:

```ts
  it("guarda negocio_id cuando la entrada lo trae", async () => {
    const { cliente, insertado } = supabaseFalso();

    await registrarSolicitudEntrante(
      cliente,
      { ...BASE, negocioId: "11111111-1111-1111-1111-111111111111" },
      { avisar: vi.fn(async () => {}), calendario: calendarioOk, ahora: AHORA },
    );

    expect(insertado[0]).toMatchObject({
      negocio_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("negocio_id queda null cuando la entrada no lo trae", async () => {
    const { cliente, insertado } = supabaseFalso();

    await registrarSolicitudEntrante(cliente, BASE, {
      avisar: vi.fn(async () => {}),
      calendario: calendarioOk,
      ahora: AHORA,
    });

    expect(insertado[0]).toMatchObject({ negocio_id: null });
  });
```

(`BASE`, `supabaseFalso`, `calendarioOk`, `AHORA` ya existen en este
archivo de test — reusalos tal cual, no los redefinas. Si alguno de esos
nombres no existe exactamente así, leé el archivo y adaptá el test al
fixture real que encuentres, manteniendo la misma idea: dos casos, con y
sin `negocioId`.)

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx vitest run src/lib/solicitudes/__tests__/entrada.test.ts`
Expected: FAIL — error de tipos (TS) porque `EntradaSolicitud` todavía no
acepta `negocioId`, y/o el `insertado[0]` no tiene `negocio_id` en runtime.

- [ ] **Step 4: `EntradaSolicitud` y la fila del insert**

En `src/lib/solicitudes/entrada.ts`, cambiar el tipo `EntradaSolicitud`
(agregar el campo, no reemplazar el tipo entero):

```ts
export type EntradaSolicitud = {
  origen: "voz" | "whatsapp";
  claveOrigen: string;
  contacto: { nombre?: string | null; telefono?: string | null; email?: string | null };
  servicioInteres?: string | null;
  detalle?: string | null;
  mejorHorario?: string | null;
  citaCruda?: unknown;
  llamadaId?: string | null;
  conversacion?: string | null;
};
```

por:

```ts
export type EntradaSolicitud = {
  origen: "voz" | "whatsapp";
  claveOrigen: string;
  contacto: { nombre?: string | null; telefono?: string | null; email?: string | null };
  servicioInteres?: string | null;
  detalle?: string | null;
  mejorHorario?: string | null;
  citaCruda?: unknown;
  llamadaId?: string | null;
  conversacion?: string | null;
  /** El negocio de prospección del que salió, si se conoce. */
  negocioId?: string | null;
};
```

Y el objeto `fila` que arma el insert:

```ts
  const fila = {
    user_id: null,
    origen: entrada.origen,
    estado: "nueva",
    servicio_slug: slug,
    mensaje: detalle,
    contacto_nombre: nombre,
    contacto_telefono: telefono,
    contacto_email: email,
    llamada_id: entrada.llamadaId ?? null,
    conversacion: limpio(entrada.conversacion, TOPE_CONVERSACION),
    clave_origen: entrada.claveOrigen,
    cita_inicio: cita?.inicio ?? null,
    cita_fin: cita?.fin ?? null,
    cita_texto_crudo: cita ? null : citaCrudaTexto,
  };
```

por:

```ts
  const fila = {
    user_id: null,
    origen: entrada.origen,
    estado: "nueva",
    servicio_slug: slug,
    mensaje: detalle,
    contacto_nombre: nombre,
    contacto_telefono: telefono,
    contacto_email: email,
    llamada_id: entrada.llamadaId ?? null,
    conversacion: limpio(entrada.conversacion, TOPE_CONVERSACION),
    clave_origen: entrada.claveOrigen,
    cita_inicio: cita?.inicio ?? null,
    cita_fin: cita?.fin ?? null,
    cita_texto_crudo: cita ? null : citaCrudaTexto,
    negocio_id: entrada.negocioId ?? null,
  };
```

No tocar nada más de la función (el manejo de errores, la lógica de
calendario/aviso quedan intactos — `negocio_id` es un campo más del
insert, ortogonal a todo eso).

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx vitest run src/lib/solicitudes/__tests__/entrada.test.ts`
Expected: PASS (todos, incluidos los 2 casos nuevos).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores relacionados a estos dos archivos (puede haber
errores en `src/lib/admin/solicitudes-actions.ts` si algo más adelante en
este plan ya lo tocó fuera de orden — no debería, esta es la Task 2).

- [ ] **Step 7: Commit**

```bash
git add src/lib/portal/solicitudes.ts src/lib/solicitudes/entrada.ts src/lib/solicitudes/__tests__/entrada.test.ts
git commit -m "feat: Solicitud y EntradaSolicitud ganan negocio_id"
```

---

## Task 3: `/api/zak/solicitud` lee `negocio_id` del payload del bot

**Files:**
- Modify: `src/app/api/zak/solicitud/route.ts`

**Interfaces:**
- Consumes: `EntradaSolicitud.negocioId` de la Task 2.
- Produces: el endpoint acepta un campo `negocio_id` opcional en el body
  y lo pasa a `registrarSolicitudEntrante`. **El bot de WhatsApp (fuera de
  este repo) todavía no lo manda** — hasta que ese bot se actualice, este
  campo llega `undefined` siempre y `negocio_id` queda `null` en la fila,
  exactamente el comportamiento de hoy. Este paso deja el lado de Zakumi
  listo, no depende de que el otro repo cambie primero.

- [ ] **Step 1: Leer el campo del body**

Buscá en el archivo el bloque que arma la llamada a
`registrarSolicitudEntrante` (usa el helper `texto()` para los demás
campos opcionales del body, ej. `texto(b.nombre)`, `texto(b.email)`). Junto
a esos, agregar una línea que lea `negocio_id`:

```ts
  const negocioId = texto(b.negocio_id);
```

Y sumarlo al objeto que se le pasa a `registrarSolicitudEntrante`:

```ts
  const r = await registrarSolicitudEntrante(supabase, {
    origen: "whatsapp",
    claveOrigen: `wa:${ref}`,
    contacto: { nombre: texto(b.nombre), telefono, email: texto(b.email) },
    servicioInteres: texto(b.servicio),
    detalle: texto(b.detalle),
    mejorHorario: texto(b.mejor_horario),
    citaCruda: b.cita,
    conversacion: telefono,
    negocioId,
  });
```

Leé el archivo primero para confirmar el nombre exacto de la variable que
guarda el body parseado (en la investigación aparece como `b`) y el
`texto()` helper (ya definido en el archivo) antes de escribir el diff
exacto — la forma de arriba es el objetivo, no una cita literal línea por
línea.

- [ ] **Step 2: Actualizar el comentario del contrato del body**

El archivo documenta el shape esperado del body en un comentario cerca del
top (`{ telefono, ref?, nombre?, email?, servicio?, detalle?,
mejor_horario?, cita? }`). Agregarle `negocio_id?` a esa lista, para que
quien lea el archivo (o actualice el bot Flask del otro lado) sepa que
existe.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/zak/solicitud/route.ts
git commit -m "feat: /api/zak/solicitud acepta negocio_id del bot"
```

---

## Task 4: `activarSolicitud` avanza el negocio a `cliente`

**Files:**
- Modify: `src/lib/admin/solicitudes-actions.ts`

**Interfaces:**
- Consumes: `avanzarEstadoNegocio` de `./estado-negocio` (Fase 1);
  `Solicitud.negocio_id` de la Task 2.
- Produces: sin cambio de firma pública de `activarSolicitud`.

**Nota de alcance:** no hay test para `activarSolicitud` hoy (server
action con `verifySession()`, pagos, cartera — dependencias pesadas). Se
verifica por lectura cuidadosa + typecheck + el checklist manual del
final, igual que las tareas de wiring de fases anteriores.

- [ ] **Step 1: Importar el helper**

En `src/lib/admin/solicitudes-actions.ts`, agregar a los imports:

```ts
import { avanzarEstadoNegocio } from "./estado-negocio";
```

- [ ] **Step 2: Disparar el avance tras cerrar la solicitud**

Dentro de `activarSolicitud`, el "Paso 4" (el cierre) hace:

```ts
  // 4. Cerrar el ciclo.
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: "activa" })
    .eq("id", id);
  if (error) {
    console.error("[activarSolicitud] estado", error.message);
    return { error: "El servicio quedó creado pero la solicitud no cerró. Reintenta." };
  }
```

Cambiar por:

```ts
  // 4. Cerrar el ciclo.
  const { error } = await supabase
    .from("solicitudes")
    .update({ estado: "activa" })
    .eq("id", id);
  if (error) {
    console.error("[activarSolicitud] estado", error.message);
    return { error: "El servicio quedó creado pero la solicitud no cerró. Reintenta." };
  }

  if (sol.negocio_id) {
    await avanzarEstadoNegocio(supabase, sol.negocio_id, "cliente");
  }
```

`sol` es la fila obtenida al principio de la función (antes del paso 1) —
ya tiene `negocio_id` disponible sin un fetch extra, gracias a la Task 2.
Leé el archivo primero para confirmar el nombre exacto de esa variable
(aparece como `sol` en la investigación previa) antes de escribir el diff.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/solicitudes-actions.ts
git commit -m "feat: activarSolicitud avanza el negocio a cliente"
```

---

## Task 5: SQL — tabla `leads_overrides`

**Files:**
- Create: `supabase/leads-overrides.sql`

**Interfaces:**
- Produces: la tabla `public.leads_overrides` que consumen las Tasks 6-8.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/leads-overrides.sql
--
-- Overlay local para los leads que captura el bot de WhatsApp (viven en su
-- base Flask, no en Supabase — ver docs/superpowers/specs/2026-09-13-
-- consola-zak-rediseno-design.md, Decisión 12). Esta tabla nunca es la
-- fuente de verdad de un lead: solo anota ediciones, borrados lógicos y
-- vínculos a un negocio de prospección, por instancia+teléfono. El Flask
-- no se toca nunca desde acá.
--
-- Idempotente. Correr en el SQL editor de Supabase, después de
-- supabase/zak-automatizacion.sql (referencia negocios.id).

create table if not exists public.leads_overrides (
  instancia_id   integer not null,
  telefono       text not null,
  datos_editados jsonb,
  negocio_id     uuid references public.negocios(id) on delete set null,
  borrado        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (instancia_id, telefono)
);

alter table public.leads_overrides enable row level security;

-- Mismo helper que ya usa el resto del admin-only (supabase/perfiles.sql):
-- STABLE + security definer, se llama como (select es_admin()) para que
-- Postgres lo evalúe una sola vez por statement (initplan).
create policy leads_overrides_solo_admin on public.leads_overrides
  for all using ((select public.es_admin()))
  with check ((select public.es_admin()));
```

- [ ] **Step 2: Verificar que el archivo es válido SQL a simple vista**

No hay forma de correrlo contra una base real desde acá. Releelo: la
tabla, el índice implícito de la primary key, RLS habilitada, una sola
policy `for all` con el mismo check de lectura y escritura.

- [ ] **Step 3: Commit**

```bash
git add supabase/leads-overrides.sql
git commit -m "feat(db): tabla leads_overrides (overlay de CRUD para leads del Flask)"
```

**Nota para el humano:** correr este archivo en el SQL editor de Supabase
antes de probar esta fase contra la base real.

---

## Task 6: `mezclarLeads` — la función pura del overlay

**Files:**
- Create: `src/lib/admin/leads-overrides.ts`
- Test: `src/lib/admin/__tests__/leads-overrides.test.ts`

**Interfaces:**
- Consumes: `Lead` de `@/lib/bots/tipos` (`{ phone: string; datos:
  Record<string, unknown> }`).
- Produces:
  - `type LeadOverride = { instancia_id: number; telefono: string;
    datos_editados: Record<string, unknown> | null; negocio_id: string |
    null; borrado: boolean }`
  - `type LeadConOverride = { phone: string; datos: Record<string,
    unknown>; negocioId: string | null }`
  - `mezclarLeads(leads: Lead[], overrides: LeadOverride[]):
    LeadConOverride[]`
  Las Tasks 7-9 consumen estos tipos y esta función.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/admin/__tests__/leads-overrides.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mezclarLeads, type LeadOverride } from "../leads-overrides";
import type { Lead } from "@/lib/bots/tipos";

function lead(extra: Partial<Lead>): Lead {
  return { phone: "573001112233", datos: { nombre: "Ana" }, ...extra };
}

function override(extra: Partial<LeadOverride>): LeadOverride {
  return {
    instancia_id: 1,
    telefono: "573001112233",
    datos_editados: null,
    negocio_id: null,
    borrado: false,
    ...extra,
  };
}

describe("mezclarLeads", () => {
  it("un lead sin override pasa igual, con negocioId null", () => {
    const r = mezclarLeads([lead({})], []);
    expect(r).toEqual([{ phone: "573001112233", datos: { nombre: "Ana" }, negocioId: null }]);
  });

  it("un lead con datos_editados usa los editados, no los originales", () => {
    const r = mezclarLeads(
      [lead({ datos: { nombre: "Ana", necesidad: "web" } })],
      [override({ datos_editados: { nombre: "Ana María" } })],
    );
    expect(r[0]!.datos).toEqual({ nombre: "Ana María" });
  });

  it("un lead con borrado:true se excluye del resultado", () => {
    const r = mezclarLeads(
      [lead({ phone: "a" }), lead({ phone: "b" })],
      [override({ telefono: "a", borrado: true })],
    );
    expect(r.map((l) => l.phone)).toEqual(["b"]);
  });

  it("un lead con negocio_id trae negocioId en el resultado", () => {
    const r = mezclarLeads(
      [lead({})],
      [override({ negocio_id: "11111111-1111-1111-1111-111111111111" })],
    );
    expect(r[0]!.negocioId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("un override de un teléfono que no está en leads no genera nada", () => {
    const r = mezclarLeads([lead({ phone: "a" })], [override({ telefono: "z" })]);
    expect(r).toHaveLength(1);
    expect(r[0]!.phone).toBe("a");
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run src/lib/admin/__tests__/leads-overrides.test.ts`
Expected: FAIL — `Cannot find module '../leads-overrides'`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `src/lib/admin/leads-overrides.ts`:

```ts
// El overlay de leads: los datos crudos viven en el Flask del bot (ver
// src/lib/bots/api.ts), esta tabla solo anota ediciones/borrados
// lógicos/vínculos a un negocio, por instancia+teléfono. El merge es puro
// para poder testearlo sin levantar nada — lo llama el route handler de
// actividad (src/app/admin/api/bots/[id]/actividad/route.ts). SOLO SERVIDOR.

import type { Lead } from "@/lib/bots/tipos";

export type LeadOverride = {
  instancia_id: number;
  telefono: string;
  datos_editados: Record<string, unknown> | null;
  negocio_id: string | null;
  borrado: boolean;
};

export type LeadConOverride = {
  phone: string;
  datos: Record<string, unknown>;
  /** El negocio vinculado a mano, si lo hay — nunca viene del Flask. */
  negocioId: string | null;
};

/**
 * Mezcla los leads crudos del Flask con sus overrides locales: oculta lo
 * borrado, pisa los campos editados, resuelve el negocio vinculado. El
 * Flask nunca se toca — esta función solo lee.
 */
export function mezclarLeads(leads: Lead[], overrides: LeadOverride[]): LeadConOverride[] {
  const porTelefono = new Map(overrides.map((o) => [o.telefono, o]));
  const resultado: LeadConOverride[] = [];
  for (const l of leads) {
    const o = porTelefono.get(l.phone);
    if (o?.borrado) continue;
    resultado.push({
      phone: l.phone,
      datos: o?.datos_editados ?? l.datos,
      negocioId: o?.negocio_id ?? null,
    });
  }
  return resultado;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run src/lib/admin/__tests__/leads-overrides.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/leads-overrides.ts src/lib/admin/__tests__/leads-overrides.test.ts
git commit -m "feat: mezclarLeads — el merge puro del overlay de leads"
```

---

## Task 7: Server actions — editar, borrar, vincular un lead

**Files:**
- Create: `src/lib/admin/leads-actions.ts`

**Interfaces:**
- Consumes: nada de las tareas anteriores directamente (escribe en la
  tabla de la Task 5, sin pasar por `mezclarLeads`).
- Produces:
  - `editarLead(instanciaId: number, telefono: string, datos:
    Record<string, unknown>): Promise<{ error: string | null }>`
  - `borrarLead(instanciaId: number, telefono: string): Promise<{ error:
    string | null }>`
  - `vincularLead(instanciaId: number, telefono: string, negocioId:
    string | null): Promise<{ error: string | null }>`
  La Task 9 (UI de `Actividad.tsx`) llama a estas tres.

**Nota de alcance:** sin test dedicado (server actions con
`verifySession()`, mismo criterio que el resto de `src/lib/admin/
*-actions.ts` en este repo) — se verifica por lectura + typecheck + el
checklist manual del final.

- [ ] **Step 1: Escribir el archivo completo**

```ts
"use server";

// Las tres formas de tocar un lead sin tocar el Flask: todo escribe en
// leads_overrides (Supabase). El merge con los datos crudos del bot lo
// hace mezclarLeads() del lado de lectura (src/lib/admin/leads-overrides.ts),
// no acá.

import { revalidatePath } from "next/cache";
import { verifySession } from "./dal";

function claveValida(
  instanciaId: unknown,
  telefono: unknown,
): instanciaId is number {
  return (
    Number.isInteger(instanciaId) &&
    (instanciaId as number) > 0 &&
    typeof telefono === "string" &&
    telefono.length > 0 &&
    telefono.length < 40
  );
}

export async function editarLead(
  instanciaId: number,
  telefono: string,
  datos: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!claveValida(instanciaId, telefono)) return { error: "Lead no válido." };

  const { error } = await supabase
    .from("leads_overrides")
    .upsert(
      { instancia_id: instanciaId, telefono, datos_editados: datos },
      { onConflict: "instancia_id,telefono" },
    );
  if (error) {
    console.error("[editarLead]", error.message);
    return { error: "No se pudo guardar la edición." };
  }
  revalidatePath("/admin/metricas");
  return { error: null };
}

export async function borrarLead(
  instanciaId: number,
  telefono: string,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!claveValida(instanciaId, telefono)) return { error: "Lead no válido." };

  const { error } = await supabase
    .from("leads_overrides")
    .upsert(
      { instancia_id: instanciaId, telefono, borrado: true },
      { onConflict: "instancia_id,telefono" },
    );
  if (error) {
    console.error("[borrarLead]", error.message);
    return { error: "No se pudo borrar el lead." };
  }
  revalidatePath("/admin/metricas");
  return { error: null };
}

export async function vincularLead(
  instanciaId: number,
  telefono: string,
  negocioId: string | null,
): Promise<{ error: string | null }> {
  const { supabase } = await verifySession();
  if (!claveValida(instanciaId, telefono)) return { error: "Lead no válido." };

  const { error } = await supabase
    .from("leads_overrides")
    .upsert(
      { instancia_id: instanciaId, telefono, negocio_id: negocioId },
      { onConflict: "instancia_id,telefono" },
    );
  if (error) {
    console.error("[vincularLead]", error.message);
    return { error: "No se pudo vincular el negocio." };
  }
  revalidatePath("/admin/metricas");
  return { error: null };
}
```

(`upsert` con `onConflict` solo actualiza las columnas que se le pasan —
Postgres `ON CONFLICT ... DO UPDATE SET` no toca columnas ausentes del
payload. Por eso `editarLead`/`vincularLead`/`borrarLead` pueden llamarse
en cualquier orden sobre el mismo lead sin pisarse entre sí: `vincularLead`
después de `editarLead` no borra `datos_editados`, por ejemplo.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/leads-actions.ts
git commit -m "feat: server actions editarLead/borrarLead/vincularLead"
```

---

## Task 8: El route handler de actividad mezcla los overrides

**Files:**
- Modify: `src/app/admin/api/bots/[id]/actividad/route.ts`

**Interfaces:**
- Consumes: `mezclarLeads`/`LeadOverride` de la Task 6.
- Produces: la respuesta de `GET /admin/api/bots/:id/actividad` cambia su
  campo `leads` de `Lead[]` a `LeadConOverride[]` (mismo `phone`/`datos`,
  más `negocioId`). La Task 9 (cliente) consume esta forma nueva.

- [ ] **Step 1: Importar y usar `mezclarLeads`**

El archivo completo hoy:

```ts
import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { jobsFallidos, listarLeads, statusInstancia } from "@/lib/bots/api";

// Uso de hoy + jobs fallidos + leads en una sola llamada del panel.
// Degradable por partes: si jobs o leads fallan, van vacíos (queda en el log);
// solo el status tumba la respuesta porque sin él no hay nada que pintar.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) {
    return NextResponse.json({ error: "bot_invalido" }, { status: 400 });
  }

  const [status, jobs, leads] = await Promise.all([
    statusInstancia(iid),
    jobsFallidos(iid),
    listarLeads(iid),
  ]);

  if (!status.ok) {
    return NextResponse.json({ error: status.error }, { status: 502 });
  }
  return NextResponse.json({
    status: status.data,
    jobs: jobs.ok ? jobs.data : [],
    leads: leads.ok ? leads.data : [],
  });
}
```

Cambiar por:

```ts
import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { jobsFallidos, listarLeads, statusInstancia } from "@/lib/bots/api";
import { mezclarLeads, type LeadOverride } from "@/lib/admin/leads-overrides";

// Uso de hoy + jobs fallidos + leads (ya mezclados con sus overrides
// locales) en una sola llamada del panel. Degradable por partes: si jobs
// o leads fallan, van vacíos (queda en el log); solo el status tumba la
// respuesta porque sin él no hay nada que pintar.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const iid = Number(id);
  if (!Number.isInteger(iid) || iid <= 0) {
    return NextResponse.json({ error: "bot_invalido" }, { status: 400 });
  }

  const [status, jobs, leads, overrides] = await Promise.all([
    statusInstancia(iid),
    jobsFallidos(iid),
    listarLeads(iid),
    sesion.supabase.from("leads_overrides").select("*").eq("instancia_id", iid),
  ]);

  if (!status.ok) {
    return NextResponse.json({ error: status.error }, { status: 502 });
  }
  const leadsCrudos = leads.ok ? leads.data : [];
  const overridesData = (overrides.data ?? []) as LeadOverride[];
  return NextResponse.json({
    status: status.data,
    jobs: jobs.ok ? jobs.data : [],
    leads: mezclarLeads(leadsCrudos, overridesData),
  });
}
```

(Si `overrides.error` no es null porque la tabla todavía no existe en la
base contra la que se prueba — falta correr la Task 5 en Supabase —
`overrides.data` viene `null` y `overridesData` queda `[]`: se degrada a
"como si no hubiera overrides", no rompe la respuesta. Coherente con el
resto del handler, que ya degrada por partes.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errores esperados en `src/components/admin/bots/Actividad.tsx`
(su tipo `Datos.leads: Lead[]` ya no coincide con la forma nueva
`LeadConOverride[]`) — la Task 9 los resuelve. Anotalos en tu reporte, no
los arregles acá.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/api/bots/[id]/actividad/route.ts"
git commit -m "feat: el endpoint de actividad mezcla los leads con sus overrides"
```

---

## Task 9: `Actividad.tsx` — editar, borrar, vincular desde la UI

**Files:**
- Modify: `src/components/admin/bots/Actividad.tsx`

**Interfaces:**
- Consumes: `LeadConOverride` (Task 6), `editarLead`/`borrarLead`/
  `vincularLead` (Task 7), el `negocioId` que ahora trae cada lead de la
  Task 8.
- Produces: sin cambio de firma pública (`{ instanciaId: number }`).

**Nota de alcance:** sin test (componente React). Se verifica con
`npx tsc --noEmit` + el checklist manual del final.

- [ ] **Step 1: Imports y tipo `Datos`**

Cambiar (líneas 1-25 del archivo actual):

```tsx
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { reintentarJob } from "@/lib/admin/bots-actions";
import { fechaCorta } from "@/lib/admin/formato";
import {
  esLabs,
  type JobFallido,
  type Lead,
  type StatusInstancia,
} from "@/lib/bots/tipos";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

type Props = { instanciaId: number };

type Datos = {
  status: StatusInstancia;
  jobs: JobFallido[];
  leads: Lead[];
};
```

por:

```tsx
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { borrarLead, editarLead, vincularLead } from "@/lib/admin/leads-actions";
import { reintentarJob } from "@/lib/admin/bots-actions";
import { fechaCorta } from "@/lib/admin/formato";
import { labelEstado } from "@/lib/admin/negocios";
import type { LeadConOverride } from "@/lib/admin/leads-overrides";
import { type FichaNegocio } from "@/lib/admin/zak";
import { esLabs, type JobFallido, type StatusInstancia } from "@/lib/bots/tipos";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Island } from "@/components/admin/ui/Island";
import { Input } from "@/components/admin/ui/Field";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { Trash2, X } from "lucide-react";

type Props = { instanciaId: number };

type Datos = {
  status: StatusInstancia;
  jobs: JobFallido[];
  leads: LeadConOverride[];
};
```

- [ ] **Step 2: Estado y handlers nuevos dentro de `Actividad`**

Después de la línea `const [operando, startOperar] = useTransition();`
(línea 41 del archivo actual), agregar:

```tsx
  const { confirmar, dialogo } = useConfirmar();
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<string | null>(null);
  const [busquedaNegocio, setBusquedaNegocio] = useState("");
  const [resultadosNegocio, setResultadosNegocio] = useState<FichaNegocio[]>([]);
```

Y, junto a la función `reintentar` (que ya existe), agregar estas tres:

```tsx
  function abrirEdicion(l: LeadConOverride) {
    setEditando(l.phone);
    setErrorEdit(null);
    setTextoEdit(JSON.stringify(l.datos, null, 2));
  }

  function guardarEdicion(phone: string) {
    let datos: Record<string, unknown>;
    try {
      datos = JSON.parse(textoEdit) as Record<string, unknown>;
    } catch {
      setErrorEdit("Eso no es JSON válido.");
      return;
    }
    setErrorEdit(null);
    startOperar(async () => {
      const res = await editarLead(instanciaId, phone, datos);
      if (res.error) {
        setErrorEdit(res.error);
        return;
      }
      setEditando(null);
      await cargar();
    });
  }

  async function borrar(phone: string) {
    const ok = await confirmar({
      titulo: "¿Borrar este lead?",
      mensaje: "Se oculta de esta lista — no toca nada en el bot.",
      accion: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    startOperar(async () => {
      const res = await borrarLead(instanciaId, phone);
      if (res.error) {
        setAvisoJob(res.error);
        return;
      }
      await cargar();
    });
  }

  function abrirVinculo(phone: string) {
    setVinculando(phone);
    setBusquedaNegocio("");
    setResultadosNegocio([]);
  }

  async function buscarNegocio(q: string) {
    setBusquedaNegocio(q);
    if (q.trim().length < 2) {
      setResultadosNegocio([]);
      return;
    }
    try {
      const res = await fetch(`/admin/api/zak/negocios?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { fichas: FichaNegocio[] };
      setResultadosNegocio(data.fichas);
    } catch {
      setResultadosNegocio([]);
    }
  }

  function vincular(phone: string, negocioId: string | null) {
    startOperar(async () => {
      const res = await vincularLead(instanciaId, phone, negocioId);
      if (res.error) {
        setAvisoJob(res.error);
        return;
      }
      setVinculando(null);
      await cargar();
    });
  }
```

(`cargar`/`avisoJob`/`setAvisoJob`/`operando`/`startOperar` ya existen en
el archivo — se reusan tal cual, no se redefinen. `useConfirmar` ya se usa
en otros componentes del panel, ej. `Conversaciones.tsx`, con este mismo
patrón `const { confirmar, dialogo } = useConfirmar();`.)

- [ ] **Step 3: Renderizar `{dialogo}`**

En el `return` del componente, justo antes del primer `<div>` (donde hoy
arranca `<div className="flex flex-col gap-aire">`), agregar `{dialogo}`:

```tsx
  return (
    <>
      {dialogo}
      <div className="flex flex-col gap-aire">
```

Y cerrar el fragment al final del `return` (donde hoy cierra el único
`</div>` exterior, agregarle `</>` después).

- [ ] **Step 4: La lista de "Leads capturados" gana acciones**

Cambiar el bloque de "Leads capturados" (el `<Island titulo="Leads
capturados">` con su `<ul>` de `datos.leads.map`):

```tsx
      <Island className="bg-isla-alta/50" titulo="Leads capturados">
        {datos.leads.length === 0 ? (
          <p className="text-sm text-tinta-40">Todavía no hay leads.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {datos.leads.map((l, i) => (
              <li key={`${l.phone}-${i}`}>
                <ListRow interactiva={false} className="text-sm text-tinta">
                  <strong>{l.phone}</strong>
                  {esLabs(l.phone) && (
                    <Badge tono="neutro" className="ml-1.5">
                      Prueba
                    </Badge>
                  )}
                  <span className="text-tinta-60"> — {resumenLead(l.datos)}</span>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>
```

por:

```tsx
      <Island className="bg-isla-alta/50" titulo="Leads capturados">
        {datos.leads.length === 0 ? (
          <p className="text-sm text-tinta-40">Todavía no hay leads.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {datos.leads.map((l, i) => (
              <li key={`${l.phone}-${i}`}>
                <ListRow interactiva={false} className="flex-col items-stretch gap-2 text-sm text-tinta">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong>{l.phone}</strong>
                    {esLabs(l.phone) && <Badge tono="neutro">Prueba</Badge>}
                    {l.negocioId && <Badge tono="neutro">vinculado a un negocio</Badge>}
                    <span className="text-tinta-60"> — {resumenLead(l.datos)}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button disabled={operando} onClick={() => abrirEdicion(l)}>
                        Editar
                      </Button>
                      <Button disabled={operando} onClick={() => abrirVinculo(l.phone)}>
                        {l.negocioId ? "Cambiar negocio" : "Vincular a negocio"}
                      </Button>
                      <IconButton
                        etiqueta="Borrar lead"
                        disabled={operando}
                        onClick={() => void borrar(l.phone)}
                        className="hover:bg-peligro/10 hover:text-peligro"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>

                  {editando === l.phone && (
                    <div className="flex flex-col gap-2 rounded-fila border border-hairline p-3">
                      {errorEdit && <Banner variante="error">{errorEdit}</Banner>}
                      <textarea
                        className="min-h-32 rounded-fila border border-hairline bg-isla p-2 font-mono text-xs text-tinta"
                        value={textoEdit}
                        onChange={(e) => setTextoEdit(e.target.value)}
                        disabled={operando}
                      />
                      <div className="flex gap-2">
                        <Button
                          variante="primaria"
                          disabled={operando}
                          onClick={() => guardarEdicion(l.phone)}
                        >
                          Guardar
                        </Button>
                        <Button disabled={operando} onClick={() => setEditando(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {vinculando === l.phone && (
                    <div className="flex flex-col gap-2 rounded-fila border border-hairline p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          placeholder="Buscar negocio por nombre…"
                          value={busquedaNegocio}
                          onChange={(e) => void buscarNegocio(e.target.value)}
                          disabled={operando}
                          autoFocus
                        />
                        {l.negocioId && (
                          <Button disabled={operando} onClick={() => vincular(l.phone, null)}>
                            Quitar vínculo
                          </Button>
                        )}
                        <IconButton etiqueta="Cancelar" onClick={() => setVinculando(null)}>
                          <X className="h-4 w-4" />
                        </IconButton>
                      </div>
                      {resultadosNegocio.length > 0 && (
                        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                          {resultadosNegocio.map((f) => (
                            <li key={f.negocioId}>
                              <button
                                type="button"
                                className="flex w-full flex-col gap-0.5 rounded-fila px-3 py-2 text-left text-sm hover:bg-isla"
                                onClick={() => vincular(l.phone, f.negocioId)}
                                disabled={operando}
                              >
                                <span className="flex items-center gap-1.5 font-medium text-tinta">
                                  {f.nombre}
                                  <Badge tono="neutro">{f.verticalLabel}</Badge>
                                  <Badge tono={f.estado}>{labelEstado(f.estado)}</Badge>
                                </span>
                                <span className="text-xs text-tinta-40">{f.telefono}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Island>
```

(`FichaNegocio` — el tipo, de `@/lib/admin/zak` — ya trae `negocioId`,
`nombre`, `verticalLabel`, `estado`, `telefono`; es exactamente lo que
devuelve `/admin/api/zak/negocios?q=`, el mismo endpoint que ya usa
`NuevoChatZak.tsx` para buscar un negocio por nombre — este paso calca ese
patrón de búsqueda, no inventa uno nuevo.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores (esto resuelve los errores que la Task 8 dejó
pendientes a propósito).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/bots/Actividad.tsx
git commit -m "feat: Actividad — editar, borrar y vincular un lead a un negocio"
```

---

## Task 10: `/admin/metricas` — la página nueva

**Files:**
- Create: `src/app/admin/(panel)/metricas/page.tsx`
- Create: `src/components/admin/metricas/EmbudoEstados.tsx`
- Modify: `src/components/admin/Sidebar.tsx`

**Interfaces:**
- Consumes: `ESTADOS`/`labelEstado`/`EstadoNegocio` de
  `@/lib/admin/negocios`; `listarTandas`/`listarProspectos` de
  `@/lib/bots/api`; el componente `Actividad` (ya existe, ganó CRUD en la
  Task 9).
- Produces: la ruta `/admin/metricas`, alcanzable desde el Sidebar.

- [ ] **Step 1: `EmbudoEstados.tsx` — el componente del embudo**

Crear `src/components/admin/metricas/EmbudoEstados.tsx`:

```tsx
import { ESTADOS, type EstadoNegocio } from "@/lib/admin/negocios";

type Props = {
  conteos: Record<EstadoNegocio, number>;
};

/** Cuántos negocios hay en cada paso del pipeline — reemplaza el viejo
 *  contador suelto de "interesados" del header de Zak. */
export function EmbudoEstados({ conteos }: Props) {
  return (
    <div className="grid grid-cols-2 gap-aire min-[720px]:grid-cols-3 min-[1100px]:grid-cols-6">
      {ESTADOS.map((e) => (
        <div key={e.valor} className="rounded-fila bg-isla-alta px-4 py-3">
          <span className="block text-2xl font-semibold text-tinta">{conteos[e.valor]}</span>
          <span className="text-xs text-tinta-60">{e.label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `page.tsx` — la página**

Crear `src/app/admin/(panel)/metricas/page.tsx`. Antes de escribirlo, leé
`src/app/admin/(panel)/solicitudes/page.tsx` completo — es la referencia
exacta a calcar (Server Component que hace `verifySession()` primero,
resuelve sus datos, y arma `<Cockpit><PageHeader/><CockpitBody>...`
directo, sin un shell cliente intermedio).

```tsx
import { verifySession } from "@/lib/admin/dal";
import { ESTADOS, type EstadoNegocio } from "@/lib/admin/negocios";
import { listarProspectos, listarTandas } from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Actividad } from "@/components/admin/bots/Actividad";
import { EmbudoEstados } from "@/components/admin/metricas/EmbudoEstados";

export const metadata = { title: "Métricas" };

export default async function MetricasPage() {
  const { supabase } = await verifySession();

  const [tandas, prospectos, ...conteos] = await Promise.all([
    listarTandas(ID_ZAK),
    listarProspectos(ID_ZAK),
    ...ESTADOS.map((e) =>
      supabase.from("negocios").select("*", { count: "exact", head: true }).eq("estado", e.valor),
    ),
  ]);

  const embudo = Object.fromEntries(
    ESTADOS.map((e, i) => [e.valor, conteos[i]?.count ?? 0]),
  ) as Record<EstadoNegocio, number>;

  const tandasData = tandas.ok ? tandas.data : [];
  const prospectosData = prospectos.ok ? prospectos.data : [];
  const enviados = tandasData.reduce(
    (t, x) => t + x.funnel.enviado + x.funnel.entregado + x.funnel.leido + x.funnel.respondido,
    0,
  );
  const respondidos = tandasData.reduce((t, x) => t + x.funnel.respondido, 0);
  const interesados = prospectosData.filter((p) => p.interesado).length;
  const tasa = enviados > 0 ? Math.round((respondidos / enviados) * 100) : 0;

  return (
    <Cockpit>
      <PageHeader
        titulo="Métricas"
        coletilla="cómo le está yendo a Zak"
        contador={
          <>
            {tasa}% tasa de respuesta ({respondidos}/{enviados}) · {interesados} interesados
          </>
        }
      />
      <CockpitBody>
        <div className="flex flex-col gap-aire p-5">
          <EmbudoEstados conteos={embudo} />
          <Actividad instanciaId={ID_ZAK} />
        </div>
      </CockpitBody>
    </Cockpit>
  );
}
```

Si al leer `solicitudes/page.tsx` el patrón real de `verifySession()` /
`Cockpit` difiere en algo puntual de lo de arriba (props distintas,
import diferente), seguí el patrón real del archivo — esto es la
referencia de forma, no una cita exacta a pegar sin mirar.

- [ ] **Step 3: Entrada en el Sidebar**

En `src/components/admin/Sidebar.tsx`, agregar el import de un ícono
nuevo (junto a los demás de `lucide-react`, línea 6-19):

```ts
import { Gauge } from "lucide-react";
```

(agregalo a la lista existente de imports de `lucide-react`, no como
import aparte, si ya están todos en un solo `import { ... } from
"lucide-react";`).

Y en `SECCIONES` (líneas 27-38), agregar una entrada entre "Zak" y
"Solicitudes":

```ts
const SECCIONES = [
  { href: "/admin/prospeccion", label: "Encontrar clientes", Icono: Target },
  { href: "/admin/territorios", label: "Territorios", Icono: LandPlot },
  { href: "/admin/zak", label: "Zak", Icono: Bot },
  { href: "/admin/solicitudes", label: "Solicitudes", Icono: Inbox },
  ...
```

por:

```ts
const SECCIONES = [
  { href: "/admin/prospeccion", label: "Encontrar clientes", Icono: Target },
  { href: "/admin/territorios", label: "Territorios", Icono: LandPlot },
  { href: "/admin/zak", label: "Zak", Icono: Bot },
  { href: "/admin/metricas", label: "Métricas", Icono: Gauge },
  { href: "/admin/solicitudes", label: "Solicitudes", Icono: Inbox },
  ...
```

(dejando el resto de las entradas — Agenda, Clientes, Bots, Voz, Equipo —
exactamente igual, en el mismo orden.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/metricas/page.tsx" src/components/admin/metricas/EmbudoEstados.tsx src/components/admin/Sidebar.tsx
git commit -m "feat: /admin/metricas — embudo por estado + actividad, promovido del sidebar"
```

---

## Task 11: `ZakView.tsx` pierde la pestaña Métricas

**Files:**
- Modify: `src/components/admin/bots/ZakView.tsx`
- Modify: `src/lib/admin/zak-caras.ts`
- Modify: `src/app/admin/(panel)/zak/page.tsx`
- Delete: `src/components/admin/bots/MetricasZak.tsx`

**Interfaces:**
- Consumes: nada nuevo — este es el "desmontaje" del lado de Zak, ahora
  que `/admin/metricas` (Task 10) ya cubre lo que mostraba esta pestaña.
- Produces: `ZakView`'s `type Props` pierde `tandas`/`prospectos`/`status`
  (ya nadie los usa en este componente).

- [ ] **Step 1: `PESTANAS_CHAT` sin `metricas`**

En `src/lib/admin/zak-caras.ts`, cambiar:

```ts
export const PESTANAS_CHAT = [
  "bandeja",
  "plantillas",
  "metricas",
  "prompt",
  "labs",
] as const;
```

por:

```ts
export const PESTANAS_CHAT = [
  "bandeja",
  "plantillas",
  "prompt",
  "labs",
] as const;
```

- [ ] **Step 2: `ZakView.tsx` — imports, `LABEL_CHAT`, `type Props`**

Quitar el import:

```ts
import { MetricasZak } from "./MetricasZak";
```

Cambiar `LABEL_CHAT`:

```ts
const LABEL_CHAT: Record<(typeof PESTANAS_CHAT)[number], string> = {
  bandeja: "Bandeja",
  plantillas: "Plantillas",
  metricas: "Métricas",
  prompt: "Prompt",
  labs: "Labs",
};
```

por:

```ts
const LABEL_CHAT: Record<(typeof PESTANAS_CHAT)[number], string> = {
  bandeja: "Bandeja",
  plantillas: "Plantillas",
  prompt: "Prompt",
  labs: "Labs",
};
```

Cambiar `type Props` — quitar `tandas`, `prospectos` y `status`:

```ts
type Props = {
  instancia: Instancia | null;
  prompt: PromptActivo | null;
  versiones: VersionPrompt[];
  status: StatusInstancia | null;
  tandas: Tanda[];
  prospectos: Prospecto[];
  tabInicial: PestanaZak;
  ...
```

por:

```ts
type Props = {
  instancia: Instancia | null;
  prompt: PromptActivo | null;
  versiones: VersionPrompt[];
  tabInicial: PestanaZak;
  ...
```

(el resto de los campos de `Props` — `telefonoInicial`, `verticales`,
`plantillas`, `vozZak`, `agenteVoz`, `llamadasVoz`, `llamadasVozHoy`,
`voces`, `clientes`, `telefoniaLista` — quedan intactos).

Actualizar el import de tipos de `@/lib/bots/tipos` para no traer más lo
que ya no se usa:

```ts
import {
  ID_ZAK,
  type Instancia,
  type PromptActivo,
  type Prospecto,
  type StatusInstancia,
  type Tanda,
  type VersionPrompt,
} from "@/lib/bots/tipos";
```

por:

```ts
import { ID_ZAK, type Instancia, type PromptActivo, type VersionPrompt } from "@/lib/bots/tipos";
```

- [ ] **Step 3: La desestructuración de props y el cuerpo del componente**

Cambiar la desestructuración:

```ts
export function ZakView({
  instancia,
  prompt,
  versiones,
  status,
  tandas,
  prospectos,
  tabInicial,
  telefonoInicial = null,
  ...
```

por:

```ts
export function ZakView({
  instancia,
  prompt,
  versiones,
  tabInicial,
  telefonoInicial = null,
  ...
```

Quitar los cálculos que ya no alimentan nada (`interesados`, `uso`,
`enviados`, `respondidos`):

```ts
  const interesados = useMemo(() => prospectos.filter((p) => p.interesado), [prospectos]);
  const uso = status?.uso_hoy;

  // Tasa de respuesta agregada de la prospección (los fallidos no cuentan
  // como enviados; los pendientes todavía no salieron).
  const enviados = tandas.reduce(
    (t, x) => t + x.funnel.enviado + x.funnel.entregado + x.funnel.leido + x.funnel.respondido,
    0,
  );
  const respondidos = tandas.reduce((t, x) => t + x.funnel.respondido, 0);
```

(borrar el bloque entero — nada de esto se usa en ningún otro lado de este
archivo una vez que se quite el `contador` del header, en el siguiente
paso).

Si `useMemo` deja de usarse en cualquier otro lugar del archivo, sacalo
también del import de `"react"` (línea 3) — confirmá con un
`grep -n "useMemo" src/components/admin/bots/ZakView.tsx` antes de tocar
ese import.

- [ ] **Step 4: El `contador` del header desaparece**

Cambiar:

```tsx
        contador={
          uso && (
            <>
              hoy: {uso.llamadas} llamadas · {uso.tokens_entrada + uso.tokens_salida} tokens ·{" "}
              {interesados.length} interesados en total
            </>
          )
        }
      />
```

por:

```tsx
      />
```

(el prop `contador` se deja de pasar del todo — `PageHeader` ya maneja
`contador` como opcional, no hace falta pasarle `undefined` a mano.)

- [ ] **Step 5: Quitar el render de la pestaña**

Cambiar:

```tsx
        {tab === "plantillas" && <PlantillasZak filas={plantillas} />}

        {tab === "metricas" && (
          <MetricasZak
            enviados={enviados}
            respondidos={respondidos}
            interesados={interesados.length}
            tandas={tandas.length}
          />
        )}

        {tab === "prompt" && (
```

por:

```tsx
        {tab === "plantillas" && <PlantillasZak filas={plantillas} />}

        {tab === "prompt" && (
```

- [ ] **Step 6: Borrar `MetricasZak.tsx`**

```bash
rm src/components/admin/bots/MetricasZak.tsx
```

- [ ] **Step 7: `zak/page.tsx` deja de traer `tandas`/`prospectos`/`status`**

En `src/app/admin/(panel)/zak/page.tsx`, quitar `statusInstancia`,
`listarTandas`, `listarProspectos` del `Promise.all` (y de sus imports si
no se usan para nada más en el archivo — confirmalo con grep antes de
tocar los imports), y quitar `tandas`, `prospectos`, `status` de las props
que se le pasan a `<ZakView>`. Leé el archivo completo primero: el
`Promise.all` trae varias cosas más (`instancia`, `prompt`, `versiones`,
`catalogo`, `zakVoz`, y lo de voz más abajo) que quedan intactas — solo se
sacan esas tres.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 9: Suite completa**

Run: `npm test`
Expected: todos los tests pasan.

- [ ] **Step 10: Commit**

```bash
git add -A src/components/admin/bots/ZakView.tsx src/lib/admin/zak-caras.ts "src/app/admin/(panel)/zak/page.tsx" src/components/admin/bots/MetricasZak.tsx
git commit -m "feat: quita la pestaña Métricas de Zak (ahora vive en /admin/metricas)"
```

---

## Task 12: Verificación completa de la fase

**Files:** ninguno nuevo — solo correr y revisar.

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: todos los tests pasan, incluidos los ~7 nuevos de las Tasks 2 y 6.

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso, incluida la ruta nueva `/admin/metricas`.

- [ ] **Step 4: Checklist manual (requiere `npm run dev`, sesión admin
  real, y las migraciones de las Tasks 1 y 5 ya corridas en Supabase)**

Avisar al usuario que confirme estos puntos a mano:

- `/admin/metricas` aparece en el Sidebar (entre Zak y Solicitudes) y
  carga sin errores.
- El embudo muestra 6 números que suman aproximadamente el total de
  negocios (pueden no sumar exacto si hay negocios creados/borrados entre
  cada count — aceptable).
- La tasa de respuesta y el conteo de interesados coinciden con lo que
  mostraba antes la pestaña Métricas de Zak.
- Jobs fallidos y Leads capturados siguen mostrando lo mismo que antes
  (mismos datos del Flask), con los botones nuevos Editar/Vincular/Borrar.
- Editar un lead (JSON válido) → se guarda y se refleja al instante.
  Editar con JSON inválido → error claro, no rompe nada.
- Borrar un lead → desaparece de la lista (confirmá que sigue existiendo
  en el Flask — esto es un borrado lógico local, no le pega al bot).
- Vincular un lead a un negocio (buscar por nombre, elegir uno) → aparece
  el badge "vinculado a un negocio"; "Quitar vínculo" lo saca.
- Zak (`/admin/zak`) ya no tiene la pestaña Métricas; sus otras pestañas
  (Bandeja, Plantillas, Prompt, Labs, Voz) siguen igual que antes.
- Activar una solicitud con `negocio_id` conocido (requiere que el paso
  de la Task 3 ya tenga un `negocio_id` real llegando — hoy solo pasa si
  se prueba a mano, ya que el bot de WhatsApp todavía no lo manda) mueve
  ese negocio a `cliente` en `/admin/prospeccion`.

- [ ] **Step 5: Commit final si el checklist manual movió algo**

Si no hizo falta ningún cambio, no hay nada que commitear en este paso.
