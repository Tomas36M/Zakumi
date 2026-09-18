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
| Panel interno | `src/app/admin/` | `admin-theme.css` (tokens `@theme`, vía `globals.css`) | Islas oscuras redondeadas, un acento naranja |
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

## Solicitudes entrantes y agenda (2026-09-01, rama `feat/solicitudes-agenda`)

Todo el que quiere contratarnos cae en `/admin/solicitudes`, venga de la
tienda, de una llamada o de un chat. Espec y runbook:
`docs/superpowers/specs/2026-09-01-solicitudes-agenda-design.md`.

- **Una sola bandeja**: `solicitudes` tiene `user_id` nullable + contacto
  propio (`supabase/solicitudes-entrada.sql`). La política de LECTURA del
  portal NO se tocó y no hay que tocarla: `user_id = auth.uid()` con NULL
  filtra la fila. Si alguien "arregla" esa política con un IS NULL, abre la
  bandeja entera. La de INSERT sí se reforzó en ese mismo SQL: el cliente solo
  puede crear filas con `origen = 'portal'` y todo lo de voz/WhatsApp en NULL
  (si se vuelve a correr `portal.sql` después, hay que re-correr este script).
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
- **Brochure de servicios y precios** (2026-09-13): `public/folletos/
  brochure-zakumi-servicios-precios.pdf` se sirve en
  `https://zakumistudio.com/folletos/brochure-zakumi-servicios-precios.pdf`. Lo manda
  Zak (tool `enviar_brochure` en `whatsapp-bot/agent.py`, solo instancia Zak) cuando
  preguntan por precios o servicios; la URL se deriva del host de `ZAK_VOZ_URL` (o
  `ZAK_BROCHURE_URL`). Para cambiar el PDF: reemplazar el archivo con nombre NUEVO y
  actualizar el sufijo en el bot (Cache-Control immutable en `/folletos/`).
- **Saludo genérico = `saludo_general`** (2026-09-13, id Meta 1468817021745554,
  imagen `public/folletos/generico-v2.jpg`). Reemplazó a `saludo_zakumi` porque
  Meta solo acepta 1 edición cada 24 h por plantilla aprobada — y cuenta las
  ediciones «sin cambios». La fila `generico` de `plantillas_zak` se movió con
  `supabase/plantillas-saludo-general.sql`; la vieja sigue aprobada en Meta
  pero nadie la manda. `PLANTILLA_SALUDO_TEXTO` (zak.ts) es el espejo del body.

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
- **Llamada en vivo desde el cockpit** (2026-09-17): «Llamar con IA» marca
  directo (sin confirmar) y abre `ModalLlamadaZak` — fase, transcripción que va
  cayendo y, al colgar, `DetalleLlamada` completo. El modal lo monta
  `BotonLlamarZak`, así que lo heredan bandeja, Interesados, ficha de lead y
  Territorios. **Cerrar NO cuelga** (no hay endpoint de colgar) y se dice en
  pantalla. El poll es un solo hook, `useLlamadaEnVivo` (4 s, tope ~6 min),
  compartido con el Lab; a quién se pregunta lo decide `consultar`
  (`estadoLlamadaVoz` con agente conocido, `estadoLlamadaZak` resolviendo
  `es_zak` en el servidor porque el id del agente no baja al cliente). La
  transcripción parcial sale del MISMO `GET conversations/{id}` y se parsea con
  `parseTurnos` (`src/lib/voz/transcript.ts`), el único parser de turnos — lo
  usa también el webhook post-call, para que lo que se pinta en vivo y lo que
  se guarda en `llamadas_voz.transcript` no puedan divergir.
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

## Contestadoras: el bot se calla y la llamada se encola (2026-09-18, rama `feat/cola-contestadoras`)

Medido sobre las tandas 4, 5 y 6 (15–17 sep, 150 negocios): **el 69 % abre el
mensaje**, pero de 22 conversaciones con respuesta **18 eran la contestadora
del negocio**; en las tandas 4 y 5 juntas, 16 respuestas = 15 máquinas + 1
humano. La fuga no estaba en la persuasión: el embudo medía máquinas.

- **El detector ya existía** (`whatsapp-bot/contestadora.py`, alimentado con
  los textos reales de la bandeja). Lo nuevo es que **decide**:
  `veredicto_respuesta` (puro) manda sobre el texto suelto y es **pegajoso
  hacia arriba** — quien ya escribió como persona NUNCA vuelve a ser máquina,
  porque callarse con un humano al otro lado es el fallo caro.
- **El bot no le contesta a una máquina.** `app._encolar_para` clasifica
  ANTES de encolar; si es máquina el job va con `tipo='contestadora'` y el
  worker (`worker._atender`, branch ANTES del de pausados) **archiva el
  mensaje y no llama a Claude**. El mensaje se guarda igual: la bandeja tiene
  que mostrar qué dijo. ⚠️ **Esto va en código, no en el prompt**: el playbook
  ya ordenaba «no lo contestes como si fuera una persona» y el 17 sep, con la
  instrucción viva, el modelo le contestó igual.
- **Una máquina no avanza el funnel**: no se llama `marcar_respondido`. Por eso
  los contadores de tandas anteriores al 18 sep están inflados.
- **La cola de llamadas**: `/admin/zak` → Voz → **«Por llamar»**
  (`ColaVoz.tsx` + `/admin/api/zak/cola-voz`, lógica pura en
  `src/lib/admin/cola-voz.ts`). Es **derivada**, no hay tabla nueva: mira las
  últimas 300 conversaciones del bot, cruza el CRM y marca quién ya recibió
  llamada. **No llama sola a nadie** — cada llamada la dispara Tomás desde su
  fila (y abre el modal que la narra en vivo). Marcar sesenta números de golpe
  es lo que quema una lista sin que nadie mire.
- **Escalar deja fila en el CRM**: `escalar_a_humano` pausaba el chat y mandaba
  el aviso por WhatsApp, y ahí moría — el 15 sep un chat ofreció pasarnos con
  quien decide, Zak prometió que Tomás escribía y nadie escribió. Ahora
  también crea la solicitud (`_solicitud_de_escalado` → `/api/zak/solicitud`,
  solo la instancia de Zak), idempotente por teléfono + día de Bogotá: si el
  modelo ya la registró en el turno, el sitio responde 'duplicada'.
- **Plantilla nueva `saludo_dueno`** (pendiente de crear/aprobar en Meta):
  copy y runbook en `marketing/plantillas/saludo-dueno.md`, creación con
  `whatsapp-bot/scripts/crear_plantilla_saludo.py`, y
  `supabase/plantillas-saludo-dueno.sql` DESPUÉS de APPROVED (hay que pegarle
  el id o revienta a propósito). Se crea, no se edita `saludo_general`: Meta
  solo acepta 1 edición cada 24 h y cuenta las «sin cambios».

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
- **Ajustes de Supabase que esta pantalla asume** (consola, no repo):
  - *Settings → API → Max rows* = **1000** (el default). PostgREST recorta ahí
    toda consulta, en silencio y sin error. Por eso el tope de la lista de leads
    es 900: para que el límite que manda sea el que está escrito en el código.
    Subir el 900 sin subir antes Max rows no hace nada.
  - *Automatically expose new tables* está **activado**, y Supabase recomienda
    lo contrario ("control access manually"). O sea: `territorios` —y cualquier
    tabla futura— nace publicada en la Data API. Hoy no es un hueco (la policy
    `territorios_solo_admin` de `prospeccion.sql` la protege de verdad; un
    `cliente` del portal no saca nada), pero **una tabla nueva SIN política
    nace expuesta**. Regla: toda tabla que se añada trae su `enable row level
    security` + policy en el mismo archivo .sql que la crea.
- Notas: `barrer/route.ts` lleva `maxDuration = 30` y su timeout hacia Google
  es de 8 s a propósito (que corte el nuestro antes que la plataforma: un 504
  se contaría como fallo gratis sobre una llamada ya facturada). El límite de
  filas de la lista de leads es explícito en
  `src/app/admin/(panel)/prospeccion/page.tsx` y se avisa en pantalla cuando
  hay más de las que se muestran.

## Panel rediseñado: header con navegación, Territorios, fichas en modal, agenda semanal (2026-09-13, rama `feat/panel-rediseno`)

Plan aprobado en `~/.claude/plans/hay-que-aprovechar-mas-reactive-toucan.md` (fases F0–F6, un commit por fase).

- **Una sola cabecera**: `ui/PageHeader` (`titulo`, `coletilla`, `subtitulo`, `contador`,
  `navegacion`, `acciones`). Las caras («Territorio | Leads», «Chat | Voz») van en el
  header con `ui/Caras`; sus definiciones son puras (`carasProspeccion`, `carasZak`).
- **Deep-links con `useParametroUrl`** (`history.replaceState`, NUNCA `router.replace`:
  re-renderizaría la page con todos sus fetches): `?tab`, `?lead`, `?territorio`,
  `?cliente`, `?solicitud`, `?cita`, `?semana`. El modal de una ficha lo monta el
  **shell de la página**, no las vistas (en Prospección la cara Territorio está siempre
  montada y dos modales se abrirían a la vez).
- **Sidebar**: la preferencia de colapso viaja en la cookie `zk-sidebar` y el layout la
  lee en el servidor (sin flash). La isla del logo es el botón de colapsar.
- **Territorios** es entrada del menú: `/admin/territorios` (grid, cuentas exactas por
  `count` en el servidor — no heredan el tope de 900 del mapa) y
  `/admin/territorios/[id]` (locales + acciones). El mapa ya no tiene lista: tocar un
  polígono abre su ficha (Barrer, Ver locales, Centrar, Renombrar, Eliminar); Dibujar,
  Buscar en Google y Añadir manual flotan SOBRE el mapa (`AccionesMapa`, en la misma
  columna que `FiltrosMapa` para que el panel abierto no los tape). La banda de encima
  del mapa (`BarraTerritorio`) solo aparece si falla la consulta de territorios. `useBarrido`/`DialogoBarrer`/
  `BarridoProgreso` NO cambiaron.
- **Ficha de lead** = `leads/FichaLeadModal` (datos, notas, Chat con Zak, Llamar con
  IA, convertir, eliminar), la misma desde el mapa, la lista Leads y un territorio.
  `estadoVozZak` (puro) habilita «Llamar con IA» en cualquier page con una consulta.
- **Mapa** (`mapa/`): `Marcadores` (clusters con `@googlemaps/markerclusterer`, zoom ≥16
  sueltos), `ControlesMapa` (zoom, recentrar, satélite, pantalla completa por CSS),
  `Leyenda` y `FiltrosMapa` (misma `filtrarLeads` que la lista). `pines.tsx` es la única
  fuente de las clases de los pines.
- **Agenda**: semana 6:00–22:00 hecha a mano (`agenda/semana.ts`, puro). Solo citas de
  Zakumi. `agenda/citas.ts` orquesta agendar/mover/cancelar: **Supabase primero, Google
  después, aviso de último**, y devuelve qué pasó con cada uno (`lineasDeResultado`).
  Google gana `actualizarEvento`/`borrarEvento` (tri-estado). `avisarLead` escribe AL
  LEAD por Zak con la plantilla **`aviso_reunion` — PENDIENTE de crear y aprobar en
  Meta** (hasta entonces cae al texto libre dentro de la ventana de 24 h).
- **Solicitudes** y **Clientes**: grid de tarjetas + ficha en modal. Nuevas actions:
  `actualizarSolicitud`/`eliminarSolicitud` (validación pura `validarCambiosSolicitud`),
  `actualizarCliente`; dar de baja producto usa `actualizarProducto({activo})`. La cita
  se agenda/mueve/cancela también desde la solicitud (mismas piezas que la agenda).
- Sin SQL ni envs nuevas. Fuera del repo: la plantilla `aviso_reunion` en Meta.

## Dónde vive cada cosa (reorganizado 2026-08-30)

- `marketing/` — TODO el material de marca/venta que antes estaba regado en la
  raíz: folletos (`marketing/folletos/`), video de 70s (`marketing/video-70s/`),
  prompts de imágenes. **Leer `marketing/README.md`** antes de buscar o crear
  material ahí; los binarios pesados están gitignored.
- `assets/masters/` — masters de imagen fuera de git (incluye
  `zakumi-icon-1024.png` y `zaku_tech_render.png`).
- `docs/empresa/` — documentos legales/administrativos (cámara de comercio…),
  gitignored por datos personales.
- `cursos/` — material del curso de IA; sus PDF son derivados regenerables.
- Regla: **no dejar archivos sueltos en la raíz del repo** — prompts y piezas de
  marketing van en `marketing/`, documentos en `docs/`.

## Varias sesiones de Claude comparten este checkout

- Los commits caen en **la rama que esté checked out** — antes de commitear,
  mira `git branch --show-current` y el `git log` reciente por commits ajenos.
- `git add -A` (incluso scoped a `src/`) puede barrer el working tree de OTRA
  sesión: agrega archivos explícitos, o trabaja en un **worktree**
  (`.claude/worktrees/`) como hace la rama del design system.
- Ramas (2026-09-12): todo lo mergeado se limpió, en local y en origin. Quedan
  `main`, `feat/agentes-voz` y las cuatro que viven en worktrees
  (`.claude/worktrees/`: `feat/admin-design-system`, `fix/avisos-plantilla-meta`,
  `feat/zak-unificado`, `feat/cuota-y-confirmacion`) — NO borrarlas aunque
  figuren mergeadas: otra sesión puede estar parada ahí. El tema de folletos
  —headers de imagen en plantillas Meta— quedó desbloqueado el 2026-08-24
  (plantillas con header aprobadas); el pendiente real es el display name del
  número (`name_status: NON_EXISTS`), que lo mantiene en TIER_250.

## Repo y despliegue

- **GitHub**: `https://github.com/Tomas36M/Zakumi` (rama `main`).
- **Vercel** como hosting esperado; variable **`NEXT_PUBLIC_SITE_URL`** para URL canónica en producción.

## Memoria multi-sesión (opcional usuario)

Fuera del repo, si aplica tu flujo global: archivos en `~/memory/` (ver `CLAUDE.md` en home del usuario).
