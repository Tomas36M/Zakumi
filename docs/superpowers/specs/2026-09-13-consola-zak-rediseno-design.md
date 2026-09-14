# Consola de Zak — estados automáticos, chat sin fricción y limpieza de navegación

Fecha: 2026-09-13 · Rama: por crear desde `main`

## Contexto

La consola de Zak (`/admin/zak`) mezcla hoy trabajo manual que ya podría hacer
sola la máquina de estados, pestañas que perdieron su función, y un chat cuyo
header le roba espacio a los mensajes. Concretamente:

- Cada vez que Tomás contacta un negocio por WhatsApp desde la Bandeja, tiene
  que acordarse de ir a `/admin/prospeccion` y marcarlo `contactado` a mano.
- Para ver la ficha completa de un negocio mientras chatea, hoy toca salir del
  chat, ir a Prospección y buscarlo — se pierde el hilo de la conversación.
- La pestaña **Interesados** y la pestaña **Tandas** ya no aportan (la primera
  se solapa con el CRM de Solicitudes; la segunda es un visor sin acción).
- **Plantillas** es una lista vertical que podría ser un grid.
- **Métricas** vive enterrada como una pestaña más de Zak, cuando en realidad
  es el panel de analítica de toda la prospección + el bot.
- Varios headers de página muestran datos sueltos en vez de decir claramente
  en qué parte del panel está uno parado.
- `territorios` se trae completo en cada carga de Prospección, sin límite.

Este diseño ataca las siete cosas a la vez porque casi todas viven en el mismo
módulo (`/admin/zak` y su entorno inmediato) y la única pieza con lógica de
negocio nueva de verdad —automatizar estados— queda acotada y con su propio
modelo de datos.

## Estado actual relevante (explorado)

- La máquina de estados es un enum de Postgres (`estado_negocio`:
  `nuevo, contactado, respondido, interesado, cliente, descartado`,
  `supabase/schema.sql:16-19,31-50`) — Postgres compara enums por **orden de
  declaración**, así que `estado < 'contactado'` ya funciona sin tabla de
  orden aparte. Un trigger (`nota_cambio_estado`, `schema.sql:90-112`) deja
  sola una nota cada vez que `estado` cambia — no hay que tocarlo.
- **`respondido` e `interesado` YA se automatizan.** `sincronizarEstadosZak()`
  (`src/lib/admin/zak-actions.ts:198-239`) trae la prospección del bot
  (`listarProspectos`) y avanza el CRM vía `avancesDeEstado()`
  (`src/lib/admin/zak.ts:396-420`, pura y ya forward-only: nunca toca
  `cliente`/`descartado`, nunca retrocede). Corre sola una vez por visita a
  `/admin/zak` (`ZakView.tsx:144-149`) y también a mano con el botón
  "Sincronizar con el CRM" que vive **en la pestaña Interesados** que se
  elimina — hay que preservar esa capacidad de otra forma (ver Decisión 4).
- **`contactado` es el hueco real.** `enviarTandaZak` (tandas desde
  Prospección, `zak-actions.ts:30-137`) sí marca `contactado` al enviar
  (líneas 116-128, `.eq("estado","nuevo")` ad-hoc). `despacharLlamadaZak`
  (voz, `src/lib/voz/despacho.ts:107-114`) también, con el mismo patrón
  ad-hoc. Pero **`abrirChatZak`** (`zak-actions.ts:146-191`) — el que de
  verdad usan "+ Nuevo chat" y "Reabrir con plantilla" en la Bandeja — **no
  toca `negocios` para nada**. Ahí está exactamente el "me toca manual" del
  pedido.
- Tres implementaciones del mismo update ad-hoc (`despacho.ts`,
  `enviarTandaZak`), ninguna sabe de un futuro candado manual — se
  consolidan en un solo helper (Decisión 1).
- **Corrección sobre una exploración anterior de este mismo documento:** no
  existe `src/components/admin/mapa/FichaNegocio.tsx`. La ficha completa de
  un negocio es `src/components/admin/leads/FichaLeadModal.tsx` (props
  `{ leadId, negocio, vozZak, onCerrar, onCambio, onEliminado }`, sin nada
  de mapa/territorio en sus imports), un modal compartido (Radix Dialog vía
  `Modal.tsx`) controlado por `?lead=<id>` en la URL
  (`useFichaLead()`/`useParametroUrl`). El cambio manual de estado pasa por
  `actualizarNegocio(id, cambios)` (`src/lib/admin/actions.ts:174-185`) y
  `cambiarEstadoLote` (`actions.ts:231-256`) — los dos únicos lugares donde
  hoy se edita `estado` a mano, ambos invocados desde dentro de este modal
  o de la lista que lo abre.
- `Conversaciones.tsx:522-556` ya es un solo `<div className="flex flex-wrap
  ...">`, pero con nombre+teléfono+2 badges a la izquierda y 3 botones a la
  derecha, a los anchos típicos hace wrap a dos líneas (lo que se ve en la
  captura). `fichaActual` (con `negocioId`) ya está resuelto ahí mismo.
- `leads capturados` y `jobs fallidos` (Métricas de Zak) **no viven en
  Supabase**: salen de un servicio Flask externo en Railway
  (`BOT_ADMIN_URL`/`BOT_ADMIN_TOKEN`, `src/lib/bots/api.ts`). El tipo `Lead`
  es `{ phone, datos: Record<string, unknown> }` sin `negocio_id`.
- `solicitudes` y `negocios` **no tienen ningún vínculo hoy** — ni FK ni
  cruce confiable por teléfono (formatos distintos:
  `solicitudes.contacto_telefono` texto libre vs. `negocios.telefono` E.164
  con check). `registrarSolicitudEntrante` (`src/lib/solicitudes/entrada.ts:97`)
  arma la fila en las líneas 136-153 sin ninguna referencia a negocios.
- `PageHeader` (`src/components/admin/ui/PageHeader.tsx`) hoy es
  `{ titulo, acciones }` y solo lo usa `AgendaView.tsx:28`, sin acciones —
  patrón subutilizado, base perfecta para generalizar.
- `Sidebar.tsx:28-38` tiene 8 secciones planas; ninguna se llama Métricas.
- `prospeccion/page.tsx` pagina `negocios` con `TOPE_LEADS=900` + `count:
  "exact"` (patrón ya probado), pero `territorios` se trae con
  `.select("*").order(...)` **sin límite**.

## Decisiones

1. **Un solo helper para avanzar estado, en vez de tres updates ad-hoc.**
   `avanzarEstadoNegocio(supabase, negocioId, nuevoEstado)` hace un único
   `update` atómico:
   ```ts
   supabase.from("negocios")
     .update({ estado: nuevoEstado })
     .eq("id", negocioId)
     .eq("estado_fijado_manual", false)
     .lt("estado", nuevoEstado);
   ```
   El `.lt("estado", nuevoEstado)` ya es forward-only gratis (orden del enum
   de Postgres); `descartado` nunca es destino de este helper, así que su
   posición al final del enum no importa. `despacho.ts`, `enviarTandaZak` y
   el nuevo hook de `abrirChatZak`/`enviarManual` (Decisión 3) llaman a este
   único helper — un solo lugar donde vive el candado.
   Alternativa descartada: una función de Postgres (`rpc`). Innecesaria: un
   solo `UPDATE ... WHERE` ya es atómico a nivel de fila; una función SQL solo
   agrega una capa de despliegue sin ganar nada.

2. **Candado manual: `negocios.estado_fijado_manual`.** Las DOS puertas de
   edición manual de estado en `src/lib/admin/actions.ts` setean
   `estado_fijado_manual: true` en el mismo `update`: `actualizarNegocio`
   (cuando `cambios.estado` viene en el payload, desde `FichaLeadModal`) y
   `cambiarEstadoLote` (cambio de estado en lote sobre una selección, desde
   la lista de leads de Prospección) — se encontró este segundo call site
   al escribir el plan; sin él, un cambio manual en lote quedaría sin
   candado y la sincronización automática podría pisarlo después. Ni
   `avanzarEstadoNegocio` ni `avancesDeEstado`/`sincronizarEstadosZak` tocan
   un negocio con el candado puesto, para siempre (no hay "desfijar": no se
   pidió y es trivial agregarlo después si hace falta). Con esto, un
   `descartado` puesto a mano queda a salvo de que una respuesta tardía del
   negocio lo reviva.

3. **`contactado` se dispara en el primer mensaje saliente.** `abrirChatZak`
   gana un parámetro `negocioId?: string` (ya resuelto en el cliente vía
   `fichaActual?.negocioId`) y llama
   `avanzarEstadoNegocio(supabase, negocioId, "contactado")` tras el envío
   exitoso. `enviarManual` (`src/lib/admin/bots-actions.ts`) recibe el mismo
   parámetro por si un negocio en `nuevo` se contacta con texto libre en vez
   de plantilla (chat ya abierto por otra vía). `enviarTandaZak` y
   `despacho.ts` migran su update ad-hoc al helper de la Decisión 1.

4. **`respondido`/`interesado` se quedan en `sincronizarEstadosZak`, pero
   corren más seguido.** En vez de una sola vez por visita, se llama en cada
   tick del polling de la lista de conversaciones que YA existe
   (`usePollingVivo(refrescarLista, { intervaloMs: 12_000, ... })` en
   `Conversaciones.tsx:392-395`) — sin agregar infraestructura, el CRM queda
   al día en segundos en vez de esperar a que alguien reabra la consola. Se
   ajustan `avancesDeEstado`/`sincronizarEstadosZak` para leer y respetar
   `estado_fijado_manual` (se agrega a su `select` de `negocios`).
   Al quitarse el botón manual "Sincronizar con el CRM" (vivía en Interesados,
   que se elimina), no hace falta reemplazarlo: el polling ya cubre ese caso
   de uso y de sobra.

5. **`cliente` se automatiza vinculando `solicitudes` a `negocios`.** Se
   agrega `solicitudes.negocio_id uuid references negocios(id)`. El bot de
   WhatsApp (que ya sabe con qué negocio conversa) lo manda en el payload de
   `/api/zak/solicitud`; `registrarSolicitudEntrante` lo guarda en el insert.
   Cuando una solicitud pasa a `activa` (pago confirmado, `activarSolicitud`
   en `src/lib/admin/solicitudes-actions.ts:156-248`), esa misma acción llama
   `avanzarEstadoNegocio(supabase, solicitud.negocio_id, "cliente")` si el
   campo no es nulo. Sin `negocio_id` (solicitudes que no vinieron de un chat
   de Zak con negocio conocido, ej. llamadas de voz sin match), `cliente`
   sigue siendo manual — no se inventa un cruce por teléfono, que ya se
   descartó por poco confiable.

6. **`descartado` se queda 100% manual.** Inferir rechazo de texto libre es
   arriesgado (falso positivo = prospecto perdido); no hay señal existente
   para reusar como con respondido/interesado.

7. **La ficha del negocio se ve desde el chat sin navegar, reusando el modal
   que ya existe — no se construye un drawer nuevo.** Corrección sobre lo
   escrito originalmente aquí: no hay ningún `FichaNegocio.tsx` de panel
   lateral. La ficha completa ya está unificada en
   `src/components/admin/leads/FichaLeadModal.tsx` — "la misma desde el
   mapa, la lista de Leads y la página de un territorio" (comentario propio
   del archivo) — controlada por el parámetro de URL `?lead=<id>` vía
   `useFichaLead()`/`useParametroUrl` (`replaceState`, sin ida al servidor).
   Cada página que la usa monta su PROPIA instancia de `<FichaLeadModal>` +
   `useFichaLead()` (el hook documenta por qué: "el dueño es el shell de
   cada página, nunca una vista"). `Conversaciones.tsx` monta una tercera
   instancia igual, con dos diferencias respecto a Territorio/Prospección:
   - Esas dos páginas resuelven `negocio: Negocio | null` con
     `.find(n => n.id === leadId)` sobre una lista ya cargada en memoria;
     Zak no tiene esa lista, así que resuelve el negocio con un fetch
     individual nuevo (`GET /admin/api/negocios/[id]`, no existe hoy).
   - Mientras ese fetch está en vuelo, `negocio` es `null` — pero
     `FichaLeadModal` hoy interpreta cualquier `negocio: null` con el modal
     abierto como "no está en la lista cargada" (un banner de error).
     Gana un prop `cargando?: boolean` (default `false`, no rompe a los
     otros dos consumidores) que, en `true`, pinta un esqueleto de carga en
     vez de ese banner.
   El botón "Ver ficha" del header del chat llama `abrirLead(negocioId)`
   (el `abrir` que devuelve `useFichaLead()`), igual que ya hace
   `FilaLeadCompacta` en las otras pantallas — no aparece si `fichaActual`
   no tiene `negocioId`.
   Alternativa descartada: un drawer/panel deslizante nuevo. Duplicaría el
   formulario editable, las notas y las acciones que `FichaLeadModal` ya
   tiene, por una preferencia estética (mantener la lista de chats visible)
   que no pesa tanto como partir en dos la única ficha de negocio del panel.

8. **Header del chat: una sola fila.** Nombre + teléfono + badges (vertical,
   estado) a la izquierda; a la derecha, el nuevo botón "Ver ficha" y los 3
   existentes (Llamar con IA, Pausar/Reanudar, Borrar) pasan a iconos
   compactos con tooltip en vez de botones con texto, para que quepan sin
   wrap a los anchos donde hoy se parte en dos líneas.

9. **Interesados y Tandas se eliminan sin reemplazo**, tal como se pidió.
   Importante: **Tandas (la pestaña, un visor)** no es lo mismo que
   `enviarTandaZak` (la acción de mandar una tanda desde Prospección) — esa
   acción sigue intacta, solo pierde su pantalla de seguimiento en Zak. El
   dato de "tasa de respuesta" para Métricas se sigue calculando server-side
   a partir de `tandas`, aunque ya no haya tab que las liste una por una.

10. **Plantillas pasa de lista a grid.** Mismo contenido de cada `Island`
    (vigente/borrador, badges de estado Meta, edición), solo cambia el
    contenedor: grid responsive (1 col mobile, 2-3 desktop). El bloque de
    edición expandible, cuando está abierto, ocupa el ancho completo de la
    fila del grid (`col-span-full`) para no quedar aplastado en una sola
    columna.

11. **Métricas sale de las pestañas de Zak y se promueve a `/admin/metricas`
    en el Sidebar.** Deja de estar acoplada a "una pestaña más del bot" y
    pasa a ser el panel de analítica de toda la prospección. Contenido:
    - Lo que ya muestra hoy (tasa de respuesta, llamadas a Claude, tokens,
      conversaciones, chats pausados, jobs fallidos con retry).
    - Nuevo: **embudo de negocios por estado** (conteo de
      `nuevo/contactado/respondido/interesado/cliente/descartado`, 6 queries
      `count: "exact", head: true` filtradas por estado) — reemplaza el valor
      de "interesados en total" y de paso vuelve visible el efecto de la
      automatización.
    - Leads capturados, con **editar / borrar / vincular a negocio** (Decisión
      12).
    `ZakView.tsx` pierde las pestañas Interesados/Métricas/Tandas de
    `PESTANAS_CHAT` (`src/lib/admin/zak-caras.ts`), quedando
    Bandeja/Plantillas/Prompt/Labs.

12. **CRUD de leads como overlay local, sin tocar el Flask.** Tabla nueva
    `leads_overrides` (clave `instancia_id + telefono`): `datos_editados
    jsonb`, `negocio_id uuid references negocios`, `borrado boolean`. La
    vista de Métricas hace el merge en memoria: lo que devuelve el Flask +
    el override (oculta lo borrado, pisa los campos editados, resuelve el
    negocio vinculado). Editar/borrar/vincular escriben solo esta tabla.
    Alternativa descartada: endpoints de escritura en el Flask — correcto a
    largo plazo, pero cruza a otro repo/servicio y ese bot ya está
    documentado como pendiente fuera de este alcance.

13. **Patrón de header con breadcrumb, solo en las vistas de nivel superior
    del Sidebar.** `PageHeader` gana `migas: string[]` (ej. `["Zak",
    "Bandeja"]`, `["Encontrar clientes", "Territorio"]`) y se aplica a las 8
    vistas existentes del Sidebar más la nueva Métricas — el último segmento
    es la pestaña activa cuando la vista tiene pestañas internas. No toca el
    header del chat (Decisión 8): ese vive un nivel más adentro, no es una
    vista de nivel superior.

14. **Territorios se pagina igual que negocios.** `prospeccion/page.tsx`
    reemplaza `.select("*")` sin límite por `.range()` + `count: "exact"`, 25
    por página, con `?pagina=N` en la URL (mismo patrón que `?tab=`) y un
    paginador simple debajo de la lista.

## Modelo de datos

**`supabase/zak-automatizacion.sql`** (idempotente, corre después de
`prospeccion.sql` y de `solicitudes-entrada.sql`):

```sql
alter table public.negocios
  add column if not exists estado_fijado_manual boolean not null default false;

comment on column public.negocios.estado_fijado_manual is
  'true en cuanto un humano cambia el estado a mano (FichaLeadModal). '
  'Desde ahí la automatización deja el negocio en paz para siempre.';

alter table public.solicitudes
  add column if not exists negocio_id uuid references public.negocios(id) on delete set null;

create index if not exists solicitudes_negocio_id_idx
  on public.solicitudes (negocio_id) where negocio_id is not null;
```

**`supabase/leads-overrides.sql`** (idempotente):

```sql
create table if not exists public.leads_overrides (
  instancia_id   integer not null,
  telefono       text not null,
  datos_editados jsonb,
  negocio_id     uuid references public.negocios(id) on delete set null,
  borrado        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (instancia_id, telefono)
);

alter table public.leads_overrides enable row level security;

-- Mismo helper que ya usa el resto del admin-only (perfiles.sql:97-106):
-- STABLE + security definer, se llama como (select es_admin()) para que
-- Postgres lo evalúe una sola vez por statement (initplan).
create policy leads_overrides_solo_admin on public.leads_overrides
  for all using ((select public.es_admin()))
  with check ((select public.es_admin()));
```

## Flujo de la automatización de estados

```
CONTACTADO (evento puntual)         RESPONDIDO/INTERESADO (reconciliación)   CLIENTE (evento puntual)

+Nuevo chat / Reabrir / manual      cada tick del polling de la lista (12s)  solicitud → 'activa'
        │                                   │ Conversaciones.tsx                    │
        ▼                                   ▼                                       ▼
abrirChatZak / enviarManual         sincronizarEstadosZak()                 acción que activa la solicitud
        │ (si hay negocioId)               │ avancesDeEstado(prospectos,             │ (si solicitud.negocio_id)
        ▼                                   │   negocios con estado_fijado_manual)   ▼
  avanzarEstadoNegocio(id, 'contactado')     ▼                                 avanzarEstadoNegocio(id,'cliente')
        │                            avanzarEstadoNegocio(id,'respondido'|'interesado')
        ▼                                   │
  UPDATE negocios SET estado=X        (nunca toca cliente/descartado,
  WHERE estado_fijado_manual=false     nunca retrocede, salta lo fijado a mano)
    AND estado < X
```

## Archivos

**Nuevos**

| Archivo | Qué hace |
|---|---|
| `supabase/zak-automatizacion.sql` | `estado_fijado_manual` + `solicitudes.negocio_id` |
| `supabase/leads-overrides.sql` | Tabla del overlay de CRUD de leads |
| `src/lib/admin/estado-negocio.ts` | `avanzarEstadoNegocio()` — el único update con candado |
| `src/app/admin/api/negocios/[id]/route.ts` | `GET` de un `Negocio` completo por id (no existía — Territorio/Prospección resuelven por lista en memoria, Zak no la tiene) |
| `src/app/admin/(panel)/metricas/page.tsx` | Nueva página de nivel superior |
| `src/components/admin/metricas/MetricasView.tsx` | Shell (reemplaza `MetricasZak.tsx` + `Actividad.tsx` como pestañas de Zak) |
| `src/components/admin/metricas/EmbudoEstados.tsx` | El conteo de negocios por estado |
| `src/components/admin/metricas/LeadsCapturados.tsx` | Lista con editar/borrar/vincular |
| `src/lib/admin/leads-overrides.ts` | Fetch + merge Flask↔overlay |
| `src/lib/admin/leads-actions.ts` | Server actions: editar, borrar, vincular a negocio |

**Tocados**

| Archivo | Cambio |
|---|---|
| `src/lib/voz/despacho.ts` | Usa `avanzarEstadoNegocio` en vez de su update ad-hoc |
| `src/lib/admin/zak-actions.ts` | `abrirChatZak(telefono, slug, negocioId?)` dispara `contactado`; `enviarTandaZak` migra al helper; `sincronizarEstadosZak` respeta `estado_fijado_manual` |
| `src/lib/admin/zak.ts` | `avancesDeEstado` filtra negocios con `estado_fijado_manual` |
| `src/lib/admin/actions.ts` | `actualizarNegocio` y `cambiarEstadoLote` setean `estado_fijado_manual: true` cuando tocan `estado` |
| `src/lib/admin/bots-actions.ts` | `enviarManual` gana `negocioId?` y el mismo hook de `contactado` |
| `src/components/admin/bots/Conversaciones.tsx` | Header del chat en una fila (botones a íconos) + botón "Ver ficha" que llama `abrirLead(negocioId)` (`useFichaLead()`) + monta `<FichaLeadModal>` alimentado por un fetch propio a `/admin/api/negocios/[id]` + pasa `fichaActual?.negocioId` a `abrirChatZak`/`enviarManual`; `sincronizarEstadosZak` se llama en el tick de `refrescarLista` |
| `src/components/admin/leads/FichaLeadModal.tsx` | Gana el prop opcional `cargando?: boolean` (default `false`): en `true` pinta un esqueleto en vez del banner "no está en la lista cargada" — lo usa el fetch por id de Zak, no cambia nada para Territorio/Prospección |
| `src/components/admin/voz/BotonLlamarZak.tsx` | Gana el prop opcional `compacto?: boolean` (default `false`): en `true` se renderiza como `IconButton` en vez de `Button` con texto |
| `src/components/admin/bots/ZakView.tsx` | Quita Interesados/Tandas/Métricas de `PESTANAS_CHAT`; deja de recibir `tandas`/`prospectos` (se mudan a la página de Métricas) |
| `src/lib/admin/zak-caras.ts` | `PESTANAS_CHAT` sin `interesados`/`tandas`/`metricas` |
| `src/components/admin/bots/PlantillasZak.tsx` | Contenedor pasa a grid responsive |
| `src/components/admin/Sidebar.tsx` | Nueva entrada "Métricas" (`/admin/metricas`) |
| `src/components/admin/ui/PageHeader.tsx` | Gana `migas: string[]` |
| Las 8 páginas de nivel superior existentes | Agregan `<PageHeader migas={...} />` |
| `src/lib/solicitudes/entrada.ts` | `EntradaSolicitud` y la fila insertada ganan `negocio_id` |
| `src/app/api/zak/solicitud/route.ts` | Lee `negocio_id` del payload del bot |
| `src/lib/portal/solicitudes.ts` | Tipo `Solicitud` gana `negocio_id` |
| `src/lib/admin/solicitudes-actions.ts` (`activarSolicitud`, línea ~248) | Tras marcar `estado: 'activa'`, dispara `avanzarEstadoNegocio(..., "cliente")` si `solicitud.negocio_id` no es nulo |
| `src/app/admin/(panel)/prospeccion/page.tsx` | Pagina `territorios` con `.range()` + `count: "exact"`, 25/página |
| `src/components/admin/prospeccion/TerritorioView.tsx` / `PanelTerritorios.tsx` | Recibe página/total, pinta el paginador |

**Borrados**

| Archivo | Por qué |
|---|---|
| `src/components/admin/bots/InteresadosZak.tsx` | Pestaña eliminada |
| `src/components/admin/bots/TandasZak.tsx` | Pestaña eliminada (la acción de enviar tandas, no la pestaña, sigue viva en Prospección) |

## Fases (cada una desplegable sin romper nada)

1. **Automatización de estados** — migración `zak-automatizacion.sql`,
   `avanzarEstadoNegocio`, refactor de `despacho.ts`/`enviarTandaZak`,
   `contactado` en `abrirChatZak`/`enviarManual`, candado en
   `actualizarNegocio`, sync de respondido/interesado en cada tick.
2. **Ficha desde el chat + header de una fila** — endpoint `GET
   /admin/api/negocios/[id]`, `cargando` en `FichaLeadModal`, `compacto` en
   `BotonLlamarZak`, reordenar `Conversaciones.tsx`.
3. **Navegación** — quitar Interesados/Tandas, Plantillas a grid.
4. **Métricas** — nueva ruta, embudo, `leads_overrides` + CRUD, vínculo
   `solicitudes.negocio_id` → `cliente`.
5. **Breadcrumb** — generalizar `PageHeader`, aplicarlo a las 9 vistas.
6. **Paginación de territorios**.

## Riesgos y gates

- **Carga extra sobre el bot Flask.** Llamar `sincronizarEstadosZak` en cada
  tick de 12s multiplica por el número de admins con la consola abierta las
  llamadas a `listarProspectos`. Si pesa, se puede desacoplar su intervalo
  del de la lista (ej. cada 30s) sin tocar el resto del diseño.
- **La automatización de `cliente` depende de que el bot mande `negocio_id`.**
  Hasta que se actualice el lado del bot de WhatsApp (fuera de este repo, o
  en su siguiente release), las solicitudes seguirán llegando sin ese campo y
  `cliente` seguirá siendo manual — no bloquea nada de las fases 1-3, que
  entregan valor solas.
- **`leads_overrides` es un parche, no la fuente de verdad.** Si el Flask
  algún día gana su propio CRUD, este overlay se retira sin drama: nunca fue
  autoritativo.
- **9 archivos tocados solo por el breadcrumb.** Mecánico y de bajo riesgo,
  pero fácil de dejar uno afuera — conviene una sola pasada final grepeando
  `<PageHeader` para confirmar que las 9 quedaron iguales.
- **`estado_fijado_manual` es aditivo.** Con default `false`, cualquier
  negocio existente arranca "automatizable"; no hay migración de datos que
  decidir.

## Tests

- `src/lib/admin/__tests__/estado-negocio.test.ts` (nuevo) — el update no
  avanza si `estado_fijado_manual`, no avanza si el destino no es "mayor",
  sí avanza en el caso feliz (con un doble de Supabase).
- `src/lib/admin/__tests__/zak.test.ts` — `avancesDeEstado` ignora negocios
  con `estado_fijado_manual`.
- `src/lib/solicitudes/__tests__/entrada.test.ts` — la fila insertada
  incluye `negocio_id` cuando viene en la entrada, `null` cuando no.
- `src/lib/admin/__tests__/leads-overrides.test.ts` (nuevo) — el merge oculta
  lo borrado, pisa los campos editados, no muta lo que no tiene override.

## Verificación

- "+ Nuevo chat" a un negocio en `nuevo` → pasa a `contactado` sin tocar nada
  a mano.
- Un negocio puesto a mano en `descartado`: aunque responda después por
  WhatsApp, se queda en `descartado`.
- Un negocio en `contactado` que responde por WhatsApp → pasa a `respondido`
  en segundos (sin recargar la consola).
- Activar una solicitud con `negocio_id` → el negocio pasa a `cliente`.
- Abrir la ficha completa de un negocio sin salir del chat de Zak.
- El header del chat no hace wrap a dos líneas en desktop.
- Interesados y Tandas ya no aparecen como pestañas; enviar una tanda desde
  Prospección sigue funcionando igual.
- Plantillas se ve en grid y el editor expandido no se aplasta.
- `/admin/metricas` aparece en el Sidebar, con el embudo por estado y los
  leads con acciones de editar/borrar/vincular.
- Borrar un lead lo oculta de la lista sin llamar al Flask.
- Territorios pagina de 25 en 25 con `?pagina=`.
- Las 9 vistas de nivel superior muestran su breadcrumb.
