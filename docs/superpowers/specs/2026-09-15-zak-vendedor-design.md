# Zak vendedor — repertorio por vertical, señales del CRM, interés real y ficha de cierre

Fecha: 2026-09-15 · Rama: `feat/zak-vendedor` (panel) y `feat/zak-vendedor` en el repo del bot
(`whatsapp-bot/`, Railway) · Estado: diseño aprobado en conversación, pendiente de revisión del spec.

El estudio de mercado, método de cierre y precios que sustenta este diseño es interno y vive fuera
de git: `docs/finanzas/estudio-zak-vendedor-2026-09-15.md`. Aquí va solo lo que cambia en el código.

## 1. Problema

Zak abre conversaciones de prospección con negocios del CRM (tandas con plantilla de Meta) y
conversa con ellos. Hoy:

1. **Vende una sola cosa.** El bloque de prospección que recibe en cada chat (`_BLOQUE_PROSPECTO`
   en `agent.py`) trae un único ejemplo: «un agente como yo atendiendo tu {categoria} 24/7». El
   `angulo` de cada vertical (`plantillas_zak.angulo`, seed en `src/lib/admin/zak.ts`) es una frase,
   siempre sobre el agente. Zakumi vende también landing, web, tienda con pagos, automatización,
   CRM y marca, y Zak lo tiene en su base de conocimiento, pero nadie le dice que lo use.
2. **Confunde una contestadora con un interesado.** Muchos negocios responden con el mensaje
   automático de WhatsApp Business (horario, «gracias por tu mensaje», el link del menú). Zak lo
   lee como conversación y llama `marcar_interesado`; el panel promueve el negocio a «Interesado»
   (`avancesDeEstado`) y a «Respondió» (`avancesDesdeChats`). En la tanda de hoy ninguna respuesta
   fue de una persona y varios negocios quedaron marcados como interesados.
3. **No sabe lo que el CRM sabe.** `negocios.sitio_web` (de Google Places) decide qué se le vende a
   un negocio y nunca viaja en el contexto del prospecto (`prospectoParaTanda` manda nombre,
   categoría, ciudad, ángulo y saludo).
4. **Los chats abiertos uno a uno no tienen prospecto.** `abrirChatZak` (ficha del lead y «+ Nuevo
   chat») manda la plantilla por `POST /instancias/{iid}/plantilla`, que no crea prospecto. Sin
   prospecto no hay bloque de prospección ni `marcar_interesado`: en esos chats Zak es el bot
   genérico del sitio.
5. **Dice cosas viejas.** El prompt semilla (`prompt/system.md`) lista «llamadas telefónicas de voz
   atendidas por IA» bajo «Lo que no ofrecemos», y Zak ya llama (`llamar_por_voz`). La tool
   `enviar_brochure` manda un PDF cuyos precios se van a redefinir.

## 2. Decisiones ya tomadas (Tomás, 15 sep 2026)

- **Cero precios en el chat.** Ni cifras, ni rangos, ni el PDF: `enviar_brochure` sale de las
  herramientas de Zak hasta nuevo aviso. Zak cotiza «por alcance» y escala a Tomás.
- **Repertorio solo con lo del brochure**: agentes, landing/web/tienda online, automatización,
  CRM, identidad de marca. Zak no promete manejo de redes sociales (la página `/marca` del sitio sí
  menciona contenido y redes: contradicción anotada, no se resuelve aquí).
- **Botón «no era interés real»** para corregir a mano: lo aprieta Tomás; el panel no corrige
  estados solo.
- **Las plantillas aprobadas en Meta no se tocan.** La conversación pivota después del saludo.
- **Precios PyME aprobados** (sección 4.10): son los del catálogo y del brochure nuevo; Zak no los
  dice, Tomás sí.
- Orden de trabajo: este spec primero; después la página de precios en la landing; después la
  cabecera del mapa y la bandeja (frentes aparte).

## 3. Alcance

**Dentro**

1. Repertorio de tres ganchos por vertical, en código, que viaja con el prospecto.
2. Señales `sin_web` y `contestadora` en el contexto del prospecto y reglas de qué gancho va primero.
3. Todo chat que abre Zak (tanda o uno a uno) deja prospecto con contexto.
4. Bloque de prospección nuevo: escalera de síes, una pregunta antes de proponer, demo en el chat,
   micro-cierre con alternativa, objeciones, cero precios.
5. Detector de contestadora en el bot + guarda dura en `marcar_interesado`.
6. El panel no promueve a «Respondió» ni a «Interesado» con contestadoras; insignia 🤖 en la bandeja.
7. Botón «No era interés real» en la cabecera del chat y en la ficha del lead.
8. Ficha de cierre estructurada en `escalar_a_humano`, incluida en el aviso a Tomás.
9. `enviar_brochure` fuera; línea de voz fuera del prompt semilla; regla de precios intacta.
10. `catalogo.ts` con los precios aprobados y dos productos nuevos (landing, tienda online).

**Fuera** (frentes siguientes, anotados): página de precios en la landing pública; landings de demo
por vertical; seguimiento automático (día 2 / día 7); plantillas de apertura con gancho de web;
base de landing por vertical para entregar a precio de entrada; cabecera del mapa dentro del mapa;
filtros y badge de la bandeja.

## 4. Diseño

### 4.1 Repertorio por vertical (panel, lógica pura)

Archivo nuevo `src/lib/admin/zak-repertorio.ts`:

```ts
export type Repertorio = {
  /** Lo que suele dolerle a este tipo de negocio, en una frase. */
  senal: string;
  /** Tres cosas vendibles, todas del brochure, en orden de preferencia. */
  ganchos: readonly [string, string, string];
};
export const REPERTORIO: Readonly<Record<string, Repertorio>>; // por slug de vertical
export function repertorioPara(slug: string): Repertorio | null; // genérico → null
```

| Slug | Señal típica | Gancho 1 | Gancho 2 | Gancho 3 |
|---|---|---|---|---|
| restaurante | pedidos por app de domicilios o por llamada; menú en un link o una foto | menú digital con QR y pedidos por WhatsApp | Zak toma pedidos y reservas completos | domicilios propios con pago en línea, sin comisión de la app |
| panaderia | encargos de tortas por chat | catálogo con fotos y encargos por WhatsApp | Zak toma encargos con sabor, porciones y fecha | tienda con pago para pedidos anticipados |
| ferreteria | «¿tienen X? ¿a cómo?» todo el día | Zak responde precio y disponibilidad desde el catálogo | catálogo web buscable | automatización pedidos ↔ inventario |
| veterinaria | citas por llamada | Zak agenda citas y manda recordatorios | landing con reservas | recordatorios automáticos de vacunas |
| farmacia | domicilios por llamada | Zak toma domicilios con dirección y pago | catálogo con pedidos | automatización con inventario |
| belleza | agenda por mensajes directos y llamadas | Zak agenda, reagenda y recuerda | landing de portafolio con reservas | identidad de marca |
| taller | cotizaciones por chat | Zak agenda revisiones y cotiza repuestos | web con servicios y agenda | automatización de órdenes de trabajo |
| hogar | cotización con medidas y fotos | Zak cotiza con fotos y coordina la entrega | catálogo web | tienda online |
| moda | tallas y apartados por mensajes directos | tienda online con pagos | Zak responde tallas y aparta | identidad de marca |
| comercio | pedidos por chat | Zak toma pedidos | landing con botón a WhatsApp | tienda online |
| generico | — | (sin repertorio: Zak pregunta primero a qué se dedica y cómo le llegan los clientes) | | |

Vive en código y no en `plantillas_zak.angulo` a propósito: el seed de esa tabla es
`on conflict do nothing`, así que cambiar el ángulo exigiría SQL en producción; el repertorio es
largo y estructurado, y se prueba en vitest. `angulo` sigue viajando como hasta hoy (compatibilidad
con el bot que esté desplegado) y el bloque nuevo lo ignora cuando hay repertorio.

### 4.2 Las señales que viajan con el prospecto

`contexto` del prospecto (jsonb en el bot, tipo `Prospecto["contexto"]` en el panel) gana:

| Campo | Quién lo pone | Valor |
|---|---|---|
| `ganchos` | panel, al crear el prospecto | `string[3]` del repertorio; ausente en el genérico |
| `senal_tipica` | panel | `Repertorio.senal` |
| `sin_web` | panel | `esSinWeb(negocio)` (sitio nulo o vacío) |
| `contestadora` | bot, al clasificar una respuesta | `true` en cuanto llega un mensaje automático; no vuelve a `false` |
| `humano` | bot | `true` en cuanto llega un mensaje que no es contestadora; no vuelve a `false` |
| `interes_descartado` | bot, por el botón | `true` cuando Tomás dijo «no era interés real»; se borra con el siguiente mensaje humano |

`prospectoParaTanda` (`src/lib/admin/envio.ts`) añade `ganchos`, `senal_tipica` y `sin_web`. Las
claves se omiten cuando no aplican (nunca `null`): un bot viejo las ignora y un prospecto viejo no
las tiene — ausente significa «no se sabe», y en el panel «no se sabe» conserva el comportamiento
de hoy (sección 4.6).

### 4.3 Todo chat de Zak lleva prospecto

`POST /instancias/{iid}/plantilla` (envío directo) acepta además `negocio_id` y `contexto`. Cuando
llegan, el bot deja el prospecto con `store.prospecto_manual(iid, telefono, negocio_id, contexto,
plantilla)`:

- Una tanda por instancia con `notas = 'manual'` (se busca; si no existe se crea con
  `crear_tanda`). Guarda el nombre de la plantilla que salió.
- `INSERT … ON CONFLICT (instancia_id, telefono) DO UPDATE` de `negocio_id`, `contexto`,
  `estado_envio = 'enviado'`, `wamid`, `actualizado_en = now()`. Reabrir un chat refresca el
  contexto (el negocio pudo cambiar de vertical o de estado de web) sin perder `interesado`.
- Sin `contexto` en el body, el endpoint se comporta como hoy (la reparación de tanda existente).

`abrirChatZak` manda `negocio_id` y el mismo `contexto` que `prospectoParaTanda` cuando conoce el
negocio; con un teléfono suelto (sin negocio) manda `contexto: { angulo, saludo }` y sin
`negocio_id`, para que Zak igual sepa que abrió él.

### 4.4 El bloque de prospección (bot, `agent.py`)

`_BLOQUE_PROSPECTO` se reescribe. Texto completo (lo que reciben el modelo y los tests):

```
# Contexto de prospección (interno, no lo recites)

Este chat es con un negocio que TÚ contactaste primero, como parte de la prospección de Zakumi:
- Negocio: {nombre} · Tipo: {categoria} · Ciudad: {ciudad}
- Señales: {senales}
- Lo que suele dolerle a este tipo de negocio: {senal_tipica}
- Ganchos para este tipo de negocio, en orden (elige UNO según las señales; nunca los recites todos):
  1) {gancho_1}  2) {gancho_2}  3) {gancho_3}

Tu meta aquí NO es vender ni cotizar: es CALENTAR y ESCALAR, subiendo de a un sí:
respuesta de una persona → una pregunta sobre su operación → una demo aquí mismo → una llamada de 10 minutos con Tomás.

Cómo:
- Ya les llegó tu saludo aprobado. Si preguntan quién eres, preséntate en media línea como Zak, el agente de IA de Zakumi.
- Abre con ellos, no con nosotros: usa el nombre del negocio y lo que compartan (un menú, una foto, un link).
- ANTES de proponer, UNA pregunta sobre cómo operan hoy (cómo les llegan los pedidos o las citas; quién contesta cuando cierran). La respuesta elige el gancho.
- Qué va primero: sin sitio web → existir en internet (landing o menú con QR), no el agente. Con contestadora → no vendas «responder» (ya responden): vende «tomar el pedido» o «agendar», o lo que les falta (web, tienda). Con web y sin contestadora → el agente. Si mencionan una app de domicilios → domicilios propios sin comisión. Si mencionan citas → agenda y recordatorios.
- Enseña UNA cosa que no hayan pensado, en una frase: un pedido por app deja una parte en comisión; un mensaje automático responde pero no toma el pedido; sin web, en Google aparece la app y no ellos.
- La demo es tu mejor argumento: ofrece «escríbeme como si fueras tu cliente y pídeme algo», y toma el pedido o la cita completos con lo que ellos compartieron (menú, servicios, horarios).
- Cierra con alternativa, nunca con «¿te interesa?»: «¿te llamo 10 minutos hoy a las 3 o mañana a las 10?». Si prefieren no llamar, ofrece pasarlos con Tomás para la propuesta.
- Precios: NUNCA una cifra, un rango ni un «desde». Lo que sí puedes decir: «son precios para negocios de barrio, no de agencia; sin permanencia y se prueba antes; Tomás te lo cuadra según lo que necesites» — y escalas.
- Objeciones: «ya tengo WhatsApp Business» → eso responde; tú tomas el pedido completo. «No tengo tiempo» → lo montamos nosotros, solo aprueban; pide la hora. «Es caro» → sin permanencia y se prueba antes; escala. «Ya tengo Rappi» → sigue sirviendo; esto es para que quienes ya lo conocen pidan directo, sin comisión. «Mándame información» → cuéntalo en dos líneas y muéstralo aquí; pregunta qué le quita más tiempo.
- Un mensaje automático del negocio (horario, «gracias por tu mensaje», bienvenida, un menú suelto) NO es una persona: no lo contestes como si lo fuera y no marques interés. Espera a que escriba alguien.
- Cuando detectes interés real de una persona (pregunta cómo funciona, dice que le serviría, pide hablar), llama marcar_interesado con el resumen — y sigue conversando.
- Si quieren avanzar ya o hablar con una persona, llama escalar_a_humano con la ficha de cierre completa: Tomás cierra. Escalar es tu último mensaje en el chat.
- Si piden no ser contactados, discúlpate con calidez, despídete y no insistas.
- No inventes precios ni promesas: solo lo que está en tu base de conocimiento.
```

`{senales}` se arma en `_bloque_prospecto` con lo que haya: «no tiene sitio web» / «tiene sitio
web» / (nada si no se sabe) · «responde con contestadora» / «sin contestadora hasta ahora» ·
«todavía no ha escrito ninguna persona» / «ya escribió una persona». Sin repertorio (genérico) las
líneas de señal típica y ganchos se sustituyen por: «Ganchos: descubre primero a qué se dedica y
cómo le llegan los clientes; luego elige entre agente, landing o menú con QR, tienda online,
automatización o marca — lo que la respuesta pida». Con `interes_descartado` se añade: «Tomás ya
revisó este chat y no era interés real: vuelve a marcarlo solo si una persona escribe algo que lo
demuestre».

El bloque va después del breakpoint de caché del knowledge, como hoy; crece unos 500 tokens por
turno en chats de prospección. Aceptado.

### 4.5 Contestadora: detector y guarda dura (bot)

Módulo nuevo `contestadora.py`, puro:

```python
def es_contestadora(texto: str, segundos_desde_nuestro_ultimo: float | None) -> bool
```

Es contestadora si **cualquiera** de las dos:

1. **Marcadores.** El texto normalizado (minúsculas, sin tildes) contiene alguno de una lista
   fija: «gracias por tu mensaje», «gracias por escribir», «gracias por comunicarte», «gracias por
   contactar», «horario de atencion», «nuestro horario», «fuera de horario», «en breve», «en un
   momento te», «lo antes posible», «te responderemos», «le responderemos», «un asesor te», «un
   asesor se», «mensaje automatico», «respuesta automatica», «bienvenido a», «bienvenida a»,
   «bienvenidos a», «selecciona una opcion», «escribe el numero», «te compartimos nuestro menu». La
   lista es del módulo y la cubren los tests (con textos reales anonimizados).
2. **Velocidad.** Llegó **≤ 20 segundos** después de nuestro último mensaje y trae **≥ 2 líneas o
   ≥ 120 caracteres**. Una persona no escribe tres párrafos en veinte segundos.

Dónde corre: en `_encolar_para` (`app.py`), donde hoy se llama `marcar_respondido`. Nuevo
`store.clasificar_respuesta(phone, iid, texto)`: si hay prospecto, calcula los segundos desde el
último mensaje `assistant` en `mensajes` (el saludo se guarda ahí al enviarse) y actualiza el
`contexto`: `contestadora = true` si lo es; si no, `humano = true` y borra `interes_descartado`.
Best-effort como `marcar_respondido`: nunca tumba el webhook. `estado_envio = 'respondido'` se
sigue marcando igual (es el funnel de entrega; «Respondió» del CRM es otra cosa, sección 4.6).

**Guarda dura** en `_dispatch_tool` para `marcar_interesado`, antes de tocar la base:

- Sin prospecto → como hoy («no hay prospecto que marcar»).
- `contexto.humano` no es `true` → no marca y devuelve: «Este número solo ha respondido con
  mensajes automáticos (contestadora). No es interés: sigue conversando y, si escribe una persona,
  vuelve a intentarlo.»
- `contexto.interes_descartado` → no marca y devuelve: «Tomás ya revisó este chat y no era interés
  real. Vuelve a marcarlo solo si la persona escribe algo nuevo que lo demuestre.»

Es una regla del handler, no del prompt: el modelo no puede interpretarla.

### 4.6 Lo que ve el panel

- `GET /instancias/{iid}/prospectos` ya devuelve `contexto`: el tipo `Prospecto["contexto"]`
  suma `humano?`, `contestadora?`, `interes_descartado?`, `sin_web?`, `ganchos?`, `senal_tipica?`.
- `GET /instancias/{iid}/history` devuelve además `humano` (`true`/`false`, o `null` sin prospecto)
  y `contestadora` (`bool`).
- `GET /instancias/{iid}/conversations` devuelve por fila `humano` y `contestadora` (LEFT JOIN con
  `prospectos` por teléfono; `null`/`false` sin prospecto).
- `avancesDeEstado` (`zak.ts`): a «interesado» solo si `p.interesado && p.contexto.humano === true`;
  a «respondido» solo si `humano !== false` (un prospecto viejo sin la clave conserva la regla de
  hoy; uno con `humano: false` no sube).
- `consultarRespuestas` (`zak-actions.ts`): `respondio = humano === true || (humano === null &&
  <regla de hoy>)`; con `humano === false` es `false`.
- Bandeja (`Conversaciones.tsx`): insignia `🤖 contestadora` en la fila y en la cabecera del chat
  cuando `contestadora && !humano`; el badge de estado sigue viniendo del CRM.
- Métricas de Zak: donde se cuente «respondieron», contar solo `humano !== false` (un prospecto
  con `humano: false` no cuenta; los viejos sin clave se cuentan como hoy).

### 4.7 Botón «No era interés real»

- Bot: `POST /instancias/{iid}/prospectos/{telefono}/descartar-interes` → `interesado = false`,
  `interes_resumen = NULL`, `contexto.interes_descartado = true`, `actualizado_en = now()`. 404 sin
  prospecto. No toca `humano` ni `contestadora` (son evidencia).
- Panel, server action `noEraInteresReal(negocioId | null, telefono)` en `zak-actions.ts`:
  1. llama al endpoint del bot; si falla, devuelve el error y no toca el CRM;
  2. si hay negocio y su estado es `interesado`, lo pasa a `respondido` cuando el historial dice
     `humano === true` y a `contactado` si no — UPDATE directo (es el clic de Tomás, no la
     automatización): no toca `cliente` ni `descartado`, y sí baja aunque haya
     `estado_fijado_manual` (el botón ES la corrección manual);
  3. `revalidatePath` de `/admin/zak` y `/admin/prospeccion`.
- UI: en la cabecera del chat (`Conversaciones.tsx`), junto al badge de estado, solo cuando el
  negocio está en «Interesado»; y en la ficha del lead (`FichaLeadModal`), en la misma condición,
  con el teléfono del negocio. Confirmación con `useConfirmar` («Vuelve a Contactado/Respondió y
  Zak no lo volverá a marcar hasta que escriba una persona»).

### 4.8 Ficha de cierre en `escalar_a_humano`

El `input_schema` de la tool suma un objeto opcional `ficha` con campos de texto corto:
`tiene_web` («sí»/«no»/«no sé»), `tiene_contestadora`, `usa_app_domicilios`, `canal_hoy` (por dónde
le llegan hoy pedidos o citas), `dolor` (en sus palabras), `gancho` (el que prendió), `objecion`
(la abierta), `mejor_hora` (cuándo y por dónde contactar). La descripción de la tool pide llenarla
con lo que se sepa; `motivo` sigue siendo obligatorio.

`notify(phone, motivo, ficha=None)`: `notify_escalation` arma el texto en **una sola línea**
(«🔔 Chat escalado · De: … · Motivo: … · Web: … · Contestadora: … · App domicilios: … · Pedidos hoy:
… · Dolor: … · Gancho: … · Objeción: … · Mejor hora: …»), omitiendo campos vacíos y recortada a 1024
caracteres — los parámetros de plantilla de Meta no admiten saltos de línea ni más de eso. El
camino de texto libre usa el mismo texto. El bloque de prospección pide la ficha «completa».

### 4.9 Limpieza

- `enviar_brochure` no se registra en las tools de Zak (el código y sus tests quedan; una
  constante `BROCHURE_ACTIVO = False` documenta por qué). Cuando Tomás redefina los precios se
  vuelve a encender.
- `prompt/system.md` (semilla): sale la línea «Llamadas telefónicas de voz atendidas por IA» de «Lo
  que no ofrecemos». El prompt **vivo** está en la tabla `prompts` y se edita desde el panel: es un
  paso manual del runbook (sección 5).
- La regla de precios del prompt de sistema se queda tal cual; el bloque de prospección la repite.

### 4.10 Catálogo y precios (`src/lib/catalogo.ts`)

Precios aprobados el 15 sep para PyMEs (son los del brochure nuevo y de la página de precios que
viene después; Zak no los dice):

| Slug | Nombre | Tarifa | Ciclo | Montaje |
|---|---|---|---|---|
| `landing` (nuevo, tipo `web`) | Landing / menú digital con QR | $590.000 | único | — |
| `pagina-web` | Página web (hasta 5 secciones) | $1.190.000 | único | — |
| `tienda-online` (nuevo, tipo `web`) | Tienda online con pagos | $1.490.000 | único | — |
| `mantenimiento-web` | Mantenimiento web | $49.900 | mensual | — |
| `bot-whatsapp` | Bot de WhatsApp (Zak) | $129.900 | mensual | $199.900 |
| `agente-voz` | Agente de voz | $249.900 | mensual | $199.900 |
| `crm` | CRM | $99.900 | mensual | — |

Automatización de procesos (desde $890.000), identidad de marca (desde $890.000) y marca +
estrategia (desde $1.990.000) no entran al catálogo del portal: se cotizan; van al brochure y a la
página de precios. App móvil, software a medida y CRM con IA salen del brochure PyME.

`CLAVES` de `slugDeInteres` gana `landing` («landing», «menu», «qr», «una pagina») antes de
`pagina-web`, y `tienda-online` («tienda», «carrito», «pagos», «ecommerce») antes de `pagina-web`.
Los `pitch` de los nuevos siguen el tono de los existentes.

## 5. Compatibilidad y orden de encendido

Los dos repos se despliegan por separado y ninguno puede depender de que el otro ya esté:

- **Bot antes que panel.** El panel manda claves nuevas en `contexto` que un bot viejo ignora; el
  panel viejo ignora `humano`/`contestadora`. Con el bot nuevo y el panel viejo, la guarda dura ya
  frena los interesados falsos (lo más urgente).
- Prospectos anteriores al despliegue no tienen `humano`: el panel los trata como hoy hasta que
  llegue un mensaje nuevo o Tomás use el botón.

Runbook para Tomás, en orden:

1. Mergear y desplegar la rama del bot (Railway, web + worker).
2. Mergear y desplegar la rama del panel (Vercel).
3. En `/admin/bots` → Zak → Prompt: quitar «Llamadas telefónicas de voz atendidas por IA» de «Lo
   que no ofrecemos» y guardar versión.
4. En `/admin/zak`: en cada chat marcado «Interesado» con insignia 🤖, «No era interés real».
5. Mandar una tanda corta y comprobar: los chats con contestadora no suben de «Contactado»; el
   primero que escriba una persona sube a «Respondió»; el aviso de escalado trae la ficha.

## 6. Pruebas

**vitest** (lógica pura): `zak-repertorio` (11 slugs con señal y tres ganchos no vacíos; genérico →
null); `prospectoParaTanda` (ganchos, senal_tipica, sin_web; sin claves nulas; genérico sin
ganchos); `avancesDeEstado` (interesado exige `humano === true`; respondido bloqueado con
`humano === false`; prospecto sin clave como hoy); regla de `consultarRespuestas`; `catalogo`
(precios y montajes nuevos, slugs nuevos, `slugDeInteres` con «menú con qr» → landing y «tienda con
pagos» → tienda-online, mantenimiento antes que web); texto del aviso de escalado sin saltos.

**pytest** (bot): `es_contestadora` (cada marcador; velocidad con y sin longitud; una persona lenta
y corta no es contestadora; textos reales anonimizados); `clasificar_respuesta` deja `contestadora`
y `humano` pegajosos y borra `interes_descartado` con humano (marcado `db`); guarda de
`marcar_interesado` (sin humano, con descartado, con humano marca); `prospecto_manual` crea y
refresca sin perder `interesado` (`db`); `_bloque_prospecto` con y sin repertorio, con cada señal;
`notify_escalation` arma una línea ≤ 1024 con ficha parcial; `enviar_brochure` ausente de las tools
de Zak.

## 7. Riesgos

- **Falso positivo del detector** (una persona rápida y larga): solo retrasa «interesado» hasta su
  siguiente mensaje, que la marca humana. Sin efecto permanente.
- **Falso negativo** (contestadora corta y sin marcador): Zak la contesta como hoy; la guarda
  dura sigue vigente porque `humano` solo se pone con un mensaje que no es contestadora — un falso
  negativo SÍ marca `humano`. Por eso la lista de marcadores se alimenta de los textos reales de la
  bandeja y se amplía con lo que aparezca.
- **Tokens**: +≈500 por turno en chats de prospección; el bloque va fuera de la caché como hoy.
- **Dos repos**: el orden de encendido es bot → panel; cada uno tolera al otro viejo.
- **Meta**: el aviso por plantilla se recorta a 1024 caracteres y sin saltos; la ficha larga se
  trunca por el final (los campos van de más a menos útil).
