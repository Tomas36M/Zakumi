-- supabase/zak-automatizacion.sql
--
-- Automatiza los avances de estado de negocios (ver
-- docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md).
-- Idempotente: solo `add column if not exists`. Correr en el SQL editor
-- de Supabase — no hay migración automática en este repo.

alter table public.negocios
  add column if not exists estado_fijado_manual boolean not null default false;

comment on column public.negocios.estado_fijado_manual is
  'true en cuanto un humano cambia el estado a mano (actualizarNegocio o '
  'cambiarEstadoLote). Desde ahí la automatización deja el negocio en paz.';
