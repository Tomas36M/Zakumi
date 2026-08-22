-- ============================================================================
-- RLS por roles — endurecimiento previo a abrir el signup público.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de perfiles.sql. Idempotente.
--
-- ⚠️ GATE: verifica ANTES de correr que el seed de admins quedó bien
-- (select email, rol from perfiles;) — si nadie es admin, el panel queda
-- ciego (queries vacías) hasta corregirlo.
--
-- Reemplaza las políticas "authenticated ve todo" de schema.sql/cartera.sql:
-- con el signup público abierto, "authenticated" pasa a incluir a cualquier
-- persona de internet. Modelo nuevo: admin todo; cliente SOLO lo suyo
-- (lectura); anon nada. El portal escribe únicamente en sus propias tablas
-- (portal.sql). Smoke test del panel después de correr esto.
-- ============================================================================

-- ---- negocios / notas: CRM interno, solo admin --------------------------------

drop policy if exists negocios_crud_autenticados on public.negocios;
drop policy if exists negocios_solo_admin        on public.negocios;
create policy negocios_solo_admin on public.negocios
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists notas_crud_autenticados on public.notas;
drop policy if exists notas_solo_admin        on public.notas;
create policy notas_solo_admin on public.notas
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

-- ---- clientes: admin todo; el cliente lee su propia fila -----------------------

drop policy if exists clientes_crud_autenticados on public.clientes;
drop policy if exists clientes_admin_todo        on public.clientes;
create policy clientes_admin_todo on public.clientes
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists clientes_lee_su_fila on public.clientes;
create policy clientes_lee_su_fila on public.clientes
  for select to authenticated
  using (id = (select public.mi_cliente_id()));

-- ---- productos_contratados: admin todo; el cliente lee los suyos ----------------

drop policy if exists productos_crud_autenticados on public.productos_contratados;
drop policy if exists productos_admin_todo        on public.productos_contratados;
create policy productos_admin_todo on public.productos_contratados
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists productos_lee_los_suyos on public.productos_contratados;
create policy productos_lee_los_suyos on public.productos_contratados
  for select to authenticated
  using (cliente_id = (select public.mi_cliente_id()));

-- ---- pagos: admin todo; el cliente lee los de sus productos ---------------------
-- registrar_pago es SECURITY INVOKER: un cliente que lo invoque por RPC choca
-- con la política de INSERT (solo admin) — verificarlo en el smoke test.

drop policy if exists pagos_crud_autenticados on public.pagos;
drop policy if exists pagos_admin_todo        on public.pagos;
create policy pagos_admin_todo on public.pagos
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists pagos_lee_los_suyos on public.pagos;
create policy pagos_lee_los_suyos on public.pagos
  for select to authenticated
  using (exists (
    select 1 from public.productos_contratados pc
    where pc.id = pagos.producto_id
      and pc.cliente_id = (select public.mi_cliente_id())
  ));

-- ---- Cero acceso anónimo (re-afirmación; ya estaba en schema/cartera) -----------

revoke all on public.negocios              from anon;
revoke all on public.notas                 from anon;
revoke all on public.clientes              from anon;
revoke all on public.productos_contratados from anon;
revoke all on public.pagos                 from anon;
revoke execute on function public.registrar_pago from anon;
