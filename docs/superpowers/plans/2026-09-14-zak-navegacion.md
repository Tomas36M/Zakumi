# Navegación de la consola de Zak (Fase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quitar las pestañas "Interesados" y "Tandas" de `/admin/zak` (sin
reemplazo — el CRM de Solicitudes ya cubre lo primero, lo segundo era un
visor sin acción) y pasar "Plantillas" de lista vertical a grid.

**Architecture:** Cambios puramente de UI/navegación, sin tocar el modelo
de datos ni los server actions. `PESTANAS_CHAT` pierde dos entradas;
`ZakView.tsx` deja de importar y renderizar los dos componentes de esas
pestañas (que se borran); `PlantillasZak.tsx` cambia el contenedor de la
lista de `flex flex-col` a `grid` y hace que la tarjeta en edición ocupe
todo el ancho de su fila. **Nada de esto toca `enviarTandaZak`** (la acción
de mandar una tanda desde Prospección) ni los props `tandas`/`prospectos`
que `ZakView` sigue recibiendo — `MetricasZak` (pestaña que se queda hasta
la Fase 4) todavía los necesita para la tasa de respuesta y el contador de
interesados.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind. Sin cambios
de dependencias.

**Spec:** `docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md`
(Decisiones 9 y 10 — Fase 3 de las 6; la Fase 4 es la que se lleva
"Métricas" de estas mismas pestañas, no esta).

## Global Constraints

- **No tocar `tandas`/`prospectos` como datos.** Sus fetch en
  `src/app/admin/(panel)/zak/page.tsx`, los `useMemo` derivados
  (`interesados`, `enviados`, `respondidos`) y las props que le llegan a
  `<MetricasZak>` en `ZakView.tsx` quedan exactamente igual — solo
  desaparecen las PESTAÑAS que los mostraban por separado (Interesados,
  Tandas). Si algún cambio de este plan borra o modifica esas variables,
  es un error del plan, no algo pedido.
- **`enviarTandaZak` (el server action que manda una tanda desde
  Prospección) no se toca.** La pestaña "Tandas" que se borra es solo su
  visor de seguimiento dentro de Zak; la acción de enviar sigue viva.
- Este repo no testea componentes React con vitest (`vitest.config.ts` con
  `environment: "node"`, `include` solo `*.test.ts`). Los cambios de este
  plan son o bien un array de strings con test genérico ya existente
  (Task 1) o JSX puro (Tasks 2-3) — se verifican con la suite existente +
  `npx tsc --noEmit` + `npm run build` + el checklist manual del final.

---

## Task 1: Quitar `interesados`/`tandas` de `PESTANAS_CHAT`

**Files:**
- Modify: `src/lib/admin/zak-caras.ts:13-21`
- Test: `src/lib/admin/__tests__/zak-caras.test.ts` (ya existe, genérico —
  itera sobre `PESTANAS_CHAT`/`PESTANAS_VOZ` sin nombrar pestañas
  puntuales; no hace falta tocarlo, solo confirmar que sigue en verde)

**Interfaces:**
- Produces: `PESTANAS_CHAT` pasa de `["bandeja", "interesados", "tandas",
  "plantillas", "metricas", "prompt", "labs"]` a `["bandeja", "plantillas",
  "metricas", "prompt", "labs"]`. Las Tasks 2 y 3 consumen esta lista
  indirectamente (a través de `LABEL_CHAT`/`ZakView.tsx`, que ya no debe
  mencionar las dos pestañas quitadas).

- [ ] **Step 1: Cambiar el array**

En `src/lib/admin/zak-caras.ts`, cambiar (líneas 13-21):

```ts
export const PESTANAS_CHAT = [
  "bandeja",
  "interesados",
  "tandas",
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
  "metricas",
  "prompt",
  "labs",
] as const;
```

No tocar nada más del archivo (`PESTANAS_VOZ`, `PESTANA_INICIAL`,
`caraDe`, `esPestanaZak`, `pestanaInicial`, `subPestanaVoz`, `carasZak`
quedan igual — ninguno nombra `"interesados"`/`"tandas"` explícitamente).

- [ ] **Step 2: Correr el test existente**

Run: `npx vitest run src/lib/admin/__tests__/zak-caras.test.ts`
Expected: PASS (todos los tests son genéricos sobre la lista, así que
siguen pasando con la lista más corta — no hace falta escribir ningún
test nuevo).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errores en `src/components/admin/bots/ZakView.tsx` (todavía
referencia `"interesados"`/`"tandas"` — se arreglan en la Task 2) y
posiblemente en otros archivos que usen `LABEL_CHAT`/`PestanaChat` con esas
claves. **Esto es esperado en este punto del plan** — no es un fallo de
esta tarea, es la Task 2 la que lo corrige. Anotá qué archivos aparecen
para confirmar que son los que la Task 2 ya contempla.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/zak-caras.ts
git commit -m "feat: quita interesados/tandas de PESTANAS_CHAT"
```

---

## Task 2: `ZakView.tsx` deja de mostrar Interesados/Tandas; se borran sus archivos

**Files:**
- Modify: `src/components/admin/bots/ZakView.tsx`
- Delete: `src/components/admin/bots/InteresadosZak.tsx`
- Delete: `src/components/admin/bots/TandasZak.tsx`

**Interfaces:**
- Consumes: `PESTANAS_CHAT` de la Task 1 (ya sin `"interesados"`/`"tandas"`).
- Produces: `ZakView` sigue recibiendo y usando `tandas`/`prospectos` como
  props (sin cambios en `type Props`) — solo cambia qué pestañas renderiza.

- [ ] **Step 1: Quitar los imports de los componentes borrados**

En `src/components/admin/bots/ZakView.tsx`, quitar estas dos líneas de los
imports:

```ts
import { InteresadosZak } from "./InteresadosZak";
```

y

```ts
import { TandasZak } from "./TandasZak";
```

- [ ] **Step 2: Quitar las dos entradas de `LABEL_CHAT`**

Cambiar:

```ts
const LABEL_CHAT: Record<(typeof PESTANAS_CHAT)[number], string> = {
  bandeja: "Bandeja",
  interesados: "Interesados",
  tandas: "Tandas",
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
  metricas: "Métricas",
  prompt: "Prompt",
  labs: "Labs",
};
```

(El tipo `Record<(typeof PESTANAS_CHAT)[number], string>` ya exige
exactamente las claves de la Task 1 — TypeScript marcaría error si sobran
o faltan claves, así que este cambio es obligatorio para que compile.)

- [ ] **Step 3: Simplificar `pestanasChat` — ya no hace falta el badge de Interesados**

Cambiar:

```tsx
  const pestanasChat = PESTANAS_CHAT.map((p) => ({
    id: p as PestanaZak,
    label:
      p === "interesados" && interesados.length > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          {LABEL_CHAT[p]}
          <span
            className={cn(
              "rounded-full px-1.5 text-[0.7rem] font-bold",
              tab === "interesados" ? "bg-white/25 text-white" : "bg-acento text-white",
            )}
          >
            {interesados.length}
          </span>
        </span>
      ) : (
        LABEL_CHAT[p]
      ),
  }));
```

por:

```tsx
  const pestanasChat = PESTANAS_CHAT.map((p) => ({
    id: p as PestanaZak,
    label: LABEL_CHAT[p],
  }));
```

La variable `interesados` (el `useMemo` que filtra `prospectos`) **no se
toca** — sigue usándose más abajo, en el contador del header
(`{interesados.length} interesados en total`) y en las props de
`<MetricasZak>`. Esta Task 3 (paso 3) solo saca su uso DENTRO del cálculo
de `pestanasChat`.

Como `cn` ya no se usa en ningún otro lugar de este archivo después de
este cambio (era su único uso), quitar también el import:

```ts
import { cn } from "@/lib/cn";
```

Confirmá esto vos mismo con un `grep -n "cn(" src/components/admin/bots/ZakView.tsx`
antes de borrar el import — si aparece en algún otro lado, dejalo.

- [ ] **Step 4: Quitar el render de las dos pestañas**

Cambiar:

```tsx
        {tab === "interesados" && (
          <InteresadosZak
            interesados={interesados}
            vozZak={vozZak}
            sincronizando={sincronizando}
            onSincronizar={() => sincronizar(false)}
            onAbrirChat={() => irA("bandeja")}
          />
        )}

        {tab === "tandas" && <TandasZak tandas={tandas} />}

        {tab === "plantillas" && <PlantillasZak filas={plantillas} />}
```

por:

```tsx
        {tab === "plantillas" && <PlantillasZak filas={plantillas} />}
```

- [ ] **Step 5: `sincronizando` queda sin uso — ajustar la desestructuración**

`sincronizando` (el booleano de `useTransition()`) solo se usaba pasado a
`<InteresadosZak sincronizando={sincronizando} />`, que acabás de borrar.
Confirmá con `grep -n "sincronizando" src/components/admin/bots/ZakView.tsx`
que no queda ningún otro uso, y cambiá:

```ts
  const [sincronizando, startSync] = useTransition();
```

por:

```ts
  const [, startSync] = useTransition();
```

(`startSync` sigue haciendo falta — lo usa `sincronizar()`. Si el grep
muestra otro uso de `sincronizando` que este plan no previó, dejá la
variable como está y decilo en tu reporte — no fuerces el cambio.)

- [ ] **Step 6: Borrar los dos archivos**

```bash
rm src/components/admin/bots/InteresadosZak.tsx
rm src/components/admin/bots/TandasZak.tsx
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores (esto resuelve los errores que la Task 1 dejó
pendientes a propósito).

- [ ] **Step 8: Suite completa**

Run: `npm test`
Expected: todos los tests pasan (ninguno testea `InteresadosZak`/`TandasZak`
directamente, per la Task 1 ya confirmó que `zak-caras.test.ts` es
genérico).

- [ ] **Step 9: Commit**

```bash
git add -A src/components/admin/bots/ZakView.tsx src/components/admin/bots/InteresadosZak.tsx src/components/admin/bots/TandasZak.tsx
git commit -m "feat: quita las pestañas Interesados y Tandas de Zak (sin reemplazo)"
```

(`git add -A` sobre estas rutas puntuales — no sobre todo el repo — captura
también el borrado de los dos archivos.)

---

## Task 3: `PlantillasZak.tsx` — de lista a grid

**Files:**
- Modify: `src/components/admin/bots/PlantillasZak.tsx`

**Interfaces:**
- Sin cambio de firma pública (`type Props = { filas: PlantillaZakFila[] };`
  intacta) — solo cambia el layout.

- [ ] **Step 1: Agregar el import de `cn`**

Junto a los demás imports (después de `import { fechaCorta } from
"@/lib/admin/formato";`, línea 5), agregar:

```ts
import { cn } from "@/lib/cn";
```

- [ ] **Step 2: El contenedor de la lista pasa a grid**

Cambiar (línea 212):

```tsx
      <div className="barra-fina flex flex-col gap-4 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:overflow-y-auto min-[900px]:pr-1">
```

por:

```tsx
      <div className="barra-fina grid grid-cols-1 gap-4 min-[700px]:grid-cols-2 min-[1200px]:grid-cols-3 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:overflow-y-auto min-[900px]:pr-1">
```

(`min-[900px]:flex-1` se queda: sigue controlando cómo este `<div>` crece
dentro de SU padre — que es un `flex flex-col` — nada que ver con que sus
propios hijos ahora se acomoden en grid en vez de en columna.)

- [ ] **Step 3: La tarjeta en edición ocupa todo el ancho de su fila**

Ojo: el bloque de edición expandible (el `{editando && (...)}` con el
`<Field>` del texto y el folleto) vive DENTRO del `<Island>` de cada
plantilla — no es un hijo directo del grid. `col-span-full` en ese `<div>`
interno no haría nada (las propiedades de grid-item solo aplican a hijos
DIRECTOS del contenedor `grid`). El hijo directo del grid es el propio
`<Island>` — así que es al `<Island>` al que hay que agregarle
`col-span-full`, condicionado a si esa tarjeta está en edición.

Cambiar:

```tsx
          <Island
            key={f.slug}
            className="bg-isla-alta"
```

por:

```tsx
          <Island
            key={f.slug}
            className={cn("bg-isla-alta", editando && "col-span-full")}
```

No tocar el `<div className="flex flex-col gap-3 rounded-fila border border-hairline p-4">`
del bloque de edición (línea ~302) — ese se queda exactamente igual, la
tarjeta entera (el `Island`) es la que crece a ancho completo, no hace
falta nada adentro.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/bots/PlantillasZak.tsx
git commit -m "feat: Plantillas pasa de lista a grid responsive"
```

---

## Task 4: Verificación completa de la fase

**Files:** ninguno nuevo — solo correr y revisar.

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: todos los tests pasan (esta fase no agrega tests nuevos).

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Checklist manual (requiere `npm run dev` levantado y una
  sesión admin real)**

Avisar al usuario que confirme estos puntos a mano en `/admin/zak`:

- Las pestañas de la cara "Chat" son ahora Bandeja, Plantillas, Métricas,
  Prompt, Labs — sin Interesados ni Tandas.
- `/admin/zak?tab=interesados` o `?tab=tandas` (un deep-link viejo, ej. de
  un enlace guardado) no rompe nada: `pestanaInicial` ya cae a "bandeja"
  ante cualquier valor desconocido.
- La pestaña Métricas sigue mostrando los mismos números de tasa de
  respuesta e interesados que antes (los datos no se tocaron, solo la
  pestaña que los mostraba aparte).
- Desde `/admin/prospeccion`, seleccionar negocios y enviar una tanda sigue
  funcionando igual que antes (la acción no se tocó, solo perdió su visor
  dentro de Zak).
- Plantillas se ve en grid (1 columna en mobile, 2 en tablet, 3 en
  desktop ancho) y al abrir "Editar" en una tarjeta, esa tarjeta se
  expande a todo el ancho de su fila sin aplastar el formulario.

- [ ] **Step 5: Commit final si el checklist manual movió algo**

Si no hizo falta ningún cambio, no hay nada que commitear en este paso.
