# Encontrar clientes — el mapa como centro de operaciones de prospección

**Fecha:** 2026-08-31
**Origen:** PDF de Tomás `~/Documents/Mapa debe tener mas estrategia para poder dar con clientes potenciales….pdf` (frente 1; el frente 2, "Zak unificado", se cerró en la PR #12)
**Reemplaza:** la mitad de descubrimiento de `docs/superpowers/specs/2026-08-11-admin-panel-mapa-crm-design.md`

## El problema

`/admin/mapa` hoy es un buscador de texto con mapa: tres chips fijos (Madrid,
Ubaté, Bogotá), una caja donde escribes «ferreterías en Ubaté», y pines que
importas de a uno. Tiene tres límites que impiden usarlo para conseguir clientes:

1. **No hay territorio.** Solo puedes buscar donde alguien codificó un chip.
2. **No hay memoria.** Cada búsqueda empieza de cero: no sabes qué barriste ayer,
   cuánto llevas cubierto de un municipio, ni cuánto has gastado en Google.
3. **No hay señal de venta.** El sitio web ya se guarda (`negocios.sitio_web`)
   pero solo se ve dentro de la ficha, nunca como criterio para decidir a quién
   llamar.

Lo pedido, literal: *"que pueda delinear una area del mapa y pueda sacar los
negocios potenciales, lograr ver si tienen pagina web o algo (…) hay que hacerlo
un centro de operaciones logístico para conseguir clientes"*.

## Decisiones de producto (Tomás, 2026-08-31)

| Decisión | Elegido | Descartado |
|---|---|---|
| Modo de uso | **Censo del área**: dibujo un municipio y quiero todo lo que hay | Cacería enfocada; censo incremental por oficio |
| Costo | **Estimar y confirmar** antes de barrer | Techo mensual duro; sin frenos |
| Señal de lead | **Sin web = mejor lead** (le vendemos marca + sitio) | Con web = mejor lead; etiquetar por producto; solo mostrarlo |
| Sidebar | **Una entrada, dos caras** (Territorio · Leads) | Dos entradas renombradas; una sola pantalla partida |
| Memoria | **Territorios persistidos** | Barrido efímero |

## Restricciones de la Places API (verificadas contra la doc, 2026-08-31)

Estas restricciones no son detalles de implementación: definen la arquitectura.

- **Google no acepta polígonos.** `Nearby Search (New)` solo acepta **círculo**
  en `locationRestriction` (radio máx. 50 km, **máx. 20 resultados, sin
  paginación**). `Text Search (New)` solo acepta **rectángulo**, 20 por página y
  **tope duro de 60 resultados** con `pageToken`.
  → El recorte por polígono lo hacemos nosotros.
- **No existe filtro "tiene sitio web".** `websiteUri` se pide en el FieldMask y
  se filtra en nuestro lado. Ya está en el FieldMask actual: filtrar es gratis.
- **Tiers de campos.** `formattedAddress`, `location`, `types` son *Essentials*;
  `displayName`, `businessStatus`, `addressComponents` son *Pro*;
  `nationalPhoneNumber`, `websiteUri`, `rating` son **Enterprise**.
- **Precio.** Nearby Search Enterprise = **US$35 / 1.000 llamadas**, con **1.000
  llamadas gratis al mes**. Pro = US$32 con 5.000 gratis, pero pierde teléfono y
  web, que es justo lo que necesitamos.
  → **Bajar de tier no sirve. Lo que hay que minimizar es el número de llamadas.**

Corolario que manda sobre el diseño del barrido: como cada llamada devuelve
máximo 20 negocios, un censo obliga a partir el área en teselas **y** a repetir
por oficio.

## Modelo de datos

### `territorios` (tabla nueva)

```sql
create table public.territorios (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(nombre) between 1 and 120),
  poligono       jsonb not null,             -- [{lat,lng}, …] cerrado
  bbox_sur       double precision not null,  -- caja envolvente desnormalizada
  bbox_norte     double precision not null,
  bbox_oeste     double precision not null,
  bbox_este      double precision not null,
  verticales     text[] not null default '{}',
  teselas_hechas jsonb not null default '[]',
  llamadas       int  not null default 0,
  ultimo_barrido timestamptz,
  creado_por     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

- **`bbox_*` desnormalizada** para responder "¿qué territorios tocan esta vista?"
  sin abrir el `jsonb` en cada consulta.
- **`teselas_hechas`** es lo que permite reanudar sin volver a pagar (ver
  "Reanudar" más abajo).
- **`llamadas`** es el gasto acumulado del territorio, auditable en pantalla.
- RLS: solo admin, igual que `negocios` (`supabase/rls.sql`).
- Trigger `updated_at`, igual que las demás tablas del esquema.

**Sin PostGIS, a propósito.** El recorte por polígono ocurre en TypeScript sobre
los ≤20 resultados que Google acaba de devolver, y los territorios se cuentan por
decenas. Una extensión de Postgres aquí es complejidad de operación que no compra
nada.

### Migración de `negocios`

```sql
alter table public.negocios add column territorio_id uuid
  references public.territorios (id) on delete set null;
create index if not exists negocios_territorio_idx on public.negocios (territorio_id);

alter table public.negocios alter column ciudad drop default;
alter table public.negocios alter column ciudad type text using ciudad::text;
update public.negocios set ciudad = null where ciudad = 'otra';
drop type public.ciudad;
```

El enum `public.ciudad` (`madrid|ubate|bogota|otra`) solo lo usa la columna
`negocios.ciudad` — nada más en el esquema depende de él, así que el `drop type`
es seguro. `ciudad` pasa a **texto libre**.

### Efectos en el código

- `Ciudad` y `CIUDADES` desaparecen de `src/lib/admin/negocios.ts`.
  `Negocio["ciudad"]` pasa a `string | null`.
- `inferirCiudad()` (substring-match de "madrid"/"ubate"/"bogota" sobre la
  dirección) se reemplaza por `localidadDe(addressComponents)`, que lee la
  localidad real que devuelve Google. **`addressComponents` es tier Pro y ya
  pagamos Enterprise por el teléfono: no sube la factura.** El FieldMask tiene un
  comentario advirtiendo que no se añadan campos sin mirar el precio — este se
  verificó.
- Arrastre: `FichaNegocio.ciudad` en `src/lib/admin/zak.ts:244` sigue el tipo
  solo; el filtro de ciudad de `NegociosView` deja de leer una constante y se
  arma con las ciudades presentes en la base.

## El barrido

### 1. Dibujar

Polígono dibujado a mano, clic a clic, con `google.maps.Polygon`.
**No se usa `DrawingManager`**: la Drawing Library de Google se deprecó en agosto
de 2025 y dejó de estar disponible en la v3.65 (mayo de 2026) — su constructor
lanza error, sin degradación. Google endosa Terra Draw como reemplazo, pero para
colocar vértices con clics no compensa una dependencia nueva. El territorio **se guarda con nombre antes de poder barrerse**:
barrer algo sin nombre es gastar plata en algo que no vas a poder volver a mirar.

### 2. Teselar

Nearby Search solo acepta círculos, así que cubrimos la caja del polígono con una
rejilla de círculos de **radio 400 m** separados `r·√2` — la separación que
garantiza cobertura sin huecos con una rejilla cuadrada.

**Las celdas cuyo cuadrado no intersecta el polígono se descartan.** Dibujar una
franja delgada a lo largo de una avenida cuesta lo que mide la franja, no lo que
mide su caja envolvente.

Madrid (Cundinamarca) urbano, ~10 km² → ~31 celdas.

### 3. Consultar por vertical

Una consulta por celda × vertical, con `includedTypes` de Nearby Search. Las
verticales son **las 10 que ya existen** en `src/lib/admin/zak.ts`
(`VERTICALES_PROSPECCION`: restaurante, panadería, ferretería, veterinaria,
droguería, belleza, taller, hogar, moda, comercio), cada una con su plantilla de
WhatsApp ya asociada — lo que entra por el censo ya sabe con qué plantilla se le
habla.

Los `matchers` existentes son substrings para clasificar `negocios.categoria` y
**no sirven** como `includedTypes`, que exige identificadores exactos de Google.
Se añade un mapeo nuevo `vertical → includedTypes[]` en
`src/lib/admin/verticales-places.ts`.

Barrer todas las verticales juntas satura cada consulta de inmediato; barrer por
vertical mantiene cada consulta muy por debajo del techo de 20.

**31 celdas × 10 verticales = 310 llamadas ≈ US$10,85**, y las primeras 1.000 del
mes son gratis.

### 4. Subdivisión adaptativa

Si una consulta devuelve **exactamente 20** resultados, la celda está saturada:
hay negocios que no viste. El servidor lo reporta (`saturada: true`), el cliente
parte esa celda en 4 y reconsulta **solo esa vertical**. Profundidad máxima 2
(hasta 16 subceldas por celda saturada).

Si al fondo sigue saturada, la pantalla lo dice — un censo incompleto que se
declara incompleto es útil; uno que se declara completo es una mentira cara.

Así solo se paga resolución donde hay densidad.

### 5. Recortar, filtrar, escribir

1. **Recorte por polígono.** Los círculos se desbordan del área dibujada; *ray
   casting* (`puntoEnPoligono`) descarta lo de afuera.
2. **Contactabilidad.** Se mantiene la regla vigente — **sin teléfono no hay
   venta** — pero contando lo descartado, no escondiéndolo:
   *"412 encontrados · 89 sin teléfono · 312 nuevos · 11 ya estaban"*.
3. **Escritura directa.** El barrido escribe a `negocios` en estado `nuevo` con
   `territorio_id`. Importar de a uno tiene sentido para una búsqueda de texto;
   para 312 negocios es absurdo. El flujo de importar selectivo se conserva solo
   para la búsqueda de texto suelta.
4. **Dedupe.** Insert que ignora conflictos de `google_place_id` (que ya es
   `unique`). **Re-barrer nunca pisa el estado del pipeline ni las notas de un
   lead ya trabajado.**

### 6. Dónde corre el bucle

**En el navegador.** El cliente calcula el plan (función pura compartida con el
servidor), muestra la estimación, y al confirmar recorre las teselas **de a 4 en
paralelo** contra `POST /admin/api/territorio/[id]/barrer`.

Razón: 310–600 llamadas a Google no caben cómodas en un request de Vercel, y el
bucle en el cliente da progreso real, botón de pausar y cero infraestructura
nueva. El servidor conserva la API key (nunca baja al browser) y **valida que el
círculo pedido caiga dentro del territorio guardado**, para que el endpoint no
sea un proxy con el que barrer Colombia entera a nombre de Zakumi.

### 7. Estimar y confirmar

Antes de barrer, un diálogo con la cuenta hecha:

> **Madrid centro** — 31 teselas × 10 verticales = **310 llamadas ≈ US$10,85**.
> Puede subir hasta ~US$15 si hay zonas densas.
> Este territorio lleva 0 llamadas gastadas.

### 8. Reanudar sin volver a pagar

Cada tesela completada se anota en `territorios.teselas_hechas`. Si se cierra la
pestaña a mitad de camino, lo barrido ya está en la base y al volver el barrido
**retoma donde iba** en vez de recomprarle a Google lo ya comprado. Es la
diferencia entre perder 40 segundos y perder US$7.

Tiempo total de un censo de 310 llamadas, con concurrencia 4: **~20 segundos**.

## La pantalla

Ruta nueva **`/admin/prospeccion`**, entrada de sidebar **"Encontrar clientes"**.
`/admin/mapa` y `/admin/negocios` **redirigen** ahí: dos puertas a la misma cosa
se desincronizan (lección de la PR #12 con `/admin/voz/<id-de-Zak>`).

Dos caras arriba, dibujadas como **tarjetas y no como `<Tabs>`** — el patrón de
`CarasZak.tsx`: si se vieran igual que las pestañas de adentro, los dos niveles
se leen como uno.

### 🗺 Territorio

- Mapa a pantalla completa dentro del `Cockpit` (sin scroll de página).
- Isla flotante a la izquierda: tus territorios con su cobertura —
  *"Madrid centro · 312 leads · 89 sin web · barrido hace 3 días"* — y el botón
  **Dibujar territorio**.
- Barra de progreso del barrido con pausar/reanudar mientras corre.
- El buscador de texto sobrevive para consultas sueltas, pero deja de ser el
  protagonista.

### 📇 Leads

`NegociosView` tal cual, más: filtro **"solo sin web"**, filtro por territorio y
columna de sitio web. El filtro de ciudad se arma con las ciudades presentes en
la base.

### Los pines dicen dos cosas a la vez

Hoy el **color** del rombo es el estado del pipeline y el **contorno naranja sin
relleno** significa "resultado de búsqueda sin importar". Ese contorno **sigue
ocupado**: la búsqueda de texto suelta se conserva y sigue produciendo
resultados sin importar. Así que "sin web" necesita un eje propio:

- **Color del relleno** = estado del pipeline (sin cambios).
- **Contorno naranja sin relleno** = resultado sin importar (sin cambios).
- **Anillo alrededor del rombo** = **sin sitio web** (el lead que queremos).

Tres señales en tres canales distintos —relleno, contorno, anillo— que no se
pisan entre sí. Un vistazo al mapa y se ve dónde está el dinero.

### URL

Una sola pestaña en la URL (`?tab=`), con la lógica pura en
`src/lib/admin/prospeccion-caras.ts`, copiando `zak-caras.ts`. Un solo parámetro
no puede contradecirse a sí mismo.

## Archivos

**Nuevos**

| Archivo | Qué es |
|---|---|
| `supabase/prospeccion.sql` | `territorios` + RLS + migración de `ciudad` |
| `src/lib/admin/barrido.ts` | **Puro**: `teselar`, `celdaTocaPoligono`, `puntoEnPoligono`, `estimarBarrido`, `esSaturada` |
| `src/lib/admin/territorios.ts` | Tipos y acceso a datos de territorios |
| `src/lib/admin/verticales-places.ts` | **Puro**: `vertical → includedTypes[]` de Google |
| `src/lib/admin/prospeccion-caras.ts` | **Puro**: `caraDe`, `pestanaInicial` |
| `src/app/admin/(panel)/prospeccion/page.tsx` | La pantalla |
| `src/app/admin/api/territorio/[id]/barrer/route.ts` | Una tesela: Google → recorte → filtro → insert |
| `src/components/admin/prospeccion/*` | `CarasProspeccion`, `TerritorioView`, `PanelTerritorios`, `DibujarTerritorio`, `BarridoProgreso`, `useBarrido` |

**Modificados**

- `src/lib/admin/negocios.ts` — fuera `Ciudad`/`CIUDADES`; `ciudad: string | null`
- `src/lib/admin/places.ts` — `localidadDe()` en vez de `inferirCiudad()`
- `src/app/admin/api/places/search/route.ts` — `addressComponents` al FieldMask
- `src/components/admin/Sidebar.tsx` — una entrada "Encontrar clientes"
- `src/components/admin/negocios/NegociosView.tsx` — filtros de web y territorio
- `src/components/admin/mapa/MapCanvas.tsx` — polígonos, relleno/hueco por web

**Deuda que se paga en el camino:** `MapaView` tiene 250 líneas y le entra
dibujo, territorios, barrido y progreso. Se parte al moverlo a
`TerritorioView` + los componentes de arriba, no después.

## Pruebas

Vitest (`npm test`), en `src/lib/admin/__tests__/`. El riesgo real vive en las
funciones puras, y todas son testeables sin red:

- `teselar` — cobertura sin huecos; celdas fuera del polígono descartadas;
  polígono degenerado (3 puntos, área ~0) no explota.
- `puntoEnPoligono` — dentro, fuera, sobre el borde, polígono cóncavo.
- `estimarBarrido` — celdas × verticales; el número que se le muestra a Tomás
  antes de gastar.
- `esSaturada` — 20 resultados sí, 19 no.
- `verticalATypes` — toda vertical del catálogo tiene al menos un type.
- `localidadDe` — direcciones colombianas reales, y `null` cuando Google no manda
  localidad.
- `caraDe` / `pestanaInicial` — espejo de los 9 tests de `zak-caras.ts`.

## Errores

| Caso | Comportamiento |
|---|---|
| `429` de Google (cuota) | **Pausa** el barrido y lo dice. No lo mata: se reanuda con las teselas ya hechas. |
| Timeout / red en una tesela | Un reintento; luego se marca la tesela como fallida y el barrido sigue. |
| Celda saturada a profundidad máxima | Se reporta en el resumen: el censo se declara incompleto en esa zona. |
| Territorio sin resultados | Se dice explícitamente, no se deja el mapa mudo. |
| Falta `GOOGLE_PLACES_API_KEY` | El comportamiento actual del handler (ya cubierto). |

## Orden de despliegue

**`supabase/prospeccion.sql` primero, deploy después.** La migración quita el
enum `ciudad`; si el código nuevo sube antes que el SQL, la lista de leads se
cae. Es el mismo patrón de orden de encendido que ya está documentado para el
portal de clientes.

## Fuera de alcance (a propósito)

- **Techo mensual duro de llamadas.** Se eligió estimar y confirmar. Añadirlo
  exige persistir un contador mensual; se puede hacer después sin tocar nada de
  esto.
- **Follow-up de seguridad de Maps.** `/admin/mapa` carga
  `maps.googleapis.com` sin pin, la misma exposición que motivó vendorizar el
  widget de ElevenLabs. Es un fix chico e independiente: meterlo aquí solo
  retrasa el censo.
- **Auto-llamar o auto-escribir a lo barrido.** El censo llena la base; las
  tandas de Zak siguen siendo un acto deliberado.

## Riesgos

1. **El costo depende del dibujo.** Un polígono que abarque Bogotá entera son
   miles de llamadas. Mitigado por la estimación con confirmación, pero no
   bloqueado — un clic apurado sobre "Barrer" puede costar caro. Si esto pasa una
   vez, el techo mensual duro deja de ser opcional.
2. **La subdivisión adaptativa puede subestimar.** El tope de profundidad 2
   acota el gasto pero admite que en zonas muy densas el censo quede corto. Se
   declara en pantalla en vez de fingir completitud.
3. **`drop type public.ciudad` no tiene vuelta atrás** en el mismo deploy.
   Verificado que ninguna otra tabla lo usa; aun así el SQL corre antes y a mano.
