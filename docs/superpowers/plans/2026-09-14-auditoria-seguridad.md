# Correcciones de seguridad de la Radiografía Zakumi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los hallazgos de seguridad de la auditoría (1 Crítico, 1
Alto, y los de Medio/Bajo que se pueden arreglar en código) sin tocar los
tres que exigen un toggle del dashboard de Supabase (CAPTCHA, MFA, "Secure
password change") — esos quedan documentados para que Tomás los prenda a
mano.

**Architecture:** Cada hallazgo es independiente — no hay una pieza de
diseño compartida entre ellos. El plan los agrupa en 7 tasks por
tamaño/riesgo: un upgrade de dependencia, un cambio de RLS/trigger, y cinco
correcciones de aplicación chicas y autocontenidas (una de ellas agrupa 8
archivos porque son ediciones mecánicas del mismo tipo — importar
`"server-only"`, o una validación de una línea).

**Tech Stack:** Next.js 16 + TypeScript + Supabase (Postgres/RLS). Sin
dependencias nuevas.

**Spec:** No hay spec de diseño — es la lista de hallazgos de seguridad de
la auditoría hecha en esta misma sesión (ver el artifact "Radiografía
Zakumi" publicado, o el hallazgo original en la conversación).

## Global Constraints

- **Cero tests de componentes/route handlers** (`vitest.config.ts`:
  `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts"]`).
  Solo la Task 4 (`cambiarPassword`) toca lógica testeable — el resto son
  SQL, config o rutas sin contraparte de test en este repo.
- **Deliberadamente FUERA de este plan** (no los toques):
  - CAPTCHA de Supabase Auth, MFA, y "Secure password change" — son
    toggles del dashboard de Supabase, no hay nada que escribir en el
    repo. Anotados para Tomás en el reporte de la Task 7.
  - La condición de carrera del cap diario de `/api/zak/llamar`
    (`src/lib/voz/despacho.ts:52-55`) — el propio código YA documenta esto
    como una limitación aceptada a propósito ("Aceptable mientras despacha
    1-a-1 el cockpit y la tool del bot; el cron de tandas necesitará su
    cola propia"). Cerrarla de verdad exige una tabla/RPC nueva — más
    diseño del que amerita esta pasada. Solo se arregla la restricción de
    país (Task 5), que es independiente y no tiene esa objeción.
  - Un rate-limiter casero para los logins (alternativa que la auditoría
    menciona al CAPTCHA) — se descarta a propósito: una tabla de intentos
    de login escribible por `anon` (necesario, porque el login corre sin
    sesión) es su propia superficie de ataque si no se diseña con cuidado,
    y esta pasada no es el lugar para apurar eso. El camino real es
    CAPTCHA (dashboard).
- **`cambiarPassword` gana un parámetro nuevo, no una tabla nueva.** El
  re-auth (Task 4) usa `signInWithPassword` con la contraseña actual que
  ya escribe el usuario — no depende de ningún toggle de Supabase.

---

### Task 1: Actualizar Next.js y sharp (el hallazgo Crítico)

**Files:**
- Modify: `package.json`, `package-lock.json` (via `npm install`)

**Interfaces:** ninguna — es un bump de versión, no cambia ninguna firma
que otro código consuma.

- [ ] **Step 1: Actualizar**

```bash
npm install next@^16.3.3
```

Y en `package.json`, dentro del bloque `"overrides"`, cambiar:

```json
"sharp": "^0.35.3"
```

por:

```json
"sharp": "^0.35.4"
```

Luego:

```bash
npm install
```

- [ ] **Step 2: Confirmar que el audit queda limpio**

Run: `npm audit --omit=dev`
Expected: sin el advisory de Next.js/sharp que motivó este hallazgo (GHSA‑2xp9‑vwfh‑vxw4). Si aparece algo nuevo y distinto, anótalo en el reporte — no es parte de este hallazgo puntual, pero no lo ignores en silencio.

- [ ] **Step 3: Verificar que todo sigue andando**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npm test`
Expected: mismo número de tests que antes de este task, todos pasando.

Run: `npm run build`
Expected: build exitoso (Next 16.3.x puede haber cambiado algo del pipeline de build — si el build falla, es exactamente lo que este step existe para cazar antes de mergear).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix: actualiza Next.js a 16.3.3 (RCE no autenticado en /_next/image, GHSA-2xp9-vwfh-vxw4)"
```

---

### Task 2: `perfiles.email` deja de ser editable por el propio usuario

**Files:**
- Modify: `supabase/perfiles.sql`

**Interfaces:** ninguna en TypeScript — es SQL puro. No hay ningún flujo
del código que dependa de poder escribir `perfiles.email` desde el
cliente (la única escritura legítima de `email` es el trigger
`crear_perfil()` al signup, que corre como `security definer` y no pasa
por RLS).

- [ ] **Step 1: Acotar la política de auto-edición a la columna `nombre`**

En `supabase/perfiles.sql`, reemplazar el bloque de la política
`perfiles_edita_propio` (busca `-- Editar el propio perfil`):

```sql
-- Editar el propio perfil (solo nombre en la práctica: el trigger
-- perfiles_proteger bloquea rol/cliente_id para no-admins).
drop policy if exists perfiles_edita_propio on public.perfiles;
create policy perfiles_edita_propio on public.perfiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

por:

```sql
-- Editar el propio perfil. La política deja pasar el UPDATE de la fila
-- propia; el GRANT de columnas de abajo acota QUÉ columnas puede tocar el
-- rol `authenticated` — Postgres exige ambos (policy + privilegio de
-- columna). Ojo: el grant es por ROL de Postgres, y admin y cliente son el
-- MISMO rol (`authenticated`; "admin" es solo un valor de perfiles.rol que
-- RLS lee vía es_admin()). Por eso no se puede acotar a `(nombre)` sin
-- romper los tres flujos de admin que escriben acá — cambiarRolPerfil
-- (rol), vincularPerfilACliente y activarSolicitud (cliente_id). Quien
-- decide si un NO-admin puede tocar rol/cliente_id es el trigger
-- perfiles_proteger. `email` NO va en la lista: ningún flujo de la app lo
-- escribe (solo crear_perfil() al signup, que es security definer, y el
-- seed como postgres) — así el grant lo bloquea en la capa de ACL y el
-- trigger es la segunda capa, no la única. Antes de esto, cualquier usuario
-- podía reescribir su propio `email`, lo que permitía "ocupar" el correo de
-- un cliente real y que un admin lo vinculara a la ficha equivocada — ver
-- Radiografía Zakumi, hallazgo Alto #2. Al agregar una columna nueva que
-- la app escriba, hay que sumarla a esta lista: los grants de columna no
-- se extienden solos a columnas futuras.
drop policy if exists perfiles_edita_propio on public.perfiles;
create policy perfiles_edita_propio on public.perfiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.perfiles from authenticated;
grant update (nombre, rol, cliente_id) on public.perfiles to authenticated;
```

- [ ] **Step 2: Cerrar el trigger también, como segunda capa**

En el mismo archivo, dentro de la función `proteger_perfil()`, cambiar:

```sql
  if (new.rol is distinct from old.rol
      or new.cliente_id is distinct from old.cliente_id
      or new.user_id is distinct from old.user_id)
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'solo un admin puede cambiar rol o cliente vinculado';
  end if;
```

por:

```sql
  if (new.rol is distinct from old.rol
      or new.cliente_id is distinct from old.cliente_id
      or new.user_id is distinct from old.user_id
      or new.email is distinct from old.email)
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'solo un admin puede cambiar rol, cliente vinculado o email';
  end if;
```

(El `grant update (nombre)` del Step 1 ya haría esto imposible por sí
solo — este trigger es el cinturón encima del arnés, para que un futuro
`grant update` más ancho sobre esta tabla no vuelva a abrir el hueco en
silencio.)

- [ ] **Step 3: El seed de admins deja de confiar en `perfiles.email`**

Todavía en el mismo archivo, cambiar el bloque `-- Seed de admins`:

```sql
update public.perfiles set rol = 'admin'
where email in (
  'tomasmunevar36@gmail.com',  -- Tomás
  'catalinamcpg@outlook.com'   -- Catalina
);
```

por:

```sql
-- Se lee de auth.users.email (la fuente real de identidad), no de
-- perfiles.email (una copia editable hasta el Step 1 de arriba — un
-- correo "ocupado" ahí antes de este fix habría vuelto admin a cualquiera
-- en una re-corrida de este seed).
update public.perfiles p set rol = 'admin'
from auth.users u
where u.id = p.user_id
  and u.email in (
    'tomasmunevar36@gmail.com',  -- Tomás
    'catalinamcpg@outlook.com'   -- Catalina
  );
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores (este task no toca ningún `.ts`, pero confirma que no se rompió nada por accidente).

Este SQL no se ejecuta en un entorno de test — no hay Postgres en CI para
este repo. Escribir en el reporte de esta task, textual, para que Tomás lo
corra a mano en el SQL Editor de Supabase (staging o producción, según
corresponda):

```sql
-- 1. Correr este archivo completo (es idempotente).
-- 2. Verificar como un usuario NO admin (una sesión de cliente del portal):
update public.perfiles set email = 'hackeado@evil.com' where user_id = auth.uid();
-- Debe fallar con "permission denied for table perfiles" (columna no
-- otorgada) — no con el mensaje del trigger, que ya ni se alcanza a
-- evaluar porque el GRANT lo bloquea primero.
-- 3. Verificar que SIGUE funcionando cambiar el nombre propio:
update public.perfiles set nombre = 'Nombre Nuevo' where user_id = auth.uid();
-- Debe funcionar sin error (actualizarNombre en portal/actions.ts sigue
-- andando igual que antes).
```

- [ ] **Step 5: Commit**

```bash
git add supabase/perfiles.sql
git commit -m "fix: perfiles.email deja de ser editable por el propio usuario (RLS + trigger + seed)"
```

---

### Task 3: Open redirect en el callback del portal

**Files:**
- Modify: `src/app/app/auth/callback/route.ts`

**Interfaces:** ninguna — el handler no expone nada que otro código
consuma.

- [ ] **Step 1: Reemplazar el guard de prefijo por un parseo real de URL**

En `src/app/app/auth/callback/route.ts`, reemplazar:

```ts
  const next = url.searchParams.get("next") ?? "/app";
  // Solo paths internos: nada de open-redirect vía ?next=https://…
  const destinoPedido = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
```

por:

```ts
  const next = url.searchParams.get("next") ?? "/app";
  // Solo paths internos: nada de open-redirect. Un prefijo "/" no alcanza
  // —el parseo de WHATWG URL normaliza \ a / y descarta tab/CR/LF, así que
  // "/%5Cevil.com" o "/%09/evil.com" terminan siendo otro origen aunque
  // "empiecen con /"— así que se compara el origin ya resuelto, no el
  // string crudo.
  const destinoPedido = (() => {
    try {
      const resuelta = new URL(next, url.origin);
      return resuelta.origin === url.origin ? resuelta.pathname + resuelta.search : "/app";
    } catch {
      return "/app";
    }
  })();
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint src/app/app/auth/callback/route.ts`
Expected: 0 errores/warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/auth/callback/route.ts
git commit -m "fix: cierra el open redirect del callback del portal (parseo real de URL, no prefijo de string)"
```

---

### Task 4: `cambiarPassword` exige la contraseña actual

**Files:**
- Modify: `src/lib/portal/actions.ts`
- Modify: `src/components/portal/AjustesModal.tsx`

**Interfaces:**
- Produces: `cambiarPassword(datos: { passwordActual: string; password:
  string; confirmacion: string })` — firma nueva, el único llamador
  (`AjustesModal.tsx`) se actualiza en el mismo task.

- [ ] **Step 1: La action re-autentica antes de cambiar la contraseña**

En `src/lib/portal/actions.ts`, reemplazar la función `cambiarPassword`:

```ts
export async function cambiarPassword(datos: {
  password: string;
  confirmacion: string;
}): Promise<{ error: string | null }> {
  const sesion = await verifySesionPortal();

  const password = typeof datos?.password === "string" ? datos.password : "";
  if (password.length < 8) {
    return { error: "La contraseña necesita al menos 8 caracteres." };
  }
  if (password !== datos.confirmacion) {
    return { error: "Las contraseñas no coinciden." };
  }

  const { error } = await sesion.supabase.auth.updateUser({ password });
  if (error) {
    console.error("[cambiarPassword]", error.message);
    return { error: "No se pudo cambiar la contraseña." };
  }
  return { error: null };
}
```

por:

```ts
export async function cambiarPassword(datos: {
  passwordActual: string;
  password: string;
  confirmacion: string;
}): Promise<{ error: string | null }> {
  const sesion = await verifySesionPortal();

  const passwordActual = typeof datos?.passwordActual === "string" ? datos.passwordActual : "";
  if (!passwordActual) {
    return { error: "Escribe tu contraseña actual." };
  }
  const password = typeof datos?.password === "string" ? datos.password : "";
  if (password.length < 8) {
    return { error: "La contraseña necesita al menos 8 caracteres." };
  }
  if (password !== datos.confirmacion) {
    return { error: "Las contraseñas no coinciden." };
  }

  // Re-autenticar con la contraseña actual antes de cambiarla: sin esto,
  // cualquiera con acceso momentáneo a una sesión abierta (la cookie del
  // portal no es httpOnly por cómo funciona @supabase/ssr) podía tomar la
  // cuenta entera con un solo cambio de contraseña, sin saber la anterior.
  if (!sesion.email) {
    return { error: "No se pudo verificar tu contraseña actual." };
  }
  const { error: errorAuth } = await sesion.supabase.auth.signInWithPassword({
    email: sesion.email,
    password: passwordActual,
  });
  if (errorAuth) {
    return { error: "La contraseña actual no es correcta." };
  }

  const { error } = await sesion.supabase.auth.updateUser({ password });
  if (error) {
    console.error("[cambiarPassword]", error.message);
    return { error: "No se pudo cambiar la contraseña." };
  }
  return { error: null };
}
```

- [ ] **Step 2: El formulario pide la contraseña actual**

En `src/components/portal/AjustesModal.tsx`, dentro de `SeccionSeguridad`:

1. Agregar el estado nuevo, junto a los otros `useState` de esa función:

```ts
  const [passwordActual, setPasswordActual] = useState("");
```

2. Cambiar la llamada a la action:

```ts
      const r = await cambiarPassword({ password, confirmacion });
```

por:

```ts
      const r = await cambiarPassword({ passwordActual, password, confirmacion });
```

3. Limpiar el campo nuevo también al terminar bien (busca donde ya se
   limpian `password`/`confirmacion` tras el éxito):

```ts
      setPassword("");
      setConfirmacion("");
```

por:

```ts
      setPasswordActual("");
      setPassword("");
      setConfirmacion("");
```

4. Agregar el input en el JSX, ANTES del campo de la contraseña nueva
   (busca el `<div className="app-field">` que ya existe para
   `ajustes-pass` y agrega este bloque justo encima, con el mismo patrón
   de clases):

```tsx
      <div className="app-field">
        <label className="app-field-label" htmlFor="ajustes-pass-actual">
          Contraseña actual
        </label>
        <input
          id="ajustes-pass-actual"
          type="password"
          className="app-input"
          value={passwordActual}
          onChange={(e) => setPasswordActual(e.target.value)}
          autoComplete="current-password"
        />
      </div>
```

(El campo de la contraseña nueva que ya existe, `id="ajustes-pass"`,
queda tal cual — solo se agrega este ANTES.)

5. El botón de guardar debe seguir deshabilitado si falta cualquiera de
   los tres campos. Reemplazar:

```tsx
        disabled={guardando || password.length === 0}
```

por:

```tsx
        disabled={guardando || !passwordActual || password.length === 0}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npx eslint src/lib/portal/actions.ts src/components/portal/AjustesModal.tsx`
Expected: 0 errores/warnings.

Run: `npm test`
Expected: mismo número de tests, todos pasando (este repo no tiene test
para `cambiarPassword` hoy — no hay que agregar uno: es una acción de
Supabase Auth real, no lógica pura, y sigue el patrón ya establecido de
que esas acciones no llevan test en este archivo).

- [ ] **Step 4: Commit**

```bash
git add src/lib/portal/actions.ts src/components/portal/AjustesModal.tsx
git commit -m "fix: cambiar la contraseña exige la contraseña actual (re-auth)"
```

---

### Task 5: `/api/zak/llamar` solo marca a Colombia por defecto

**Files:**
- Modify: `src/lib/voz/despacho.ts`

**Interfaces:** ninguna — `despacharLlamadaZak`'s firma no cambia.

- [ ] **Step 1: Restringir el país, con salida de emergencia por env**

En `src/lib/voz/despacho.ts`, justo después de la línea:

```ts
  const telefono = normalizarTelefono(typeof datos.telefono === "string" ? datos.telefono : "");
  if (!telefono) return { error: "Teléfono no válido (formato +57…)." };
```

agregar:

```ts

  // Sin esto, el endpoint marcaba a cualquier +<código de país> del
  // mundo con solo el token compartido — un token filtrado podía usarse
  // para marcar a números internacionales de tarifa premium a costa de
  // Zakumi. ZAK_VOZ_PAISES_PERMITIDOS es la salida de emergencia si algún
  // día el negocio sí necesita llamar fuera de Colombia.
  const paisesPermitidos = (process.env.ZAK_VOZ_PAISES_PERMITIDOS ?? "+57")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paisesPermitidos.some((prefijo) => telefono.startsWith(prefijo))) {
    return { error: "Ese número no está en un país permitido para llamar." };
  }
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npm test`
Expected: mismo número de tests, todos pasando.

Run: `npx eslint src/lib/voz/despacho.ts`
Expected: 0 errores/warnings.

- [ ] **Step 3: Commit**

```bash
git add src/lib/voz/despacho.ts
git commit -m "fix: /api/zak/llamar solo marca a Colombia por defecto (ZAK_VOZ_PAISES_PERMITIDOS)"
```

---

### Task 6: Endurecimiento chico — 8 archivos, ediciones mecánicas

Ocho correcciones independientes, cada una de un par de líneas. Se
agrupan en un solo task porque ninguna necesita su propio ciclo de
revisión — son mecánicas y de bajo riesgo.

**Files:**
- Modify: `src/lib/bots/api.ts`, `src/lib/voz/api.ts`, `src/lib/voz/twilio.ts`,
  `src/lib/agenda/google.ts`, `src/lib/voz/supabase-service.ts` (una línea
  cada uno)
- Modify: `next.config.ts` (CSP)
- Modify: `src/app/admin/(panel)/clientes/[id]/page.tsx` (ilike → eq)
- Modify: `src/app/api/zak/solicitud/route.ts` (validar negocio_id)

**Interfaces:** ninguna cambia de forma observable para otro código.

- [ ] **Step 1: `import "server-only"` en los 5 módulos con secretos**

En cada uno de estos 5 archivos, agregar `import "server-only";` como la
PRIMERA línea del archivo (antes de cualquier comentario o import
existente):

- `src/lib/bots/api.ts`
- `src/lib/voz/api.ts`
- `src/lib/voz/twilio.ts`
- `src/lib/agenda/google.ts`
- `src/lib/voz/supabase-service.ts`

Ejemplo para `src/lib/bots/api.ts` (el patrón es idéntico en los 5 —
`import "server-only";` en la línea 1, todo lo demás del archivo queda
exactamente igual, empezando por su comentario `// Cliente del API admin
del bot...` que ahora queda en la línea 2):

```ts
import "server-only";
// Cliente del API admin del bot (Flask en Railway, /admin/api/v1).
//
// SOLO SERVIDOR: se importa desde pages, server actions y route handlers —
```

Hoy nada de esto se filtra al cliente (todo lo que importa estos módulos
desde un componente `"use client"` usa `import type`), así que este
cambio no debería alterar ningún build — es una red para que un futuro
`import` sin `type` falle en build en vez de filtrar un secreto en
silencio. `server-only` ya es una dependencia transitiva de Next.js, no
hace falta instalar nada.

- [ ] **Step 2: Content-Security-Policy**

En `next.config.ts`, agregar al array `securityHeaders` (después de
`Strict-Transport-Security`):

```ts
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' blob: https://maps.googleapis.com https://cdn.jsdelivr.net/npm/@alexanderolsen/libsamplerate-js@2.1.2/",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "media-src 'self' https:",
      "connect-src 'self' https://maps.googleapis.com https://*.supabase.co https://*.elevenlabs.io wss://*.elevenlabs.io",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
```

Cada host tiene una razón concreta, verificada leyendo qué carga cada
superficie desde el navegador (no "por si acaso"):
- `'unsafe-inline'` en `script-src`: Next inyecta un bootstrap inline;
  sin nonces no se evita sin un cambio mucho mayor.
- `https://maps.googleapis.com` en `script-src` y `connect-src`: el loader
  de Google Maps (`MapCanvas.tsx`) y el XHR de los tiles vectoriales.
- `https://cdn.jsdelivr.net` en `script-src`: el widget de voz de
  ElevenLabs carga su audio worklet de ahí como fallback en
  Firefox/Safari; los worklets se rigen por `script-src`.
- `https://fonts.googleapis.com`/`https://fonts.gstatic.com`: el chrome
  de Google Maps puede traer Roboto de ahí; `disableDefaultUI` lo hace
  improbable, pero dos hosts son más baratos que un mapa roto.
- `media-src 'self' https:`: sin la directiva, `<audio>` cae a
  `default-src 'self'` y bloquea las previsualizaciones de voz de
  ElevenLabs (`VozView.tsx`, `BibliotecaVoces.tsx`), que viven en un CDN
  de terceros — misma postura que `img-src https:`.
- `https://*.elevenlabs.io` + `wss://*.elevenlabs.io` en `connect-src`:
  el widget de voz está vendorizado (`public/voz/…`, lo cubre `'self'`),
  pero habla por REST con `api*.elevenlabs.io` y por WebSocket con
  `api*.elevenlabs.io` y `livekit.rtc.elevenlabs.io`. Sin esto, el lab
  de `/admin/voz` carga y no funciona — y ningún test lo detecta.
- `https://*.supabase.co` en `connect-src`: el cliente del navegador le
  habla directo. NO se agrega `wss://` porque ninguna pantalla usa
  Realtime desde el cliente — no se permite lo que no está en uso.
Si algo deja de funcionar tras este cambio, es que falta un host en esta
lista, no que el CSP esté de más.

- [ ] **Step 3: La sugerencia de vínculo en la ficha de cliente busca por email exacto, no por patrón**

En `src/app/admin/(panel)/clientes/[id]/page.tsx`, dentro del bloque que
arma `sugerenciaRes`, reemplazar:

```ts
    cliente.email
      ? supabase
          .from("perfiles")
          .select("user_id, email, nombre, cliente_id")
          .ilike("email", cliente.email)
          .is("cliente_id", null)
          .eq("rol", "cliente")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
```

por:

```ts
    cliente.email
      ? supabase
          .from("perfiles")
          .select("user_id, email, nombre, cliente_id")
          .eq("email", cliente.email)
          .is("cliente_id", null)
          .eq("rol", "cliente")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
```

(`.ilike()` sin escapar dejaba que un `%`/`_` en `cliente.email` ampliara
la búsqueda a otros perfiles — la sugerencia de vínculo quiere el email
EXACTO, no un patrón, así que `.eq()` es más correcto además de más
seguro.)

- [ ] **Step 4: `/api/zak/solicitud` valida `negocio_id` antes de pasarlo**

En `src/app/api/zak/solicitud/route.ts`, agregar la constante (junto a
`tokenValido`/`texto`, arriba del `export async function POST`):

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

Y reemplazar:

```ts
  const negocioId = texto(b.negocio_id);
```

por:

```ts
  const negocioIdCrudo = texto(b.negocio_id);
  const negocioId = negocioIdCrudo && UUID.test(negocioIdCrudo) ? negocioIdCrudo : null;
```

(Mismo patrón que ya usa `src/lib/voz/despacho.ts:11,74-77` para el mismo
campo en el otro endpoint del bot — un `negocio_id` que no es un UUID
hoy provoca un error `22P02` de Postgres que `registrarSolicitudEntrante`
trata como un fallo genérico y dispara el aviso de rescate por WhatsApp a
Tomás/Pau sin necesidad; con esto, un valor raro simplemente se guarda
como `null` en vez de tumbar el insert entero.)

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores.

Run: `npm run build`
Expected: build exitoso (el CSP es lo único de este task con chance real
de romper algo visualmente — el build no lo detecta, pero al menos
confirma que nada rompió en compilación).

Run: `npm test`
Expected: mismo número de tests, todos pasando.

Run:
```bash
npx eslint src/lib/bots/api.ts src/lib/voz/api.ts src/lib/voz/twilio.ts src/lib/agenda/google.ts src/lib/voz/supabase-service.ts "src/app/admin/(panel)/clientes/[id]/page.tsx" src/app/api/zak/solicitud/route.ts
```
Expected: 0 errores/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bots/api.ts src/lib/voz/api.ts src/lib/voz/twilio.ts src/lib/agenda/google.ts src/lib/voz/supabase-service.ts next.config.ts "src/app/admin/(panel)/clientes/[id]/page.tsx" src/app/api/zak/solicitud/route.ts
git commit -m "fix: endurecimiento chico — server-only, CSP, ilike sin escapar, negocio_id sin validar"
```

---

### Task 7: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: mismo número que la última corrida de la Fase/plan anterior, todos pasando (este plan no agrega tests nuevos).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: `npm audit` de nuevo, para el reporte final**

Run: `npm audit --omit=dev`
Expected: documentar el resultado tal cual en el reporte — confirma si el
advisory de la Task 1 quedó cerrado.

- [ ] **Step 5: Checklist de QA manual + lo que queda fuera de código**

Escribir en el reporte de esta task, textual:

**Pendiente de verificación humana (navegador):**
- [ ] Login de admin y de portal siguen funcionando con credenciales
      correctas.
- [ ] `/app` (cualquier página del portal) carga sin errores de consola
      nuevos tras el CSP — si algo deja de cargar (un mapa, un widget,
      una fuente), anotar cuál para ajustar la política.
- [ ] Cambiar la contraseña propia en `/app` pide ahora la contraseña
      actual, y falla claro si se escribe mal.
- [ ] La ficha de un cliente en `/admin/clientes/[id]` sigue mostrando la
      sugerencia de vínculo cuando corresponde.

**Pendiente FUERA de este repo (dashboard de Supabase, Tomás):**
- [ ] Activar CAPTCHA (hCaptcha o Turnstile) en Authentication → Settings,
      para los dos logins (admin y portal) — cierra el hallazgo de fuerza
      bruta que este plan no tocó en código.
- [ ] Activar MFA para las dos cuentas admin.
- [ ] Activar "Secure password change" en Authentication → Settings (el
      re-auth de la Task 4 ya cubre el mismo riesgo desde el lado de la
      app — este toggle es una segunda capa, no obligatoria pero
      recomendada).

- [ ] **Step 6: Commit (solo si hiciera falta alguna corrección)**

Si algún paso anterior encontró un problema y hubo que corregirlo:

```bash
git add -A
git commit -m "fix: ajuste final de las correcciones de seguridad"
```

Si todos los pasos dieron bien, no hay nada que commitear en esta task —
reportar `DONE` igual, sin diff.
