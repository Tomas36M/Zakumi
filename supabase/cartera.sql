-- ============================================================================
-- Cartera de clientes y cobros — módulo F del panel de admin Zakumi.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de schema.sql. Idempotente.
--
-- clientes ← productos_contratados ← pagos. Un cliente puede nacer de un
-- negocio del CRM (negocio_id UNIQUE hace idempotente la conversión) o
-- crearse directo. productos_contratados.instancia_id es una referencia
-- BLANDA (texto) a la instancia del bot, que vive en otra base (Railway).
-- ============================================================================

-- ---- Enums -----------------------------------------------------------------

do $$ begin
  create type public.tipo_producto as enum ('bot', 'web', 'crm', 'otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ciclo_cobro as enum ('mensual', 'anual', 'unico');
exception when duplicate_object then null; end $$;

-- ---- Tablas ----------------------------------------------------------------

create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid unique references public.negocios (id) on delete set null,
  nombre     text not null check (length(nombre) between 1 and 300),
  telefono   text check (telefono is null or telefono ~ '^\+[1-9][0-9]{6,14}$'),
  email      text check (email is null or position('@' in email) > 1),
  notas      text,
  activo     boolean not null default true,
  creado_por uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.productos_contratados (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid not null references public.clientes (id) on delete cascade,
  tipo         public.tipo_producto not null,
  nombre       text not null check (length(nombre) between 1 and 200),
  -- id o slug de la instancia en la base del bot (otra base: sin FK a propósito)
  instancia_id text,
  dominio      text,
  tarifa       numeric(12, 2) not null check (tarifa >= 0),
  moneda       char(3) not null default 'COP',
  ciclo        public.ciclo_cobro not null default 'mensual',
  proxima_fecha date,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.pagos (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references public.productos_contratados (id) on delete cascade,
  fecha          date not null default current_date,
  monto          numeric(12, 2) not null check (monto > 0),
  moneda         char(3) not null default 'COP',
  nota           text check (nota is null or length(nota) <= 2000),
  registrado_por uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);

-- ---- Índices (toda FK indexada + el orden del panel) ------------------------

create index if not exists clientes_creado_por_idx  on public.clientes (creado_por);
create index if not exists productos_cliente_idx    on public.productos_contratados (cliente_id);
create index if not exists productos_proxima_idx    on public.productos_contratados (proxima_fecha)
  where activo;
create index if not exists pagos_producto_idx       on public.pagos (producto_id, fecha desc);
create index if not exists pagos_registrado_por_idx on public.pagos (registrado_por);

-- ---- Triggers de updated_at (reutiliza la función de schema.sql) ------------

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

drop trigger if exists productos_updated_at on public.productos_contratados;
create trigger productos_updated_at
  before update on public.productos_contratados
  for each row execute function public.set_updated_at();

-- ---- registrar_pago: insertar el pago y avanzar la fecha, atómico -----------
-- La nueva fecha la calcula TypeScript (siguienteFecha, única fuente de la
-- regla de ciclo, testeada) y viaja como parámetro. security invoker: RLS
-- sigue aplicando con el rol de la sesión.

create or replace function public.registrar_pago(
  p_producto_id  uuid,
  p_monto        numeric,
  p_fecha        date,
  p_nota         text,
  p_nueva_proxima date
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pago_id uuid;
begin
  insert into pagos (producto_id, fecha, monto, nota)
  values (p_producto_id, p_fecha, p_monto, nullif(trim(coalesce(p_nota, '')), ''))
  returning id into v_pago_id;

  update productos_contratados
     set proxima_fecha = p_nueva_proxima
   where id = p_producto_id;

  return v_pago_id;
end;
$$;

-- ---- RLS: solo autenticados, cero acceso anónimo -----------------------------

alter table public.clientes              enable row level security;
alter table public.productos_contratados enable row level security;
alter table public.pagos                 enable row level security;

drop policy if exists clientes_crud_autenticados on public.clientes;
create policy clientes_crud_autenticados on public.clientes
  for all to authenticated using (true) with check (true);

drop policy if exists productos_crud_autenticados on public.productos_contratados;
create policy productos_crud_autenticados on public.productos_contratados
  for all to authenticated using (true) with check (true);

drop policy if exists pagos_crud_autenticados on public.pagos;
create policy pagos_crud_autenticados on public.pagos
  for all to authenticated using (true) with check (true);

revoke all on public.clientes              from anon;
revoke all on public.productos_contratados from anon;
revoke all on public.pagos                 from anon;
revoke execute on function public.registrar_pago from anon;
