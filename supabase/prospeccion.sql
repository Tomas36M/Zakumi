-- ============================================================================
-- Territorios de prospección — el mapa deja de estar atado a tres municipios.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de rls.sql.
-- Spec: docs/superpowers/specs/2026-08-31-mapa-prospeccion-design.md
--
-- ⚠️ ORDEN: este archivo corre ANTES de desplegar el código nuevo. Quita el
-- enum public.ciudad; si el código nuevo sube primero, la lista de leads se cae.
--
-- A diferencia de los demás supabase/*.sql (setup idempotente hacia adelante:
-- create table/function if not exists / or replace, seguro de re-correr), este
-- archivo va envuelto en una transacción explícita. Es el único que dropea un
-- tipo y reescribe una columna en su lugar — el único con un riesgo real de
-- quedar a medias. El DDL de Postgres es transaccional: si cualquier statement
-- falla, el BEGIN/COMMIT revierte TODO el archivo, no solo lo que falló.
--
-- ⚠️ RE-CORRER: es seguro, pero no porque cada statement lo sea por su cuenta.
-- El bloque "muerte del enum ciudad" NO es idempotente por sí mismo (su UPDATE
-- borraría ciudades escritas a mano y su ALTER TYPE reescribiría la tabla
-- entera) y por eso va guardado por `if exists (… pg_type …)`: en una base que
-- ya lo corrió, el enum ya no existe y el bloque entero se salta. Lo demás sí
-- es idempotente hacia adelante en el sentido normal (if not exists /
-- or replace / drop … if exists). Ver el detalle en ese bloque.
-- ============================================================================

begin;

create table if not exists public.territorios (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(nombre) between 1 and 120),
  -- [{lat,lng}, …]. Sin PostGIS a propósito: el recorte por polígono corre en
  -- TypeScript sobre los ≤20 resultados que Google acaba de devolver.
  poligono       jsonb not null,
  -- Caja envolvente desnormalizada. NO es para pintar el mapa: es el
  -- guardarraíl de gasto del servidor. El endpoint de barrido recibe el
  -- círculo del navegador, así que antes de pagarle una llamada a Google
  -- comprueba contra estos cuatro números que el círculo pedido cae dentro
  -- del territorio (circuloDentroDelTerritorio en barrido-servidor.ts) — sin
  -- parsear el jsonb del polígono, en el camino caliente que corre miles de
  -- veces por barrido.
  bbox_sur       double precision not null check (bbox_sur between -90 and 90),
  bbox_norte     double precision not null check (bbox_norte between -90 and 90),
  bbox_oeste     double precision not null check (bbox_oeste between -180 and 180),
  bbox_este      double precision not null check (bbox_este between -180 and 180),
  verticales     text[] not null default '{}',
  -- Claves "lat,lng@radio#vertical" ya barridas: permite reanudar sin volver a
  -- pagarle a Google lo ya comprado.
  teselas_hechas jsonb not null default '[]',
  -- Claves de las teselas que devolvieron el tope de 20 resultados. Sin esto,
  -- las 4 hijas de una celda saturada solo existen en la cola del navegador:
  -- cerrar la pestaña a mitad de barrido las pierde PARA SIEMPRE (la madre ya
  -- quedó en teselas_hechas, así que ningún plan futuro la vuelve a emitir) y
  -- las manzanas más densas —las que más vale la pena vender— desaparecen del
  -- censo sin que nada lo diga.
  teselas_saturadas jsonb not null default '[]',
  llamadas       int not null default 0 check (llamadas >= 0),
  ultimo_barrido timestamptz,
  creado_por     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- La columna va TAMBIÉN acá: en una base donde la tabla ya existe, el
-- `create table if not exists` de arriba no añade columnas nuevas. Las dos
-- formas son idempotentes (la de arriba se salta si la tabla existe, esta si
-- la columna existe), así que este par en concreto se puede re-correr sin
-- consecuencias.
alter table public.territorios
  add column if not exists teselas_saturadas jsonb not null default '[]';

create index if not exists territorios_creado_por_idx on public.territorios (creado_por);

drop trigger if exists territorios_updated_at on public.territorios;
create trigger territorios_updated_at
  before update on public.territorios
  for each row execute function public.set_updated_at();

-- ---- anotar_tesela: registrar una tesela barrida en UN solo UPDATE ----------
-- El route handler de Task 8 corre de a CONCURRENCIA=4 en paralelo (Task 10)
-- contra la misma fila de territorios. Un read-modify-write hecho desde la
-- app (leer llamadas/teselas_hechas, escribir de vuelta) pierde anotaciones
-- bajo esa carrera: dos requests leen llamadas=5, ambas escriben 6, una de
-- las dos teselas queda sin anotar — y al reanudar el barrido, Google cobra
-- otra vez por una tesela que ya se había pagado. Esta función hace las tres
-- cosas (contador, teselas_hechas, verticales) en un solo UPDATE atómico:
-- Postgres serializa los UPDATE concurrentes sobre la misma fila, así que no
-- hay ventana entre leer y escribir.
--
-- security invoker (no definer, a diferencia de registrar_llamada_voz en
-- voz.sql): quien llama esta función ya es la sesión admin autenticada del
-- route handler — la misma sesión que la policy territorios_solo_admin exige
-- — no un webhook sin sesión de usuario. Con invoker, el UPDATE de adentro
-- sigue pasando por esa policy: un no-admin que la invocara directo no
-- rompería nada (RLS no le deja ver ni tocar la fila), y no hace falta
-- reimplementar el check de es_admin() acá adentro. definer + grant a
-- authenticated habría abierto ese hueco (cualquier autenticado, incluido un
-- cliente del portal, tocando territorios de cualquiera sin pasar por RLS);
-- definer + grant a service_role (el patrón textual de voz.sql) habría hecho
-- la función imposible de llamar desde este handler, que nunca usa la
-- service-role key (server.ts es explícito: "la service-role key NO se usa
-- en la app").
--
-- teselas_hechas ? p_clave usa el operador jsonb "existe": true si p_clave ya
-- es un elemento del array. p_clave es la clave de TRABAJO (tesela#vertical,
-- claveTrabajo() en barrido.ts), no solo la de la tesela — una tesela se
-- barre una vez POR VERTICAL.
-- La firma cambió (entró p_saturada), y `create or replace` NO reemplaza una
-- función de aridad distinta: crearía una SEGUNDA anotar_tesela y dejaría dos
-- versiones vivas en las bases que ya corrieron este archivo. El drop explícito
-- de la firma vieja garantiza que quede exactamente una.
drop function if exists public.anotar_tesela(uuid, text, text);

-- p_saturada tiene default: durante la ventana entre correr este SQL y
-- desplegar el código nuevo, el código viejo sigue llamando con 3 argumentos y
-- no se rompe.
create or replace function public.anotar_tesela(
  p_territorio uuid,
  p_clave      text,
  p_vertical   text,
  p_saturada   boolean default false
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update territorios
     set llamadas       = llamadas + 1,
         teselas_hechas = case when teselas_hechas ? p_clave
                                then teselas_hechas
                                else teselas_hechas || to_jsonb(p_clave) end,
         -- Idéntico a teselas_hechas: append idempotente, y solo si saturó.
         teselas_saturadas = case
                               when not p_saturada then teselas_saturadas
                               when teselas_saturadas ? p_clave then teselas_saturadas
                               else teselas_saturadas || to_jsonb(p_clave) end,
         verticales     = case when p_vertical = any(verticales)
                                then verticales
                                else array_append(verticales, p_vertical) end,
         ultimo_barrido = now()
   where id = p_territorio;

  -- Sin esto, un territorio borrado entre el SELECT del handler y esta llamada
  -- hace que el UPDATE no toque ninguna fila, la función devuelva éxito y el
  -- handler reporte `contabilizada: true` para una llamada que se cobró y NO
  -- se contabilizó — exactamente lo que ese flag existe para no callar.
  --
  -- No filtra nada: con security invoker + RLS, un no-admin también ve 0 filas
  -- y recibe EXACTAMENTE este mismo error, así que no puede distinguir "no
  -- existe" de "existe y no es tuyo".
  if not found then
    raise exception 'territorio % no existe', p_territorio using errcode = 'no_data_found';
  end if;
end;
$$;

-- ---- negocios: territorio de origen ------------------------------------------

alter table public.negocios
  add column if not exists territorio_id uuid
  references public.territorios (id) on delete set null;

create index if not exists negocios_territorio_idx on public.negocios (territorio_id);

-- La pantalla de leads pide `negocios` ordenada por created_at desc en cada
-- carga. Antes de los territorios la tabla crecía de a 25 filas importadas a
-- mano y un sort en memoria no se notaba; un barrido mete miles de una tanda.
create index if not exists negocios_created_at_idx on public.negocios (created_at desc);

-- ---- muerte del enum ciudad ---------------------------------------------------
-- Con territorios libres, un enum de tres municipios es una jaula. Verificado
-- que public.ciudad SOLO lo usa negocios.ciudad.
--
-- ⚠️ ESTE BLOQUE CORRE UNA SOLA VEZ EN LA VIDA DE LA BASE, y por eso va
-- entero dentro de la guarda de existencia del enum. Suelto sería destructivo
-- al re-correr el archivo:
--   · `update … set ciudad = null where ciudad = 'otra'` es correcto EXACTAMENTE
--     mientras 'otra' sea el valor del enum que la columna traía por default
--     (schema.sql:35) y que por tanto no distinguía nada: colapsarlo a NULL no
--     pierde información. Con la columna ya en texto libre, "otra" pasa a ser
--     lo que un humano escribió a mano en la ficha — y el mismo UPDATE le
--     borraría la ciudad a todos esos negocios.
--   · `alter column ciudad type text` tampoco es gratis dos veces: reescribe la
--     tabla ENTERA y reconstruye sus índices, justo la tabla que este feature
--     existe para llenar de miles de filas.
-- Con la guarda, en una base que ya migró el enum no existe, el bloque no se
-- ejecuta, y re-correr el archivo es un no-op.
do $$
begin
  if exists (
    select 1
      from pg_type
     where typname = 'ciudad'
       and typnamespace = 'public'::regnamespace
  ) then
    alter table public.negocios alter column ciudad drop default;
    -- La columna nació `not null default 'otra'` (schema.sql:35). Sin quitar el
    -- NOT NULL, el UPDATE de abajo revienta con 23502 — y lo haría DESPUÉS de
    -- reescribir el tipo, dejando la migración a medias.
    alter table public.negocios alter column ciudad drop not null;
    alter table public.negocios alter column ciudad type text using ciudad::text;
    update public.negocios set ciudad = null where ciudad = 'otra';
    drop type public.ciudad;
  end if;
end;
$$;

-- ---- RLS: CRM interno, solo admin (mismo patrón que negocios) ------------------

alter table public.territorios enable row level security;

drop policy if exists territorios_solo_admin on public.territorios;
create policy territorios_solo_admin on public.territorios
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

revoke all on public.territorios from anon;

-- anotar_tesela es security invoker: RLS (territorios_solo_admin, arriba) es
-- la barrera real. El revoke/grant explícito es defensa en profundidad, no
-- la única puerta — sigue el estilo explícito de voz.sql en vez de confiar
-- en el grant a PUBLIC por defecto de Postgres en una función nueva.
revoke all on function public.anotar_tesela(uuid, text, text, boolean) from public, anon;
grant execute on function public.anotar_tesela(uuid, text, text, boolean) to authenticated;

commit;
