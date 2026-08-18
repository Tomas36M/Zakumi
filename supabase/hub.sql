-- ============================================================================
-- Hub de empresas — amplía el enum de productos para el catálogo de upsell.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de cartera.sql. Idempotente.
--
-- GATE: correr ANTES de desplegar el código del panel que usa estos valores
-- ('voz' y 'mantenimiento' en TipoProducto) — el insert fallaría sin esto.
--
-- 'voz' es el gancho de los agentes ElevenLabs (etapa siguiente): contratar
-- un agente de voz mañana no vuelve a tocar el schema.
-- ============================================================================

do $$ begin
  alter type public.tipo_producto add value if not exists 'voz';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.tipo_producto add value if not exists 'mantenimiento';
exception when duplicate_object then null; end $$;
