# Correcciones de calidad de código de la Radiografía Zakumi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los seis hallazgos de calidad de código que la auditoría
del PR #33 dejó abiertos: un error real de ESLint que `npm run build` no
detecta, un banner engañoso en la ficha de negocio cuando el fetch falla de
verdad, una función pura cuya firma no garantiza su precondición, y tres
restos cosméticos (comentario desactualizado, clase muerta, variable sin
usar).

**Architecture:** Cuatro tasks chicas, sin dependencias entre sí salvo que
la Task 1 toca dos archivos que van juntos. El cambio con más sustancia es
la Task 1: el `useEffect` que trae la ficha de un negocio para el chat de
Zak hace `setState` síncrono en el cuerpo del efecto (dos veces —
`setNegocioFicha(null)` y `setNegocioCargando(true)`; el lint reporta la
primera, arreglar solo esa mueve el error a la segunda). Se colapsan los
tres estados en UN objeto `{ leadId, negocio, fallo }` que solo se escribe
desde la continuación async, y `cargando`/`fallo` pasan a ser derivados —
lo que de paso le da al modal el estado "el fetch falló" que el segundo
hallazgo pedía.

**Tech Stack:** Next.js 16 + TypeScript + React 19. Sin SQL, sin
dependencias nuevas.

**Spec:** No hay spec — son los hallazgos de calidad de código de la
auditoría de esta sesión (artifact "Radiografía Zakumi"). El séptimo
hallazgo de esa lista (`activarSolicitud` sin el patrón de upsert) ya se
cerró en el gap-fix anterior.

## Global Constraints

- **Cero tests de componentes** (`vitest.config.ts`: `environment:
  "node"`, `include: ["src/**/__tests__/**/*.test.ts"]`). Solo la Task 2
  (`mezclarLeads`, lógica pura con test existente) lleva TDD.
- **El criterio de "arreglado" para el lint es `npx eslint`, no `npm run
  build`.** Verificado en esta sesión: el build pasa hoy con el error de
  `react-hooks/set-state-in-effect` presente, porque el paso de lint del
  build no aplica esa regla. Cada task corre `npx eslint` sobre sus
  archivos y exige 0 errores Y 0 warnings.
- **Un solo cambio de comportamiento visible, y es intencional** (Task 1):
  al reabrir la ficha del MISMO negocio en el chat de Zak, ahora se pinta
  al instante lo último cargado mientras refresca por debajo, en vez de un
  esqueleto. Es consecuencia de derivar `cargando` en lugar de resetear
  estado al cerrar. Todo lo demás es idéntico para el usuario.
- **`mezclarLeads` cambia de firma** (gana `instanciaId` primero). Tiene
  exactamente UN llamador en `src/` (`actividad/route.ts`) — se actualiza
  en la misma task; no hay otro consumidor que romper.

---

### Task 1: La ficha del chat de Zak sin `setState` en el cuerpo del efecto (+ estado de fallo)

**Files:**
- Modify: `src/components/admin/bots/Conversaciones.tsx`
- Modify: `src/components/admin/leads/FichaLeadModal.tsx`

**Interfaces:**
- Produces: `FichaLeadModal` gana la prop opcional `fallo?: boolean`
  (default `false`) — los otros dos dueños (Territorio, Prospección) no la
  pasan y no cambian.

- [ ] **Step 1: `Conversaciones.tsx` — colapsar los tres estados en uno, derivar el resto**

Reemplazar (busca `const [negocioFicha, setNegocioFicha]`):

```tsx
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

por:

```tsx
  // La ficha completa del negocio abierto en el modal: a diferencia de
  // Territorio/Prospección (que la sacan de una lista ya cargada), acá se
  // trae por fetch — el chat no tiene esa lista. `negocioVersion` fuerza un
  // refetch después de editar (ver onCambio más abajo).
  //
  // UN solo estado, escrito SOLO desde la continuación async: un setState
  // síncrono en el cuerpo del efecto (resetear al cerrar, marcar
  // "cargando" al abrir) dispara react-hooks/set-state-in-effect. Lo que
  // antes era estado — cargando, fallo — ahora se deriva comparando el id
  // abierto con el id del último fetch que terminó.
  type FichaFetch = { leadId: string; negocio: Negocio | null; fallo: boolean };
  const [fichaFetch, setFichaFetch] = useState<FichaFetch | null>(null);
  const [negocioVersion, setNegocioVersion] = useState(0);

  useEffect(() => {
    if (!leadId) return;
    let cancelado = false;
    void (async () => {
      let negocio: Negocio | null = null;
      let fallo = false;
      try {
        const res = await fetch(`/admin/api/negocios/${leadId}`);
        if (!res.ok) throw new Error(String(res.status));
        negocio = ((await res.json()) as { negocio: Negocio | null }).negocio;
      } catch {
        fallo = true;
      }
      if (!cancelado) setFichaFetch({ leadId, negocio, fallo });
    })();
    return () => {
      cancelado = true;
    };
  }, [leadId, negocioVersion]);

  // El fetch "vigente" es el que coincide con el id abierto ahora mismo.
  // Sin id abierto no hay ficha; con id abierto y sin fetch que coincida,
  // se está cargando. Al reabrir el MISMO negocio se muestra al instante lo
  // último cargado mientras el efecto refresca por debajo (antes: esqueleto).
  const fetchVigente = leadId !== null && fichaFetch?.leadId === leadId ? fichaFetch : null;
  const negocioFicha = fetchVigente?.negocio ?? null;
  const negocioCargando = leadId !== null && fetchVigente === null;
  const negocioFallo = fetchVigente?.fallo ?? false;
```

- [ ] **Step 2: `Conversaciones.tsx` — pasar `fallo` al modal**

En el JSX, reemplazar:

```tsx
        <FichaLeadModal
          leadId={leadId}
          negocio={negocioFicha}
          cargando={negocioCargando}
          vozZak={vozZak}
```

por:

```tsx
        <FichaLeadModal
          leadId={leadId}
          negocio={negocioFicha}
          cargando={negocioCargando}
          fallo={negocioFallo}
          vozZak={vozZak}
```

- [ ] **Step 3: `Conversaciones.tsx` — la variable sin usar**

En el `onEliminado` del mismo `<FichaLeadModal>`, reemplazar:

```tsx
              setFichas((prev) => {
                const { [telefono]: _quitada, ...resto } = prev;
                return resto;
              });
```

por:

```tsx
              setFichas((prev) => {
                const resto = { ...prev };
                delete resto[telefono];
                return resto;
              });
```

(`_quitada` disparaba `@typescript-eslint/no-unused-vars`; este repo no
configura `varsIgnorePattern`, así que el destructure-para-descartar no
tiene forma limpia. Copiar y borrar la clave hace lo mismo sin variable
fantasma.)

- [ ] **Step 4: `FichaLeadModal.tsx` — la prop y el banner nuevos**

En `type Props`, después de `cargando?: boolean;`, agregar:

```tsx
  /** true si el dueño INTENTÓ resolver `negocio` por fetch y falló (red,
   *  5xx). Distinto de "no está en la lista cargada": ese banner es para
   *  los dueños que resuelven por lista. */
  fallo?: boolean;
```

En la destructuración de la función, después de `cargando = false,`,
agregar `fallo = false,`.

Y reemplazar el último branch del ternario de render:

```tsx
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

por:

```tsx
      ) : fallo ? (
        // El dueño resuelve por fetch (el chat de Zak) y el fetch falló de
        // verdad: no es "no está en la lista", es "no se pudo consultar".
        <Banner variante="error">
          No se pudo cargar la ficha de este negocio. Intenta de nuevo en un
          momento.
        </Banner>
      ) : (
        // La lista de esta pantalla viene topada (TOPE_LEADS): un enlace a un
        // negocio antiguo puede caer fuera de lo cargado. (Los dueños que
        // resuelven por fetch no caen acá: pasan `cargando`/`fallo`.)
        <Banner variante="error">
          Este negocio no está en la lista cargada en pantalla. Búscalo en su
          territorio o ajusta los filtros.
        </Banner>
      )}
```

- [ ] **Step 5: Verificar — este es el task cuyo criterio es el lint**

Run: `npx eslint src/components/admin/bots/Conversaciones.tsx src/components/admin/leads/FichaLeadModal.tsx`
Expected: **0 errores, 0 warnings.** Antes de este task, `Conversaciones.tsx` daba 1 error (`react-hooks/set-state-in-effect`, línea ~425) + 1 warning (`no-unused-vars`, `_quitada`). Si queda cualquier `set-state-in-effect`, el colapso de estados no se aplicó entero.

Run: `npx tsc --noEmit`
Expected: 0 errores (ojo con `delete resto[telefono]` — si `fichas` tuviera un tipo con claves obligatorias TS lo rechazaría; es un `Record<string, …>`, debe pasar).

Run: `npm test`
Expected: 669/669 (sin cambios — no hay tests de estos componentes).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/bots/Conversaciones.tsx src/components/admin/leads/FichaLeadModal.tsx
git commit -m "fix: la ficha del chat de Zak no hace setState en el cuerpo del efecto, y distingue fetch fallido de no-en-lista"
```

---

### Task 2: `mezclarLeads` garantiza su precondición en la firma (TDD)

**Files:**
- Modify: `src/lib/admin/leads-overrides.ts`
- Modify: `src/lib/admin/__tests__/leads-overrides.test.ts`
- Modify: `src/app/admin/api/bots/[id]/actividad/route.ts`

**Interfaces:**
- Produces: `mezclarLeads(instanciaId: number, leads: Lead[], overrides:
  LeadOverride[])` — nuevo primer parámetro. Único llamador:
  `actividad/route.ts:42`, actualizado en esta task.

- [ ] **Step 1: El test nuevo primero (debe fallar) + adaptar los existentes**

Reemplazar el contenido completo de
`src/lib/admin/__tests__/leads-overrides.test.ts` por:

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
    const r = mezclarLeads(1, [lead({})], []);
    expect(r).toEqual([{ phone: "573001112233", datos: { nombre: "Ana" }, negocioId: null }]);
  });

  it("un lead con datos_editados usa los editados, no los originales", () => {
    const r = mezclarLeads(
      1,
      [lead({ datos: { nombre: "Ana", necesidad: "web" } })],
      [override({ datos_editados: { nombre: "Ana María" } })],
    );
    expect(r[0]!.datos).toEqual({ nombre: "Ana María" });
  });

  it("un lead con borrado:true se excluye del resultado", () => {
    const r = mezclarLeads(
      1,
      [lead({ phone: "a" }), lead({ phone: "b" })],
      [override({ telefono: "a", borrado: true })],
    );
    expect(r.map((l) => l.phone)).toEqual(["b"]);
  });

  it("un lead con negocio_id trae negocioId en el resultado", () => {
    const r = mezclarLeads(
      1,
      [lead({})],
      [override({ negocio_id: "11111111-1111-1111-1111-111111111111" })],
    );
    expect(r[0]!.negocioId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("un override de un teléfono que no está en leads no genera nada", () => {
    const r = mezclarLeads(1, [lead({ phone: "a" })], [override({ telefono: "z" })]);
    expect(r).toHaveLength(1);
    expect(r[0]!.phone).toBe("a");
  });

  it("un override de OTRA instancia con el mismo teléfono se ignora", () => {
    // Dos bots pueden tener leads con el mismo número: el borrado en la
    // instancia 2 no puede ocultar el lead de la instancia 1.
    const r = mezclarLeads(
      1,
      [lead({})],
      [override({ instancia_id: 2, borrado: true, datos_editados: { nombre: "Otro" } })],
    );
    expect(r).toHaveLength(1);
    expect(r[0]!.datos).toEqual({ nombre: "Ana" });
    expect(r[0]!.negocioId).toBeNull();
  });
});
```

- [ ] **Step 2: Correr — deben fallar los 6 (la firma vieja recibe un número donde espera un array)**

Run: `npx vitest run src/lib/admin/__tests__/leads-overrides.test.ts`
Expected: FAIL (error de tipo/ejecución en todos, porque `mezclarLeads(1, …)` todavía no existe con esa firma).

- [ ] **Step 3: Implementar**

En `src/lib/admin/leads-overrides.ts`, reemplazar el bloque de
`mezclarLeads` (docstring incluido):

```ts
/**
 * Mezcla los leads crudos del Flask con sus overrides locales: oculta lo
 * borrado, pisa los campos editados, resuelve el negocio vinculado. El
 * Flask nunca se toca — esta función solo lee.
 *
 * `datos_editados` reemplaza `datos` entero (no mergea campo a campo): una
 * vez editado, ese lead queda congelado y no muestra campos nuevos que el
 * bot capture después para el mismo teléfono.
 */
export function mezclarLeads(leads: Lead[], overrides: LeadOverride[]): LeadConOverride[] {
  const porTelefono = new Map(overrides.map((o) => [o.telefono, o]));
```

por:

```ts
/**
 * Mezcla los leads crudos del Flask con sus overrides locales: oculta lo
 * borrado, pisa los campos editados, resuelve el negocio vinculado. El
 * Flask nunca se toca — esta función solo lee.
 *
 * `instanciaId` va en la firma a propósito: los overrides se indexan por
 * teléfono, y dos bots pueden tener leads con el mismo número — un
 * borrado de la instancia 2 no puede ocultar el lead de la instancia 1.
 * Filtrar acá (y no confiar en que el llamador ya filtró) hace la
 * precondición imposible de olvidar.
 *
 * `datos_editados` reemplaza `datos` entero (no mergea campo a campo): una
 * vez editado, ese lead queda congelado y no muestra campos nuevos que el
 * bot capture después para el mismo teléfono.
 */
export function mezclarLeads(
  instanciaId: number,
  leads: Lead[],
  overrides: LeadOverride[],
): LeadConOverride[] {
  const porTelefono = new Map(
    overrides.filter((o) => o.instancia_id === instanciaId).map((o) => [o.telefono, o]),
  );
```

(El resto de la función — el `for`, el `push`, el `return` — queda igual.)

- [ ] **Step 4: Actualizar el único llamador**

En `src/app/admin/api/bots/[id]/actividad/route.ts`, reemplazar:

```ts
    leads: mezclarLeads(leadsCrudos, overridesData),
```

por:

```ts
    leads: mezclarLeads(iid, leadsCrudos, overridesData),
```

(`iid` ya existe en ese handler — `const iid = Number(id);` — y la consulta
de overrides ya filtra `.eq("instancia_id", iid)`; ahora la función lo
garantiza además por su cuenta.)

- [ ] **Step 5: Correr — 6/6**

Run: `npx vitest run src/lib/admin/__tests__/leads-overrides.test.ts`
Expected: PASS, 6 tests.

Run: `npx tsc --noEmit`
Expected: 0 errores (si quedara algún otro llamador con la firma vieja, acá salta).

Run: `npx eslint src/lib/admin/leads-overrides.ts src/lib/admin/__tests__/leads-overrides.test.ts "src/app/admin/api/bots/[id]/actividad/route.ts"`
Expected: 0 errores/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/leads-overrides.ts src/lib/admin/__tests__/leads-overrides.test.ts "src/app/admin/api/bots/[id]/actividad/route.ts"
git commit -m "fix: mezclarLeads filtra por instancia en la firma, no confía en el llamador (TDD)"
```

---

### Task 3: Dos restos cosméticos

**Files:**
- Modify: `src/app/admin/(panel)/metricas/page.tsx`
- Modify: `src/components/admin/bots/PlantillasZak.tsx`

**Interfaces:** ninguna.

- [ ] **Step 1: El comentario que cita archivos que ya no tienen la fórmula**

En `src/app/admin/(panel)/metricas/page.tsx`, reemplazar:

```ts
  // Tasa de respuesta agregada de la prospección — misma fórmula que
  // ZakView.tsx/MetricasZak.tsx (los fallidos no cuentan como enviados; los
  // pendientes todavía no salieron).
```

por:

```ts
  // Tasa de respuesta agregada de la prospección: los fallidos no cuentan
  // como enviados y los pendientes todavía no salieron. Esta página es el
  // único dueño de la fórmula desde que Métricas salió de las pestañas de Zak.
```

- [ ] **Step 2: La clase muerta**

En `src/components/admin/bots/PlantillasZak.tsx`, en la línea del contenedor
del grid (busca `barra-fina grid grid-cols-1`), quitar el token
`min-[900px]:flex-1` de la lista de clases — `flex: 1 1 0%` no hace nada en
un contenedor que dejó de ser flex item cuando el layout pasó a grid. Los
demás tokens (`min-[900px]:min-h-0`, `min-[900px]:overflow-y-auto`,
`min-[900px]:pr-1`) se quedan.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint "src/app/admin/(panel)/metricas/page.tsx" src/components/admin/bots/PlantillasZak.tsx`
Expected: 0 errores/warnings.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(panel)/metricas/page.tsx" src/components/admin/bots/PlantillasZak.tsx
git commit -m "chore: comentario sin referencias muertas en métricas, clase flex-1 inerte fuera de Plantillas"
```

---

### Task 4: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: El lint del repo entero sobre lo tocado, con el umbral estricto**

Run:
```bash
npx eslint src/components/admin/bots/Conversaciones.tsx src/components/admin/leads/FichaLeadModal.tsx src/lib/admin/leads-overrides.ts src/lib/admin/__tests__/leads-overrides.test.ts "src/app/admin/api/bots/[id]/actividad/route.ts" "src/app/admin/(panel)/metricas/page.tsx" src/components/admin/bots/PlantillasZak.tsx
```
Expected: sin salida — 0 errores, 0 warnings en los 7 archivos.

- [ ] **Step 2: Suite completa**

Run: `npm test`
Expected: 670/670 (669 + el test nuevo de `mezclarLeads`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Checklist de QA manual (queda pendiente de verificación humana)**

Escribir en el reporte, textual:

- [ ] En `/admin/zak`, abrir un chat con negocio vinculado y tocar "Ver
      ficha": el modal carga la ficha igual que antes.
- [ ] Cerrar y volver a abrir la ficha del MISMO negocio: aparece al
      instante (sin esqueleto) y sigue correcta.
- [ ] Editar un campo en esa ficha y guardar: la ficha refresca sin
      parpadeo a esqueleto.
- [ ] Simular un fallo (p. ej. cortar la red, o abrir `?lead=<uuid
      inexistente>`): el banner dice "No se pudo cargar la ficha…", NO "no
      está en la lista cargada".
- [ ] En `/admin/prospeccion` y en un territorio, abrir una ficha: sin
      cambios (esos dueños no pasan `fallo`).
- [ ] `/admin/metricas` → pestaña de leads capturados: la lista se ve igual.
- [ ] `/admin/zak` → Plantillas: el grid se ve igual.

- [ ] **Step 6: Commit (solo si hiciera falta alguna corrección)**

```bash
git add -A
git commit -m "fix: ajuste final de las correcciones de calidad de código"
```

Si todos los pasos dieron bien, no hay nada que commitear — reportar `DONE`
igual, sin diff.
