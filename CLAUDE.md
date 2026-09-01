@AGENTS.md

# Zakumi — contexto para sesiones Claude / Cursor

`AGENTS.md` contiene los avisos de Next.js.

## Qué es

- **ZAKUMI**: estudio boutique de **marca + software**, posicionamiento “Creamos marcas. Desarrollamos el futuro.”
- **Sede / mercado**: **Colombia** (copys y SEO orientados a `es-CO`; no México).
- Dominio público acordado: **`zakumistudio.com`** (`metadataBase` y JSON-LD usan `NEXT_PUBLIC_SITE_URL` o fallback ahí mismo).
- Contacto típico en la landing: `hola@zakumi.studio` (confirmar si pasa todo a `@zakumistudio.com`).

## Stack técnico

- **Next.js** (App Router) + **TypeScript** + **Tailwind v4**.
- Una sola página principal: **`src/app/page.tsx`** → **`src/components/zakumi/ZakumiLanding.tsx`** (componente cliente).
- Estilos canónicos del diseño histórico: **`src/styles/zakumi-design.css`** (no sustituir por “reinterpretaciones” si el cliente pide pixel-fiel al artefacto HTML).
- **GSAP** (ScrollTrigger, ScrollToPlugin): animaciones entrada, stats, filosofía por palabras, marquee, cursor, cortina inicial.
- **Fuentes**: `next/font` — Inter + Playfair Display (`layout.tsx`).

## Decisiones útiles para no romper cosas

- **`--hero-size`**: solo aplicar **≥721px**; en móvil se quita la variable JS para que el **clamp CSS** mande el tamaño del H1.
- Diseño artefacto “Zakumi Landing.html”: la API Anthropic suele responder 403; la fuente de verdad ha sido exports **standalone** cuando haga falta.
- **Menú móvil**: overlay + toggle; breakpoints alineados con el CSS (~720px).
- SEO: **`src/components/site/JsonLd.tsx`** (Organization + WebSite Colombia), metadata en **`layout.tsx`**.

## Las tres superficies del sitio

El repo sirve TRES apps que no deben contaminarse entre sí:

| Superficie | Rutas | CSS (prefijo) | Estética |
|---|---|---|---|
| Landing pública | `src/app/(site)/` | `zakumi-design.css` | Editorial, radius 0, GSAP |
| Panel interno | `src/app/admin/` | `admin.css` (`adm-`) | Editorial densa, radius 0 |
| Portal de clientes | `src/app/app/` | `portal.css` (`app-`) | Islas redondeadas tipo Scribe |

Regla dura: cada CSS es global una vez cargado — **todo selector va prefijado**
y jamás `nav`/`footer` desnudos ni `.cta` (los estila la landing).

## Portal de clientes /app — "Mi Zakumi" (2026-08-22, rama `feat/portal-clientes`)

Tienda de servicios + autogestión del cliente. Spec y **runbook de encendido**:
`docs/superpowers/specs/2026-08-22-portal-clientes-design.md` (leerlo antes de tocar el portal).

- **Flujo de venta v1**: solicitud (cliente) → cotización (`/admin/solicitudes`) →
  link de pago manual Wompi/Bold → "Confirmar pago y activar" (crea cliente +
  producto + primer pago). Máquina de estados en `src/lib/portal/solicitudes.ts`.
- **Auth**: rol en la tabla `perfiles` (admin|cliente), NUNCA en claims JWT.
  Sesión compartida en `src/lib/auth/sesion.ts`; el panel exige admin
  (`verifySession`/`getSesionAdmin`), el portal usa `src/lib/portal/dal.ts`
  (`verifySesionPortal` + `instanciaDelCliente`). Next 16: los layouts NO se
  re-renderizan → el check va en CADA page/action/handler.
- **⚠️ ORDEN DE ENCENDIDO INQUEBRANTABLE**: `supabase/perfiles.sql` (editar seed
  de admins ANTES) → `rls.sql` → deploy → solo entonces habilitar signup+Google
  en Supabase → `portal.sql`. Abrir el signup antes = cualquier registrado ve
  todo el CRM.
- **Bot del cliente**: nunca ve el `system_prompt`; edita 5 secciones guiadas
  serializadas dentro de `knowledge` (`src/lib/portal/conocimiento.ts` preserva
  en `resto` lo escrito a mano). `BOT_ADMIN_TOKEN` jamás baja del servidor:
  los handlers `/app/api/bot/[id]/*` validan propiedad antes de llamar
  `src/lib/bots/api.ts`.
- Catálogo compartido tienda/upsell: `src/lib/catalogo.ts` (upsell.ts lo re-exporta).
- Envs del portal: `AVISOS_BOT_INSTANCIA_ID` + `AVISOS_WHATSAPP_TO` (aviso de
  solicitud por WhatsApp; si faltan solo se pierde el aviso).

## Agentes de voz /admin/voz — ElevenLabs (2026-08-30, PR #3 sobre `main`)

Spec + **runbook de encendido en 8 pasos** (leerlo antes de tocar voz):
`docs/superpowers/specs/2026-08-22-agentes-voz-elevenlabs-design.md`.
La consola vive sobre el design system de islas (`src/components/admin/ui/`,
entrada "Voz" en `Sidebar.tsx`) — no queda ninguna clase `adm-*`.

- **Supabase es la fuente de verdad** (`agentes_voz`/`llamadas_voz`,
  `supabase/voz.sql` DESPUÉS de portal.sql); ElevenLabs el ejecutor. Cada
  guardado manda el payload COMPLETO (`src/lib/voz/eleven.ts`) — un PATCH
  parcial en ElevenLabs borra tools/overrides.
- **Workspace COMPARTIDO con Luci** (proyecto de Tether): jamás tocar
  `agent_7401…`, `phnum_6501…` ni el webhook de Luci; el panel solo opera los
  `agent_id_eleven` guardados en `agentes_voz`. Gate pendiente: verificar si el
  webhook post-call se asigna POR AGENTE (riesgo 1 del spec).
- **Endpoints públicos del repo — exactamente DOS** (fuera del matcher del
  proxy a propósito): `/api/voz/webhook` (HMAC `t=,v0=` sobre el raw body +
  filtro por `agent_id`) y `/api/zak/llamar` (Bearer `ZAK_VOZ_TOKEN` en tiempo
  constante). Son también los únicos sitios con `SUPABASE_SERVICE_ROLE_KEY`
  (la RPC `registrar_llamada_voz` y el despacho de Zak, respectivamente).
- Leads extraídos (`lead_nombre`/`lead_telefono`) → `ventas_cliente` origen
  'bot' dentro de la RPC + aviso WhatsApp. **Excepción: `direccion='prueba'`
  jamás promueve el lead** (el lab no vende; los datos quedan en
  `llamadas_voz.datos`).
- **Lab de llamadas** (pestaña "Lab" de la ficha, `LabVoz.tsx`): el widget real
  montado en el panel + llamada de prueba narrada en vivo (`estadoLlamadaVoz`
  hace polling: fila del webhook primero, `GET conversations/{id}` mientras).
  Para el mic del widget, `next.config.ts` abre `microphone=(self)` SOLO bajo
  `/admin/:path*` — el resto del sitio sigue bloqueado.
- El **cap diario cuenta solo `saliente`+`prueba`** (lo que nosotros marcamos):
  widget y entrantes ni gastan ni bloquean (`DIRECCIONES_CAP` en
  `src/lib/admin/voz.ts`).
- **Voces en español primero** (2026-08-30): el workspace nace con voces en
  inglés; el selector agrupa "En español" y la consola trae la biblioteca
  pública (`buscarVocesCompartidas`, language=es, chips de acento). Algunas
  voces responden `paid_plan_required` → error `plan_insuficiente`.
- **Zak tiene voz propia** (`agentes_voz.es_zak`, único): semilla completa en
  `src/lib/voz/zak.ts` (alta de un clic en la consola). La dispara el cockpit
  ("Llamar con IA" en bandeja/Interesados → `llamarConZak`) y el bot de
  WhatsApp vía **`/api/zak/llamar`** (segundo endpoint público; token
  `ZAK_VOZ_TOKEN` compartido con Railway — tool `llamar_por_voz` en
  `whatsapp-bot/agent.py`, solo instancia Zak). Pieza común:
  `src/lib/voz/despacho.ts` (cap, E.164, `negocio_id` en dynamic_variables,
  negocio `nuevo→contactado` forward-only).
- Envs: `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`,
  `ELEVENLABS_PHONE_NUMBER_ID` (interruptor del piloto),
  `SUPABASE_SERVICE_ROLE_KEY` (webhook + /api/zak/llamar), `ZAK_VOZ_TOKEN`.
- `catalogo.ts` sigue `disponible: false` en `agente-voz` hasta el paso 8 del runbook.

## Encontrar clientes /admin/prospeccion — territorios y barrido (2026-09-01, rama `feat/mapa-prospeccion`)

Spec + **runbook de encendido**: `docs/superpowers/specs/2026-08-31-mapa-prospeccion-design.md`.
Ledger de decisiones (37 rulings, leerlo antes de "arreglar" algo que parece raro):
`.superpowers/sdd/2026-08-31-mapa-prospeccion/progress.md`.

- **Una sola puerta**: `/admin/prospeccion` con dos caras (`?tab=territorio` |
  `?tab=leads`). `/admin/mapa` y `/admin/negocios` son **redirects**, no
  pantallas — no revalidar esas rutas ni enlazarlas.
- **SQL antes del deploy**: `supabase/prospeccion.sql` (base nueva) o
  `supabase/prospeccion-parches.sql` (base que ya corrió una versión anterior),
  y en ambos casos ANTES de subir el código: el archivo mata el enum
  `public.ciudad` y el código nuevo asume `ciudad` texto libre.
- **El modelo de plata**: una tesela × una vertical = **una** llamada a Nearby
  Search = **US$0,035** (Enterprise, US$35/1.000). El navegador emite esas
  llamadas de a 4 en paralelo contra
  `/admin/api/territorio/[id]/barrer` — la ÚNICA ruta del repo que gasta dinero
  por petición. Guardarraíles, en orden: estimación previa en el diálogo →
  `circuloDentroDelTerritorio` (bbox, en el servidor) → tope de 2× lo aprobado
  que pausa el barrido y vuelve a preguntar → `teselas_hechas` para no pagar
  dos veces lo mismo.
- **Regla de la pantalla**: los contadores de plata no mienten y un censo no
  declara completitud que no tiene. Cualquier cifra que pueda estar truncada,
  vieja o incompleta se dice con un banner, no se maquilla.
- **Si un barrido se va de las manos** (no hay botón de pánico en el panel, y
  esto es lo que hay):
  1. **Cerrar la pestaña** — el bucle vive en el navegador; sin pestaña no hay
     más llamadas. Lo ya barrido queda guardado y reanudar no lo vuelve a pagar.
  2. **Cuota diaria** en Google Cloud → APIs & Services → Quotas → Places API
     (New) → *Nearby Search requests per day*: es el único tope duro real.
  3. **Alerta de presupuesto** en Billing → Budgets & alerts sobre el proyecto
     de la key.
  4. Revisar el gasto real en los logs de Vercel: el handler emite una línea
     `{"evt":"tesela",…}` por llamada facturada (territorio, tesela, vertical).
- Notas: `barrer/route.ts` lleva `maxDuration = 30` y su timeout hacia Google
  es de 8 s a propósito (que corte el nuestro antes que la plataforma: un 504
  se contaría como fallo gratis sobre una llamada ya facturada). El límite de
  filas de la lista de leads es explícito en
  `src/app/admin/(panel)/prospeccion/page.tsx` y se avisa en pantalla cuando
  hay más de las que se muestran.

## Varias sesiones de Claude comparten este checkout

- Los commits caen en **la rama que esté checked out** — antes de commitear,
  mira `git branch --show-current` y el `git log` reciente por commits ajenos.
- `git add -A` (incluso scoped a `src/`) puede barrer el working tree de OTRA
  sesión: agrega archivos explícitos, o trabaja en un **worktree**
  (`.claude/worktrees/`) como hace la rama del design system.
- Ramas activas en paralelo (2026-08-30): `feat/folletos-prospeccion` (headers
  de imagen en plantillas Meta; bloqueada por re-aprobación de plantillas) y
  `feat/agentes-voz` (voz ElevenLabs, PR #3 **rebasada sobre main** el
  2026-08-30; consola sobre el kit `ui/` + entrada Voz en `Sidebar.tsx`).
  El portal y el design system del admin ya están mergeados en main.

## Repo y despliegue

- **GitHub**: `https://github.com/Tomas36M/Zakumi` (rama `main`).
- **Vercel** como hosting esperado; variable **`NEXT_PUBLIC_SITE_URL`** para URL canónica en producción.

## Memoria multi-sesión (opcional usuario)

Fuera del repo, si aplica tu flujo global: archivos en `~/memory/` (ver `CLAUDE.md` en home del usuario).
