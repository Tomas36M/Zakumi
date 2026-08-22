-- ============================================================================
-- Perfiles y roles — prerrequisito del portal de clientes (/app).
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de cartera.sql. Idempotente.
--
-- ⚠️ ANTES DE CORRER: edita el seed de admins (busca "EDITAR AQUÍ") con los
-- correos reales de las cuentas de Tomás/Paula. Si nadie queda como admin,
-- el panel se queda ciego al correr rls.sql (queries vacías, no rotas).
--
-- Cada usuario de auth.users tiene UN perfil: rol (admin|cliente) y el
-- vínculo opcional a la fila de `clientes` de la cartera. El perfil se crea
-- solo al signup (trigger). Los helpers es_admin() / mi_cliente_id() son la
-- base de todas las políticas de rls.sql: son SECURITY DEFINER (dueño
-- postgres) a propósito — leen perfiles sin re-disparar sus propias
-- políticas, que es el patrón estándar para evitar recursión de RLS.
-- ============================================================================

-- ---- Enum de rol -------------------------------------------------------------

do $$ begin
  create type public.rol_usuario as enum ('admin', 'cliente');
exception when duplicate_object then null; end $$;

-- ---- Tabla -------------------------------------------------------------------

create table if not exists public.perfiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  rol        public.rol_usuario not null default 'cliente',
  -- Vínculo a la cartera. Lo asigna SOLO el admin (trigger proteger_perfil).
  cliente_id uuid references public.clientes (id) on delete set null,
  -- Copia del email de auth: el admin busca/vincula sin tocar auth.users.
  email      text,
  nombre     text check (nombre is null or length(nombre) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perfiles_cliente_idx on public.perfiles (cliente_id);
create index if not exists perfiles_email_idx   on public.perfiles (email);

drop trigger if exists perfiles_updated_at on public.perfiles;
create trigger perfiles_updated_at
  before update on public.perfiles
  for each row execute function public.set_updated_at();

-- ---- Auto-creación del perfil al signup --------------------------------------
-- Google trae full_name en raw_user_meta_data; email/password no trae nada.

create or replace function public.crear_perfil() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (user_id, email, nombre)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    )), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_perfil_al_signup on auth.users;
create trigger crear_perfil_al_signup
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---- Backfill de usuarios existentes (cuentas creadas a mano) ----------------

insert into public.perfiles (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- ---- Seed de admins — ⚠️ EDITAR AQUÍ antes de correr --------------------------

update public.perfiles set rol = 'admin'
where email in (
  'tomas@ejemplo.com',   -- ← correo real de la cuenta admin de Tomás
  'paula@ejemplo.com'    -- ← correo real de la cuenta admin de Paula
);

-- ---- Helpers para RLS ---------------------------------------------------------
-- STABLE: un solo valor por statement. Las políticas los llaman como
-- (select es_admin()) para que Postgres los evalúe una vez (initplan).

create or replace function public.es_admin() returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where user_id = (select auth.uid()) and rol = 'admin'
  );
$$;

create or replace function public.mi_cliente_id() returns uuid
language sql stable
security definer
set search_path = public
as $$
  select cliente_id from perfiles where user_id = (select auth.uid());
$$;

revoke all on function public.es_admin()      from public, anon;
revoke all on function public.mi_cliente_id() from public, anon;
grant execute on function public.es_admin()      to authenticated;
grant execute on function public.mi_cliente_id() to authenticated;

-- ---- Anti auto-escalada --------------------------------------------------------
-- Un cliente puede editar su nombre, pero rol/cliente_id/user_id solo los
-- cambia un admin. auth.uid() IS NULL = SQL directo del dashboard o service
-- role: pasa (así funcionan el seed y las correcciones a mano).

create or replace function public.proteger_perfil() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.rol is distinct from old.rol
      or new.cliente_id is distinct from old.cliente_id
      or new.user_id is distinct from old.user_id)
     and (select auth.uid()) is not null
     and not public.es_admin() then
    raise exception 'solo un admin puede cambiar rol o cliente vinculado';
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_proteger on public.perfiles;
create trigger perfiles_proteger
  before update on public.perfiles
  for each row execute function public.proteger_perfil();

-- ---- RLS de perfiles -----------------------------------------------------------

alter table public.perfiles enable row level security;

drop policy if exists perfiles_admin_todo on public.perfiles;
create policy perfiles_admin_todo on public.perfiles
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists perfiles_lee_propio on public.perfiles;
create policy perfiles_lee_propio on public.perfiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Editar el propio perfil (solo nombre en la práctica: el trigger
-- perfiles_proteger bloquea rol/cliente_id para no-admins).
drop policy if exists perfiles_edita_propio on public.perfiles;
create policy perfiles_edita_propio on public.perfiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.perfiles from anon;
