# Portal de clientes "Mi Zakumi" — zakumistudio.com/app

## Contexto

Zakumi ya vende servicios (bot WhatsApp, web, CRM, mantenimiento, voz "próximamente")
pero todo el ciclo es manual y opaco para el cliente. Tomás quiere un portal donde
cualquier usuario se registre, compre/solicite servicios y gestione sus activos
digitales — el módulo "F: clientes & cobros" del roadmap, versión cara-al-cliente.
Objetivo de negocio: acercar ventas reales; v1 vendible primero.

**Decisiones tomadas por Tomás (2026-08-22):**

1. El cliente ve TODO en su portal: tienda de servicios, sus activos (su bot: verlo,
   modificarlo, probarlo, sus conversaciones y leads), registro de sus ventas
   (mini-CRM + lo del bot) y sus compras/pagos con Zakumi.
2. Compra v1: **solicitud → cotización desde /admin → link de pago manual (Wompi/Bold)
   → activación**. Sin pasarela integrada en v1.
3. Mismo repo, route group nuevo en `/app`.
4. Signup público **email+contraseña + Google OAuth** (hoy está desactivado).
5. UI: shell tipo **Scribe (Nebula)** — sidebar de islas flotantes colapsable + modal
   de ajustes — **redondeado como Scribe** pero con identidad Zakumi (#0A0C12, naranja
   #DB5227, Instrument Sans + Playfair). El /admin conserva su radius 0.
6. Bot del cliente: **secciones guiadas** (personalidad/tono, info del negocio,
   horarios, FAQ, qué no decir) — nunca el prompt completo.

## Estado actual relevante (explorado)

- Next.js 16.2.12: `src/proxy.ts` (no middleware), `cookies()` async, **layouts NO se
  re-renderizan al navegar** → `verifySession()` primera línea de cada page/action
  (`src/lib/admin/dal.ts`), `getSesion()` → 401 en handlers.
- Supabase sin ORM: SQL idempotente en `supabase/*.sql` corrido a mano. Tablas:
  `negocios`, `notas`, `clientes`, `productos_contratados` (tipo, tarifa, ciclo,
  `instancia_id` texto blando al bot, `proxima_fecha`), `pagos` + RPC `registrar_pago`.
- **RLS actual = "authenticated ve todo"** → activar signup sin rediseñarla expondría
  todo el CRM. Es EL prerrequisito.
- Bot Flask/Railway vía `src/lib/bots/api.ts` (server-only, `BOT_ADMIN_TOKEN`, contrato
  `Resultado<T>` que nunca lanza): prompt versionado (409+diff), labs, conversaciones,
  leads, status. Componentes admin: PromptEditor, LabsChat, Conversaciones, Actividad.
- Catálogo en `src/lib/admin/upsell.ts` (`CATALOGO_ZAKUMI`: 5 servicios con slug,
  tarifa COP, ciclo, disponible, pitch).
- Sin: zod, form libs, shadcn, pasarela, email transaccional. Tests: vitest lógica pura.

---

## 1. Identidad y roles — tabla `perfiles` (no claims JWT)

`supabase/perfiles.sql` (idempotente, estilo cartera.sql):

- Enum `rol_usuario ('admin','cliente')`. Tabla `perfiles`: `user_id` PK → auth.users,
  `rol` default 'cliente', `cliente_id` FK nullable → clientes, `email` (copia para que
  el admin busque/vincule), `nombre`, timestamps + trigger `set_updated_at`.
- Trigger `after insert on auth.users` → `crear_perfil()` security definer,
  `on conflict do nothing`, copia email y `full_name` de Google.
- Backfill de usuarios existentes + seed de admins por email (Tomás edita antes de correr).
- Helpers RLS security definer estables: `es_admin()`, `mi_cliente_id()`.
  Revoke anon/public, grant authenticated.
- RLS de perfiles: cliente SELECT solo su fila; **sin UPDATE de cliente** (rol y
  cliente_id solo los toca admin — evita auto-escalada).

Por qué tabla y no claim en JWT: los cambios de rol/vínculo aplican al instante (Tomás
vincula cuentas en vivo); un claim queda rancio hasta el refresh (~1h). El proxy solo
autentica; el rol se decide en DAL + RLS, que sí corren en cada request.

## 2. Rediseño RLS — `supabase/rls.sql`

Políticas con `(select es_admin())` / `(select mi_cliente_id())` (initplan, best
practice Supabase), cada una con su `drop policy if exists`:

| Tabla | Admin | Cliente | Anon |
|---|---|---|---|
| negocios, notas | ALL | nada | nada |
| clientes | ALL | SELECT su fila (`id = mi_cliente_id()`) | nada |
| productos_contratados | ALL | SELECT los suyos | nada |
| pagos | ALL | SELECT vía exists→producto→cliente | nada |
| perfiles | ALL | SELECT propia | nada |
| solicitudes | ALL | SELECT suyas; INSERT solo `estado='nueva'` sin campos de cotización | nada |
| ventas_cliente | SELECT (soporte) | ALL sobre las suyas (`user_id = auth.uid()`) | nada |

**Orden de migración en producción (sin romper /admin):** (1) perfiles.sql y verificar
seed de admins, (2) rls.sql + smoke test del panel, (3) desplegar DAL endurecido,
(4) **recién ahí** activar signup + Google en Supabase, (5) portal.sql + portal.
`registrar_pago` es security invoker: un cliente que lo invoque falla en el INSERT
de pagos — verificar en el checklist.

## 3. Datos del portal — `supabase/portal.sql`

- **`solicitudes`**: `user_id` FK (pertenece al usuario, no al cliente — un signup
  nuevo aún no tiene fila en clientes), `servicio_slug` (ref blanda a CATALOGO_ZAKUMI,
  mismo patrón que instancia_id), `mensaje`, enum `estado_solicitud`
  `nueva→cotizada→link_enviado→pagada→activa | rechazada`, `cotizacion_monto/moneda/
  ciclo/nota`, `link_pago` (URL Wompi/Bold que pega Tomás), `producto_id` FK nullable
  (se llena al activar). Máquina de estados en TS puro
  `src/lib/portal/solicitudes.ts` + test vitest (patrón `siguienteFecha`).
- **`ventas_cliente`** (mini-CRM, una sola tabla YAGNI): `user_id`, `contacto`,
  `telefono` (E.164 check), `detalle`, `monto`, `moneda`, `fecha`, enum `origen`
  `manual|bot`. Los leads del bot NO se copian en v1: "Mis ventas" muestra
  `ventas_cliente` + `listarLeads()` en vivo, lado a lado.
- **Clientes existentes sin usuario**: vinculación MANUAL desde /admin en v1 (bloque
  "Acceso al portal" en la ficha: buscar perfil por email, sugerencia automática si
  `perfiles.email = clientes.email`, vincular en 2 clics). Auto-claim por email se
  pospone (un email mal tipeado expondría conversaciones ajenas).

## 4. Auth y routing

- `src/proxy.ts`: matcher `["/admin/:path*", "/app/:path*"]`; públicos `/app/login`,
  `/app/registro`, `/app/auth/callback`; sin sesión → `/app/login` (con
  `redirigirConCookies`); con sesión en login/registro → `/app`.
- **`src/lib/auth/sesion.ts` nuevo (compartido)**: `getSesion` (React.cache) ampliado —
  tras `getClaims()`, una query a perfiles; `Sesion` gana `rol` y `clienteId`. Sin fila
  de perfil (carrera con el trigger) → tratar como cliente sin clienteId.
- `src/lib/admin/dal.ts`: `verifySession()` exige `rol==='admin'` (cliente →
  redirect `/app`); nuevo `getSesionAdmin()` para los **8 route handlers de
  `/admin/api/**`** (crítico: hoy solo piden sesión — con signup abierto cualquiera
  leería prompts/conversaciones de todas las instancias). Re-exportar desde dal.ts
  para no tocar ~20 imports.
- **`src/lib/portal/dal.ts` nuevo**: `verifySesionPortal()` (ambos roles) y
  `verifyBotDelCliente(instanciaId)` (producto activo tipo bot con ese instancia_id
  para `sesion.clienteId`; RLS ya filtra, esto es defensa en profundidad).
- Páginas `(auth)/login`, `(auth)/registro` (useActionState, patrón LoginForm) +
  botón Google (`signInWithOAuth` → `/app/auth/callback?next=/app`);
  `auth/callback/route.ts` con `exchangeCodeForSession` (route handler: SÍ puede
  escribir cookies) y redirect por rol. Actions en `src/lib/portal/auth-actions.ts`.
- Config Supabase manual (documentar): provider Google (Client ID/Secret), Site URL,
  redirect URLs prod+localhost, **Confirm email ON**, habilitar signups. Sin envs nuevas.

## 5. Exposición segura del bot

`BOT_ADMIN_TOKEN` jamás baja del servidor. Toda llamada del portal:
`verifySesionPortal()` → `verifyBotDelCliente(id)` → `src/lib/bots/api.ts`.

| Capacidad | Cómo | Límite |
|---|---|---|
| Modificar respuesta | **Secciones guiadas** (personalidad/tono, info negocio, horarios, FAQ, qué no decir) en `EditorConocimiento`; se serializan al campo `knowledge` vía `guardarPrompt` (hereda versionado 409 + historial + rollback desde /admin, notas "Editado por cliente <email>") | `system_prompt` bloqueado; ~20k chars; sin modelo/tokens/credenciales |
| Probar (labs) | handlers `/app/api/bot/[id]/labs` → labsChat/Historial/Reset, sesión `zk-portal-labs-<id>` | mitigación de gasto: `presupuesto_tokens_dia` por instancia (ya existe en el bot) |
| Conversaciones | `/app/api/bot/[id]/{conversaciones,historial}` | **solo lectura** (sin pausar/enviar/borrar) |
| Leads / estado | `listarLeads()` + `statusInstancia()` en server components | lectura |

Reuso: `LabsChat` se parametriza con prop `apiBase` (~5 líneas); `ConversacionesCliente`
es variante portal nueva solo-lectura (más barato y seguro que condicionar 4 acciones
admin); `PromptEditor` NO se reusa.

## 6. Estructura de archivos

```
src/app/app/
  layout.tsx                    # importa portal.css; robots noindex (patrón admin)
  (auth)/login/page.tsx  (auth)/registro/page.tsx
  auth/callback/route.ts
  (portal)/layout.tsx           # <PortalSidebar/> + <main> — SIN check de sesión (Next 16)
  (portal)/page.tsx             # inicio: saludo, estado del bot, últimas solicitudes, CTA tienda
  (portal)/tienda/page.tsx      # CATALOGO_ZAKUMI como cards → SolicitudForm
  (portal)/solicitudes/page.tsx # timeline de estados; botón "Pagar" si link_enviado
  (portal)/mi-bot/page.tsx      # tabs: Personalidad | Probar | Conversaciones | Leads
  (portal)/mis-ventas/page.tsx  # ventas_cliente CRUD + leads del bot en vivo
  (portal)/pagos/page.tsx       # productos + pagos (solo lectura)
  api/bot/[id]/{labs,conversaciones,historial}/route.ts

src/components/portal/
  PortalSidebar.tsx  AjustesModal.tsx  LoginForm/RegistroForm/BotonGoogle.tsx
  tienda/  solicitudes/  bot/{MiBotView,EditorConocimiento,ConversacionesCliente}.tsx
  ventas/
src/lib/portal/{dal,auth-actions,actions,solicitudes}.ts + __tests__/
src/lib/auth/sesion.ts
src/lib/catalogo.ts             # CATALOGO_ZAKUMI extraído de upsell.ts (que lo re-importa)
                                # → el portal no importa nada de lib/admin
src/styles/portal.css           # prefijo app-, cargado solo por app/layout.tsx
```

## 7. Sistema visual (Scribe → Zakumi)

Referencia: `/Users/tom/Desktop/Nebula/proto_scribe-main/` — ruta corta de lectura:
`globals.css` (tokens) → `src/lib/animations/sidebar-animations.ts` →
`chat-sidebar.tsx` L748-1524 → `settings-modal.tsx` → `glass-menu.tsx`.

**Se toma el patrón (no el código):**
- **Islas flotantes**: bloques independientes redondeados (25px) sobre lienzo más
  oscuro, gap 10px, sin bordes; profundidad con backdrop-blur, no sombras.
- **Sidebar 240⇄50px** (framer-motion 0.4s easeInOut): iconos anclados (nunca saltan),
  labels fade (salida 0.2s < entrada 0.3s), área muerta clickeable colapsa, footer =
  píldora de usuario con avatar + glass menu; estado en localStorage
  (useSyncExternalStore, referencia `sidebar-context.tsx` de Scribe).
- **Modal de ajustes** 720×554 abierto desde la píldora de usuario: sidebar interno de
  tabs pill h-35px (activo = acento sólido), SectionCard, master-detail <1044px.
  V1: Cuenta (nombre) · Seguridad (contraseña) · Cerrar sesión.
- Inputs píldora h-35px sin borde, toggle, alturas canónicas 35/50px, empty states
  minimalistas, glass menus con fallback `@supports`.

**Identidad Zakumi:** lienzo `#0A0C12`, islas un paso más claras (tipo `--superficie`),
acento `#DB5227` en lugar del azul, texto `--paper #f5efe3`/`--ink-2 #98A3AE`, verde
`--live` para estados ok; Instrument Sans (cuerpo) + Playfair Display (displays/cifras).
framer-motion se añade como dependencia (Scribe lo usa para todo el motion del sidebar).

**Trampas al portar:** ~20 variables `--colors-*` de Scribe NO existen (restos de
Figma) — definir tokens propios; no copiar `ui/card.tsx`/`ui/button.tsx` (shadcn roto);
sus `!important` no hacen falta con CSS propio; Nebula Sans no se usa. `portal.css`
sigue las reglas duras de `admin.css`: todo prefijado `app-`, jamás selectores desnudos
(`nav`/`footer`/`.cta` los estila la landing).

## 8. Cambios en /admin

- **`/admin/solicitudes`** (page + `BandejaSolicitudes`): lista por estado con perfil y
  cliente vinculado. Actions (`src/lib/admin/solicitudes-actions.ts`, con
  `verifySession()`): `cotizarSolicitud`, `marcarLinkEnviado(link)`,
  `rechazarSolicitud`, y `activarSolicitud` — la transacción gorda: crea cliente si no
  existe + vincula perfil + `crearProducto` (action existente) + `registrarPago` del
  primer cobro + estado `activa`.
- **Ficha cliente**: bloque "Acceso al portal" (vincular/desvincular perfil, buscador
  por email, sugerencia automática).
- `AdminNav`: link "Solicitudes".

## 9. Notificaciones v1

WhatsApp a Tomás vía el bot existente: al `crearSolicitud`, fire-and-forget
`enviarManual(...)` de `src/lib/bots/api.ts` (contrato Resultado nunca lanza: Railway
caído → la solicitud igual queda en la bandeja). Envs nuevas: `AVISOS_BOT_INSTANCIA_ID`,
`AVISOS_WHATSAPP_TO`. Email al cliente (Resend) = v2; en v1 ve el estado en
`/app/solicitudes`.

## 10. Fases (cada una desplegable sin romper nada)

| Fase | Contenido | Verificación |
|---|---|---|
| **1. Identidad** | `perfiles.sql` (tabla+trigger+backfill+seed+helpers) | SQL Editor: roles correctos; panel intacto |
| **2. RLS + DAL duro** ⚠️ prerrequisito | `rls.sql`; `sesion.ts`; verifySession exige admin; `getSesionAdmin()` en los 8 handlers | Panel completo OK; usuario prueba rol cliente: no ve nada, 401 en `/admin/api/*`; signup sigue OFF |
| **3. Auth + shell portal** | Signup+Google ON; proxy; login/registro/callback; sidebar Scribe-Zakumi + portal.css + inicio | Registro email y Google; redirect por rol; `/app` protegido |
| **4. Tienda + solicitudes** 🎯 corazón vendible | `portal.sql`; tienda; `crearSolicitud`; `/app/solicitudes`; bandeja admin; aviso WhatsApp | Ciclo completo solicitar→cotizar→link→pagar→activar→producto visible |
| **5. Pagos + vinculación** | `/app/pagos`; bloque "Acceso al portal" en ficha | Cliente ve SOLO lo suyo |
| **6. Mi bot** | `verifyBotDelCliente`; 3 handlers; EditorConocimiento (secciones guiadas); LabsChat parametrizado; ConversacionesCliente; leads | Cliente edita/prueba/ve; otro cliente → 404 |
| **7. Mis ventas** | ventas_cliente CRUD + leads en vivo | — |
| **8. Ajustes** | AjustesModal (Cuenta/Seguridad) | — |
| v1.1/v2 | Resend, badge solicitudes, auto-claim email, promover lead→venta, pasarela integrada, agente de voz | — |

**V1 vendible = fases 1-4.** 5-8 son retención.

## 11. Riesgos clave

1. Activar signup antes de la fase 2 = cualquier registrado lee todo el CRM y todas
   las instancias del bot vía `/admin/api/**`. El orden de fases existe por esto.
2. Next 16: `verifySesionPortal()` primera línea de CADA page/action/handler del
   portal (los layouts no protegen).
3. Seed de admins ANTES de rls.sql o el panel queda ciego (queries vacías). Todo
   idempotente para re-correr.
4. `instancia_id` texto blando: validar `/^\d+$/` antes de `Number()`; instancia
   borrada → banner degradado, nunca pantalla rota.
5. `portal.css` es global una vez cargado: prefijo `app-` estricto o rompe la landing.
6. Vinculación cuenta↔cliente manual: el email en `clientes` no es prueba de identidad.
7. Labs gasta tokens reales: mitigar con `presupuesto_tokens_dia` de la instancia.

## Verificación end-to-end

1. `npm run dev` + los SQL corridos en Supabase (Tomás los corre; Claude no escribe en
   la BD — regla dura).
2. Vitest: máquina de estados de solicitudes, composición de secciones→knowledge,
   catálogo extraído (test de upsell.ts sigue verde).
3. Flujo completo con 2 usuarios de prueba: admin (panel intacto, bandeja funciona) y
   cliente nuevo (registro Google, solicita bot, recibe cotización, Tomás activa,
   cliente edita personalidad y la ve reflejada en Labs, registra una venta, ve sus
   pagos). Cliente B no ve NADA de cliente A (pages, handlers y SQL directo con anon key).
4. Landing y /admin sin regresión visual (portal.css no se filtra).
5. Deploy Vercel con envs nuevas (`AVISOS_*`) — smoke en producción antes de anunciar.

---

## Puesta en marcha (runbook para Tomás) — estado al 2026-08-22

El código de las fases 1-8 está en la rama `feat/portal-clientes` (build, lint
y 132 tests en verde; login/registro verificados en navegador). Para encender:

1. **Editar `supabase/perfiles.sql`**: en el bloque "EDITAR AQUÍ", poner los
   correos REALES de las cuentas admin (Tomás y Paula). Correrlo en el SQL
   Editor. Verificar: `select email, rol from perfiles;`.
2. **Correr `supabase/rls.sql`** y hacer smoke test del panel /admin
   (mapa, negocios, clientes, registrar un pago de prueba).
3. **Correr `supabase/portal.sql`**.
4. **Merge + deploy** de la rama (o deploy preview primero).
5. **Supabase Auth**: habilitar signups; Confirm email ON; provider Google
   (Client ID/Secret de Google Cloud Console, redirect
   `https://<proyecto>.supabase.co/auth/v1/callback`); Site URL
   `https://zakumistudio.com`; Additional Redirect URLs:
   `https://zakumistudio.com/app/auth/callback` y
   `http://localhost:3000/app/auth/callback`.
6. **Vercel env** (Production): `AVISOS_BOT_INSTANCIA_ID` (instancia de Zak,
   normalmente 1) y `AVISOS_WHATSAPP_TO` (celular de Tomás, 57XXXXXXXXXX).
7. **Prueba end-to-end con 2 cuentas**: cliente nuevo por Google → solicita
   bot → cotizar en /admin/solicitudes → publicar link → "Confirmar pago y
   activar" → en la ficha del cliente vincular la instancia real del bot →
   el cliente edita Personalidad, prueba en Labs y ve conversaciones.
   Verificar que una segunda cuenta cliente NO ve nada de la primera.

Orden inquebrantable: 1→2 ANTES de habilitar el signup (paso 5), o cualquier
registrado vería todo el CRM.
