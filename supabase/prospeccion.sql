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
-- ============================================================================

begin;

create table if not exists public.territorios (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(nombre) between 1 and 120),
  -- [{lat,lng}, …]. Sin PostGIS a propósito: el recorte por polígono corre en
  -- TypeScript sobre los ≤20 resultados que Google acaba de devolver.
  poligono       jsonb not null,
  -- Caja envolvente desnormalizada: "¿qué territorios tocan esta vista?" sin
  -- abrir el jsonb.
  bbox_sur       double precision not null check (bbox_sur between -90 and 90),
  bbox_norte     double precision not null check (bbox_norte between -90 and 90),
  bbox_oeste     double precision not null check (bbox_oeste between -180 and 180),
  bbox_este      double precision not null check (bbox_este between -180 and 180),
  verticales     text[] not null default '{}',
  -- Claves "lat,lng@radio#vertical" ya barridas: permite reanudar sin volver a
  -- pagarle a Google lo ya comprado.
  teselas_hechas jsonb not null default '[]',
  llamadas       int not null default 0 check (llamadas >= 0),
  ultimo_barrido timestamptz,
  creado_por     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

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
create or replace function public.anotar_tesela(
  p_territorio uuid,
  p_clave      text,
  p_vertical   text
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
         verticales     = case when p_vertical = any(verticales)
                                then verticales
                                else array_append(verticales, p_vertical) end,
         ultimo_barrido = now()
   where id = p_territorio;
end;
$$;

-- ---- negocios: territorio de origen ------------------------------------------

alter table public.negocios
  add column if not exists territorio_id uuid
  references public.territorios (id) on delete set null;

create index if not exists negocios_territorio_idx on public.negocios (territorio_id);

-- ---- muerte del enum ciudad ---------------------------------------------------
-- Con territorios libres, un enum de tres municipios es una jaula. Verificado
-- que public.ciudad SOLO lo usa negocios.ciudad.

alter table public.negocios alter column ciudad drop default;
-- La columna nació `not null default 'otra'` (schema.sql:35). Sin quitar el
-- NOT NULL, el UPDATE de abajo revienta con 23502 — y lo haría DESPUÉS de
-- reescribir el tipo, dejando la migración a medias.
alter table public.negocios alter column ciudad drop not null;
alter table public.negocios alter column ciudad type text using ciudad::text;
update public.negocios set ciudad = null where ciudad = 'otra';
drop type if exists public.ciudad;

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
revoke all on function public.anotar_tesela(uuid, text, text) from public, anon;
grant execute on function public.anotar_tesela(uuid, text, text) to authenticated;

commit;
