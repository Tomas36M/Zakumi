-- ============================================================================
-- Territorios de prospección — el mapa deja de estar atado a tres municipios.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de rls.sql. Idempotente.
-- Spec: docs/superpowers/specs/2026-08-31-mapa-prospeccion-design.md
--
-- ⚠️ ORDEN: este archivo corre ANTES de desplegar el código nuevo. Quita el
-- enum public.ciudad; si el código nuevo sube primero, la lista de leads se cae.
-- ============================================================================

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

-- ---- negocios: territorio de origen ------------------------------------------

alter table public.negocios
  add column if not exists territorio_id uuid
  references public.territorios (id) on delete set null;

create index if not exists negocios_territorio_idx on public.negocios (territorio_id);

-- ---- muerte del enum ciudad ---------------------------------------------------
-- Con territorios libres, un enum de tres municipios es una jaula. Verificado
-- que public.ciudad SOLO lo usa negocios.ciudad.

alter table public.negocios alter column ciudad drop default;
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
