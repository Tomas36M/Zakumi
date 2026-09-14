# Ficha del negocio en el chat + header de una fila (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde el chat de Zak, ver la ficha completa de un negocio (editar,
notas, acciones) sin navegar a Prospección, y liberar la fila que hoy se
pierde en el header del chat comprimiendo sus 3 botones a íconos.

**Architecture:** No se construye ningún componente de ficha nuevo: se
reusa `FichaLeadModal` (el modal compartido que ya usan Territorio y
Prospección, controlado por `?lead=<id>` en la URL vía `useFichaLead()`).
`Conversaciones.tsx` monta una tercera instancia de ese mismo modal,
alimentada por un fetch propio a un endpoint nuevo
(`GET /admin/api/negocios/[id]`) porque —a diferencia de las otras dos
pantallas— el chat no tiene la lista completa de negocios cargada en
memoria. Mientras ese fetch está en vuelo, `FichaLeadModal` pinta un
esqueleto en vez de su banner de "no encontrado" (prop `cargando` nuevo).
El header del chat pasa sus 3 botones de `Button` con texto a `IconButton`
compactos, y gana un cuarto: "Ver ficha".

**Tech Stack:** Next.js (App Router, Server Components + Client Components)
+ TypeScript + Supabase + Radix Dialog (ya en uso vía `Modal.tsx`). Sin
librerías nuevas.

**Spec:** `docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md`
(Decisiones 7 y 8 — Fase 2 de las 6 del spec; el resto queda para planes
siguientes).

## Global Constraints

- Este repo **no testea componentes React con vitest** (`vitest.config.ts`
  tiene `environment: "node"` y `include` solo matchea `*.test.ts`, no
  `.tsx`; no hay `@testing-library/react` ni `jsdom`/`happy-dom` instalado).
  Todas las tareas de esta fase son UI o un route handler delgado — se
  verifican con `npx tsc --noEmit` + `npm run build` + el checklist manual
  del final, nunca con un test nuevo. Esto no es un atajo: es como este
  repo ya verifica este tipo de cambio en todo el resto del código (ver
  `src/app/admin/api/**/route.ts`, ninguno tiene test adjunto).
- Next 16 (`AGENTS.md`: "This is NOT the Next.js you know"): los route
  handlers con segmento dinámico reciben `{ params }: { params:
  Promise<{ id: string }> }` — hay que `await params`, no desestructurar
  directo (ver `src/app/admin/api/bots/[id]/actividad/route.ts:8-16`, la
  referencia exacta que se copia en la Task 1).
- `useFichaLead()`/`FichaLeadModal` son compartidos con Territorio y
  Prospección — cualquier cambio a `FichaLeadModal.tsx` debe ser
  estrictamente aditivo (prop opcional con default que preserva el
  comportamiento actual) para esas dos pantallas.
- `BotonLlamarZak` es compartido con `FichaLeadAcciones.tsx` (dentro del
  propio `FichaLeadModal`) — el nuevo prop `compacto` también debe ser
  opcional/aditivo.

---

## Task 1: Endpoint — un negocio completo por id

**Files:**
- Create: `src/app/admin/api/negocios/[id]/route.ts`

**Interfaces:**
- Produces: `GET /admin/api/negocios/:id` → `{ negocio: Negocio | null }`
  (200), `{ error: "no_autorizado" }` (401), `{ error: "id_invalido" }`
  (400 — id no tiene forma de UUID), `{ error: "crm" }` (502 — falló la
  consulta). La Task 5 lo consume desde el cliente.

- [ ] **Step 1: Escribir el route handler**

```ts
import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un negocio completo por id — a diferencia de /admin/api/zak/fichas
 * (columnas chicas, por teléfono), trae la fila entera para la ficha
 * completa (FichaLeadModal) cuando el caller no tiene ya la lista de
 * negocios en memoria (hoy: el chat de Zak).
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

  const { data, error } = await sesion.supabase
    .from("negocios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[api/negocios/[id]]:", error.message);
    return NextResponse.json({ error: "crm" }, { status: 502 });
  }
  return NextResponse.json({ negocio: data });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/api/negocios/\[id\]/route.ts
git commit -m "feat: GET /admin/api/negocios/[id] — un negocio completo por id"
```

---

## Task 2: `FichaLeadModal` gana el estado de carga

**Files:**
- Modify: `src/components/admin/leads/FichaLeadModal.tsx`

**Interfaces:**
- Produces: `FichaLeadModal` gana el prop opcional `cargando?: boolean`
  (default `false`). Con `cargando: true`, pinta un esqueleto en vez del
  banner "no está en la lista cargada" — así el fetch por id de la Task 5
  no muestra ese error mientras todavía está en vuelo. Territorio y
  Prospección (que no pasan este prop) se comportan exactamente igual que
  hoy.

- [ ] **Step 1: Agregar el prop y el esqueleto de carga**

Cambiar (líneas 11-21, el `type Props`):

```ts
type Props = {
  /** El id abierto (de la URL). `null` = modal cerrado. */
  leadId: string | null;
  /** El negocio resuelto por el dueño en cada render (id → fila viva). */
  negocio: Negocio | null;
  vozZak: EstadoVozZak;
  onCerrar: () => void;
  /** router.refresh() del dueño: los datos frescos llegan por props. */
  onCambio: () => void;
  onEliminado: () => void;
};
```

por:

```ts
type Props = {
  /** El id abierto (de la URL). `null` = modal cerrado. */
  leadId: string | null;
  /** El negocio resuelto por el dueño en cada render (id → fila viva). */
  negocio: Negocio | null;
  /** true mientras el dueño todavía está resolviendo `negocio` (ej. un
   *  fetch por id, en vez de buscarlo en una lista ya cargada). Pinta un
   *  esqueleto en vez del banner de "no encontrado". */
  cargando?: boolean;
  vozZak: EstadoVozZak;
  onCerrar: () => void;
  /** router.refresh() del dueño: los datos frescos llegan por props. */
  onCambio: () => void;
  onEliminado: () => void;
};
```

Cambiar la firma de la función (línea 32):

```ts
export function FichaLeadModal({ leadId, negocio, vozZak, onCerrar, onCambio, onEliminado }: Props) {
```

por:

```ts
export function FichaLeadModal({
  leadId,
  negocio,
  cargando = false,
  vozZak,
  onCerrar,
  onCambio,
  onEliminado,
}: Props) {
```

Agregar el import de `Skeleton` (junto a los otros imports de `@/components/admin/ui`, línea 5-6):

```ts
import { Banner } from "@/components/admin/ui/Banner";
import { Modal } from "@/components/admin/ui/Modal";
```

por:

```ts
import { Banner } from "@/components/admin/ui/Banner";
import { Modal } from "@/components/admin/ui/Modal";
import { Skeleton } from "@/components/admin/ui/Skeleton";
```

Cambiar el bloque de render (líneas 53-76):

```tsx
      {negocio ? (
        <div
          key={negocio.id}
          className="grid gap-5 min-[720px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        >
          <FichaLeadDatos negocio={negocio} onCambio={onCambio} />
          <div className="flex min-w-0 flex-col gap-4">
            <FichaLeadAcciones
              negocio={negocio}
              vozZak={vozZak}
              onCerrar={onCerrar}
              onEliminado={onEliminado}
            />
            <FichaLeadNotas negocioId={negocio.id} version={negocio.updated_at} />
          </div>
        </div>
      ) : (
        // La lista de esta pantalla viene topada (TOPE_LEADS): un enlace a un
        // negocio antiguo puede caer fuera de lo cargado.
        <Banner variante="error">
          Este negocio no está en la lista cargada en pantalla. Búscalo en su
          territorio o ajusta los filtros.
        </Banner>
      )}
```

por:

```tsx
      {cargando ? (
        <div className="grid gap-5 min-[720px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : negocio ? (
        <div
          key={negocio.id}
          className="grid gap-5 min-[720px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        >
          <FichaLeadDatos negocio={negocio} onCambio={onCambio} />
          <div className="flex min-w-0 flex-col gap-4">
            <FichaLeadAcciones
              negocio={negocio}
              vozZak={vozZak}
              onCerrar={onCerrar}
              onEliminado={onEliminado}
            />
            <FichaLeadNotas negocioId={negocio.id} version={negocio.updated_at} />
          </div>
        </div>
      ) : (
        // La lista de esta pantalla viene topada (TOPE_LEADS): un enlace a un
        // negocio antiguo puede caer fuera de lo cargado. (Zak no cae acá:
        // resuelve por fetch, no por lista — ver `cargando` arriba.)
        <Banner variante="error">
          Este negocio no está en la lista cargada en pantalla. Búscalo en su
          territorio o ajusta los filtros.
        </Banner>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/leads/FichaLeadModal.tsx
git commit -m "feat: FichaLeadModal gana un estado de carga (cargando)"
```

---

## Task 3: `BotonLlamarZak` gana una variante compacta

**Files:**
- Modify: `src/components/admin/voz/BotonLlamarZak.tsx`

**Interfaces:**
- Produces: `BotonLlamarZak` gana el prop opcional `compacto?: boolean`
  (default `false`). Con `compacto: true`, se renderiza como
  `IconButton` (solo el ícono, con `etiqueta`/tooltip) en vez de `Button`
  con texto. `FichaLeadAcciones.tsx` (que no pasa este prop) sigue viendo
  exactamente el mismo botón con texto de hoy.

- [ ] **Step 1: Agregar el prop y la rama compacta**

Agregar el import de `IconButton` (línea 7, junto al de `Button`):

```ts
import { Button } from "@/components/admin/ui/Button";
```

por:

```ts
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";
```

Cambiar la firma (líneas 25-39):

```ts
export function BotonLlamarZak({
  vozZak,
  telefono,
  nombre,
  negocioId,
  cargando = false,
}: {
  vozZak: EstadoVozZak;
  /** E.164 (+57…) — la ficha del CRM ya lo trae así. */
  telefono: string;
  nombre?: string | null;
  negocioId?: string | null;
  /** true mientras el caller resuelve la ficha del CRM: no despachar aún. */
  cargando?: boolean;
}) {
```

por:

```ts
export function BotonLlamarZak({
  vozZak,
  telefono,
  nombre,
  negocioId,
  cargando = false,
  compacto = false,
}: {
  vozZak: EstadoVozZak;
  /** E.164 (+57…) — la ficha del CRM ya lo trae así. */
  telefono: string;
  nombre?: string | null;
  negocioId?: string | null;
  /** true mientras el caller resuelve la ficha del CRM: no despachar aún. */
  cargando?: boolean;
  /** true = solo el ícono (con tooltip), para headers angostos como el del
   *  chat de Zak. Sin este prop, botón con texto (comportamiento de hoy). */
  compacto?: boolean;
}) {
```

Cambiar el render (líneas 64-82):

```tsx
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        disabled={pendiente || llamando || cargando || vozZak !== "lista"}
        title={
          vozZak !== "lista"
            ? MOTIVO[vozZak]
            : cargando
              ? "Cargando la ficha del CRM…"
              : undefined
        }
        onClick={llamar}
      >
        <Phone className="h-4 w-4" />
        {llamando ? "Zak está llamando 📞" : pendiente ? "Marcando…" : "Llamar con IA"}
      </Button>
      {error && <span className="text-xs text-peligro">{error}</span>}
    </span>
  );
```

por:

```tsx
  const texto = llamando ? "Zak está llamando 📞" : pendiente ? "Marcando…" : "Llamar con IA";
  const deshabilitado = pendiente || llamando || cargando || vozZak !== "lista";
  const motivo = vozZak !== "lista" ? MOTIVO[vozZak] : cargando ? "Cargando la ficha del CRM…" : undefined;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {compacto ? (
        <IconButton etiqueta={motivo ?? texto} disabled={deshabilitado} onClick={llamar}>
          <Phone className="h-4 w-4" />
        </IconButton>
      ) : (
        <Button disabled={deshabilitado} title={motivo} onClick={llamar}>
          <Phone className="h-4 w-4" />
          {texto}
        </Button>
      )}
      {error && <span className="text-xs text-peligro">{error}</span>}
    </span>
  );
```

(`texto`/`deshabilitado`/`motivo` se extraen una sola vez y los usan ambas
ramas — sin duplicar la lógica de qué texto/tooltip mostrar en cada estado.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/voz/BotonLlamarZak.tsx
git commit -m "feat: BotonLlamarZak gana una variante compacta (solo ícono)"
```

---

## Task 4: Header del chat — de dos filas a una

**Files:**
- Modify: `src/components/admin/bots/Conversaciones.tsx`

**Interfaces:**
- Consumes: `BotonLlamarZak`'s prop `compacto` (Task 3), `IconButton`
  (ya existe).
- Produces: sin cambio de firma pública del componente — solo cambia el
  JSX del header del chat. La Task 5 sigue editando este mismo bloque
  (agrega un botón más adelante de este).

- [ ] **Step 1: Agregar los imports que hacen falta**

Cambiar (línea 5):

```ts
import { Trash2 } from "lucide-react";
```

por:

```ts
import { Pause, Play, Trash2 } from "lucide-react";
```

Agregar el import de `IconButton` entre los de `EmptyState` e `Input`
(líneas 29-30):

```ts
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Input } from "@/components/admin/ui/Field";
```

por:

```ts
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Input } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
```

(El orden final de ese bloque de imports queda Badge, Banner, Button,
ChatBubble, EmptyState, Input, IconButton, ListRow, Skeleton — no hace
falta reordenar todo el bloque a alfabético estricto, alcanza con no romper
nada; si preferís dejarlo alfabético, `IconButton` iría entre `EmptyState`
e `Input`, no después.)

- [ ] **Step 2: Comprimir el header del chat a una fila**

Cambiar (líneas 544-562, el bloque de acciones dentro del header del chat):

```tsx
              {historial && (
                <div className="flex flex-wrap items-center gap-2">
                  {esZak && vozZak && telefono && !esLabs(telefono) && (
                    <BotonLlamarZak
                      vozZak={vozZak}
                      telefono={fichaActual?.telefono ?? `+${telefono}`}
                      nombre={fichaActual?.nombre ?? null}
                      negocioId={fichaActual?.negocioId ?? null}
                      cargando={!telsResueltos.has(telefono)}
                    />
                  )}
                  <Button disabled={operando} onClick={alternarPausa}>
                    {historial.paused ? "Reanudar bot" : "Pausar bot (lo tomo yo)"}
                  </Button>
                  <Button variante="peligro" disabled={operando} onClick={() => void borrar()}>
                    <Trash2 className="h-4 w-4" /> Borrar
                  </Button>
                </div>
              )}
```

por:

```tsx
              {historial && (
                <div className="flex flex-wrap items-center gap-1">
                  {esZak && vozZak && telefono && !esLabs(telefono) && (
                    <BotonLlamarZak
                      compacto
                      vozZak={vozZak}
                      telefono={fichaActual?.telefono ?? `+${telefono}`}
                      nombre={fichaActual?.nombre ?? null}
                      negocioId={fichaActual?.negocioId ?? null}
                      cargando={!telsResueltos.has(telefono)}
                    />
                  )}
                  <IconButton
                    etiqueta={historial.paused ? "Reanudar bot" : "Pausar bot (lo tomo yo)"}
                    disabled={operando}
                    onClick={alternarPausa}
                  >
                    {historial.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </IconButton>
                  <IconButton
                    etiqueta="Borrar conversación"
                    disabled={operando}
                    onClick={() => void borrar()}
                    className="hover:bg-peligro/10 hover:text-peligro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores. `Button` sigue usándose en el resto del archivo
(el compositor, "Reabrir con plantilla", etc.) — no se borra su import.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/bots/Conversaciones.tsx
git commit -m "feat: header del chat de Zak en una sola fila (botones a íconos)"
```

---

## Task 5: Botón "Ver ficha" — monta `FichaLeadModal` en el chat

**Files:**
- Modify: `src/components/admin/bots/Conversaciones.tsx`

**Interfaces:**
- Consumes: `GET /admin/api/negocios/:id` (Task 1) → `{ negocio: Negocio |
  null }`; `FichaLeadModal`'s prop `cargando` (Task 2); `useFichaLead()`
  (ya existe en `src/components/admin/leads/useFichaLead.ts`, sin cambios).
- Produces: sin cambio de firma pública del componente.

- [ ] **Step 1: Imports**

Cambiar (línea 3, ya con el import de Image):

```ts
import Image from "next/image";
```

por:

```ts
import Image from "next/image";
import { useRouter } from "next/navigation";
```

Cambiar (la línea de lucide-react que dejó la Task 4):

```ts
import { Pause, Play, Trash2 } from "lucide-react";
```

por:

```ts
import { IdCard, Pause, Play, Trash2 } from "lucide-react";
```

Cambiar (línea 13):

```ts
import { labelEstado } from "@/lib/admin/negocios";
```

por:

```ts
import { labelEstado, type Negocio } from "@/lib/admin/negocios";
```

Agregar, junto a los otros imports de componentes (después del bloque de
`@/components/admin/ui/*`, antes de `import { NuevoChatZak } from
"./NuevoChatZak";`):

```ts
import { FichaLeadModal } from "@/components/admin/leads/FichaLeadModal";
import { useFichaLead } from "@/components/admin/leads/useFichaLead";
```

- [ ] **Step 2: Estado y fetch del negocio completo**

Justo antes de `return (` (la línea con `const slugParaReabrir = slugReabrir
?? fichaActual?.verticalSlug ?? "generico";`, seguida de `return (`),
agregar:

```ts
  const router = useRouter();
  const [leadId, abrirLead] = useFichaLead();
  const negocioIdActual = fichaActual?.negocioId ?? null;
  const [negocioFicha, setNegocioFicha] = useState<Negocio | null>(null);
  const [negocioCargando, setNegocioCargando] = useState(false);
  const [negocioVersion, setNegocioVersion] = useState(0);

  // La ficha completa del negocio abierto en el modal: a diferencia de
  // Territorio/Prospección (que la sacan de una lista ya cargada), acá se
  // trae por fetch — el chat no tiene esa lista. `negocioVersion` fuerza un
  // refetch después de editar (ver onCambio más abajo).
  useEffect(() => {
    if (!leadId) {
      setNegocioFicha(null);
      return;
    }
    let cancelado = false;
    setNegocioCargando(true);
    void (async () => {
      try {
        const res = await fetch(`/admin/api/negocios/${leadId}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { negocio: Negocio | null };
        if (!cancelado) setNegocioFicha(data.negocio);
      } catch {
        if (!cancelado) setNegocioFicha(null);
      } finally {
        if (!cancelado) setNegocioCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [leadId, negocioVersion]);
```

Así queda ese tramo del archivo, de arriba a abajo: `fichaActual`,
`slugParaReabrir`, el bloque nuevo de arriba, y recién después `return (`.

- [ ] **Step 3: Botón "Ver ficha" en el header**

Cambiar (el inicio del bloque de acciones que dejó la Task 4):

```tsx
              {historial && (
                <div className="flex flex-wrap items-center gap-1">
                  {esZak && vozZak && telefono && !esLabs(telefono) && (
                    <BotonLlamarZak
                      compacto
```

por:

```tsx
              {historial && (
                <div className="flex flex-wrap items-center gap-1">
                  {esZak && negocioIdActual && (
                    <IconButton
                      etiqueta="Ver ficha del negocio"
                      onClick={() => abrirLead(negocioIdActual)}
                    >
                      <IdCard className="h-4 w-4" />
                    </IconButton>
                  )}
                  {esZak && vozZak && telefono && !esLabs(telefono) && (
                    <BotonLlamarZak
                      compacto
```

(El resto del bloque —`BotonLlamarZak`, los dos `IconButton` de
pausar/borrar, el cierre `</div>`— queda exactamente como lo dejó la Task 4,
sin tocar.)

- [ ] **Step 4: Montar `FichaLeadModal`**

Cambiar (el inicio del `return`, línea con `{dialogo}`):

```tsx
    <div className="grid items-start gap-aire min-[900px]:h-full min-[900px]:grid-cols-[340px_minmax(0,1fr)] min-[900px]:items-stretch">
      {dialogo}
```

por:

```tsx
    <div className="grid items-start gap-aire min-[900px]:h-full min-[900px]:grid-cols-[340px_minmax(0,1fr)] min-[900px]:items-stretch">
      {dialogo}
      {esZak && vozZak && (
        <FichaLeadModal
          leadId={leadId}
          negocio={negocioFicha}
          cargando={negocioCargando}
          vozZak={vozZak}
          onCerrar={() => abrirLead(null)}
          onCambio={() => {
            router.refresh();
            setNegocioVersion((v) => v + 1);
          }}
          onEliminado={() => {
            abrirLead(null);
            router.refresh();
          }}
        />
      )}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/bots/Conversaciones.tsx
git commit -m "feat: botón Ver ficha abre FichaLeadModal sin salir del chat de Zak"
```

---

## Task 6: Verificación completa de la fase

**Files:** ninguno nuevo — solo correr y revisar.

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: 644/644 (esta fase no agrega tests nuevos — ver Global
Constraints — así que el número no cambia respecto a la Fase 1; solo debe
seguir en verde).

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Checklist manual (requiere `npm run dev` levantado y una
  sesión admin real)**

Avisar al usuario que confirme estos puntos a mano en `/admin/zak`:

- El header de un chat con negocio conocido entra en una sola fila en
  desktop (sin partirse en dos).
- El botón "Ver ficha" abre `FichaLeadModal` con un esqueleto de carga
  breve y después los datos reales del negocio — sin salir de `/admin/zak`
  (la URL gana `?lead=<id>`, no navega a otra página).
- Un chat sin negocio conocido (número suelto, sin match en el CRM) no
  muestra el botón "Ver ficha".
- Editar un campo (o el estado) desde la ficha abierta así y cerrar: el
  modal refleja el cambio si se reabre (gracias a `negocioVersion`).
- Los otros dos lugares donde vive `FichaLeadModal` (`/admin/territorios/[id]`,
  `/admin/prospeccion?tab=leads`) siguen funcionando exactamente igual que
  antes de esta fase (sin esqueleto, con su banner de "no está en la lista"
  si corresponde).
- "Llamar con IA" compacto (ícono con teléfono) sigue funcionando desde el
  chat; su versión con texto en la ficha de un lead (`FichaLeadAcciones`)
  no cambió.

- [ ] **Step 5: Commit final si el checklist manual movió algo**

Si no hizo falta ningún cambio, no hay nada que commitear en este paso.
