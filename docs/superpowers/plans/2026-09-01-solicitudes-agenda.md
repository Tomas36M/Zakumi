# Solicitudes entrantes y agenda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda intención de contratar que consiga Zak —por llamada de voz o por WhatsApp— termine en `/admin/solicitudes`, en el WhatsApp de Tomás y Paula, y si hay cita, en Google Calendar con link de Meet y en una agenda propia del panel.

**Architecture:** `solicitudes` deja de ser "del portal" y pasa a ser la bandeja de todo interesado (`user_id` nullable + contacto propio + traza al origen). Las dos puntas de entrada (el webhook post-call de ElevenLabs, que ya existe, y un endpoint nuevo para el bot Flask) llaman a la MISMA función `registrarSolicitudEntrante()`, que inserta → agenda → avisa, degradando paso a paso y sin lanzar nunca. Google Calendar entra por `fetch` contra la API REST, sin SDK.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · Supabase (postgres + RLS, service-role solo en los dos endpoints públicos) · Tailwind v4 con los tokens de `admin-theme.css` · vitest · Google Calendar API v3 · ElevenLabs post-call webhook.

**Spec:** `docs/superpowers/specs/2026-09-01-solicitudes-agenda-design.md`

**Rama:** `feat/solicitudes-agenda`, ya creada, en el worktree `.claude/worktrees/agentes-voz` (sale de `feat/twilio-apikey`). Todo el trabajo va ahí — `main` no tiene el canal de voz.

## Global Constraints

- **Cero dependencias nuevas.** El repo no usa zod ni SDKs; Google Calendar entra con `fetch`. No añadir nada a `package.json`.
- **Español es-CO en todo el copy.** Prohibida la palabra "stack". Nada de Spanglish.
- **Contrato degradable:** toda función de integración devuelve un resultado y **jamás lanza**. Una caída de Google o del bot de avisos no puede tumbar la operación que la originó.
- **Envs de servidor jamás con prefijo `NEXT_PUBLIC`.** Los valores no se escriben en el repo, solo en `.env.local` y Vercel; `.env.example` lleva la clave vacía y su comentario.
- **`SUPABASE_SERVICE_ROLE_KEY` solo en los endpoints públicos** (`/api/voz/webhook`, `/api/zak/llamar`, y ahora `/api/zak/solicitud`). El resto de la app sigue en anon + RLS.
- **UI del panel: cockpit sin scroll de página.** Toda pantalla nueva usa `<Cockpit>` + `<CockpitBody>` de `src/components/admin/ui/Cockpit.tsx`. Componentes por debajo de ~200 líneas; si crece, se parte.
- **Todo selector CSS va prefijado.** Nada de `nav`/`footer` desnudos ni `.cta` (los estila la landing).
- **Comentarios en español**, explicando el *porqué* (el patrón del repo), no el *qué*.
- Zona horaria del negocio: **`America/Bogota`, UTC-5 fijo** (Colombia no tiene horario de verano).
- Correr `npm run lint` y `npx tsc --noEmit` antes de cada commit; `npm test` cuando la tarea toque tests.

---

# FASE 1 — La bandeja recibe

Al terminar la fase 1, una llamada real que consigue un interesado deja solicitud en `/admin/solicitudes` y avisa a los dos números. Sin Google todavía y **sin re-sincronizar ningún agente**.

---

### Task 1: Migración SQL y el tipo `Solicitud`

**Files:**
- Create: `supabase/solicitudes-entrada.sql`
- Modify: `src/lib/portal/solicitudes.ts:8-26` (el tipo `Solicitud`)

**Interfaces:**
- Consumes: nada.
- Produces: las columnas nuevas de `public.solicitudes` y el tipo `Solicitud` con `origen`, `contacto_nombre`, `contacto_telefono`, `contacto_email`, `llamada_id`, `conversacion`, `clave_origen`, `cita_inicio`, `cita_fin`, `cita_meet_url`, `cita_evento_id`, `cita_link_google`, `cita_texto_crudo`, y `user_id: string | null`. También el tipo `OrigenSolicitud`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/solicitudes-entrada.sql`:

```sql
-- Solicitudes entrantes: la bandeja deja de ser "del portal" y pasa a ser
-- TODO el que quiere contratarnos. Correr DESPUÉS de portal.sql.
--
-- Por qué se amplía en vez de crear tabla nueva: duplicar la máquina de
-- estados (src/lib/portal/solicitudes.ts), la bandeja y la vista para separar
-- filas que se trabajan exactamente igual no compra nada. El portal está
-- apagado (PORTAL_ABIERTO = false en src/proxy.ts), así que la tabla está
-- dormida y ampliarla no le rompe nada a ningún cliente.
--
-- ⚠️ La RLS del portal NO se toca y NO hace falta tocarla: la política del
-- cliente es `user_id = (select auth.uid())`, y con user_id NULL la
-- comparación da NULL → la fila se filtra. Ningún cliente del portal verá un
-- lead nuestro. Si algún día alguien "arregla" esa política con un IS NULL,
-- estaría abriendo la bandeja entera: no hacerlo.

alter table public.solicitudes
  alter column user_id drop not null;

alter table public.solicitudes
  add column if not exists origen            text not null default 'portal',
  add column if not exists contacto_nombre   text,
  add column if not exists contacto_telefono text,
  add column if not exists contacto_email    text,
  -- traza al hecho que la originó
  add column if not exists llamada_id        uuid references public.llamadas_voz (id) on delete set null,
  add column if not exists conversacion      text,
  -- idempotencia de la ingesta: 'voz:<conversation_id>' | 'wa:<ref del bot>'
  add column if not exists clave_origen      text,
  -- cita
  add column if not exists cita_inicio       timestamptz,
  add column if not exists cita_fin          timestamptz,
  add column if not exists cita_meet_url     text,
  add column if not exists cita_evento_id    text,
  add column if not exists cita_link_google  text,
  -- lo que dijo la persona cuando no hubo fecha parseable
  add column if not exists cita_texto_crudo  text;

-- `add constraint` NO acepta `if not exists`: drop + add para que el script
-- se pueda correr dos veces sin reventar (el resto ya es idempotente).
alter table public.solicitudes
  drop constraint if exists solicitudes_origen_chk,
  drop constraint if exists solicitudes_identifica_chk;

alter table public.solicitudes
  add constraint solicitudes_origen_chk
    check (origen in ('portal', 'voz', 'whatsapp')),
  -- toda solicitud identifica a alguien: cuenta de portal o teléfono
  add constraint solicitudes_identifica_chk
    check (user_id is not null or contacto_telefono is not null);

create unique index if not exists solicitudes_clave_origen_uq
  on public.solicitudes (clave_origen) where clave_origen is not null;

create index if not exists solicitudes_agenda_idx
  on public.solicitudes (cita_inicio) where cita_inicio is not null;
```

- [ ] **Step 2: Ampliar el tipo `Solicitud`**

En `src/lib/portal/solicitudes.ts`, reemplazar el `export type Solicitud` por:

```ts
/** De dónde salió la solicitud. 'portal' = la tienda; el resto, Zak. */
export type OrigenSolicitud = "portal" | "voz" | "whatsapp";

export type Solicitud = {
  id: string;
  /** null cuando la solicitud NO viene del portal (llamada o WhatsApp). */
  user_id: string | null;
  servicio_slug: string;
  mensaje: string | null;
  estado: EstadoSolicitud;
  cotizacion_monto: number | null;
  cotizacion_moneda: string;
  cotizacion_ciclo: Ciclo | null;
  cotizacion_nota: string | null;
  link_pago: string | null;
  producto_id: string | null;
  created_at: string;
  updated_at: string;

  // ---- Solicitudes entrantes (voz / WhatsApp) ----
  origen: OrigenSolicitud;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  llamada_id: string | null;
  conversacion: string | null;
  clave_origen: string | null;
  cita_inicio: string | null;
  cita_fin: string | null;
  cita_meet_url: string | null;
  cita_evento_id: string | null;
  cita_link_google: string | null;
  cita_texto_crudo: string | null;
};
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores. (`BandejaSolicitudes.tsx` usa `perfiles[s.user_id]` con `user_id` ahora nullable — si TypeScript se queja, **no lo silencies**: la Task 13 lo arregla de verdad; por ahora cámbialo a `perfiles[s.user_id ?? ""]` y deja el `// TODO Task 13` fuera, solo el cambio mínimo.)

- [ ] **Step 4: Correr la migración en Supabase**

Pegar el contenido de `supabase/solicitudes-entrada.sql` en el SQL editor de Supabase y ejecutar. Correrlo **dos veces** para comprobar que es idempotente: la segunda no debe dar error.

- [ ] **Step 5: Commit**

```bash
git add supabase/solicitudes-entrada.sql src/lib/portal/solicitudes.ts src/components/admin/solicitudes/BandejaSolicitudes.tsx
git commit -m "solicitudes: la bandeja acepta leads sin cuenta de portal (user_id nullable + contacto + cita)"
```

---

### Task 2: Avisos por WhatsApp a varios números

**Files:**
- Modify: `src/lib/portal/avisos.ts`
- Test: `src/lib/portal/__tests__/avisos.test.ts` (crear)

**Interfaces:**
- Consumes: `enviarManual` de `@/lib/bots/api` (ya existe).
- Produces: `destinatarios(crudo: string | undefined): string[]` y `avisarAdmin(texto: string): Promise<void>` (misma firma que hoy, ahora envía a todos).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/portal/__tests__/avisos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { destinatarios } from "../avisos";

describe("destinatarios", () => {
  it("parte por comas y limpia espacios", () => {
    expect(destinatarios(" 573007970810 , 573007909522 ")).toEqual([
      "573007970810",
      "573007909522",
    ]);
  });

  it("acepta el formato viejo de un solo número", () => {
    expect(destinatarios("573007970810")).toEqual(["573007970810"]);
  });

  it("descarta vacíos y duplicados", () => {
    expect(destinatarios("573007970810,,573007970810, ")).toEqual(["573007970810"]);
  });

  it("sin valor devuelve lista vacía", () => {
    expect(destinatarios(undefined)).toEqual([]);
    expect(destinatarios("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/portal/__tests__/avisos.test.ts`
Expected: FAIL — `destinatarios` no está exportado.

- [ ] **Step 3: Implementar**

Reemplazar el cuerpo de `src/lib/portal/avisos.ts` (dejando la cabecera de comentarios y el import) por:

```ts
/**
 * `AVISOS_WHATSAPP_TO` acepta una lista separada por comas. Un valor viejo
 * (un solo número) sigue funcionando: partir "573..." por comas da una lista
 * de uno. Se deduplica para que un copy-paste no mande el aviso dos veces.
 */
export function destinatarios(crudo: string | undefined): string[] {
  return [
    ...new Set(
      (crudo ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n !== ""),
    ),
  ];
}

export async function avisarAdmin(texto: string): Promise<void> {
  const iid = Number(process.env.AVISOS_BOT_INSTANCIA_ID ?? "");
  const para = destinatarios(process.env.AVISOS_WHATSAPP_TO);
  if (!Number.isInteger(iid) || iid <= 0 || para.length === 0) {
    console.error("[avisos] faltan AVISOS_BOT_INSTANCIA_ID / AVISOS_WHATSAPP_TO — aviso no enviado");
    return;
  }
  // Secuencial y con el error aislado por número: que uno malo no deje al
  // otro sin aviso. El bot no tiene envío en lote, así que son N llamadas.
  for (const numero of para) {
    const r = await enviarManual(iid, numero, texto);
    if (!r.ok) {
      console.error(`[avisos] el aviso a ${numero} no salió:`, r.error);
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/portal/__tests__/avisos.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Actualizar `.env.example`**

En `.env.example`, reemplazar el comentario y la línea de `AVISOS_WHATSAPP_TO` por:

```
# Avisos por WhatsApp cuando entra una solicitud (de la tienda, de una llamada
# o del bot): se envían con el bot ya desplegado. AVISOS_WHATSAPP_TO acepta
# VARIOS números separados por comas, formato 57XXXXXXXXXX.
# Si faltan, todo funciona igual — solo se pierde el aviso.
AVISOS_BOT_INSTANCIA_ID=1
AVISOS_WHATSAPP_TO=
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/portal/avisos.ts src/lib/portal/__tests__/avisos.test.ts .env.example
git commit -m "avisos: AVISOS_WHATSAPP_TO acepta varios números (Tomás y Pau)"
```

---

### Task 3: Parser de la fecha de la cita

**Files:**
- Create: `src/lib/solicitudes/fecha.ts`
- Test: `src/lib/solicitudes/__tests__/fecha.test.ts`

**Interfaces:**
- Consumes: nada (función pura).
- Produces: `type Cita = { inicio: string; fin: string }` (ISO UTC) y `parsearCita(crudo: unknown, opciones?: { ahora?: Date; duracionMin?: number }): Cita | null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/solicitudes/__tests__/fecha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsearCita } from "../fecha";

// Todas las pruebas anclan "ahora" para que no caduquen con el tiempo.
const AHORA = new Date("2026-09-01T15:00:00Z"); // 10:00 en Bogotá

describe("parsearCita", () => {
  it("ancla una fecha sin zona a Bogotá (UTC-5)", () => {
    const r = parsearCita("2026-09-03T10:00", { ahora: AHORA });
    expect(r).toEqual({
      inicio: "2026-09-03T15:00:00.000Z",
      fin: "2026-09-03T15:30:00.000Z",
    });
  });

  it("acepta segundos y espacio en vez de T", () => {
    const r = parsearCita("2026-09-03 10:00:00", { ahora: AHORA });
    expect(r?.inicio).toBe("2026-09-03T15:00:00.000Z");
  });

  it("respeta la zona cuando el agente sí la manda", () => {
    const r = parsearCita("2026-09-03T15:00:00Z", { ahora: AHORA });
    expect(r?.inicio).toBe("2026-09-03T15:00:00.000Z");
  });

  it("respeta la duración pedida", () => {
    const r = parsearCita("2026-09-03T10:00", { ahora: AHORA, duracionMin: 45 });
    expect(r?.fin).toBe("2026-09-03T15:45:00.000Z");
  });

  it("descarta el pasado", () => {
    expect(parsearCita("2026-08-30T10:00", { ahora: AHORA })).toBeNull();
  });

  it("descarta fechas absurdamente lejanas (alucinación de año)", () => {
    expect(parsearCita("2027-09-03T10:00", { ahora: AHORA })).toBeNull();
  });

  it("descarta texto libre y valores que no son texto", () => {
    expect(parsearCita("el jueves por la tarde", { ahora: AHORA })).toBeNull();
    expect(parsearCita("", { ahora: AHORA })).toBeNull();
    expect(parsearCita(null, { ahora: AHORA })).toBeNull();
    expect(parsearCita(42, { ahora: AHORA })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/solicitudes/__tests__/fecha.test.ts`
Expected: FAIL — no existe `../fecha`.

- [ ] **Step 3: Implementar**

Crear `src/lib/solicitudes/fecha.ts`:

```ts
// Parser de la fecha que extrae el agente (`cita_fecha_hora`). Función pura y
// desconfiada: si no es una fecha futura, cercana y legible, devuelve null y
// el llamador guarda el texto crudo. Preferimos "no agendé, ponle hora tú"
// antes que inventar una reunión que nadie va a atender.

/** Bogotá es UTC-5 todo el año (Colombia no tiene horario de verano), así que
 *  una fecha sin zona se ancla con -05:00 sin necesitar librería de zonas. */
const OFFSET_BOGOTA = "-05:00";
const SIN_ZONA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
/** Más allá de esto es una alucinación de año, no una cita. */
const MAX_DIAS = 90;
export const DURACION_POR_DEFECTO_MIN = 30;

export type Cita = { inicio: string; fin: string };

export function parsearCita(
  crudo: unknown,
  opciones: { ahora?: Date; duracionMin?: number } = {},
): Cita | null {
  if (typeof crudo !== "string") return null;
  const texto = crudo.trim();
  if (texto === "") return null;

  const conZona = SIN_ZONA.test(texto)
    ? `${texto.replace(" ", "T")}${OFFSET_BOGOTA}`
    : texto;
  const inicio = new Date(conZona);
  if (Number.isNaN(inicio.getTime())) return null;

  const ahora = opciones.ahora ?? new Date();
  if (inicio.getTime() <= ahora.getTime()) return null;
  if ((inicio.getTime() - ahora.getTime()) / 86_400_000 > MAX_DIAS) return null;

  const duracion = opciones.duracionMin ?? DURACION_POR_DEFECTO_MIN;
  return {
    inicio: inicio.toISOString(),
    fin: new Date(inicio.getTime() + duracion * 60_000).toISOString(),
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/solicitudes/__tests__/fecha.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/solicitudes/fecha.ts src/lib/solicitudes/__tests__/fecha.test.ts
git commit -m "solicitudes: parser de la fecha de cita — desconfiado y anclado a Bogotá"
```

---

### Task 4: El servicio pedido → slug del catálogo

**Files:**
- Modify: `src/lib/catalogo.ts` (añadir al final)
- Test: `src/lib/__tests__/catalogo.test.ts` (crear si no existe; si existe, añadir el `describe`)

**Interfaces:**
- Consumes: `CATALOGO_ZAKUMI` de `src/lib/catalogo.ts`.
- Produces: `SLUG_POR_DEFINIR = "por-definir"` y `slugDeInteres(texto: unknown): string`.

- [ ] **Step 1: Comprobar si el test ya existe**

Run: `ls src/lib/__tests__/`
Si `catalogo.test.ts` existe, **añade** el `describe` de abajo al final; no lo sobrescribas (un `Write` sobre un test existente ya pisó 6 tests en este repo el 29 ago).

- [ ] **Step 2: Escribir el test que falla**

En `src/lib/__tests__/catalogo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { slugDeInteres, SLUG_POR_DEFINIR } from "../catalogo";

describe("slugDeInteres", () => {
  it("reconoce lo que el agente dice tal cual", () => {
    expect(slugDeInteres("bot de WhatsApp")).toBe("bot-whatsapp");
    expect(slugDeInteres("Página web")).toBe("pagina-web");
    expect(slugDeInteres("mantenimiento")).toBe("mantenimiento-web");
    expect(slugDeInteres("CRM")).toBe("crm");
    expect(slugDeInteres("agente de voz")).toBe("agente-voz");
  });

  it("ignora tildes y mayúsculas", () => {
    expect(slugDeInteres("PAGINA WEB")).toBe("pagina-web");
    expect(slugDeInteres("whatsapp")).toBe("bot-whatsapp");
  });

  it("acepta el slug exacto", () => {
    expect(slugDeInteres("bot-whatsapp")).toBe("bot-whatsapp");
  });

  it("cae en 'por-definir' cuando no reconoce nada", () => {
    expect(slugDeInteres("algo raro")).toBe(SLUG_POR_DEFINIR);
    expect(slugDeInteres(null)).toBe(SLUG_POR_DEFINIR);
    expect(slugDeInteres("")).toBe(SLUG_POR_DEFINIR);
  });

  // 'mantenimiento web' contiene 'web': el orden de las reglas importa.
  it("no confunde mantenimiento con página web", () => {
    expect(slugDeInteres("mantenimiento web")).toBe("mantenimiento-web");
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/__tests__/catalogo.test.ts`
Expected: FAIL — `slugDeInteres` no existe.

- [ ] **Step 4: Implementar**

Añadir al final de `src/lib/catalogo.ts`:

```ts
/** Solicitud entrante donde el agente no logró identificar el servicio. No
 *  está en el catálogo a propósito: la bandeja lo muestra crudo y eso es una
 *  señal útil ("hay que preguntarle"), no un error. */
export const SLUG_POR_DEFINIR = "por-definir";

/** Palabras clave por slug. El ORDEN importa: 'mantenimiento web' contiene
 *  'web', así que mantenimiento tiene que evaluarse antes que página web. */
const CLAVES: readonly { slug: string; palabras: readonly string[] }[] = [
  { slug: "mantenimiento-web", palabras: ["mantenimiento", "soporte"] },
  { slug: "bot-whatsapp", palabras: ["whatsapp", "bot", "chatbot"] },
  { slug: "agente-voz", palabras: ["voz", "llamada", "telefono", "call"] },
  { slug: "crm", palabras: ["crm", "clientes"] },
  { slug: "pagina-web", palabras: ["pagina", "web", "sitio", "landing"] },
] as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Lo que el agente extrajo en `servicio_interes` (texto libre) → slug del
 * catálogo. Nunca lanza y nunca devuelve vacío: sin coincidencia,
 * SLUG_POR_DEFINIR.
 */
export function slugDeInteres(texto: unknown): string {
  if (typeof texto !== "string" || texto.trim() === "") return SLUG_POR_DEFINIR;
  const t = normalizar(texto);
  const exacto = CATALOGO_ZAKUMI.find((s) => s.slug === t.trim());
  if (exacto) return exacto.slug;
  for (const { slug, palabras } of CLAVES) {
    if (palabras.some((p) => t.includes(p))) return slug;
  }
  return SLUG_POR_DEFINIR;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/__tests__/catalogo.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalogo.ts src/lib/__tests__/catalogo.test.ts
git commit -m "catalogo: slugDeInteres — el servicio que dijo la persona al slug del catálogo"
```

---

### Task 5: El texto del aviso de WhatsApp

**Files:**
- Create: `src/lib/solicitudes/mensaje.ts`
- Test: `src/lib/solicitudes/__tests__/mensaje.test.ts`

**Interfaces:**
- Consumes: nada (función pura).
- Produces: `type DatosAviso` y `construirAviso(d: DatosAviso): string`. Lo usa `entrada.ts` (Task 6).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/solicitudes/__tests__/mensaje.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { construirAviso, type DatosAviso } from "../mensaje";

const BASE: DatosAviso = {
  origen: "voz",
  nombre: "María Pérez",
  telefono: "+573001112233",
  servicio: "Bot de WhatsApp",
  detalle: "Quiere un bot para su restaurante, 3 sedes",
  mejorHorario: null,
  cita: null,
  citaTextoCrudo: null,
  meetUrl: null,
  choque: false,
  urlPanel: "https://zakumistudio.com/admin/solicitudes",
};

describe("construirAviso", () => {
  it("arma el aviso base con contacto, servicio y detalle", () => {
    const t = construirAviso(BASE);
    expect(t).toContain("Nueva solicitud — llamada de voz");
    expect(t).toContain("María Pérez · +573001112233");
    expect(t).toContain("Servicio: Bot de WhatsApp");
    expect(t).toContain("Quiere un bot para su restaurante, 3 sedes");
    expect(t).toContain("https://zakumistudio.com/admin/solicitudes");
  });

  it("dice el canal correcto para WhatsApp", () => {
    expect(construirAviso({ ...BASE, origen: "whatsapp" })).toContain(
      "Nueva solicitud — conversación de WhatsApp",
    );
  });

  it("muestra la cita en hora de Bogotá con el link de Meet", () => {
    const t = construirAviso({
      ...BASE,
      cita: { inicio: "2026-09-03T15:00:00.000Z", fin: "2026-09-03T15:30:00.000Z" },
      meetUrl: "https://meet.google.com/abc-defg-hij",
    });
    // 15:00Z = 10:00 en Bogotá
    expect(t).toMatch(/10:00/);
    expect(t).toContain("septiembre");
    expect(t).toContain("https://meet.google.com/abc-defg-hij");
  });

  it("marca el choque de horario sin esconder la cita", () => {
    const t = construirAviso({
      ...BASE,
      cita: { inicio: "2026-09-03T15:00:00.000Z", fin: "2026-09-03T15:30:00.000Z" },
      choque: true,
    });
    expect(t).toContain("⚠️");
    expect(t).toMatch(/10:00/);
  });

  it("pide poner la hora a mano cuando la fecha no se pudo entender", () => {
    const t = construirAviso({ ...BASE, citaTextoCrudo: "el jueves por la tarde" });
    expect(t).toContain("el jueves por la tarde");
    expect(t).toContain("ponle hora tú");
    expect(t).not.toContain("meet.google.com");
  });

  it("no deja líneas de campos vacíos", () => {
    const t = construirAviso({
      ...BASE,
      nombre: null,
      servicio: null,
      detalle: null,
    });
    expect(t).toContain("+573001112233");
    expect(t).not.toContain("Servicio:");
    expect(t).not.toContain("null");
    expect(t).not.toMatch(/\n\n\n/);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/solicitudes/__tests__/mensaje.test.ts`
Expected: FAIL — no existe `../mensaje`.

- [ ] **Step 3: Implementar**

Crear `src/lib/solicitudes/mensaje.ts`:

```ts
// El texto del aviso de WhatsApp. Puro y testeable: el formato del mensaje es
// lo único que Tomás y Paula ven de todo este subsistema, así que se prueba
// aparte de la red y de la base.

import type { Cita } from "./fecha";

export type DatosAviso = {
  origen: "voz" | "whatsapp";
  nombre: string | null;
  telefono: string | null;
  servicio: string | null;
  detalle: string | null;
  mejorHorario: string | null;
  cita: Cita | null;
  citaTextoCrudo: string | null;
  meetUrl: string | null;
  choque: boolean;
  urlPanel: string;
};

const CANAL: Record<DatosAviso["origen"], string> = {
  voz: "llamada de voz",
  whatsapp: "conversación de WhatsApp",
};

const FORMATO = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "full",
  timeStyle: "short",
});

/** Fecha ISO → "martes, 3 de septiembre de 2026, 10:00" en hora de Bogotá. */
export function fechaLegible(iso: string): string {
  return FORMATO.format(new Date(iso));
}

export function construirAviso(d: DatosAviso): string {
  const lineas: string[] = [`🟠 Nueva solicitud — ${CANAL[d.origen]}`];

  const quien = [d.nombre, d.telefono].filter((x) => x).join(" · ");
  lineas.push(quien || "sin datos de contacto");
  if (d.servicio) lineas.push(`Servicio: ${d.servicio}`);
  if (d.detalle) lineas.push(`«${d.detalle}»`);
  if (d.mejorHorario) lineas.push(`Prefiere que lo contacten: ${d.mejorHorario}`);

  if (d.cita) {
    lineas.push("");
    lineas.push(`📅 ${fechaLegible(d.cita.inicio)}${d.choque ? "  ⚠️ choca con otro evento" : ""}`);
    if (d.meetUrl) lineas.push(`🎥 ${d.meetUrl}`);
    else lineas.push("(sin link de Meet — el calendario no respondió)");
  } else if (d.citaTextoCrudo) {
    lineas.push("");
    lineas.push(`📅 Quiere agendar: «${d.citaTextoCrudo}» — sin fecha clara, ponle hora tú.`);
  }

  lineas.push("");
  lineas.push(`→ ${d.urlPanel}`);
  return lineas.join("\n");
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/solicitudes/__tests__/mensaje.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/solicitudes/mensaje.ts src/lib/solicitudes/__tests__/mensaje.test.ts
git commit -m "solicitudes: el texto del aviso de WhatsApp, puro y probado"
```

---

### Task 6: `registrarSolicitudEntrante()` — el camino único

**Files:**
- Create: `src/lib/agenda/tipos.ts`
- Create: `src/lib/solicitudes/entrada.ts`
- Test: `src/lib/solicitudes/__tests__/entrada.test.ts`

**Interfaces:**
- Consumes: `parsearCita`/`Cita` (Task 3), `slugDeInteres`/`SLUG_POR_DEFINIR` (Task 4), `construirAviso` (Task 5), `avisarAdmin` (Task 2).
- Produces:
  - `src/lib/agenda/tipos.ts`: `type EventoAgendado = { eventoId: string; meetUrl: string | null; linkGoogle: string | null }` y `type Calendario = { crearEvento(d: { titulo: string; descripcion: string; inicio: string; fin: string }): Promise<EventoAgendado | null>; hayChoque(inicio: string, fin: string): Promise<boolean> }`.
  - `src/lib/solicitudes/entrada.ts`: `type EntradaSolicitud`, `type ResultadoEntrada`, `type DepsEntrada`, `registrarSolicitudEntrante(supabase, entrada, deps?)`.

- [ ] **Step 1: Definir el contrato del calendario (sin implementarlo)**

Crear `src/lib/agenda/tipos.ts`:

```ts
// El contrato del calendario, aparte de su implementación (google.ts) para que
// `entrada.ts` se pueda probar sin red y para que la fase 1 funcione sin
// Google configurado: si no hay calendario, la solicitud igual queda guardada
// y el aviso lo dice.

export type EventoAgendado = {
  eventoId: string;
  meetUrl: string | null;
  linkGoogle: string | null;
};

export type Calendario = {
  /** null = no se pudo crear el evento (red, credenciales, respuesta rara). */
  crearEvento(datos: {
    titulo: string;
    descripcion: string;
    inicio: string;
    fin: string;
  }): Promise<EventoAgendado | null>;
  /** Solo informa: un choque NO impide agendar (perder la cita es peor). */
  hayChoque(inicio: string, fin: string): Promise<boolean>;
};
```

- [ ] **Step 2: Escribir el test que falla**

Crear `src/lib/solicitudes/__tests__/entrada.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { registrarSolicitudEntrante, type EntradaSolicitud } from "../entrada";
import type { Calendario } from "@/lib/agenda/tipos";

const AHORA = new Date("2026-09-01T15:00:00Z");

/** Supabase de mentira: registra lo insertado/actualizado y deja simular el
 *  choque de clave única (23505) que produce un reintento del webhook. */
function supabaseFalso(opciones: { errorInsert?: { code: string } } = {}) {
  const insertado: Record<string, unknown>[] = [];
  const actualizado: Record<string, unknown>[] = [];
  const cliente = {
    from() {
      return {
        insert(fila: Record<string, unknown>) {
          insertado.push(fila);
          return {
            select() {
              return {
                single: async () =>
                  opciones.errorInsert
                    ? { data: null, error: opciones.errorInsert }
                    : { data: { id: "sol-1" }, error: null },
              };
            },
          };
        },
        update(campos: Record<string, unknown>) {
          actualizado.push(campos);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  // El tipo real de SupabaseClient es enorme; en el test solo importan estos
  // dos métodos, así que se castea a propósito.
  return { cliente: cliente as never, insertado, actualizado };
}

const BASE: EntradaSolicitud = {
  origen: "voz",
  claveOrigen: "voz:conv_abc",
  contacto: { nombre: "María", telefono: "+573001112233", email: null },
  servicioInteres: "bot de WhatsApp",
  detalle: "Quiere un bot para su restaurante",
  mejorHorario: null,
  citaCruda: null,
  llamadaId: "llamada-1",
  conversacion: null,
};

const calendarioOk: Calendario = {
  crearEvento: async () => ({
    eventoId: "ev-1",
    meetUrl: "https://meet.google.com/abc-defg-hij",
    linkGoogle: "https://calendar.google.com/event?eid=ev-1",
  }),
  hayChoque: async () => false,
};

describe("registrarSolicitudEntrante", () => {
  it("inserta la solicitud con el slug del catálogo y avisa", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn(async () => {});

    const r = await registrarSolicitudEntrante(cliente, BASE, { avisar, ahora: AHORA });

    expect(r).toEqual({ estado: "creada", solicitudId: "sol-1", agendada: false });
    expect(insertado[0]).toMatchObject({
      origen: "voz",
      estado: "nueva",
      user_id: null,
      servicio_slug: "bot-whatsapp",
      contacto_nombre: "María",
      contacto_telefono: "+573001112233",
      clave_origen: "voz:conv_abc",
      llamada_id: "llamada-1",
    });
    expect(avisar).toHaveBeenCalledOnce();
    expect(avisar.mock.calls[0][0]).toContain("María");
  });

  it("agenda y guarda el Meet cuando la fecha es buena", async () => {
    const { cliente, actualizado } = supabaseFalso();
    const avisar = vi.fn(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: calendarioOk, ahora: AHORA },
    );

    expect(r).toEqual({ estado: "creada", solicitudId: "sol-1", agendada: true });
    expect(actualizado[0]).toMatchObject({
      cita_meet_url: "https://meet.google.com/abc-defg-hij",
      cita_evento_id: "ev-1",
    });
    expect(avisar.mock.calls[0][0]).toContain("meet.google.com");
  });

  it("guarda el texto crudo cuando la fecha no se entiende", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "el jueves por la tarde" },
      { avisar, calendario: calendarioOk, ahora: AHORA },
    );

    expect(r).toMatchObject({ agendada: false });
    expect(insertado[0]).toMatchObject({
      cita_texto_crudo: "el jueves por la tarde",
      cita_inicio: null,
    });
    expect(avisar.mock.calls[0][0]).toContain("ponle hora tú");
  });

  it("si el calendario falla, la solicitud igual queda y el aviso sale", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn(async () => {});
    const calendarioCaido: Calendario = {
      crearEvento: async () => null,
      hayChoque: async () => false,
    };

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: calendarioCaido, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "creada", agendada: false });
    expect(avisar).toHaveBeenCalledOnce();
    expect(avisar.mock.calls[0][0]).toContain("el calendario no respondió");
  });

  it("marca el choque de horario en el aviso pero agenda igual", async () => {
    const { cliente } = supabaseFalso();
    const avisar = vi.fn(async () => {});
    const conChoque: Calendario = { ...calendarioOk, hayChoque: async () => true };

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: conChoque, ahora: AHORA },
    );

    expect(r).toMatchObject({ agendada: true });
    expect(avisar.mock.calls[0][0]).toContain("⚠️");
  });

  it("un reintento del webhook no duplica ni vuelve a avisar", async () => {
    const { cliente } = supabaseFalso({ errorInsert: { code: "23505" } });
    const avisar = vi.fn(async () => {});

    const r = await registrarSolicitudEntrante(cliente, BASE, { avisar, ahora: AHORA });

    expect(r).toEqual({ estado: "duplicada" });
    expect(avisar).not.toHaveBeenCalled();
  });

  it("sin teléfono ni cuenta no inserta nada (lo prohíbe el check de la tabla)", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, contacto: { nombre: "María", telefono: null, email: null } },
      { avisar, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "error" });
    expect(insertado).toHaveLength(0);
  });

  it("sin calendario configurado guarda la cita y lo dice en el aviso", async () => {
    const { cliente, insertado } = supabaseFalso();
    const avisar = vi.fn(async () => {});

    const r = await registrarSolicitudEntrante(
      cliente,
      { ...BASE, citaCruda: "2026-09-03T10:00" },
      { avisar, calendario: null, ahora: AHORA },
    );

    expect(r).toMatchObject({ estado: "creada", agendada: false });
    expect(insertado[0]).toMatchObject({ cita_inicio: "2026-09-03T15:00:00.000Z" });
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/solicitudes/__tests__/entrada.test.ts`
Expected: FAIL — no existe `../entrada`.

- [ ] **Step 4: Implementar**

Crear `src/lib/solicitudes/entrada.ts`:

```ts
// El ÚNICO camino por el que entra una solicitud que no viene del portal.
// Lo llaman las dos puntas: el webhook post-call de ElevenLabs y el endpoint
// /api/zak/solicitud del bot de WhatsApp. Escribir esto una sola vez es la
// razón de que exista el módulo.
//
// SOLO SERVIDOR. Contrato degradable, como todo el repo: NUNCA lanza, y cada
// paso que falle deja el anterior en pie — si Google se cae, la solicitud
// igual queda en la bandeja; si el bot de avisos se cae, la cita igual queda
// en el calendario.

import type { SupabaseClient } from "@supabase/supabase-js";
import { servicioDelSlug, slugDeInteres } from "@/lib/catalogo";
import { avisarAdmin } from "@/lib/portal/avisos";
import type { Calendario } from "@/lib/agenda/tipos";
import { parsearCita, type Cita } from "./fecha";
import { construirAviso } from "./mensaje";

export type EntradaSolicitud = {
  origen: "voz" | "whatsapp";
  /** Clave de idempotencia: 'voz:<conversation_id>' | 'wa:<ref del bot>'. */
  claveOrigen: string;
  contacto: { nombre?: string | null; telefono?: string | null; email?: string | null };
  /** Texto libre de lo que dijo que le interesaba. */
  servicioInteres?: string | null;
  detalle?: string | null;
  mejorHorario?: string | null;
  /** Lo que el agente extrajo como fecha; puede ser texto libre o basura. */
  citaCruda?: unknown;
  llamadaId?: string | null;
  conversacion?: string | null;
};

export type ResultadoEntrada =
  | { estado: "creada"; solicitudId: string; agendada: boolean }
  | { estado: "duplicada" }
  | { estado: "error"; motivo: string };

export type DepsEntrada = {
  /** null = sin Google configurado. La fase 1 corre así a propósito. */
  calendario?: Calendario | null;
  avisar?: (texto: string) => Promise<void>;
  ahora?: Date;
};

function urlPanel(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zakumistudio.com";
  return `${base.replace(/\/$/, "")}/admin/solicitudes`;
}

function limpio(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function registrarSolicitudEntrante(
  supabase: SupabaseClient,
  entrada: EntradaSolicitud,
  deps: DepsEntrada = {},
): Promise<ResultadoEntrada> {
  const avisar = deps.avisar ?? avisarAdmin;
  const calendario = deps.calendario ?? null;

  const telefono = limpio(entrada.contacto.telefono);
  const nombre = limpio(entrada.contacto.nombre);
  const email = limpio(entrada.contacto.email);
  // El check solicitudes_identifica_chk lo exige; comprobarlo aquí evita
  // gastar un round-trip para recibir un 23514 ilegible.
  if (!telefono) {
    console.error("[solicitud entrante] sin teléfono de contacto:", entrada.claveOrigen);
    return { estado: "error", motivo: "sin_contacto" };
  }

  const slug = slugDeInteres(entrada.servicioInteres);
  const detalle = limpio(entrada.detalle);
  const citaCrudaTexto = limpio(entrada.citaCruda);
  const duracionMin = Number(process.env.AGENDA_DURACION_MIN ?? "");
  const cita: Cita | null = parsearCita(entrada.citaCruda, {
    ahora: deps.ahora,
    duracionMin: Number.isInteger(duracionMin) && duracionMin > 0 ? duracionMin : undefined,
  });

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
    conversacion: entrada.conversacion ?? null,
    clave_origen: entrada.claveOrigen,
    cita_inicio: cita?.inicio ?? null,
    cita_fin: cita?.fin ?? null,
    // Solo se guarda el crudo cuando NO se pudo parsear: si hay cita, el crudo
    // sobra y ensucia la bandeja.
    cita_texto_crudo: cita ? null : citaCrudaTexto,
  };

  const { data, error } = await supabase
    .from("solicitudes")
    .insert(fila)
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation sobre solicitudes_clave_origen_uq: es un
    // reintento del webhook, no un fallo. Cortar sin volver a avisar.
    if (error.code === "23505") return { estado: "duplicada" };
    console.error("[solicitud entrante] insert:", error.message);
    return { estado: "error", motivo: "db" };
  }
  const solicitudId = String((data as { id: string }).id);

  let meetUrl: string | null = null;
  let choque = false;
  if (cita && calendario) {
    // El choque solo informa: se agenda igual (perder una cita conseguida es
    // peor que solapar dos eventos en el calendario).
    choque = await calendario.hayChoque(cita.inicio, cita.fin);
    const titulo = `Zakumi · ${nombre ?? telefono}`;
    const evento = await calendario.crearEvento({
      titulo,
      descripcion: [
        detalle ? `Lo que pidió: ${detalle}` : null,
        `Servicio: ${servicioDelSlug(slug)?.nombre ?? "por definir"}`,
        `Contacto: ${telefono}`,
        `Origen: ${entrada.origen}`,
        urlPanel(),
      ]
        .filter((l) => l)
        .join("\n"),
      inicio: cita.inicio,
      fin: cita.fin,
    });
    if (evento) {
      meetUrl = evento.meetUrl;
      const { error: errUpd } = await supabase
        .from("solicitudes")
        .update({
          cita_meet_url: evento.meetUrl,
          cita_evento_id: evento.eventoId,
          cita_link_google: evento.linkGoogle,
        })
        .eq("id", solicitudId);
      if (errUpd) console.error("[solicitud entrante] update cita:", errUpd.message);
    }
  }

  await avisar(
    construirAviso({
      origen: entrada.origen,
      nombre,
      telefono,
      servicio: servicioDelSlug(slug)?.nombre ?? null,
      detalle,
      mejorHorario: limpio(entrada.mejorHorario),
      cita,
      citaTextoCrudo: cita ? null : citaCrudaTexto,
      meetUrl,
      choque,
      urlPanel: urlPanel(),
    }),
  );

  return { estado: "creada", solicitudId, agendada: meetUrl !== null };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/solicitudes/__tests__/entrada.test.ts`
Expected: PASS (8 tests).

Nota: el test "sin calendario configurado" espera `agendada: false` **con la cita guardada** — `cita_inicio` se escribe siempre que la fecha parsee, haya o no Google.

- [ ] **Step 6: Correr toda la batería y verificar que nada se rompió**

Run: `npm test`
Expected: PASS. Anota el total de tests: si baja respecto a antes de esta tarea, alguien pisó un archivo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agenda/tipos.ts src/lib/solicitudes/entrada.ts src/lib/solicitudes/__tests__/entrada.test.ts
git commit -m "solicitudes: registrarSolicitudEntrante — insertar, agendar y avisar en un solo camino"
```

---

### Task 7: Engancharlo al webhook de voz

**Files:**
- Modify: `src/app/api/voz/webhook/route.ts:60-104` (el bloque del aviso)
- Test: `src/lib/voz/__tests__/webhook.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `registrarSolicitudEntrante` (Task 6), `avisarAdmin` (Task 2).
- Produces: nada nuevo hacia otras tareas.

- [ ] **Step 1: Añadir el fixture del test**

Al final de `src/lib/voz/__tests__/webhook.test.ts`, **añadir** (no reemplazar el archivo):

```ts
describe("parseEventoPostCall — campos de solicitud y cita", () => {
  it("aplana servicio_interes y cita_fecha_hora como el resto de la extracción", () => {
    const r = parseEventoPostCall(
      evento({
        analysis: {
          data_collection_results: {
            lead_nombre: { value: "María" },
            lead_detalle: { value: "Quiere un bot para su restaurante" },
            servicio_interes: { value: "bot de WhatsApp" },
            cita_fecha_hora: { value: "2026-09-03T10:00" },
            cita_confirmada: { value: true },
          },
          call_successful: "success",
          transcript_summary: "María quiere un bot.",
        },
      }),
    );
    if (r.tipo !== "llamada") throw new Error("debió parsear");
    expect(r.params.p_datos).toEqual({
      lead_nombre: "María",
      lead_detalle: "Quiere un bot para su restaurante",
      servicio_interes: "bot de WhatsApp",
      cita_fecha_hora: "2026-09-03T10:00",
      cita_confirmada: true,
    });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que pasa ya**

Run: `npx vitest run src/lib/voz/__tests__/webhook.test.ts`
Expected: PASS. El parser es genérico, así que este test **documenta** que los campos nuevos viajan sin cambios de código. Si falla, el parser no es tan genérico como creemos y hay que arreglarlo antes de seguir.

- [ ] **Step 3: Reemplazar el bloque del aviso en el route handler**

En `src/app/api/voz/webhook/route.ts`, sustituir todo el bloque que va desde el comentario `// Aviso de lead por WhatsApp — fire-and-forget…` hasta el cierre del `if (debeAvisar) { … }` por:

```ts
  // Qué hacemos al colgar, según de quién sea el agente:
  //   - agente NUESTRO (sin_cliente): la persona es un prospecto de Zakumi →
  //     solicitud en la bandeja + cita + aviso (todo dentro de entrada.ts).
  //   - agente DE UN CLIENTE (lead): se comporta igual que siempre — la venta
  //     ya la creó la RPC en ventas_cliente y aquí solo sale el aviso.
  // 'prueba' (el lab del panel) nunca produce efectos comerciales. Del agente
  // interno solo cuentan saliente/entrante: sus sesiones de widget son casi
  // siempre el propio lab.
  const d = evento.params.p_datos ?? {};
  const dir = evento.params.p_direccion;
  const texto = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

  const hayDatosLead =
    texto(d.lead_nombre) !== null ||
    texto(d.lead_telefono) !== null ||
    texto(d.lead_detalle) !== null ||
    texto(d.servicio_interes) !== null ||
    d.lead_interesado === true;

  if (r.status === "ok" && dir !== "prueba") {
    // '' del extractor no es un teléfono: cae al número marcado del evento.
    const telLead = texto(d.lead_telefono) ?? evento.params.p_telefono;

    if (r.sin_cliente === true && hayDatosLead && (dir === "saliente" || dir === "entrante")) {
      // La RPC no devuelve el id de la llamada: se busca por conversation_id
      // (tiene índice único) en vez de tocar una RPC que ya está en producción.
      const { data: llamada } = await supabase
        .from("llamadas_voz")
        .select("id")
        .eq("conversation_id", evento.params.p_conversation_id)
        .maybeSingle();

      await registrarSolicitudEntrante(supabase, {
        origen: "voz",
        claveOrigen: `voz:${evento.params.p_conversation_id}`,
        contacto: { nombre: texto(d.lead_nombre), telefono: telLead, email: null },
        servicioInteres: texto(d.servicio_interes),
        detalle: texto(d.lead_detalle) ?? evento.params.p_resumen,
        mejorHorario: texto(d.mejor_horario),
        citaCruda: d.cita_fecha_hora,
        llamadaId: (llamada as { id?: string } | null)?.id ?? null,
      });
    } else if (r.lead === true) {
      const quien = [d.lead_nombre, telLead]
        .filter((x): x is string => typeof x === "string" && x !== "")
        .join(" · ");
      await avisarAdmin(
        `🎙️ Lead por llamada de voz — ${r.agente_nombre ?? "agente"}\n` +
          `${quien || "sin datos de contacto"}\n` +
          `${evento.params.p_resumen ?? ""}`.trim(),
      );
    }
  }
```

Y añadir el import al principio del archivo:

```ts
import { registrarSolicitudEntrante } from "@/lib/solicitudes/entrada";
```

- [ ] **Step 4: Verificar que compila y que la batería sigue verde**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: sin errores, todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/voz/webhook/route.ts src/lib/voz/__tests__/webhook.test.ts
git commit -m "voz: al colgar, un prospecto de Zakumi deja solicitud en la bandeja"
```

**FASE 1 COMPLETA.** Desplegable: una llamada saliente real que consigue un interesado ya aparece en `/admin/solicitudes` y avisa a los dos números. Sin Google y sin tocar ningún agente.

---

# FASE 2 — Google Calendar con Meet

---

### Task 8: El cliente de Google Calendar

**Files:**
- Create: `src/lib/agenda/google.ts`
- Test: `src/lib/agenda/__tests__/google.test.ts`

**Interfaces:**
- Consumes: `Calendario`, `EventoAgendado` de `src/lib/agenda/tipos.ts` (Task 6).
- Produces: `cuerpoEvento(...)`, `leerEvento(json): EventoAgendado | null`, `hayOcupado(json): boolean` (puros, testeados) y `calendarioGoogle(): Calendario | null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/agenda/__tests__/google.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cuerpoEvento, hayOcupado, leerEvento } from "../google";

describe("cuerpoEvento", () => {
  const datos = {
    titulo: "Zakumi · María",
    descripcion: "Quiere un bot",
    inicio: "2026-09-03T15:00:00.000Z",
    fin: "2026-09-03T15:30:00.000Z",
  };

  it("pide una sala de Meet con requestId propio", () => {
    const c = cuerpoEvento(datos, ["a@x.com"], "req-1");
    expect(c.conferenceData).toEqual({
      createRequest: {
        requestId: "req-1",
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    });
  });

  it("manda las horas con la zona del negocio", () => {
    const c = cuerpoEvento(datos, ["a@x.com"], "req-1");
    expect(c.start).toEqual({
      dateTime: "2026-09-03T15:00:00.000Z",
      timeZone: "America/Bogota",
    });
    expect(c.end).toMatchObject({ timeZone: "America/Bogota" });
  });

  it("invita a todos los correos configurados", () => {
    const c = cuerpoEvento(datos, ["tom@x.com", "pau@x.com"], "req-1");
    expect(c.attendees).toEqual([{ email: "tom@x.com" }, { email: "pau@x.com" }]);
  });
});

describe("leerEvento", () => {
  it("saca id, Meet y link del evento creado", () => {
    const r = leerEvento({
      id: "ev-1",
      hangoutLink: "https://meet.google.com/abc-defg-hij",
      htmlLink: "https://calendar.google.com/event?eid=ev-1",
    });
    expect(r).toEqual({
      eventoId: "ev-1",
      meetUrl: "https://meet.google.com/abc-defg-hij",
      linkGoogle: "https://calendar.google.com/event?eid=ev-1",
    });
  });

  it("cae a entryPoints cuando no viene hangoutLink", () => {
    const r = leerEvento({
      id: "ev-2",
      conferenceData: {
        entryPoints: [
          { entryPointType: "more", uri: "https://tel.meet/x" },
          { entryPointType: "video", uri: "https://meet.google.com/zzz-zzzz-zzz" },
        ],
      },
    });
    expect(r?.meetUrl).toBe("https://meet.google.com/zzz-zzzz-zzz");
  });

  it("sin id no hay evento", () => {
    expect(leerEvento({ hangoutLink: "x" })).toBeNull();
    expect(leerEvento(null)).toBeNull();
  });

  it("un evento sin Meet sigue siendo un evento válido", () => {
    expect(leerEvento({ id: "ev-3" })).toEqual({
      eventoId: "ev-3",
      meetUrl: null,
      linkGoogle: null,
    });
  });
});

describe("hayOcupado", () => {
  it("detecta franjas ocupadas", () => {
    expect(hayOcupado({ calendars: { primary: { busy: [{ start: "a", end: "b" }] } } })).toBe(true);
  });

  it("sin franjas, libre", () => {
    expect(hayOcupado({ calendars: { primary: { busy: [] } } })).toBe(false);
  });

  it("ante una respuesta rara asume libre (el choque solo informa)", () => {
    expect(hayOcupado(null)).toBe(false);
    expect(hayOcupado({ error: "x" })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/agenda/__tests__/google.test.ts`
Expected: FAIL — no existe `../google`.

- [ ] **Step 3: Implementar**

Crear `src/lib/agenda/google.ts`:

```ts
// Google Calendar por API REST, sin SDK: son dos POST y el repo no usa SDKs
// (misma decisión que el cliente del bot y el de ElevenLabs).
//
// SOLO SERVIDOR. Auth: OAuth con refresh token de la cuenta de Tomás —
// tomasmunevar36@gmail.com y paulapjpg@gmail.com son cuentas personales y una
// service account no puede escribir ahí sin delegación de dominio, que exige
// Workspace.
//
// ⚠️ La pantalla de consentimiento tiene que estar PUBLICADA EN PRODUCCIÓN.
// En modo "Testing" Google caduca el refresh token a los 7 días y la agenda
// deja de funcionar sola sin avisar.

import type { Calendario, EventoAgendado } from "./tipos";

const ZONA = "America/Bogota";
const API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 10_000;

type Json = Record<string, unknown>;

function obj(v: unknown): Json | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** El cuerpo del POST de creación del evento. Puro para poder probarlo. */
export function cuerpoEvento(
  datos: { titulo: string; descripcion: string; inicio: string; fin: string },
  invitados: string[],
  requestId: string,
): Json {
  return {
    summary: datos.titulo,
    description: datos.descripcion,
    start: { dateTime: datos.inicio, timeZone: ZONA },
    end: { dateTime: datos.fin, timeZone: ZONA },
    attendees: invitados.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}

/** Respuesta de events.insert → lo que guardamos. Puro. */
export function leerEvento(json: unknown): EventoAgendado | null {
  const e = obj(json);
  const id = texto(e?.id);
  if (!id) return null;

  let meet = texto(e?.hangoutLink);
  if (!meet) {
    const entradas = obj(e?.conferenceData)?.entryPoints;
    if (Array.isArray(entradas)) {
      const video = entradas
        .map((x) => obj(x))
        .find((x) => x?.entryPointType === "video");
      meet = texto(video?.uri);
    }
  }
  return { eventoId: id, meetUrl: meet, linkGoogle: texto(e?.htmlLink) };
}

/** Respuesta de freeBusy → ¿hay algo en la franja? Puro. Ante cualquier cosa
 *  rara devuelve false: el choque solo informa, no puede bloquear una cita. */
export function hayOcupado(json: unknown): boolean {
  const calendarios = obj(obj(json)?.calendars);
  if (!calendarios) return false;
  return Object.values(calendarios).some((c) => {
    const busy = obj(c)?.busy;
    return Array.isArray(busy) && busy.length > 0;
  });
}

/** Lista de invitados de AGENDA_INVITADOS (separados por comas). */
export function invitados(): string[] {
  return [
    ...new Set(
      (process.env.AGENDA_INVITADOS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e !== ""),
    ),
  ];
}

// El access token dura ~1h. Se cachea en el módulo: en Vercel cada lambda
// tiene el suyo, así que el costo real es un POST extra por arranque en frío.
let cache: { token: string; expiraEn: number } | null = null;

async function accessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) return null;

  if (cache && Date.now() < cache.expiraEn) return cache.token;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Json | null;
    const token = texto(json?.access_token);
    if (!res.ok || !token) {
      // invalid_grant = el refresh token murió. La causa nº1: la pantalla de
      // consentimiento quedó en "Testing" (caduca a los 7 días).
      console.error("[agenda] no se pudo refrescar el token:", res.status, json?.error);
      return null;
    }
    const dura = typeof json?.expires_in === "number" ? json.expires_in : 3600;
    cache = { token, expiraEn: Date.now() + (dura - 60) * 1000 };
    return token;
  } catch (e) {
    console.error("[agenda] token:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** null = Google no está configurado; el resto del flujo sigue sin agenda. */
export function calendarioGoogle(): Calendario | null {
  if (
    !process.env.GOOGLE_OAUTH_CLIENT_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
  ) {
    console.error("[agenda] faltan las credenciales de Google — no se agenda nada");
    return null;
  }

  return {
    async crearEvento(datos) {
      const token = await accessToken();
      if (!token) return null;
      try {
        const res = await fetch(
          `${API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(cuerpoEvento(datos, invitados(), crypto.randomUUID())),
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: "no-store",
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("[agenda] events.insert →", res.status, JSON.stringify(json).slice(0, 300));
          return null;
        }
        return leerEvento(json);
      } catch (e) {
        console.error("[agenda] crearEvento:", e instanceof Error ? e.message : e);
        return null;
      }
    },

    async hayChoque(inicio, fin) {
      const token = await accessToken();
      if (!token) return false;
      try {
        const res = await fetch(`${API}/freeBusy`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeMin: inicio,
            timeMax: fin,
            timeZone: ZONA,
            items: [{ id: "primary" }],
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        if (!res.ok) return false;
        return hayOcupado(await res.json().catch(() => null));
      } catch (e) {
        console.error("[agenda] freeBusy:", e instanceof Error ? e.message : e);
        return false;
      }
    },
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/agenda/__tests__/google.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda/google.ts src/lib/agenda/__tests__/google.test.ts
git commit -m "agenda: cliente de Google Calendar por fetch — evento con Meet y freeBusy"
```

---

### Task 9: Conectar el calendario y el script de OAuth

**Files:**
- Modify: `src/lib/solicitudes/entrada.ts` (una línea: el default de `deps.calendario`)
- Create: `scripts/google-oauth.mjs`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `calendarioGoogle()` (Task 8).
- Produces: nada nuevo. A partir de aquí, quien llame a `registrarSolicitudEntrante` sin `deps.calendario` agenda de verdad.

- [ ] **Step 1: Cambiar el default del calendario**

En `src/lib/solicitudes/entrada.ts`, añadir el import y cambiar la línea del default:

```ts
import { calendarioGoogle } from "@/lib/agenda/google";
```

```ts
  // `deps.calendario` puede ser null a propósito (los tests, y la fase 1 antes
  // de que existiera google.ts): solo cuando NO se pasa nada se usa el real.
  const calendario = deps.calendario === undefined ? calendarioGoogle() : deps.calendario;
```

- [ ] **Step 2: Correr los tests para verificar que nada cambió**

Run: `npx vitest run src/lib/solicitudes/__tests__/entrada.test.ts`
Expected: PASS — los tests pasan `calendario` explícito (o `null`), así que ninguno toca la red.

- [ ] **Step 3: Escribir el script de OAuth**

Crear `scripts/google-oauth.mjs`:

```js
#!/usr/bin/env node
// Un solo uso: saca el refresh token de Google Calendar para la cuenta de
// Tomás. Se corre en local, imprime el token y se acabó — el valor va DIRECTO
// a .env.local y a Vercel, nunca al repo ni al chat.
//
//   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
//     node scripts/google-oauth.mjs
//
// Requisito previo: la pantalla de consentimiento PUBLICADA EN PRODUCCIÓN.
// En "Testing" el refresh token caduca a los 7 días.

import { createServer } from "node:http";
import { exec } from "node:child_process";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const PUERTO = 53682;
const REDIRECT = `http://localhost:${PUERTO}`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Faltan GOOGLE_OAUTH_CLIENT_ID y GOOGLE_OAUTH_CLIENT_SECRET.");
  process.exit(1);
}

const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES,
    // access_type=offline + prompt=consent: sin los dos, Google NO devuelve
    // refresh_token en una cuenta que ya autorizó antes.
    access_type: "offline",
    prompt: "consent",
  });

const servidor = createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Sin code.");
    return;
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const json = await r.json();
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(json.refresh_token ? "Listo. Vuelve a la terminal." : "Google no devolvió refresh_token.");

  if (json.refresh_token) {
    console.log("\nGOOGLE_CALENDAR_REFRESH_TOKEN=" + json.refresh_token);
    console.log("\nPégalo en .env.local y en Vercel. No lo pegues en un chat.\n");
  } else {
    console.error("\nSin refresh_token. Revoca el acceso en https://myaccount.google.com/permissions y repite.\n");
  }
  servidor.close();
});

servidor.listen(PUERTO, () => {
  console.log("Abriendo el navegador. Si no se abre, entra a:\n" + url + "\n");
  exec(`open "${url}"`);
});
```

- [ ] **Step 4: Documentar las envs**

Añadir a `.env.example`, después del bloque de Twilio:

```
# ---- Agenda (Google Calendar + Meet) — /admin/agenda ----------------------------
# TODAS solo servidor. OAuth con la cuenta de Tomás: las cuentas son personales
# (gmail.com) y una service account no puede escribir ahí sin Workspace.
# ⚠️ La pantalla de consentimiento debe quedar PUBLICADA EN PRODUCCIÓN: en
# modo "Testing" Google caduca el refresh token a los 7 días.
# El refresh token se saca UNA vez con: node scripts/google-oauth.mjs
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_CALENDAR_REFRESH_TOKEN=
# A quién se invita a cada cita (separados por comas).
AGENDA_INVITADOS=
# Duración por defecto de una cita, en minutos.
AGENDA_DURACION_MIN=30
```

- [ ] **Step 5: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: verde.

```bash
git add src/lib/solicitudes/entrada.ts scripts/google-oauth.mjs .env.example
git commit -m "agenda: conectar Google Calendar al flujo + script para sacar el refresh token"
```

---

### Task 10: Los campos de cita de Zak y el botón de poner al día

**Files:**
- Modify: `src/lib/voz/zak.ts` (`EXTRACCION_ZAK` y la sección de guion)
- Modify: `src/lib/admin/voz-actions.ts` (acción nueva al final)
- Modify: `src/components/admin/voz/ConfigAgenteVoz.tsx` (el botón)
- Test: `src/lib/voz/__tests__/zak.test.ts` (añadir casos)

**Interfaces:**
- Consumes: `EXTRACCION_ZAK`, `sincronizarAgenteVoz`, `agenteZakVoz`, `obtenerAgenteVoz`, `verifySession`, `revalidarVoz`.
- Produces: `fusionarExtraccion(actual, estandar): CampoExtraccion[]` (pura, exportada desde `src/lib/voz/zak.ts`) y `ponerAlDiaCamposZak(): Promise<{ error: string | null; añadidos: number }>`.

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `src/lib/voz/__tests__/zak.test.ts`:

```ts
import { fusionarExtraccion, EXTRACCION_ZAK as ZAK } from "../zak";

describe("fusionarExtraccion", () => {
  it("añade las claves estándar que faltan", () => {
    const r = fusionarExtraccion([{ clave: "lead_nombre", tipo: "string", descripcion: "x" }], ZAK);
    expect(r.map((c) => c.clave)).toEqual(expect.arrayContaining(["cita_fecha_hora", "cita_confirmada"]));
  });

  it("NO pisa lo que Tomás escribió a mano", () => {
    const mia = { clave: "lead_nombre", tipo: "string" as const, descripcion: "MI TEXTO" };
    const r = fusionarExtraccion([mia], ZAK);
    expect(r.find((c) => c.clave === "lead_nombre")?.descripcion).toBe("MI TEXTO");
  });

  it("conserva los campos propios que no están en el estándar", () => {
    const propio = { clave: "presupuesto", tipo: "integer" as const, descripcion: "cuánto" };
    const r = fusionarExtraccion([propio], ZAK);
    expect(r.some((c) => c.clave === "presupuesto")).toBe(true);
  });

  it("es idempotente", () => {
    const una = fusionarExtraccion([], ZAK);
    expect(fusionarExtraccion(una, ZAK)).toEqual(una);
  });
});

describe("EXTRACCION_ZAK", () => {
  it("trae los campos de cita", () => {
    const claves = ZAK.map((c) => c.clave);
    expect(claves).toContain("cita_fecha_hora");
    expect(claves).toContain("cita_confirmada");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/voz/__tests__/zak.test.ts`
Expected: FAIL — `fusionarExtraccion` no existe y faltan las claves de cita.

- [ ] **Step 3: Añadir los campos y la fusión**

En `src/lib/voz/zak.ts`, añadir al array `EXTRACCION_ZAK` (después de `mejor_horario`):

```ts
  {
    clave: "cita_fecha_hora",
    tipo: "string",
    descripcion:
      "Si acordaron una reunión con fecha Y hora concretas, devuélvela en formato AAAA-MM-DDTHH:MM en hora de Colombia (ej. 2026-09-03T15:30). " +
      "Si solo dijo algo vago como 'el jueves por la tarde', devuelve ese texto tal cual. Si no hablaron de reunirse, null.",
  },
  {
    clave: "cita_confirmada",
    tipo: "boolean",
    descripcion:
      "true solo si la persona confirmó explícitamente el día y la hora de la reunión. Si hay duda, null.",
  },
```

Y añadir al final del archivo:

```ts
/**
 * Fusiona los campos estándar que le falten a un agente ya creado, sin pisar
 * lo que se haya escrito a mano. Existe porque EXTRACCION_ZAK solo se aplica
 * al CREAR el agente (crearAgenteZakVoz) y el de Zak ya existe: sin esto,
 * añadir un campo estándar no llegaría nunca a producción.
 */
export function fusionarExtraccion(
  actual: readonly CampoExtraccion[],
  estandar: readonly CampoExtraccion[],
): CampoExtraccion[] {
  const claves = new Set(actual.map((c) => c.clave));
  return [...actual, ...estandar.filter((c) => !claves.has(c.clave))];
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/voz/__tests__/zak.test.ts`
Expected: PASS.

- [ ] **Step 5: La server action**

Añadir al final de `src/lib/admin/voz-actions.ts`:

```ts
/**
 * Pone al día los campos de extracción del agente de Zak con EXTRACCION_ZAK y
 * lo re-sincroniza con ElevenLabs. Preserva lo escrito a mano (ver
 * fusionarExtraccion). Idempotente: correrlo dos veces no cambia nada.
 */
export async function ponerAlDiaCamposZak(): Promise<{ error: string | null; anadidos: number }> {
  const { supabase } = await verifySession();

  const agente = await agenteZakVoz(supabase);
  if (!agente) return { error: "Zak no tiene voz todavía — créala en /admin/voz.", anadidos: 0 };

  const fusionada = fusionarExtraccion(agente.extraccion, EXTRACCION_ZAK);
  const anadidos = fusionada.length - agente.extraccion.length;

  if (anadidos > 0) {
    const { error } = await supabase
      .from("agentes_voz")
      .update({ extraccion: fusionada })
      .eq("id", agente.id);
    if (error) {
      console.error("[ponerAlDiaCamposZak] update:", error.message);
      return { error: "No se pudieron guardar los campos.", anadidos: 0 };
    }
  }

  // Sincronizar SIEMPRE, aunque no se haya añadido nada: puede que la fila ya
  // estuviera al día pero ElevenLabs no.
  const r = await sincronizarAgenteVoz(agente.id);
  revalidarVoz(agente.id);
  return { error: r.error, anadidos };
}
```

Y añadir `fusionarExtraccion` al import existente de `@/lib/voz/zak`.

- [ ] **Step 6: El botón**

En `src/components/admin/voz/ConfigAgenteVoz.tsx`, añadir un `<Button>` que llame a `ponerAlDiaCamposZak` dentro de un `useTransition`, **visible solo cuando el agente es `es_zak`**. Texto: `Poner al día los campos`. Sigue el patrón exacto del botón «Sincronizar» que ya está en ese archivo — no inventes uno nuevo:

```tsx
const [pendiente, empezar] = useTransition();
const [aviso, setAviso] = useState<string | null>(null);

// Solo el agente de Zak: los de clientes no tienen campos estándar que poner al día.
{agente.es_zak && (
  <Button
    disabled={pendiente}
    onClick={() =>
      empezar(async () => {
        const r = await ponerAlDiaCamposZak();
        setAviso(
          r.error
            ? r.error
            : r.anadidos > 0
              ? `Listo: ${r.anadidos} campo(s) nuevo(s) y sincronizado con ElevenLabs.`
              : "Ya estaba al día; se re-sincronizó igual.",
        );
      })
    }
  >
    {pendiente ? "Poniendo al día…" : "Poner al día los campos"}
  </Button>
)}
```

- [ ] **Step 7: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npm test`

```bash
git add src/lib/voz/zak.ts src/lib/voz/__tests__/zak.test.ts src/lib/admin/voz-actions.ts src/components/admin/voz/ConfigAgenteVoz.tsx
git commit -m "voz: Zak extrae fecha de cita + botón para poner al día un agente ya creado"
```

**FASE 2 COMPLETA.** Con las envs puestas y el botón pulsado, una llamada donde acuerdan hora deja el evento en el calendario con Meet, y el link llega por WhatsApp.

---

# FASE 3 — El bot de WhatsApp

---

### Task 11: `/api/zak/solicitud` y el contrato para el bot Flask

**Files:**
- Create: `src/app/api/zak/solicitud/route.ts`
- Create: `docs/bot-flask/tool-registrar-solicitud.md`
- Modify: `src/proxy.ts` (verificar que `/api/**` sigue fuera del matcher — **no** tocar si ya lo está)

**Interfaces:**
- Consumes: `registrarSolicitudEntrante` (Task 6), `createSupabaseService` (ya existe).
- Produces: el endpoint `POST /api/zak/solicitud`.

- [ ] **Step 1: Comprobar que el proxy no cubre /api**

Run: `grep -n "matcher\|/api" src/proxy.ts`
Expected: `/api/**` fuera del matcher (es el caso de `/api/voz/webhook` y `/api/zak/llamar`). Si no lo estuviera, **para y dilo** — el endpoint quedaría detrás de la sesión y el bot no podría entrar.

- [ ] **Step 2: Escribir el handler**

Crear `src/app/api/zak/solicitud/route.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { registrarSolicitudEntrante } from "@/lib/solicitudes/entrada";
import { createSupabaseService } from "@/lib/voz/supabase-service";

// Zak (el bot de WhatsApp, Flask en Railway) cierra una conversación con
// intención de contratar: su tool registrar_solicitud hace POST aquí con el
// token compartido ZAK_VOZ_TOKEN — el mismo de /api/zak/llamar, misma
// contraparte y un secreto menos que rotar.
//
// Tercer endpoint público del repo (fuera del matcher del proxy a propósito):
// la puerta es el token, no la sesión. La DB entra por service-role.
//
// Body: { telefono, ref?, nombre?, email?, servicio?, detalle?, mejor_horario?,
//         cita? }. Respuestas: 200 {status: 'creada'|'duplicada'} · 400 body
// malo · 401 token malo · 500 error de dominio · 503 sin configurar.

function tokenValido(header: string | null, esperado: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  // sha256 de ambos lados: compara en tiempo constante sin filtrar longitud.
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

export async function POST(request: Request) {
  const esperado = process.env.ZAK_VOZ_TOKEN;
  if (!esperado) {
    console.error("[zak solicitud] falta ZAK_VOZ_TOKEN");
    return NextResponse.json({ error: "sin_configurar" }, { status: 503 });
  }
  if (!tokenValido(request.headers.get("authorization"), esperado)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const telefono = texto(b.telefono);
  if (!telefono) {
    return NextResponse.json({ error: "falta_telefono" }, { status: 400 });
  }

  const supabase = createSupabaseService();
  if (!supabase) {
    return NextResponse.json({ error: "sin_configurar" }, { status: 503 });
  }

  // Sin `ref` del bot, la clave de idempotencia se ancla al teléfono y al día:
  // dos cierres del mismo chat el mismo día son el mismo interés, no dos.
  const ref = texto(b.ref) ?? `${telefono}:${new Date().toISOString().slice(0, 10)}`;

  const r = await registrarSolicitudEntrante(supabase, {
    origen: "whatsapp",
    claveOrigen: `wa:${ref}`,
    contacto: { nombre: texto(b.nombre), telefono, email: texto(b.email) },
    servicioInteres: texto(b.servicio),
    detalle: texto(b.detalle),
    mejorHorario: texto(b.mejor_horario),
    citaCruda: b.cita,
    conversacion: telefono,
  });

  if (r.estado === "error") {
    console.error("[zak solicitud] no se registró:", r.motivo);
    return NextResponse.json({ error: r.motivo }, { status: 500 });
  }
  return NextResponse.json({ status: r.estado });
}
```

- [ ] **Step 3: Probar el handler a mano contra el dev server**

Run:
```bash
npm run dev &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/zak/solicitud \
  -H 'Authorization: Bearer token-malo' -H 'Content-Type: application/json' -d '{}'
```
Expected: `401`. Después, con el token bueno de `.env.local` y `-d '{}'` → `400`. Matar el dev server al terminar.

- [ ] **Step 4: Escribir el contrato para el otro repo**

Crear `docs/bot-flask/tool-registrar-solicitud.md`. Es lo único de este trabajo que viaja a otro repo, así que va completo, no en prosa:

````markdown
# Tool `registrar_solicitud` — para el bot Flask de Zak

Al cerrar una conversación en la que la persona pidió un servicio o quedó en
reunirse, Zak llama esta tool. El sitio de Zakumi crea la solicitud en
`/admin/solicitudes`, agenda en Google Calendar si hay fecha, y avisa por
WhatsApp a Tomás y a Paula. Es idempotente: repetir la llamada con el mismo
`ref` no duplica nada.

**Endpoint:** `POST {SITE_URL}/api/zak/solicitud`
**Header:** `Authorization: Bearer {ZAK_VOZ_TOKEN}` (el mismo token de
`/api/zak/llamar`, ya configurado en el bot).

## Argumentos

```json
{
  "type": "object",
  "required": ["telefono"],
  "properties": {
    "telefono":      { "type": "string", "description": "Teléfono de la persona en formato +57..." },
    "ref":           { "type": "string", "description": "Id de la conversación. Evita duplicados; si falta se usa teléfono+fecha." },
    "nombre":        { "type": "string" },
    "email":         { "type": "string" },
    "servicio":      { "type": "string", "description": "bot de WhatsApp | página web | mantenimiento | CRM | agente de voz" },
    "detalle":       { "type": "string", "description": "Qué quiere, en una frase." },
    "mejor_horario": { "type": "string", "description": "Cuándo prefiere que lo contacten, tal como lo dijo." },
    "cita":          { "type": "string", "description": "AAAA-MM-DDTHH:MM en hora de Colombia si acordaron día Y hora. Si fue vago ('el jueves por la tarde'), ese texto tal cual. Si no hablaron de reunirse, omitir." }
  }
}
```

## Respuestas

| Código | Cuerpo | Qué significa |
|---|---|---|
| 200 | `{"status":"creada"}` | Quedó en la bandeja y salió el aviso |
| 200 | `{"status":"duplicada"}` | Ya estaba registrada; no se hace nada |
| 400 | `{"error":"falta_telefono"}` \| `{"error":"json_invalido"}` | Body malo |
| 401 | `{"error":"no_autorizado"}` | Token malo |
| 500 | `{"error":"..."}` | Falló el registro; reintentar |
| 503 | `{"error":"sin_configurar"}` | Al sitio le faltan envs |

## Qué añadir al prompt de Zak

> Cuando la conversación termine y la persona haya pedido un servicio, pedido
> una cotización o quedado en reunirse, llama a `registrar_solicitud` con lo
> que sepas. Llámala UNA sola vez por conversación. Para `cita`: si acordaron
> día y hora concretos, escríbela como AAAA-MM-DDTHH:MM en hora de Colombia
> (hoy es {fecha_de_hoy}); si solo dijeron algo vago, copia sus palabras tal
> cual; si no hablaron de reunirse, no mandes el campo. Nunca inventes una
> fecha ni un teléfono.

## Ejemplo

```bash
curl -X POST "$SITE_URL/api/zak/solicitud" \
  -H "Authorization: Bearer $ZAK_VOZ_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "+573001112233",
    "ref": "573001112233-20260903",
    "nombre": "María Pérez",
    "servicio": "bot de WhatsApp",
    "detalle": "Quiere un bot para su restaurante, 3 sedes",
    "cita": "2026-09-03T10:00"
  }'
```
````

- [ ] **Step 5: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/app/api/zak/solicitud/route.ts docs/bot-flask/tool-registrar-solicitud.md
git commit -m "zak: POST /api/zak/solicitud — el bot de WhatsApp deja solicitud al cerrar"
```

**FASE 3 COMPLETA** del lado de Next. Falta aplicar el contrato en el repo del bot Flask; hasta entonces el canal de WhatsApp no produce solicitudes (el de voz sí, completo).

---

# FASE 4 — La agenda en el panel

---

### Task 12: Consultas y agrupación de la agenda

**Files:**
- Create: `src/lib/agenda/consultas.ts`
- Test: `src/lib/agenda/__tests__/consultas.test.ts`

**Interfaces:**
- Consumes: `Solicitud` (Task 1).
- Produces: `type Cita360` (la fila que ve la UI), `agruparPorDia(citas, ahora): GrupoAgenda[]` (pura), `type GrupoAgenda = { titulo: string; citas: Cita360[] }`, y `proximasCitas(supabase, limite?): Promise<Cita360[]>`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/agenda/__tests__/consultas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { agruparPorDia, type Cita360 } from "../consultas";

// 2026-09-01T15:00Z = martes 1 sep, 10:00 en Bogotá.
const AHORA = new Date("2026-09-01T15:00:00Z");

function cita(inicio: string, id = inicio): Cita360 {
  return {
    id,
    solicitudId: id,
    inicio,
    fin: inicio,
    nombre: "María",
    telefono: "+57300",
    servicio: "Bot de WhatsApp",
    detalle: null,
    meetUrl: null,
    linkGoogle: null,
    origen: "voz",
    estado: "nueva",
  };
}

describe("agruparPorDia", () => {
  it("separa hoy, mañana, esta semana y después", () => {
    const g = agruparPorDia(
      [
        cita("2026-09-01T21:00:00Z", "hoy"),      // hoy 16:00 Bogotá
        cita("2026-09-02T15:00:00Z", "manana"),   // mañana
        cita("2026-09-04T15:00:00Z", "semana"),   // viernes
        cita("2026-09-20T15:00:00Z", "despues"),
      ],
      AHORA,
    );
    expect(g.map((x) => x.titulo)).toEqual(["Hoy", "Mañana", "Esta semana", "Después"]);
    expect(g[0].citas[0].id).toBe("hoy");
    expect(g[3].citas[0].id).toBe("despues");
  });

  it("no devuelve grupos vacíos", () => {
    const g = agruparPorDia([cita("2026-09-20T15:00:00Z")], AHORA);
    expect(g).toHaveLength(1);
    expect(g[0].titulo).toBe("Después");
  });

  it("ordena por hora dentro del día", () => {
    const g = agruparPorDia(
      [cita("2026-09-01T22:00:00Z", "tarde"), cita("2026-09-01T20:00:00Z", "antes")],
      AHORA,
    );
    expect(g[0].citas.map((c) => c.id)).toEqual(["antes", "tarde"]);
  });

  it("una cita que ya pasó hoy sigue contando como de hoy", () => {
    const g = agruparPorDia([cita("2026-09-01T13:00:00Z", "temprano")], AHORA);
    expect(g[0].titulo).toBe("Hoy");
  });

  it("sin citas, sin grupos", () => {
    expect(agruparPorDia([], AHORA)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/agenda/__tests__/consultas.test.ts`
Expected: FAIL — no existe `../consultas`.

- [ ] **Step 3: Implementar**

Crear `src/lib/agenda/consultas.ts`:

```ts
// Lectura de la agenda para el panel. La agrupación es pura y se prueba
// aparte; la consulta a Supabase va por la sesión del admin (anon + RLS,
// política solicitudes_admin_todo), NUNCA por service-role.

import type { SupabaseClient } from "@supabase/supabase-js";
import { servicioDelSlug } from "@/lib/catalogo";
import type { EstadoSolicitud, OrigenSolicitud, Solicitud } from "@/lib/portal/solicitudes";

const ZONA = "America/Bogota";

export type Cita360 = {
  id: string;
  solicitudId: string;
  inicio: string;
  fin: string;
  nombre: string | null;
  telefono: string | null;
  servicio: string | null;
  detalle: string | null;
  meetUrl: string | null;
  linkGoogle: string | null;
  origen: OrigenSolicitud;
  estado: EstadoSolicitud;
};

export type GrupoAgenda = { titulo: string; citas: Cita360[] };

/** "2026-09-01" del día CALENDARIO en Bogotá (no el del servidor: Vercel
 *  corre en UTC y a las 19:00 de Bogotá ya sería el día siguiente). */
function diaBogota(fecha: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

export function agruparPorDia(citas: Cita360[], ahora: Date = new Date()): GrupoAgenda[] {
  const hoy = diaBogota(ahora);
  const manana = diaBogota(sumarDias(ahora, 1));
  const finDeSemana = diaBogota(sumarDias(ahora, 7));

  const grupos: GrupoAgenda[] = [
    { titulo: "Hoy", citas: [] },
    { titulo: "Mañana", citas: [] },
    { titulo: "Esta semana", citas: [] },
    { titulo: "Después", citas: [] },
  ];

  for (const c of [...citas].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const dia = diaBogota(new Date(c.inicio));
    if (dia === hoy) grupos[0].citas.push(c);
    else if (dia === manana) grupos[1].citas.push(c);
    else if (dia < finDeSemana) grupos[2].citas.push(c);
    else grupos[3].citas.push(c);
  }

  return grupos.filter((g) => g.citas.length > 0);
}

const CAMPOS =
  "id, servicio_slug, mensaje, estado, origen, contacto_nombre, contacto_telefono, " +
  "cita_inicio, cita_fin, cita_meet_url, cita_link_google";

function aCita(f: Partial<Solicitud>): Cita360 {
  return {
    id: String(f.id),
    solicitudId: String(f.id),
    inicio: f.cita_inicio ?? "",
    fin: f.cita_fin ?? "",
    nombre: f.contacto_nombre ?? null,
    telefono: f.contacto_telefono ?? null,
    servicio: servicioDelSlug(f.servicio_slug ?? "")?.nombre ?? null,
    detalle: f.mensaje ?? null,
    meetUrl: f.cita_meet_url ?? null,
    linkGoogle: f.cita_link_google ?? null,
    origen: f.origen ?? "portal",
    estado: f.estado ?? "nueva",
  };
}

/**
 * Las citas de hoy en adelante. Se corta en el inicio del día de Bogotá para
 * que una reunión de esta mañana siga visible hasta que termine la jornada.
 */
export async function proximasCitas(
  supabase: SupabaseClient,
  limite = 100,
): Promise<Cita360[]> {
  const desde = new Date();
  desde.setUTCHours(desde.getUTCHours() - 24);

  const { data, error } = await supabase
    .from("solicitudes")
    .select(CAMPOS)
    .not("cita_inicio", "is", null)
    .neq("estado", "rechazada")
    .gte("cita_inicio", desde.toISOString())
    .order("cita_inicio", { ascending: true })
    .limit(limite);

  if (error) {
    console.error("[agenda] proximasCitas:", error.message);
    return [];
  }
  return (data ?? []).map((f) => aCita(f as Partial<Solicitud>));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/agenda/__tests__/consultas.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agenda/consultas.ts src/lib/agenda/__tests__/consultas.test.ts
git commit -m "agenda: consultas y agrupación por día (Hoy/Mañana/Esta semana/Después)"
```

---

### Task 13: La página `/admin/agenda` y el item del sidebar

**Files:**
- Create: `src/app/admin/(panel)/agenda/page.tsx`
- Create: `src/app/admin/api/agenda/hoy/route.ts`
- Create: `src/components/admin/agenda/AgendaView.tsx`
- Create: `src/components/admin/agenda/ListaCitas.tsx`
- Create: `src/components/admin/agenda/DetalleCita.tsx`
- Modify: `src/components/admin/Sidebar.tsx` (array `SECCIONES` + contador)

**Interfaces:**
- Consumes: `proximasCitas`, `agruparPorDia`, `Cita360`, `GrupoAgenda` (Task 12); `verifySession`/`getSesionAdmin` (`@/lib/admin/dal`); el kit de `src/components/admin/ui/`.
- Produces: la ruta `/admin/agenda` y `GET /admin/api/agenda/hoy` → `{ hoy: number }`.

- [ ] **Step 1: La página (server component)**

Crear `src/app/admin/(panel)/agenda/page.tsx`:

```tsx
import type { Metadata } from "next";
import { verifySession } from "@/lib/admin/dal";
import { agruparPorDia, proximasCitas } from "@/lib/agenda/consultas";
import { AgendaView } from "@/components/admin/agenda/AgendaView";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  // verifySession() primera línea: en Next 16 los layouts no se re-renderizan
  // al navegar, así que el check va en CADA page.
  const { supabase } = await verifySession();
  const grupos = agruparPorDia(await proximasCitas(supabase));
  return <AgendaView grupos={grupos} />;
}
```

- [ ] **Step 2: El endpoint del contador**

Crear `src/app/admin/api/agenda/hoy/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import { agruparPorDia, proximasCitas } from "@/lib/agenda/consultas";

// El contador del sidebar. getSesionAdmin (no getSesion a secas): un
// registrado del portal no puede contar las citas de la casa.
export async function GET() {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ error: "no_autorizado" }, { status: 401 });

  const grupos = agruparPorDia(await proximasCitas(sesion.supabase, 50));
  const hoy = grupos.find((g) => g.titulo === "Hoy")?.citas.length ?? 0;
  return NextResponse.json({ hoy });
}
```

- [ ] **Step 3: Los tres componentes**

Crear los tres bajo `src/components/admin/agenda/`, calcando el shell y el kit ya existentes. **Ninguno pasa de ~150 líneas.**

`AgendaView.tsx` (el shell — va con código porque "cockpit sin scroll de página" es regla dura del panel):

```tsx
"use client";

import { useState } from "react";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import type { Cita360, GrupoAgenda } from "@/lib/agenda/consultas";
import { DetalleCita } from "./DetalleCita";
import { ListaCitas } from "./ListaCitas";

export function AgendaView({ grupos }: { grupos: GrupoAgenda[] }) {
  const primera = grupos[0]?.citas[0] ?? null;
  const [seleccionada, setSeleccionada] = useState<Cita360 | null>(primera);

  return (
    <Cockpit>
      <PageHeader titulo="Agenda" />
      {grupos.length === 0 ? (
        <CockpitBody>
          <EmptyState
            titulo="Nada agendado."
            detalle="Cuando Zak cierre una reunión en una llamada o un chat, aparece aquí con su link de Meet."
          />
        </CockpitBody>
      ) : (
        // El scroll vive DENTRO de cada columna, nunca en la página.
        <div className="grid min-h-0 flex-1 gap-aire px-5 py-4 min-[900px]:grid-cols-[320px_1fr]">
          <div className="barra-fina min-h-0 min-[900px]:overflow-y-auto">
            <ListaCitas
              grupos={grupos}
              seleccionadaId={seleccionada?.id ?? null}
              onElegir={setSeleccionada}
            />
          </div>
          <div className="barra-fina min-h-0 min-[900px]:overflow-y-auto">
            {seleccionada && <DetalleCita cita={seleccionada} />}
          </div>
        </div>
      )}
    </Cockpit>
  );
}
```

Los otros dos, siguiendo el kit:
- `ListaCitas.tsx`: por cada `GrupoAgenda`, un encabezado (`text-xs font-semibold tracking-wide text-tinta-60 uppercase`) y las citas como filas pulsables; cada fila muestra la hora en Bogotá (reusa `fechaLegible` de `@/lib/solicitudes/mensaje` o formatea solo la hora), el nombre y un `<Badge>` con el origen (`voz` → tono `contactado`, `whatsapp` → `respondido`). La fila activa lleva `bg-acento-10 text-acento`.
- `DetalleCita.tsx`: `<Island>` con nombre, teléfono, servicio, detalle, la fecha completa, y los botones: **Abrir Meet** (`variante="acento"`, `<a href={meetUrl} target="_blank" rel="noreferrer">`, oculto si no hay), **Ver en Google** (si `linkGoogle`) y **Ver solicitud** (`<Link href="/admin/solicitudes">`). Si no hay Meet, una línea en `text-tinta-60`: «Sin link de Meet — revisa el evento en Google».

Regla dura del repo: nada de `nav`/`footer` desnudos ni `.cta`; todas las clases salen de los tokens de `admin-theme.css` que ya usa el resto del panel (`bg-isla`, `rounded-isla`, `text-tinta`, `gap-aire`, `barra-fina`…).

- [ ] **Step 4: El item del sidebar**

En `src/components/admin/Sidebar.tsx`:

1. Importar `CalendarDays` de `lucide-react`.
2. Añadir a `SECCIONES`, entre Solicitudes y Clientes:
   ```ts
   { href: "/admin/agenda", label: "Agenda", Icono: CalendarDays },
   ```
3. Añadir un hook `useCitasHoy()` calcado de `useSaludBots()` (mismo `poll` + `setInterval(60_000)` + bandera `activo`), que hace `fetch("/admin/api/agenda/hoy")` y guarda el número.
4. En el `.map` de secciones, junto al bloque del punto de salud de Bots, añadir para `/admin/agenda` una píldora con el conteo cuando sea `> 0`:
   ```tsx
   {href === "/admin/agenda" && citasHoy > 0 && (
     <span
       title={`${citasHoy} cita(s) hoy`}
       className={cn(
         "rounded-full bg-acento-10 px-1.5 text-[10px] font-semibold text-acento",
         !colapsado && "ml-auto",
       )}
     >
       {citasHoy}
     </span>
   )}
   ```

- [ ] **Step 5: Verificar en el navegador**

Run: `npm run dev`
Comprobar: `/admin/agenda` carga sin scroll de página (el scroll va dentro de la lista), el sidebar muestra "Agenda", y con una fila de prueba (`insert` manual en Supabase con `cita_inicio` de hoy) aparece la píldora con el número y el detalle a la derecha.

- [ ] **Step 6: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npm test`

```bash
git add src/app/admin/\(panel\)/agenda src/app/admin/api/agenda src/components/admin/agenda src/components/admin/Sidebar.tsx
git commit -m "admin: Agenda en el panel — lo agendado por Zak con su link de Meet"
```

---

### Task 14: La bandeja muestra de dónde vino y si hay cita

**Files:**
- Modify: `src/components/admin/solicitudes/BandejaSolicitudes.tsx`
- Modify: `src/app/admin/(panel)/solicitudes/page.tsx` (el `map` de perfiles con `user_id` nullable)

**Interfaces:**
- Consumes: `Solicitud` con los campos nuevos (Task 1).
- Produces: nada hacia otras tareas. **Cierra el `perfiles[s.user_id ?? ""]` que la Task 1 dejó provisional.**

- [ ] **Step 1: Arreglar la página**

En `src/app/admin/(panel)/solicitudes/page.tsx`, el `userIds` debe ignorar las solicitudes sin cuenta:

```ts
  const userIds = [...new Set(solicitudes.map((s) => s.user_id).filter((id): id is string => id !== null))];
```

Y el copy de la cabecera pasa a reflejar la realidad:

```tsx
        <p className="text-xs text-tinta-60">
          Todo el que quiere contratarnos: lo que piden en la tienda y lo que
          Zak consigue por llamada o por WhatsApp. Cotiza, manda el link de pago
          y activa.
        </p>
```

- [ ] **Step 2: Mostrar origen, contacto y cita en la tarjeta**

En `BandejaSolicitudes.tsx`:

1. Sustituir `perfiles[s.user_id ?? ""]` por `s.user_id ? perfiles[s.user_id] : undefined` y tipar el prop `perfil` como opcional.
2. En `TarjetaSolicitud`, cuando `solicitud.origen !== "portal"`, mostrar el contacto propio (`contacto_nombre · contacto_telefono`) en vez del perfil del portal, y un `<Badge>` con el canal: `voz` → «Llamada» (tono `contactado`), `whatsapp` → «WhatsApp» (tono `respondido`).
3. Si `cita_inicio`, una línea con `📅 {fechaLegible(cita_inicio)}` (importar `fechaLegible` de `@/lib/solicitudes/mensaje`) y, si hay `cita_meet_url`, un enlace «Meet».
4. Si `cita_texto_crudo`, una línea en `text-tinta-60`: `Quiere agendar: «{cita_texto_crudo}» — sin hora`.
5. Actualizar el `EmptyState`: `detalle="Cuando alguien pida un servicio —en la tienda, por llamada o por WhatsApp— aparece aquí y te llega el aviso."`

- [ ] **Step 3: Verificar y commitear**

Run: `npx tsc --noEmit && npm run lint && npm test`
Comprobar en `/admin/solicitudes` que una fila de origen `voz` muestra el badge, el contacto y la cita.

```bash
git add src/components/admin/solicitudes/BandejaSolicitudes.tsx "src/app/admin/(panel)/solicitudes/page.tsx"
git commit -m "solicitudes: la bandeja muestra el canal, el contacto y la cita"
```

---

### Task 15: Documentación y cierre

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Documentar el subsistema**

Añadir a `CLAUDE.md`, después de la sección del portal:

```markdown
## Solicitudes entrantes y agenda (2026-09-01, rama `feat/solicitudes-agenda`)

Todo el que quiere contratarnos cae en `/admin/solicitudes`, venga de la
tienda, de una llamada o de un chat. Espec y runbook:
`docs/superpowers/specs/2026-09-01-solicitudes-agenda-design.md`.

- **Una sola bandeja**: `solicitudes` tiene `user_id` nullable + contacto
  propio (`supabase/solicitudes-entrada.sql`). La RLS del portal NO se tocó y
  no hay que tocarla: `user_id = auth.uid()` con NULL filtra la fila. Si
  alguien "arregla" esa política con un IS NULL, abre la bandeja entera.
- **Un solo camino de entrada**: `src/lib/solicitudes/entrada.ts`
  (`registrarSolicitudEntrante`) — insertar → agendar → avisar, degradando por
  pasos y sin lanzar nunca. Lo llaman `/api/voz/webhook` y
  `/api/zak/solicitud`.
- **Idempotencia** por `clave_origen` (`voz:<conversation_id>` / `wa:<ref>`),
  índice único parcial. Un reintento devuelve 'duplicada' y no vuelve a avisar.
- **Google Calendar** por `fetch` en `src/lib/agenda/google.ts` (sin SDK).
  ⚠️ La pantalla de consentimiento tiene que estar PUBLICADA EN PRODUCCIÓN: en
  "Testing" el refresh token caduca a los 7 días.
- **El choque de horario avisa, no bloquea** — perder una cita conseguida es
  peor que solapar dos eventos.
- **Campos de Zak**: `EXTRACCION_ZAK` solo se aplica al CREAR el agente. Para
  un agente ya existente, el botón «Poner al día los campos» de su ficha
  (`ponerAlDiaCamposZak`) fusiona los estándar sin pisar lo escrito a mano.
- **Pendiente fuera de este repo**: la tool del bot Flask
  (`docs/bot-flask/tool-registrar-solicitud.md`).
```

- [ ] **Step 2: Correr la batería completa**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: todo verde, el build pasa.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: solicitudes entrantes y agenda en el contexto del repo"
```

---

## Runbook de encendido (Tomás, en orden — nada de esto vive en el repo)

1. Correr `supabase/solicitudes-entrada.sql` en el SQL editor de Supabase.
2. `AVISOS_WHATSAPP_TO=573007970810,573007909522` en Vercel. **Ya con esto la fase 1 funciona.**
3. Google Cloud → el proyecto que ya tiene Places → habilitar **Google Calendar API**.
4. Pantalla de consentimiento OAuth: tipo **Externo** y **publicarla en Producción** (no dejarla en Testing).
5. Credenciales → ID de cliente OAuth tipo **Aplicación de escritorio**.
6. `GOOGLE_OAUTH_CLIENT_ID=… GOOGLE_OAUTH_CLIENT_SECRET=… node scripts/google-oauth.mjs` → aceptar (incluido el aviso de app no verificada) → imprime el refresh token.
7. Pegar los tres valores + `AGENDA_INVITADOS=tomasmunevar36@gmail.com,paulapjpg@gmail.com` **directo en `.env.local` y en Vercel**. No pasan por el chat.
8. Deploy.
9. `/admin/voz` → ficha de Zak → **Poner al día los campos**.
10. En el repo del bot Flask: aplicar `docs/bot-flask/tool-registrar-solicitud.md`.

## Verificación end-to-end

- Llamada de **prueba** desde el lab: no crea solicitud, no agenda, no avisa.
- Llamada **saliente** real donde piden un bot y aceptan reunirse mañana: solicitud con origen `voz`, WhatsApp a los dos números con el link de Meet, evento en el calendario con Paula invitada, y la cita en `/admin/agenda` con la píldora del sidebar en 1.
- Llamada donde dicen "el jueves por la tarde": solicitud sí, evento no, y el WhatsApp pide ponerle hora.
- Reintento del mismo webhook: no duplica.
- Con las envs de Google borradas: la solicitud y el aviso llegan igual.
- Llamada de un agente **de cliente**: se comporta como antes, sin solicitud.
- `POST /api/zak/solicitud` con token malo → 401; sin teléfono → 400.
