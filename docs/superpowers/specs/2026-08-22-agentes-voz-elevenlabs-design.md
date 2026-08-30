# Agentes de voz ElevenLabs — canal "voz" del CRM y la tienda

Fecha: 2026-08-22 · Rama: `feat/agentes-voz` (sale de `feat/portal-clientes`)

## Contexto

Zakumi ya vende bots de WhatsApp personalizados. Este diseño enciende el canal
que el repo dejó cableado a propósito: `tipo_producto 'voz'` (`supabase/hub.sql`),
`canalDeProveedor("eleven") → "voz"` (`src/lib/bots/tipos.ts`), el servicio
`agente-voz` del catálogo (`disponible: false`) y el upsell "candidato natural a
voz". El producto: agentes telefónicos tipo call-center personalizados por
cliente — el cliente escoge la voz y el comportamiento, cada llamada queda
trazada (transcript, resumen, audio) y los datos de valor se extraen tipados;
los que son leads caen en "Mis ventas" del portal.

La arquitectura NO parte de cero: calca el lazo de voz probado en producción de
Luci (repo `Teather-Education/luci`, `docs/validacion-datos/`), adaptado al
molde de este repo. Mismo workspace de ElevenLabs, pero **agentes, webhook,
API key y número PROPIOS de Zakumi** — los recursos de Luci
(`agent_7401…`, `phnum_6501…`, su webhook y su `wsec_`) no se tocan ni se reusan.

## Decisiones

1. **Todo en Next + Supabase; Flask no se toca.** ElevenLabs aloja el loop
   conversacional completo (STT→LLM→TTS, telefonía); nuestra parte es CRUD de
   agentes, un webhook post-call y trazabilidad. El gancho `'eleven'` del
   servicio Flask queda sin usar: meter ElevenLabs por Railway agregaría un
   salto de red y otro deploy sin ganar nada.
2. **Consola propia en `/admin/voz`** (no dentro de `/admin/bots`): la consola
   de bots está respaldada por la API Flask y sus tipos (`Instancia`) modelan
   WhatsApp; mezclar dos backends en una vista compra complejidad. La rama
   `feat/admin-design-system` está rehaciendo el nav — aquí solo se agrega UNA
   línea a `SECCIONES` para minimizar el conflicto de merge.
3. **Supabase es la fuente de verdad de la config; ElevenLabs el ejecutor**
   (ADR-0004 de GroundTruth). Cada guardado reconstruye el payload COMPLETO del
   agente y hace PATCH — nunca merge parcial: un PATCH "limpio" en ElevenLabs
   borra los tools/overrides que no viajen.
4. **Webhook post-call = primer endpoint público del repo**:
   `src/app/api/voz/webhook/route.ts` (Vercel, runtime nodejs). Verifica HMAC
   (`t=,v0=` sobre el raw body, tolerancia 30 min + 5 min de futuro,
   comparación timing-safe) y SIEMPRE filtra por `data.agent_id` contra
   `agentes_voz` — eventos de agentes de Luci (mismo workspace) responden
   200 `sin_agente` y no ensucian nada. Contrato de respuestas (igual que
   Luci): 200 = procesado/duplicado/sin_agente/tipo desconocido; 401 = firma
   inválida; 503 = falta el secret; 500 = error de DB (ElevenLabs reintenta si
   los retries están habilitados en el dashboard).
5. **Primera vez que entra la service-role key** (`SUPABASE_SERVICE_ROLE_KEY`):
   el webhook no tiene sesión de usuario. Se usa SOLO en
   `src/lib/voz/supabase-service.ts` (server-only, sin sesión persistida) y lo
   único que puede hacer es invocar la RPC `registrar_llamada_voz`
   (`SECURITY DEFINER`, `grant execute` solo a `service_role`, idempotente por
   `conversation_id`). El resto de la app sigue en anon + RLS.
6. **Leads → `ventas_cliente` dentro de la RPC** (misma transacción que la
   llamada): si la extracción trae `lead_nombre` o `lead_telefono` y el agente
   tiene cliente con perfil de portal, se inserta la venta con `origen='bot'`.
   Sin perfil o sin cliente (agente demo), el lead queda igualmente en
   `llamadas_voz.datos` — no se pierde nada.
7. **Salientes v1 sin cron**: tanda manual desde la ficha (`batch-calling/submit`)
   y llamada de prueba (`twilio/outbound-call`), con **cap diario por agente**
   contado en día calendario de Bogotá (patrón `daily_call_cap` de Luci,
   default 5). El cron llega después sobre las mismas piezas.
8. **Config guiada, no prompt libre**: 5 secciones (personalidad, negocio,
   guion de llamada, horarios, qué no decir) → `construirPrompt()` les antepone
   reglas duras fijas: presentarse como IA al inicio (obligación legal ya
   citada en el pitch del catálogo), no inventar precios, cerrar con `end_call`.
   Espejo del patrón `conocimiento.ts` del bot de WhatsApp; en fase 2 el portal
   edita estas mismas secciones.
9. **LLM pin `gpt-4.1-mini` + TTS `eleven_flash_v2_5`** (obligatorio para
   español), `speed 1.1`: los tres verificados en producción por Luci (Gemini
   con razonamiento leyó su chain-of-thought en inglés al teléfono).
10. **Widget**: snippet embebible (`<elevenlabs-convai agent-id=…>`) que se copia
    de la ficha para pegar en la web del cliente. La demo en la landing de
    Zakumi queda para después (exige relajar `Permissions-Policy: microphone`
    en `next.config.ts` y tocar la superficie de la landing).

## Modelo de datos — `supabase/voz.sql` (correr DESPUÉS de portal.sql)

```
agentes_voz
  id uuid PK · cliente_id uuid NULL→clientes · nombre · agent_id_eleven text UNIQUE (null = sin sincronizar)
  phone_number_id_eleven text NULL (número propio del cliente; null = usa el compartido de env)
  voice_id text · primer_mensaje text · secciones jsonb · extraccion jsonb (array {clave,tipo,descripcion})
  cap_diario int default 5 · activo bool · created_at/updated_at (+trigger)

llamadas_voz
  id uuid PK · agente_id →agentes_voz · conversation_id text UNIQUE (idempotencia)
  direccion check saliente|entrante|widget|prueba · telefono · estado (done|failed|fallo_inicio)
  resultado (success|failure|unknown) · duracion_seg · costo_creditos · resumen
  transcript jsonb · datos jsonb · criterios jsonb · dynamic_variables jsonb
  batch_id · tiene_audio bool · iniciada_en timestamptz · created_at
```

RLS desde el día 1 (fase 2 del portal gratis): `*_admin_todo` + cliente
`SELECT` de lo suyo (`cliente_id = mi_cliente_id()`, llamadas vía `EXISTS`);
`revoke all from anon`. RPC `registrar_llamada_voz(...)` — ver decisión 5/6.

## Superficie ElevenLabs usada (verificada contra Luci)

| Método/Path | Para qué |
|---|---|
| `POST /v1/convai/agents/create` · `PATCH /v1/convai/agents/{id}` | crear/sincronizar agente (payload completo) |
| `GET /v2/voices?page_size=100` | selector de voz con `preview_url` |
| `POST /v1/convai/batch-calling/submit` | tanda saliente (recipients con `dynamic_variables`) |
| `POST /v1/convai/twilio/outbound-call` | llamada de prueba inmediata |
| `GET /v1/convai/conversations/{id}/audio` | audio vía proxy admin (la key jamás baja al browser) |

Correlación: `dynamic_variables` viajan en cada llamada y vuelven intactas en
el post-call; `conversation_id` es la idempotencia. Dirección inferida:
`tipo:'prueba'` → prueba · `metadata.batch_call`/`origen:'zakumi_salida'` →
saliente · `system__caller_id` → entrante · si no → widget.

## Archivos

**Nuevos**
- `supabase/voz.sql` — tablas, RLS, RPC (idempotente; SQL lo corre Tomás a mano).
- `src/lib/voz/tipos.ts` — tipos + constantes (pins de LLM/TTS, direcciones, labels).
- `src/lib/voz/guias.ts` — secciones guiadas + `construirPrompt()` (testeado).
- `src/lib/voz/eleven.ts` — builders PUROS de payloads (agente/batch/llamada) (testeados).
- `src/lib/voz/hmac.ts` — firma/verificación `t=,v0=` (testeado).
- `src/lib/voz/webhook.ts` — parseo del evento post-call sin zod (testeado).
- `src/lib/voz/api.ts` — cliente HTTP server-only (contrato `Resultado<T>`, jamás lanza).
- `src/lib/voz/supabase-service.ts` — cliente service-role SOLO para la RPC del webhook.
- `src/lib/admin/voz.ts` — queries del panel (agentes, llamadas, conteo de hoy Bogotá).
- `src/lib/admin/voz-actions.ts` — server actions (crear, guardar config, sincronizar, prueba, tanda, activar/apagar).
- `src/app/api/voz/webhook/route.ts` — webhook público post-call.
- `src/app/admin/api/voz/[id]/audio/[conversacion]/route.ts` — proxy de audio (solo admin, no-store).
- `src/app/admin/(panel)/voz/page.tsx` + `voz/[id]/page.tsx` — consola.
- `src/components/admin/voz/{VozView,FichaAgenteVoz,LlamadasVoz}.tsx`.

**Modificados**
- `src/components/admin/AdminNav.tsx` — +1 línea en `SECCIONES` (`/admin/voz`).
- `src/styles/admin.css` — bloque `adm-voz-*` mínimo (reusa card/tabs/tabla/badge existentes).
- `.env.example` — sección nueva (abajo).
- `CLAUDE.md` — rama activa + puntero a este spec.

## Envs nuevas (todas SOLO SERVIDOR, valores solo en .env.local / Vercel)

- `ELEVENLABS_API_KEY` — key PROPIA de Zakumi (scope ElevenAgents), no la de Luci.
- `ELEVENLABS_WEBHOOK_SECRET` — el `wsec_` del webhook NUEVO de Zakumi (lo genera ElevenLabs).
- `ELEVENLABS_PHONE_NUMBER_ID` — número compartido para salientes. **Interruptor del
  piloto**: sin él, la consola configura agentes y el widget funciona, pero no se llama.
- `SUPABASE_SERVICE_ROLE_KEY` — solo la usa el webhook (decisión 5).

Degradación: sin API key la consola muestra "sin configurar" (como Railway
caído en bots); sin las de aviso, solo se pierde el aviso de lead por WhatsApp.

## Riesgos y gates

1. **⚠️ Scoping del webhook post-call (gate del runbook, paso 4).** En la
   evidencia de Luci el webhook es un setting del WORKSPACE
   (`GET /v1/convai/settings → webhooks.post_call_webhook_id`); los docs
   actuales insinúan override por agente pero no fue verificable. Si el
   override por agente existe: webhook nuevo de Zakumi asignado a sus agentes y
   listo. Si NO existe: los eventos de Zakumi caerían en el webhook de Luci
   (que responde 200 unmatched, sin reintento) — NO cambiar el webhook global
   (rompería Luci); las salidas son (a) workspace/subcuenta aparte para Zakumi
   o (b) que el receptor de Luci reenvíe por `agent_id` (tocar Luci). El código
   de Zakumi funciona igual en ambos escenarios (filtra por `agent_id`).
2. **Una key del workspace puede pisar agentes del otro proyecto** — el panel
   solo opera sobre `agent_id_eleven` guardados en `agentes_voz`; jamás
   listar-y-editar agentes del workspace.
3. **Cap diario cuenta llamadas ya aterrizadas** (filas de `llamadas_voz` de
   hoy) + el tamaño de la tanda a lanzar; una tanda en vuelo de hoy ya cuenta
   porque sus llamadas van cayendo. Suficiente para despacho manual v1; el
   cron necesitará cola propia (patrón `validation_queue` de Luci).
4. **Twilio gobierna los destinos**: geo permissions de Colombia habilitadas o
   toda llamada falla; el trial solo llama a números verificados.
5. **`productos_contratados.instancia_id` es `/^\d+$/` en el DAL del portal**:
   los productos 'voz' se vinculan por `agentes_voz.cliente_id`, NO por
   `instancia_id`. Fase 2 del portal lee por esa vía.

## Runbook de encendido (Tomás, en orden — nada de esto vive en el repo)

1. **Rotar lo pegado en el chat (2026-08-22)**: el `VALIDATION_DISPATCH_SECRET`
   y el `wsec_` de Luci quedaron en un transcript en texto plano — rotarlos en
   Luci aunque Zakumi no los use.
2. En ElevenLabs: crear **API key propia de Zakumi** (scope ElevenAgents) →
   `ELEVENLABS_API_KEY` en `.env.local` y en Vercel (Production).
3. Correr `supabase/voz.sql` en el SQL Editor (después de `portal.sql`).
   `SUPABASE_SERVICE_ROLE_KEY` a `.env.local` + Vercel.
4. **GATE — webhook**: en el dashboard (Agents → Settings → Webhooks) crear el
   webhook de Zakumi → `https://zakumistudio.com/api/voz/webhook`, evento
   `post_call_transcription`, auth HMAC → copiar el `wsec_` NUEVO a
   `ELEVENLABS_WEBHOOK_SECRET`. Verificar si puede asignarse POR AGENTE
   (override); si solo hay uno global del workspace → decisión del riesgo 1
   ANTES de crear agentes.
5. Deploy (merge de esta rama tras revisar la PR). Probar el webhook con un
   fixture firmado (script de Luci `sign-and-post-webhook.mjs` apuntando a
   `/api/voz/webhook` con el secret nuevo): debe responder 200 `sin_agente`.
6. Crear el primer agente (demo, sin cliente) en `/admin/voz`, sincronizar,
   y probar el **widget** en una página estática cualquiera.
7. Telefonía: en Twilio habilitar geo permissions CO, comprar número US
   (~US$1.15/mes) → importarlo en ElevenLabs (`POST /v1/convai/phone-numbers`)
   → `ELEVENLABS_PHONE_NUMBER_ID`. **Primera llamada de prueba al celular
   propio SIEMPRE antes de la primera tanda.**
8. Cuando la demo convenza: `disponible: true` en `src/lib/catalogo.ts`
   (enciende tienda + upsell) y quitar el "Próximamente".

## Verificación

- `npm test`: hmac (firmas válidas/expiradas/malformadas, timing-safe), guias
  (prompt con reglas duras siempre presentes), eleven (payload completo:
  end_call, data_collection, overrides), webhook (parseo + inferencia de
  dirección + eventos ajenos/ignorados), cap Bogotá.
- `npm run build` limpio.
- E2E manual (runbook 5-7): fixture firmado → 200; llamada de prueba real →
  fila en `llamadas_voz` con transcript/resumen/datos + audio reproducible en
  la ficha; extracción con `lead_nombre` → fila en `ventas_cliente` visible en
  el portal del cliente + aviso de WhatsApp a Tomás.
