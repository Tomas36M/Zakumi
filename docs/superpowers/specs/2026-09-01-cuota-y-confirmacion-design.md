# Cuota gratuita y confirmación reforzada del gasto

**Fecha:** 2026-09-01
**Origen:** Tomás vio `Barrer y gastar US$ 42,00` y preguntó si había forma de conseguir los datos sin pagar. La hay —Google no cobra las primeras 1.000 consultas del mes— pero el panel no lo sabía. Y de ahí salió el pedido de fondo: *"siempre que se vaya a pagar algo se debe mostrar una advertencia y pedir un código, para prevenir malentendidos"*.
**Motivo real, en sus palabras:** *"es por si alguien del equipo entra y no conoce bien aún la interfaz"*.

## El problema

`/admin/prospeccion` gasta dinero por petición y hoy tiene dos huecos:

1. **No sabe cuánto lleva gastado este mes.** `territorios.llamadas` es un contador acumulado desde siempre, sin fecha. No se puede responder "¿cuánto va del mes?" ni "¿por qué gasté US$40 el martes?" — la auditoría de buenas prácticas ya lo señaló como su hallazgo principal, y sigue abierto.
2. **Un clic basta para gastar.** El diálogo muestra el monto y eso frena a quien lee. A quien no conoce la pantalla, no.

## Decisiones de producto (Tomás, 2026-09-01)

| Decisión | Elegido | Descartado |
|---|---|---|
| De dónde sale el consumo del mes | **Que el panel lleve la cuenta** (tabla propia con fechas) | Preguntarle a Google (Cloud Monitoring); un tope manual por tanda |
| Cuándo pedir confirmación escrita | **Solo cuando el barrido supere la cuota gratuita** | Siempre; por encima de un monto fijo |
| Al agotarse la cuota | **Avisar fuerte, no bloquear** | Bloquear hasta el mes siguiente |
| Qué se escribe para confirmar | **El monto** | Una palabra tipo "BARRER" |

## Por qué cada una

**La cuenta propia, no la de Google.** Integrar Cloud Monitoring daría el número exacto y contaría todo lo que consuma la key, pero cuesta una cuenta de servicio, credenciales nuevas y una API más que puede caerse — y habría que decidir qué hace el botón cuando falla. La cuenta propia es aproximada **por lo bajo** (no ve lo que gaste la búsqueda de texto suelta, que usa la misma key) y a cambio no depende de nadie. Y resuelve de paso el hallazgo abierto de la auditoría: sin registro con fechas, el contador de gasto no se puede reconciliar nunca contra la factura de Google.

**La fricción solo donde cuesta.** Una confirmación que se escribe siempre se convierte en memoria muscular: a las dos semanas se teclea sin leer y deja de proteger. Atarla a la frontera gratis/pagado la pone exactamente donde el dinero empieza, que además es la frontera que al usuario le importa.

**Avisar y no bloquear.** Censar un municipio cuesta entre US$11 y US$42, y ese es el caso de uso central. Bloquear ahí inutilizaría la herramienta justo cuando empieza a servir, y le impediría gastar a quien sí sabe lo que hace sin proteger mejor a quien no.

**Se escribe el monto.** Una palabra fija se copia sin pensar. Un monto hay que ir a buscarlo al botón, y para copiarlo hay que mirarlo — que es justo lo que le falta a quien no conoce la pantalla.

**Cómo esto protege al que llega nuevo.** Entra, no entiende la interfaz, le da a Barrer. Si el barrido cabe en lo gratis, barre y no cuesta nada: aprendió usando, sin daño. Si cuesta, tiene que escribir el monto, y para escribirlo tiene que leerlo. La protección cae exactamente donde hace falta.

## Modelo de datos

### `consultas_places` (tabla nueva)

Una fila por consulta facturada. Es el registro que hoy no existe.

```sql
create table if not exists public.consultas_places (
  id           bigint generated always as identity primary key,
  territorio_id uuid references public.territorios (id) on delete set null,
  clave        text,          -- clave de trabajo: "lat,lng@radio#vertical"
  vertical     text,
  resultados   int,           -- lo que devolvió Google, para calibrar saturación
  insertados   int,
  origen       text not null default 'barrido'
                 check (origen in ('barrido', 'busqueda')),
  creado_en    timestamptz not null default now()
);

create index if not exists consultas_places_creado_en_idx
  on public.consultas_places (creado_en desc);
```

- **`on delete set null`** en `territorio_id`: borrar un territorio no puede borrar el registro de lo que se pagó por él. El gasto ocurrió.
- **`origen`** deja sitio a la búsqueda de texto suelta, que también factura contra la misma key y hoy no se cuenta. Registrarla es parte de esta spec: sin ella el conteo se queda corto justo en lo que el usuario no ve.
- **Sin `costo`**: el precio es una constante del código (`PRECIO_POR_LLAMADA_USD`). Guardar el importe duplicaría una verdad que ya existe y se desincronizaría el día que Google cambie la tarifa.
- RLS solo admin, mismo patrón que `territorios`; `revoke all from anon`.

**Por qué una tabla y no un contador mensual.** Un contador `int` por mes sería más barato, pero no responde "¿por qué gasté US$40 el martes?" — que es la mitad del valor. La fila por consulta da el conteo *y* la trazabilidad, y es la tabla que la auditoría ya recomendaba para el crecimiento de `teselas_hechas`.

### Escritura

Hay **dos escritores**, porque hay dos rutas que le pagan a Google.

**El barrido** (`origen = 'barrido'`). `anotar_tesela` ya hace el `UPDATE` atómico del contador; se le añade el `insert` en `consultas_places` **dentro de la misma función**, para que contar y registrar no puedan divergir. Gana los parámetros que la fila necesita (`p_resultados`, `p_insertados`) y sube a seis argumentos.

**El `drop function` explícito de la firma de cuatro sigue siendo obligatorio** antes del `create or replace`: cambiar la aridad deja las dos versiones conviviendo. Es la misma trampa que ya nos tocó una vez, y la base del usuario ya tiene aplicadas dos versiones distintas.

**La búsqueda de texto suelta** (`origen = 'busqueda'`). No pasa por `anotar_tesela` —vive en `src/app/admin/api/places/search/route.ts` y no toca territorios—, así que inserta su propia fila directamente, con `territorio_id`, `clave` y `vertical` en `null`. Si este insert falla, la búsqueda **no** falla: se registra en el log y se devuelven los resultados igual. Perder una anotación es peor que perder una búsqueda ya pagada, pero mucho menos malo que romper la búsqueda.

### Lectura

```ts
/** Consultas facturadas en el mes calendario en curso, hora del servidor. */
consultasDelMes(): Promise<number>
```

Una sola consulta agregada con el índice de `creado_en`. Se lee en la página de prospección y viaja como prop, igual que los territorios.

**Es un piso, no la verdad.** Cuenta lo que este panel gastó desde que existe la tabla. No ve consumo anterior a esta migración, ni el de cualquier otra cosa que use la misma key. La pantalla debe decirlo con esas palabras: *"según lo que este panel lleva registrado"*.

## Cuota

```ts
export const CUOTA_GRATIS_MENSUAL = 1_000;
```

Verificado el 2026-09-01 en la tabla de precios de Google Maps Platform: el SKU *Places API Nearby Search Enterprise* (`772E-9975-BE34`) tiene **Free Usage Cap 1.000** al mes. Si Google la cambia, cambia esta constante — y el comentario debe decir dónde se comprueba.

### `barrer solo lo gratis`

Segundo botón en el diálogo, junto al de barrer completo. Toma el plan de la tanda y lo **recorta** a las consultas que caben en lo que queda de cuota:

```ts
recortarACuota(plan: Trabajo[], restantes: number): Trabajo[]
```

Función pura, con tests. Si `restantes <= 0` devuelve vacío y el botón no se ofrece. Si el plan entero cabe, el botón tampoco se ofrece — sería idéntico al principal, y dos botones que hacen lo mismo confunden.

**El recorte deja el territorio a medias a propósito, y la pantalla lo dice.** Lo barrido queda en `teselas_hechas` y reanudar el mes siguiente no lo vuelve a pagar: es la misma promesa de reanudar que ya existe, aplicada a la frontera del mes.

## Confirmación escrita

Cuando la tanda **supera lo que queda de cuota**, el botón de barrer completo se deshabilita hasta que se escriba el monto exacto que muestra.

- El campo compara contra el monto formateado sin el símbolo (`42,00`), tolerando espacios. Ni la palabra "gastar" ni un texto fijo: **el número**.
- Debajo, una línea que diga cuánto de la tanda es gratis y cuánto se paga.
- Si la tanda cabe entera en la cuota, **no hay campo**: un clic y a barrer. La fricción aparece solo cuando empieza el gasto.

**Accesibilidad:** el campo lleva su `label`, el botón deshabilitado explica por qué con `aria-describedby`, y el foco no salta solo — quien navega con teclado no puede confirmar sin haber pasado por el campo.

## Pantalla

- **En el diálogo**, sobre el bloque de costo: *"Este mes llevas N de 1.000 consultas gratis, según lo que este panel lleva registrado."*
- **Cuando la tanda se pasa**: cuántas consultas son gratis, cuántas se pagan, y el campo del monto.
- **Cuando la cuota está agotada**: se dice, con el enlace a las métricas de Google Cloud que ya existe, y se sigue pudiendo barrer escribiendo el monto. **No se bloquea.**

## Fuera de alcance

- **Permiso de gasto por perfil.** Es la salida correcta si algún día entra al panel gente que no debe gastar nunca — hoy todos son `admin` y no hay esa granularidad. Cuando haga falta, va en `perfiles`, no en un tope.
- **Leer el consumo real de Google.** Descartado arriba por costo. Si el gasto crece hasta que el piso no alcance, Cloud Monitoring es el siguiente paso.
- **Cambiar el nombre de la columna `territorios.llamadas`.** Sigue siendo correcto: son llamadas a una API.

## Riesgos

1. **El conteo es un piso.** Alguien puede creerse dentro de la cuota y estar fuera, porque el consumo previo a esta tabla no se ve y la búsqueda suelta empezó a contarse solo ahora. Mitigado diciéndolo en pantalla; el enlace a las métricas de Google queda como la fuente de verdad.
2. **La confirmación escrita puede erosionarse igual.** Si el equipo acaba barriendo siempre por encima de la cuota, escribir el monto vuelve a ser rutina. Si eso pasa, la respuesta no es más fricción sino el permiso por perfil.
3. **`anotar_tesela` sube a seis argumentos.** Es la segunda vez que cambia de firma; el `drop function` explícito de la anterior no es opcional, y el usuario ya tiene aplicadas dos versiones distintas en su base.
