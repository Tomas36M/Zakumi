-- supabase/leads-overrides.sql
--
-- Overlay local para los leads que captura el bot de WhatsApp (viven en su
-- base Flask, no en Supabase — ver docs/superpowers/specs/2026-09-13-
-- consola-zak-rediseno-design.md, Decisión 12). Esta tabla nunca es la
-- fuente de verdad de un lead: solo anota ediciones, borrados lógicos y
-- vínculos a un negocio de prospección, por instancia+teléfono. El Flask
-- no se toca nunca desde acá.
--
-- Idempotente. Correr en el SQL editor de Supabase, después de
-- supabase/zak-automatizacion.sql (referencia negocios.id).

create table if not exists public.leads_overrides (
  instancia_id   integer not null,
  telefono       text not null,
  datos_editados jsonb,
  negocio_id     uuid references public.negocios(id) on delete set null,
  borrado        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (instancia_id, telefono)
);

alter table public.leads_overrides enable row level security;

-- Mismo helper que ya usa el resto del admin-only (supabase/perfiles.sql):
-- STABLE + security definer, se llama como (select es_admin()) para que
-- Postgres lo evalúe una sola vez por statement (initplan).
create policy leads_overrides_solo_admin on public.leads_overrides
  for all using ((select public.es_admin()))
  with check ((select public.es_admin()));
