-- ============================================================================
-- Panel de admin Zakumi — esquema de negocios (prospección) y notas.
-- Ejecutar en el SQL Editor de Supabase. Idempotente: correr dos veces es seguro.
--
-- Seguridad: RLS activo en todas las tablas; solo el rol `authenticated` puede
-- operar (el panel exige sesión y el signup público está desactivado). La
-- service-role key NUNCA se usa desde la app.
-- ============================================================================

-- ---- Enums -----------------------------------------------------------------

do $$ begin
  create type public.ciudad as enum ('madrid', 'ubate', 'bogota', 'otra');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_negocio as enum
    ('nuevo', 'contactado', 'respondido', 'interesado', 'cliente', 'descartado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_telefono as enum ('movil', 'fijo', 'desconocido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fuente_negocio as enum ('places', 'manual');
exception when duplicate_object then null; end $$;

-- ---- Tablas ----------------------------------------------------------------

create table if not exists public.negocios (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(nombre) between 1 and 300),
  direccion       text,
  ciudad          public.ciudad not null default 'otra',
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  categoria       text,
  rating          numeric(2, 1) check (rating is null or (rating >= 1 and rating <= 5)),
  sitio_web       text,
  -- E.164: el mismo invariante que valida normalizarTelefonoCO() en la app.
  telefono        text check (telefono is null or telefono ~ '^\+[1-9][0-9]{6,14}$'),
  tipo_telefono   public.tipo_telefono not null default 'desconocido',
  google_place_id text unique,
  fuente          public.fuente_negocio not null default 'manual',
  estado          public.estado_negocio not null default 'nuevo',
  creado_por      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.notas (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  texto      text not null check (length(texto) between 1 and 4000),
  automatica boolean not null default false,
  autor      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---- Índices (filtros del panel + toda FK indexada) ------------------------

create index if not exists negocios_ciudad_idx     on public.negocios (ciudad);
create index if not exists negocios_estado_idx     on public.negocios (estado);
create index if not exists negocios_creado_por_idx on public.negocios (creado_por);
create index if not exists notas_negocio_idx       on public.notas (negocio_id, created_at desc);
create index if not exists notas_autor_idx         on public.notas (autor);

-- ---- Triggers ---------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists negocios_updated_at on public.negocios;
create trigger negocios_updated_at
  before update on public.negocios
  for each row execute function public.set_updated_at();

-- Cada cambio de estado deja rastro en las notas del negocio, también en los
-- cambios por lote (una nota por fila). Corre con el rol de la sesión: sin
-- SECURITY DEFINER, la política de INSERT de notas lo cubre.
create or replace function public.nota_cambio_estado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.notas (negocio_id, texto, automatica, autor)
    values (
      new.id,
      'Estado: ' || old.estado || ' → ' || new.estado,
      true,
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;

drop trigger if exists negocios_nota_estado on public.negocios;
create trigger negocios_nota_estado
  after update of estado on public.negocios
  for each row execute function public.nota_cambio_estado();

-- ---- RLS: solo usuarios autenticados, cero acceso anónimo -------------------

alter table public.negocios enable row level security;
alter table public.notas    enable row level security;

drop policy if exists negocios_crud_autenticados on public.negocios;
create policy negocios_crud_autenticados on public.negocios
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists notas_crud_autenticados on public.notas;
create policy notas_crud_autenticados on public.notas
  for all to authenticated
  using (true)
  with check (true);

-- Cinturón y tirantes: aunque alguien cree una política permisiva por error,
-- el rol anónimo no tiene ni el privilegio de tabla.
revoke all on public.negocios from anon;
revoke all on public.notas    from anon;
