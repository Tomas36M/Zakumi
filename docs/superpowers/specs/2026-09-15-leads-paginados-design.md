# Leads paginados — la lista de negocios deja de depender de los 900 cargados

Fecha: 2026-09-15 · Rama: `feat/leads-paginados` · Estado: diseño aprobado por Tomás, con los ajustes que
salieron al escribir el plan (`docs/superpowers/plans/2026-09-15-leads-paginados.md`).

## Problema

- La cara **Leads** de `/admin/prospeccion` y la página de un territorio pintan la lista con los
  negocios que carga el servidor, topados en `TOPE_LEADS = 900` por el *Max rows* de Supabase. La base
  ya pasó ese tope: la lista, los filtros y los chips de estado cuentan solo los 900 más recientes, y
  un banner rojo lo avisa.
- La **cabecera** de Encontrar clientes («900 de N negocios · M sin web») y el detalle de las
  **caras** («900 leads · M sin web») también cuentan sobre esos 900.
- Para prospectar, una selección de la lista es una tanda, y cada tanda lleva máximo 50
  (`TANDA_MAX_BOT`). Si la lista pagina de a 50, «seleccionar la página» es exactamente una tanda.

## Decisiones (aprobadas)

1. Páginas de **50** (`LEADS_POR_PAGINA`, igual a `TANDA_MAX_BOT`).
2. Lectura por **route handler** `GET /admin/api/leads` (regla del repo: lecturas en route handlers,
   server actions solo para mutaciones). La lista pide cada página desde el navegador: cambiar un
   filtro no re-renderiza la page ni el mapa.
3. **Sin SQL nuevo.** Conteos por estado con consultas `count: "exact", head: true` en paralelo;
   búsqueda por nombre con el índice trigram que ya existe (`supabase/rendimiento.sql`).
4. **«Seleccionar todos» = la página visible.**
5. El **mapa** (cara Territorio) no cambia en esta PR: sigue cargando hasta 900 pines, con su aviso.
6. **«Contactar a los nuevos»** del territorio no cambia: usa los negocios del territorio que ya
   carga la page.
7. **Las cifras de la cabecera y de las caras son las de la base entera**, no las de la lista cargada
   (pedido de Tomás, 15 sep, sobre la captura de Encontrar clientes → Leads).

## Diseño

### Contrato de la ruta

`GET /admin/api/leads?pagina=&q=&estado=&ciudad=&categoria=&telefono=&web=&territorio=&opciones=1`

- Exige sesión admin (`getSesionAdmin`); sin sesión, 401 (antes de llegar ahí, el proxy ya redirige al
  login).
- Respuesta:
  `{ filas: Negocio[], total: number, pagina: number, conteos: Record<EstadoNegocio, number>, opciones?: { ciudades: string[], categorias: string[] } }`.
- `conteos` respetan todos los filtros **menos** `estado` (el mismo criterio que la franja de estados usa
  hoy). `total` respeta **todos**: sale de sumar los conteos (los del estado elegido, o los seis), sin un
  conteo aparte.
- `filas` respetan todos los filtros y van ordenadas por `created_at` descendente y luego por `id`: un
  barrido inserta muchas filas con la misma fecha, y sin desempate las páginas repetirían o saltarían
  filas.
- `pagina` mayor que la última → se responde la última página válida (mismo criterio que
  `/admin/territorios`).
- `opciones` (valores distintos de ciudad y categoría) solo viaja con `opciones=1`: la lista la pide en
  su primera consulta y cada vez que cambia el territorio (el fijo o el del select), no en cada tecleo.
  Respeta el filtro de territorio y se lee paginando de a 1000 filas (el tope de PostgREST). Si esa
  lectura falla, la respuesta sale sin `opciones` (queda en el log) y la lista las vuelve a pedir en la
  siguiente consulta.
- Error de la base en los conteos o en las filas → 502 `{ error: "crm" }`. La lista lo dice con un
  banner; nunca pinta ceros.

### Lógica pura (TDD) — `src/lib/admin/leads-consulta.ts`

- `filtroDesdeParams(params: URLSearchParams)` → `{ filtro: FiltroLeads, pagina: number }`. Sanea todo
  lo que llega del navegador: `estado` solo si es del enum, `telefono`/`web` solo en su dominio,
  `territorio` solo si es un UUID, `q` recortado a 80, `pagina` con `paginaDesdeParam`.
- `paramsDeFiltro(filtro, pagina)` → querystring para el `fetch` del cliente, sin claves vacías ni
  valores por defecto. Ida y vuelta con `filtroDesdeParams` sin pérdidas.
- `aplicarFiltros(query, filtro, { sinEstado })` → aplica sobre la consulta de negocios los mismos
  recortes que `filtrarLeads` hace hoy en memoria: `eq` de ciudad, categoría y territorio; `in` de
  estado; `telefono` nulo o no nulo; `sitio_web` nulo o no nulo; `ilike` del nombre con
  `patronBusqueda`. Se prueba con un doble que registra las llamadas, sin librería de mocking (patrón
  del repo). Se tipa con el tipo concreto de la consulta (`ConsultaNegocios`): una interfaz genérica
  sobre el builder de supabase-js no compila (TS2589, comprobado con `tsc`).
- `totalDeConteos`, `opcionesDe` y `rangoEnPantalla` («del 51 al 100»), también puras y con tests.
- `LEADS_POR_PAGINA`, `totalDePaginas` y `acotarPagina` viven en `src/lib/admin/paginacion.ts`.

### UI

- **`NegociosView`** deja de pintar la lista desde un array recibido: recibe `territorioFijo?: string`
  (el id) y pide la página a la ruta con `fetch` (IIFE con guarda `activo`, sin setState síncrono en
  efectos). El buscador espera 300 ms sin teclear antes de pedir. La página actual queda en la URL con
  `useParametroUrl("pagina")`.
- **Mientras carga**, la lista anterior sigue visible y atenuada, con «Cargando…». **Si falla**, banner
  con «Reintentar».
- **`FiltrosLeads`** recibe `opciones` y `total` de la ruta en vez de derivarlos de la lista; el
  contador grande dice «N negocios · del X al Y»: N es el total real filtrado y X–Y el tramo en
  pantalla. Si la ciudad o la categoría elegidas no están entre las opciones (cambió el territorio), el
  select las sigue mostrando: un filtro activo nunca queda invisible.
- **`FranjaEstados`** recibe los `conteos` de la ruta.
- **Paginador con botones** (`onPagina`): una variante del `Paginador` actual, que navega con enlaces
  y re-renderizaría la page.
- **Selección:** se limpia al cambiar de página o de filtro. `AccionesLote` y el diálogo de plantilla
  no cambian.
- **Ficha de un lead:** el dueño de la página la resuelve con la lista que ya carga (los 900 del mapa o
  los locales del territorio); si el `?lead=` no está ahí, se trae con `GET /admin/api/negocios/[id]` y
  se deriva con `estadoFicha` (mismo patrón que el chat de Zak).
- **Tras una acción** (cambiar estado, eliminar, tanda, editar en la ficha): se vuelve a pedir la página
  actual y se hace `router.refresh()` para las cifras de la cabecera y del mapa. La lista también se
  vuelve a pedir cuando cambia la cuenta de la base (un barrido que sigue corriendo con la cara Leads a
  la vista).

### Páginas

- **`prospeccion/page.tsx`:**
  - La cara Leads deja de depender de `negocios` (se siguen cargando los 900 para el mapa).
  - **Cabecera y caras con cifras exactas de la base:** el total ya se cuenta
    (`count: "exact", head: true`); se suma un segundo conteo de «sin web» (`sitio_web is null`). La
    cabecera dice «N negocios · M sin web · T territorios» sin «900 de», y el detalle de las caras
    usa esas mismas cifras. Si una cuenta falla, la cifra se dice como piso («900+») o «—», nunca como
    un cero inventado.
  - El banner de recorte de 900 queda **solo en la cara Territorio**, redactado para el mapa (los
    pines y los negocios por territorio del mapa), porque la lista ya no está recortada.
- **`territorios/[id]/page.tsx`:** sigue cargando los negocios del territorio para el header y
  «Contactar a los nuevos»; la lista usa la ruta con `territorio=<id>`. El aviso de recorte de esa
  página ahora habla de «Contactar a los nuevos», lo único que sigue topado ahí.

## Límites y riesgos

- Cada cambio de filtro cuesta 6 conteos `head` y 1 consulta de filas. Son rápidas; se prefirió eso a
  una RPC para no sumar SQL al runbook.
- Las opciones de ciudad y categoría se leen paginando de a 1000. Con decenas de miles de negocios
  convendría una RPC con `distinct`.
- El mapa sigue topado en 900 (su aviso lo dice).

## Pruebas

- TDD en `src/lib/admin/__tests__/leads-consulta.test.ts` (saneo de params, ida y vuelta,
  `aplicarFiltros` con un doble del query builder, total, opciones y tramo en pantalla), y en
  `paginacion.test.ts`, `ficha-fetch.test.ts` y `prospeccion-caras.test.ts` (cifras de la cabecera y de
  las caras).
- `tsc --noEmit`, `eslint`, `next build` y `/code-review` antes de subir.
- QA manual (esta sesión no tiene login del panel): lista paginada sobre la base completa; cabecera y
  caras con la cifra total; filtros y chips con conteos reales; seleccionar la página y mandar una
  tanda; abrir la ficha de un lead de otra página; la lista dentro de un territorio.

## Fuera de alcance

- Quitar el tope del mapa.
- Contar cuántos mensajes salieron hoy.
- Espaciado global de tandas en el bot.
