-- ============================================================================
-- Territorios de prospección — PARCHES sobre una base que ya corrió una
-- versión anterior de `supabase/prospeccion.sql`.
--
-- Este archivo existe porque el delta de despliegue no puede vivir solo en el
-- informe de una sesión: quien tenga que reconstruir una base dentro de seis
-- meses va a mirar `supabase/`, no un directorio de trabajo.
--
-- ¿Cuál correr?
--   · Base NUEVA (nunca corrió nada de prospección) → `prospeccion.sql` a secas.
--     Ya trae todo lo de acá; este archivo no hace falta.
--   · Base que YA corrió `prospeccion.sql` en cualquier versión → este archivo.
--     También sirve `prospeccion.sql` entero: desde la auditoría del
--     2026-09-01 es re-ejecutable de principio a fin (la muerte del enum
--     `ciudad` va guardada por su existencia). Este es el camino corto.
--
-- Todo lo de acá es idempotente: re-correrlo es seguro, y correrlo sobre una
-- base que ya lo tiene todo es un no-op. El begin/commit hace que un fallo a
-- mitad no deje nada a medias.
--
-- ⚠️ Correr ANTES de desplegar el código nuevo.
-- ============================================================================

begin;

-- ---- Parche 1 · 2026-09-01, ronda de arreglos de la revisión final ---------
-- La saturación se vuelve DURABLE. Sin esto, las 4 hijas de una celda saturada
-- solo existen en la cola del navegador: cerrar la pestaña las pierde para
-- siempre (la madre ya quedó en `teselas_hechas`, así que ningún plan futuro
-- las regenera) y las manzanas más densas desaparecen del censo en silencio
-- mientras la pantalla dice 100 %.

alter table public.territorios
  add column if not exists teselas_saturadas jsonb not null default '[]';

-- La firma cambió (entró p_saturada), y `create or replace` NO reemplaza una
-- función de aridad distinta: crearía una SEGUNDA anotar_tesela y dejaría dos
-- versiones vivas. El drop explícito de la firma vieja garantiza que quede una.
drop function if exists public.anotar_tesela(uuid, text, text);

-- p_saturada tiene default: durante la ventana entre correr este SQL y
-- desplegar el código nuevo, el código viejo sigue llamando con 3 argumentos y
-- no se rompe.
create or replace function public.anotar_tesela(
  p_territorio uuid,
  p_clave      text,
  p_vertical   text,
  p_saturada   boolean default false
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update territorios
     set llamadas       = llamadas + 1,
         teselas_hechas = case when teselas_hechas ? p_clave
                                then teselas_hechas
                                else teselas_hechas || to_jsonb(p_clave) end,
         -- Idéntico a teselas_hechas: append idempotente, y solo si saturó.
         teselas_saturadas = case
                               when not p_saturada then teselas_saturadas
                               when teselas_saturadas ? p_clave then teselas_saturadas
                               else teselas_saturadas || to_jsonb(p_clave) end,
         verticales     = case when p_vertical = any(verticales)
                                then verticales
                                else array_append(verticales, p_vertical) end,
         ultimo_barrido = now()
   where id = p_territorio;

  -- Sin esto, un territorio borrado entre el SELECT del handler y esta llamada
  -- hace que el UPDATE no toque ninguna fila, la función devuelva éxito y el
  -- handler reporte `contabilizada: true` para una llamada que se cobró y NO
  -- se contabilizó — exactamente lo que ese flag existe para no callar.
  --
  -- No filtra nada: con security invoker + RLS, un no-admin también ve 0 filas
  -- y recibe EXACTAMENTE este mismo error, así que no puede distinguir "no
  -- existe" de "existe y no es tuyo".
  if not found then
    raise exception 'territorio % no existe', p_territorio using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.anotar_tesela(uuid, text, text, boolean) from public, anon;
grant execute on function public.anotar_tesela(uuid, text, text, boolean) to authenticated;

-- ---- Parche 2 · 2026-09-01, auditoría de pre-producción --------------------
-- La pantalla de leads pide `negocios` ordenada por created_at desc en cada
-- carga. Antes de los territorios la tabla crecía de a 25 filas importadas a
-- mano y el sort en memoria no se notaba; un barrido mete miles de una tanda.
create index if not exists negocios_created_at_idx on public.negocios (created_at desc);

commit;

-- Comprobación posterior: debe quedar UNA sola versión de la función.
--   select p.oid::regprocedure
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'anotar_tesela';
--   -- esperado: anotar_tesela(uuid,text,text,boolean)
