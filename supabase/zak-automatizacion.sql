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

-- Fase 4: vincula una solicitud al negocio de prospección del que salió
-- (cuando se conoce — el bot de WhatsApp todavía no lo manda siempre, ver
-- Decisión 5 del spec). Cuando la solicitud llega a 'activa', esa columna
-- es lo que le dice a activarSolicitud() a qué negocio avanzar a 'cliente'.
alter table public.solicitudes
  add column if not exists negocio_id uuid references public.negocios(id) on delete set null;

create index if not exists solicitudes_negocio_id_idx
  on public.solicitudes (negocio_id) where negocio_id is not null;
