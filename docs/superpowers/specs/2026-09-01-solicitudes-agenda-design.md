# Solicitudes entrantes y agenda — el cierre comercial deja rastro

Fecha: 2026-09-01 · Rama: `feat/solicitudes-agenda` (sale de `feat/twilio-apikey`,
worktree `.claude/worktrees/agentes-voz`)

## Contexto

Zak ya conversa y ya llama, pero **lo que consigue se evapora**. Al colgar una
llamada, el webhook post-call guarda la llamada en `llamadas_voz` y manda un
WhatsApp a un solo número; al cerrar un chat, el bot Flask no le cuenta nada a
Next. En ninguno de los dos casos aparece una solicitud en `/admin/solicitudes`,
y si la persona quedó en reunirse, la cita vive en la cabeza de quien leyó el
aviso.

Este diseño cierra el lazo: **toda intención de contratar termina en la bandeja,
en los dos WhatsApp y —si hay cita— en Google Calendar con su link de Meet**,
con una agenda propia en el panel.

## Estado actual relevante (explorado)

- `src/app/api/voz/webhook/route.ts` ya distingue los dos mundos: `r.lead` =
  agente de un cliente (crea `ventas_cliente`), `r.sin_cliente` = agente interno
  de Zakumi. El segundo es el nuestro y hoy solo produce un aviso de texto.
- `registrar_llamada_voz` es idempotente por `conversation_id` y devuelve
  `status: 'ok' | 'duplicado' | 'sin_agente'`. El webhook solo actúa con `ok`,
  así que **un reintento de ElevenLabs no puede duplicar nada**: la idempotencia
  del canal de voz sale gratis.
- `avisarAdmin` (`src/lib/portal/avisos.ts`) envía por el bot ya desplegado y
  nunca lanza. Lee `AVISOS_WHATSAPP_TO` — **un solo destinatario**.
- `solicitudes` (`supabase/portal.sql`) tiene `user_id not null → auth.users`:
  un lead de llamada o de WhatsApp **no puede entrar**, no tiene cuenta.
- El portal está APAGADO (`PORTAL_ABIERTO = false` en `src/proxy.ts`), o sea que
  `solicitudes` es una tabla dormida sin tráfico real.
- `/api/zak/llamar` ya es el patrón probado de "el bot Flask entra a Next":
  token compartido, comparación timing-safe, service-role a la DB.
- No existe nada de Google Calendar, ni dependencia, ni env, ni agenda.

## Decisiones

1. **Una bandeja, no dos.** `solicitudes` deja de ser "del portal" y pasa a ser
   *todo el que quiere contratarnos*, con `user_id` nullable y contacto propio.
   Alternativa descartada: tabla `solicitudes_entrantes` aparte — duplicaría la
   máquina de estados de `src/lib/portal/solicitudes.ts`, la bandeja y la vista,
   para separar filas que Tomás va a trabajar exactamente igual. Como el portal
   está apagado, ampliar la tabla no le rompe nada a ningún cliente.
2. **La RLS del portal no se toca: ya está a salvo.** La política del cliente es
   `user_id = (select auth.uid())`; con `user_id` nulo la comparación da NULL y
   la fila se filtra. Ningún cliente del portal verá jamás un lead nuestro, y
   `solicitudes_admin_todo` sigue dando acceso completo al admin. Se documenta
   esto en el SQL para que nadie "arregle" la política más adelante.
3. **Un solo camino de entrada.** Voz y WhatsApp llaman a la MISMA función
   (`registrarSolicitudEntrante`). Las dos puntas se diferencian solo en cómo
   llega el evento; insertar, agendar y avisar se escribe una vez.
4. **Degradación por pasos, nunca todo o nada.** Si Google se cae, la solicitud
   igual queda en la bandeja y el WhatsApp lo dice; si el bot de avisos se cae,
   la cita igual queda en el calendario. Mismo contrato que el resto del repo:
   la función no lanza.
5. **Google Calendar con `fetch`, sin SDK.** El repo no usa zod ni SDKs; la API
   REST de Calendar son dos POST. Cero dependencias nuevas, cero superficie.
6. **OAuth con refresh token de la cuenta de Tomás.** `tomasmunevar36@gmail.com`
   y `paulapjpg@gmail.com` son cuentas personales: una service account no puede
   escribir ahí sin delegación de dominio, que exige Workspace. Descartado
   migrar a Workspace: es un desvío grande para esta tarea (queda anotado como
   el camino natural el día que el correo pase a `@zakumistudio.com`).
7. **El choque de horario avisa, no bloquea.** Antes de crear el evento se
   consulta `freeBusy`; si hay solape se agenda **igual** y el WhatsApp lo marca
   con `⚠️`. Perder una cita conseguida es peor que solapar dos eventos.
8. **La solicitud se arma con lo que Zak YA extrae.** `EXTRACCION_ZAK`
   (`src/lib/voz/zak.ts`) ya trae `servicio_interes`, `mejor_horario` y, de
   `EXTRACCION_LEAD`, `lead_nombre`/`lead_telefono`/`lead_detalle`. No se
   inventan campos nuevos para el servicio ni el detalle: se leen esos. La
   consecuencia práctica es grande — **la fase 1 no necesita re-sincronizar
   nada ni tocar a los agentes de clientes**.
9. **Solo la cita necesita campos nuevos, y solo en Zak.** Se suman
   `cita_fecha_hora` y `cita_confirmada` a `EXTRACCION_ZAK`, que aplica
   únicamente al agente interno: agendar en el calendario de Tomás no tiene
   sentido para el agente de un cliente. `EXTRACCION_LEAD` y `eleven.ts` no se
   tocan, así que los agentes de clientes se comportan **exactamente como hoy**
   (venta en `ventas_cliente` + aviso).
10. **Un botón para poner al día a Zak.** `EXTRACCION_ZAK` solo se aplica al
    CREAR el agente (`crearAgenteZakVoz`), y el de Zak ya existe: cambiar la
    constante no toca su fila. Se añade la acción `ponerAlDiaCamposZak()`, que
    fusiona las claves estándar que le falten (preservando las que Tomás haya
    escrito a mano) y re-sincroniza. Descartado hacer la unión al construir el
    payload: la ficha mostraría menos campos de los que el agente realmente
    tiene, y esa mentira se paga después.
11. **Fecha que no parsea = no se inventa.** Si `cita_fecha_hora` no es una fecha
   futura y legible, no hay evento: la solicitud queda con el texto crudo y el
   WhatsApp dice «quiere agendar: "el jueves por la tarde" — ponle hora tú».
12. **Agenda de solo lectura en v1.** Mover o cancelar se hace en Google (enlace
    directo al evento). Un CRUD de calendario propio es otro proyecto y no
    acerca ninguna venta.
13. **El token compartido con el bot se reusa.** `/api/zak/solicitud` valida con
    `ZAK_VOZ_TOKEN`, el mismo de `/api/zak/llamar`: un secreto menos que rotar y
    configurar, misma contraparte (el bot Flask).

## Modelo de datos — `supabase/solicitudes-entrada.sql`

Script idempotente, se corre DESPUÉS de `portal.sql`. No borra ni reescribe
nada: solo `alter table ... add column if not exists`.

```sql
alter table public.solicitudes
  alter column user_id drop not null;

alter table public.solicitudes
  add column if not exists origen            text not null default 'portal',
  add column if not exists contacto_nombre   text,
  add column if not exists contacto_telefono text,
  add column if not exists contacto_email    text,
  -- traza al hecho que la originó
  add column if not exists llamada_id        uuid references public.llamadas_voz (id) on delete set null,
  add column if not exists conversacion      text,   -- teléfono o sesión del bot
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

`servicio_slug` sigue `not null`: cuando el agente no logra identificar el
servicio se inserta `'por-definir'` (el catálogo no lo conoce y la bandeja lo
muestra tal cual — es una señal útil, no un error).

## Archivos

**Nuevos**

| Archivo | Qué hace |
|---|---|
| `supabase/solicitudes-entrada.sql` | La migración de arriba |
| `src/lib/solicitudes/entrada.ts` | `registrarSolicitudEntrante()`: insertar → agendar → avisar. Nunca lanza |
| `src/lib/solicitudes/fecha.ts` | Parser puro de `cita_fecha_hora` → `{ inicio, fin }` o `null` |
| `src/lib/agenda/google.ts` | `accessToken()`, `crearEventoConMeet()`, `hayChoque()` — solo `fetch` |
| `src/lib/agenda/consultas.ts` | Lectura de citas para el panel (agrupadas por día) |
| `src/app/api/zak/solicitud/route.ts` | Entrada del bot de WhatsApp (token `ZAK_VOZ_TOKEN`) |
| `src/app/admin/(panel)/agenda/page.tsx` | La página, server component |
| `src/app/admin/api/agenda/hoy/route.ts` | Contador de citas de hoy para el badge del sidebar |
| `src/components/admin/agenda/AgendaView.tsx` | Shell cockpit (sin scroll de página) |
| `src/components/admin/agenda/ListaCitas.tsx` | Columna izquierda agrupada por día |
| `src/components/admin/agenda/DetalleCita.tsx` | Panel derecho: contacto, detalle, Meet, enlaces |
| `scripts/google-oauth.mjs` | Un solo uso: saca el refresh token en local |
| `docs/bot-flask/tool-registrar-solicitud.md` | Contrato de la tool + texto de prompt para el otro repo |

**Tocados**

| Archivo | Cambio |
|---|---|
| `src/lib/portal/avisos.ts` | `AVISOS_WHATSAPP_TO` acepta lista por comas; un fallo no tumba al otro |
| `src/app/api/voz/webhook/route.ts` | Rama `sin_cliente` → `registrarSolicitudEntrante`; la de cliente, intacta |
| `src/lib/voz/zak.ts` | `EXTRACCION_ZAK` suma `cita_fecha_hora` y `cita_confirmada` (y la fecha de hoy en el guion) |
| `src/lib/admin/voz-actions.ts` | Acción `ponerAlDiaCamposZak()`: fusiona claves estándar faltantes y re-sincroniza |
| `src/components/admin/voz/ConfigAgenteVoz.tsx` | Botón «Poner al día los campos de Zak» (solo visible en el agente `es_zak`) |
| `src/lib/portal/solicitudes.ts` | El tipo `Solicitud` suma los campos nuevos |
| `src/components/admin/solicitudes/BandejaSolicitudes.tsx` | Muestra origen, contacto y cita |
| `src/components/admin/Sidebar.tsx` | Item `Agenda` con contador de hoy |
| `.env.example`, `CLAUDE.md` | Envs nuevas y dónde vive esto |

## Flujo

```
LLAMADA                                  WHATSAPP
ElevenLabs cuelga                        Zak cierra la conversación
  ↓ POST /api/voz/webhook (HMAC)           ↓ POST /api/zak/solicitud (Bearer)
  registrar_llamada_voz → status 'ok'      valida token + body
  ¿sin_cliente y hay datos de solicitud?
                  ↓                                   ↓
        ┌──────── registrarSolicitudEntrante() ───────┐
        │ 1. INSERT solicitudes (estado 'nueva')      │  ← si clave_origen choca: 'duplicado', se corta
        │ 2. ¿cita parseable?                         │
        │      sí → freeBusy → evento + Meet → UPDATE │  ← si Google falla: se sigue, se marca en el aviso
        │      no → guarda cita_texto_crudo           │
        │ 3. avisarAdmin() a los DOS números          │  ← si el bot falla: se loguea, la fila ya está
        └─────────────────────────────────────────────┘
```

## Google Calendar — superficie usada

- **Token**: `POST https://oauth2.googleapis.com/token` con
  `grant_type=refresh_token`. El access token se cachea en memoria del proceso
  hasta 60 s antes de expirar (en Vercel cada lambda tiene el suyo; el costo es
  un POST extra por arranque en frío, no vale la pena más).
- **Evento**: `POST /calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`
  con `conferenceData.createRequest.conferenceSolutionKey.type = "hangoutsMeet"`
  y `requestId` aleatorio. De la respuesta se guardan `id`, `hangoutLink`
  (o `conferenceData.entryPoints[0].uri`) y `htmlLink`.
- **Choque**: `POST /calendar/v3/freeBusy` sobre `primary` en la ventana de la
  cita. Un error aquí no bloquea: se agenda sin la marca.
- **Scopes**: `calendar.events` + `calendar.freebusy` (si el segundo da
  problema al pedir consentimiento, `calendar.readonly` sirve igual).
- **Zona**: `America/Bogota`. Duración por defecto 30 min (`AGENDA_DURACION_MIN`).

## Envs nuevas (todas SOLO SERVIDOR, valores solo en .env.local / Vercel)

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_CALENDAR_REFRESH_TOKEN=
AGENDA_INVITADOS=tomasmunevar36@gmail.com,paulapjpg@gmail.com
AGENDA_DURACION_MIN=30
# cambia de formato: ahora acepta lista separada por comas
AVISOS_WHATSAPP_TO=573007970810,573007909522
```

Sin las tres de Google, todo lo demás funciona: la solicitud llega a la bandeja
y el WhatsApp sale diciendo que la cita quedó sin agendar.

## Fases (cada una desplegable sin romper nada)

1. **La bandeja recibe.** Migración SQL + `entrada.ts` + avisos a dos números +
   enganche del webhook de voz. Sin Google y **sin tocar a ningún agente**: se
   lee lo que Zak ya extrae. Ya se acabó el problema principal — las llamadas
   dejan solicitud y avisan a los dos números.
2. **Google Calendar + Meet.** `agenda/google.ts`, el script de OAuth, los dos
   campos de cita en `EXTRACCION_ZAK`, el botón de poner al día, y el runbook.
3. **WhatsApp.** `/api/zak/solicitud` + el contrato de la tool para el bot Flask.
4. **La agenda.** `/admin/agenda`, el item del sidebar con contador, y los
   campos nuevos visibles en la bandeja.

## Riesgos y gates

- **El consent screen en "Testing" caduca el refresh token a los 7 días.** Hay
  que publicarlo en **Producción**. Sin verificar sale el aviso de "app no
  verificada" que se acepta una vez; el token entonces no caduca. Es el pisón
  clásico de esta integración y la causa más probable de que la agenda "deje de
  funcionar sola" en una semana.
- **El agente puede alucinar la fecha.** Mitigado con parser estricto (ISO, en
  el futuro, dentro de los próximos 90 días) y degradación a texto crudo. Se
  le inyecta la fecha de hoy al prompt para que "mañana" tenga sentido.
- **Doble reserva con la agenda de Tether.** Consciente y aceptado: `freeBusy`
  avisa, no bloquea (decisión 7).
- **Zak no traerá los campos de cita hasta ponerlo al día.** `EXTRACCION_ZAK`
  solo se aplica al crear el agente y el de Zak ya existe. Lo resuelve el botón
  de la decisión 10, y va en el runbook. Mientras tanto la fase 1 funciona
  igual: la solicitud no depende de campos nuevos.
- **`AVISOS_WHATSAPP_TO` cambia de formato.** Un valor viejo (un solo número)
  sigue funcionando: el split por comas de un número da una lista de uno.
- **La tool del bot Flask vive en otro repo.** Fuera del alcance de esta rama;
  se entrega el contrato escrito. Hasta que se aplique, el canal de WhatsApp no
  produce solicitudes (el de voz sí, completo).

## Tests (vitest, solo lo puro — la red se inyecta)

- `src/lib/solicitudes/__tests__/fecha.test.ts` — ISO válido, con zona, en
  pasado, a dos años, basura, vacío.
- `src/lib/solicitudes/__tests__/entrada.test.ts` — arma la fila correcta por
  origen; sigue adelante cuando el calendario falla; se corta en duplicado;
  el texto del aviso incluye Meet cuando lo hay y la marca de choque.
- `src/lib/portal/__tests__/avisos.test.ts` — uno, dos y cero destinatarios; un
  envío que falla no impide el otro.
- `src/lib/voz/__tests__/webhook.test.ts` — fixture nuevo con `servicio_interes`
  + `cita_fecha_hora`; y uno de agente de cliente que verifica que NO cambió nada.
- `src/lib/voz/__tests__/zak.test.ts` — el test que ya recorre `EXTRACCION_ZAK`
  cubre las claves nuevas; se le añade que `ponerAlDiaCamposZak` preserva los
  campos escritos a mano.

## Runbook de encendido (Tomás, en orden — nada de esto vive en el repo)

1. Correr `supabase/solicitudes-entrada.sql` en el SQL editor de Supabase.
2. Google Cloud → el proyecto que ya tiene Places → **habilitar Google Calendar
   API**.
3. Pantalla de consentimiento OAuth: tipo **Externo**, y **publicarla en
   Producción** (no dejarla en Testing — ver riesgos).
4. Credenciales → ID de cliente OAuth tipo **Aplicación de escritorio**.
5. `node scripts/google-oauth.mjs` → abre el navegador, aceptas (incluido el
   aviso de app no verificada) → imprime el refresh token.
6. Pegar client id, secret y refresh token **directo en `.env.local` y en
   Vercel**. No pasan por el chat.
7. `AVISOS_WHATSAPP_TO=573007970810,573007909522` en Vercel.
8. Deploy.
9. `/admin/voz` → ficha de Zak → **Poner al día los campos** (añade
   `cita_fecha_hora` y `cita_confirmada` y re-sincroniza con ElevenLabs). Solo
   hace falta para agendar: las solicitudes ya llegaban desde la fase 1.
10. En el repo del bot Flask: aplicar `docs/bot-flask/tool-registrar-solicitud.md`.

## Verificación

- Llamada de **prueba** desde el lab: NO crea solicitud, NO agenda, NO avisa.
- Llamada **saliente** real donde la persona pide un bot y acepta reunirse el
  día siguiente: aparece en `/admin/solicitudes` con origen `voz`, contacto y
  detalle; llega el WhatsApp a los dos números con el link de Meet; el evento
  está en el calendario de Tomás con Paula invitada; aparece en `/admin/agenda`.
- Llamada donde dice "el jueves por la tarde": solicitud sí, evento no, y el
  WhatsApp pide ponerle hora.
- Reintento del mismo webhook: no duplica (la RPC devuelve `duplicado`).
- Con las envs de Google borradas: la solicitud y el aviso llegan igual.
- Llamada de un agente **de cliente**: se comporta como antes, sin solicitud.
- `POST /api/zak/solicitud` con token malo → 401; con body sin teléfono → 400.
