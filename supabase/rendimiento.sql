-- ============================================================================
-- Rendimiento — índice de búsqueda por nombre y conteos agrupados.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de prospeccion.sql (usa
-- negocios.territorio_id y negocios.sitio_web). Idempotente y aditivo: no
-- cambia datos ni permisos de ninguna tabla.
--
-- Tres cosas:
-- 1. pg_trgm + un índice GIN sobre negocios.nombre. La búsqueda de
--    "+ Nuevo chat" en Zak hace ilike '%q%' en cada tecleo, y un B-tree no
--    sirve para un patrón con % al inicio: hasta ahora era un scan completo
--    de la tabla que el barrido paga expresamente por hacer crecer.
-- 2. cuentas_por_territorio(uuid[]): las cuentas exactas del grid de
--    Territorios en UNA consulta agrupada, en vez de dos por territorio
--    (50 round-trips por página de 25).
-- 3. conteo_por_estado(): el embudo de /admin/metricas en una consulta en
--    vez de seis.
--
-- Las dos funciones son security INVOKER a propósito (mismo criterio que
-- anotar_tesela en prospeccion.sql): RLS sigue mandando. Un no-admin no ve
-- filas de negocios y recibe conteos vacíos — nunca los de otro.
-- ============================================================================

-- Supabase instala las extensiones en el schema `extensions` (que está en
-- el search_path del rol postgres). El opclass va sin calificar a propósito:
-- así también funciona si en esta base pg_trgm ya estaba instalada en
-- `public` por otro camino.
create extension if not exists pg_trgm with schema extensions;

create index if not exists negocios_nombre_trgm_idx
  on public.negocios using gin (nombre gin_trgm_ops);

-- language sql (no plpgsql) a propósito: en una función SQL los nombres de
-- las columnas de salida NO entran en scope del cuerpo, así que
-- `territorio_id` resuelve a la columna de negocios sin ambigüedad.
create or replace function public.cuentas_por_territorio(p_ids uuid[])
returns table (territorio_id uuid, leads bigint, sin_web bigint)
language sql stable
security invoker
set search_path = public
as $$
  select territorio_id,
         count(*)                                  as leads,
         count(*) filter (where sitio_web is null) as sin_web
    from negocios
   where territorio_id = any(p_ids)
   group by territorio_id;
$$;

create or replace function public.conteo_por_estado()
returns table (estado public.estado_negocio, n bigint)
language sql stable
security invoker
set search_path = public
as $$
  select estado, count(*) as n
    from negocios
   group by estado;
$$;

-- El default de Postgres da EXECUTE a public en toda función nueva — se
-- revoca explícito (mismo patrón que anotar_tesela).
revoke all on function public.cuentas_por_territorio(uuid[]) from public, anon;
grant execute on function public.cuentas_por_territorio(uuid[]) to authenticated;
revoke all on function public.conteo_por_estado() from public, anon;
grant execute on function public.conteo_por_estado() to authenticated;
