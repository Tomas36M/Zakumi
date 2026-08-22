-- ============================================================================
-- Portal de clientes (/app) — solicitudes de la tienda y mini-CRM del cliente.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de rls.sql. Idempotente.
--
-- `solicitudes` pertenece al USUARIO (auth.users), no al cliente de la
-- cartera: un signup recién llegado todavía no tiene fila en `clientes`
-- (esa nace cuando Tomás activa su primera compra). servicio_slug es
-- referencia BLANDA al catálogo en TS (src/lib/catalogo.ts), mismo patrón
-- que productos_contratados.instancia_id.
--
-- Máquina de estados (la valida TypeScript — src/lib/portal/solicitudes.ts):
--   nueva → cotizada → link_enviado → pagada → activa
--   rechazada alcanzable desde cualquier estado no terminal.
-- La RLS solo garantiza el mínimo duro: el cliente crea en 'nueva' sin
-- campos de cotización y después no muta nada; el resto es del admin.
-- ============================================================================

-- ---- Enums ---------------------------------------------------------------------

do $$ begin
  create type public.estado_solicitud as enum
    ('nueva', 'cotizada', 'link_enviado', 'pagada', 'activa', 'rechazada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.origen_venta as enum ('manual', 'bot');
exception when duplicate_object then null; end $$;

-- ---- Solicitudes de la tienda ----------------------------------------------------

create table if not exists public.solicitudes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  servicio_slug     text not null check (length(servicio_slug) between 1 and 60),
  mensaje           text check (mensaje is null or length(mensaje) <= 2000),
  estado            public.estado_solicitud not null default 'nueva',
  cotizacion_monto  numeric(12, 2) check (cotizacion_monto is null or cotizacion_monto >= 0),
  cotizacion_moneda char(3) not null default 'COP',
  cotizacion_ciclo  public.ciclo_cobro,
  cotizacion_nota   text check (cotizacion_nota is null or length(cotizacion_nota) <= 2000),
  -- URL de pago (Wompi/Bold) que pega Tomás al cotizar. Pasarela integrada: v2.
  link_pago         text,
  -- Se llena al activar: el producto contratado que nació de esta solicitud.
  producto_id       uuid references public.productos_contratados (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists solicitudes_user_idx   on public.solicitudes (user_id, created_at desc);
create index if not exists solicitudes_estado_idx on public.solicitudes (estado);

drop trigger if exists solicitudes_updated_at on public.solicitudes;
create trigger solicitudes_updated_at
  before update on public.solicitudes
  for each row execute function public.set_updated_at();

-- ---- Mini-CRM del cliente: sus ventas ---------------------------------------------
-- Una sola tabla (contacto + venta en línea) a propósito. Los leads del bot
-- NO se copian aquí: "Mis ventas" los muestra en vivo desde la base del bot.
-- origen='bot' queda para cuando el cliente "promueva" un lead a venta (v1.1).

create table if not exists public.ventas_cliente (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  contacto   text not null check (length(contacto) between 1 and 200),
  telefono   text check (telefono is null or telefono ~ '^\+[1-9][0-9]{6,14}$'),
  detalle    text check (detalle is null or length(detalle) <= 2000),
  monto      numeric(12, 2) check (monto is null or monto >= 0),
  moneda     char(3) not null default 'COP',
  fecha      date not null default current_date,
  origen     public.origen_venta not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists ventas_cliente_user_idx on public.ventas_cliente (user_id, fecha desc);

-- ---- RLS ---------------------------------------------------------------------------

alter table public.solicitudes    enable row level security;
alter table public.ventas_cliente enable row level security;

-- Solicitudes: admin todo; el cliente ve las suyas y solo puede CREAR en
-- 'nueva' con los campos de cotización vacíos. Sin UPDATE/DELETE de cliente
-- en v1 (cancelar una solicitud = escribirle a Tomás).
drop policy if exists solicitudes_admin_todo on public.solicitudes;
create policy solicitudes_admin_todo on public.solicitudes
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists solicitudes_lee_propias on public.solicitudes;
create policy solicitudes_lee_propias on public.solicitudes
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists solicitudes_crea_propia on public.solicitudes;
create policy solicitudes_crea_propia on public.solicitudes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and estado = 'nueva'
    and cotizacion_monto is null
    and cotizacion_ciclo is null
    and cotizacion_nota is null
    and link_pago is null
    and producto_id is null
  );

-- Ventas del cliente: cada quien lo suyo; el admin puede LEER (soporte).
drop policy if exists ventas_cliente_propias on public.ventas_cliente;
create policy ventas_cliente_propias on public.ventas_cliente
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ventas_admin_lee on public.ventas_cliente;
create policy ventas_admin_lee on public.ventas_cliente
  for select to authenticated
  using ((select public.es_admin()));

revoke all on public.solicitudes    from anon;
revoke all on public.ventas_cliente from anon;
