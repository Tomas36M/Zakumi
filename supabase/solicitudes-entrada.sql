-- Solicitudes entrantes: la bandeja deja de ser "del portal" y pasa a ser
-- TODO el que quiere contratarnos. Correr DESPUÉS de portal.sql Y de voz.sql
-- (la columna llamada_id de abajo referencia public.llamadas_voz(id), que
-- crea voz.sql — sin esa tabla, este script revienta).
--
-- Por qué se amplía en vez de crear tabla nueva: duplicar la máquina de
-- estados (src/lib/portal/solicitudes.ts), la bandeja y la vista para separar
-- filas que se trabajan exactamente igual no compra nada. El portal está
-- apagado (PORTAL_ABIERTO = false en src/proxy.ts), así que la tabla está
-- dormida y ampliarla no le rompe nada a ningún cliente.
--
-- ⚠️ La RLS del portal NO se toca y NO hace falta tocarla: la política del
-- cliente es `user_id = (select auth.uid())`, y con user_id NULL la
-- comparación da NULL → la fila se filtra. Ningún cliente del portal verá un
-- lead nuestro. Si algún día alguien "arregla" esa política con un IS NULL,
-- estaría abriendo la bandeja entera: no hacerlo.
--
-- La política de INSERT del cliente (solicitudes_crea_propia, portal.sql) SÍ se
-- reescribe abajo: la original solo exigía user_id = auth.uid() + estado
-- 'nueva' + cotización vacía, y no conocía las columnas de este script. Sin el
-- refuerzo, el día que se abra el signup cualquier usuario autenticado podría
-- insertarse una fila con origen='voz' y su propia cita, colándose en la
-- agenda como si viniera de Zak. La versión de abajo solo deja pasar lo que la
-- tienda escribe de verdad (src/lib/portal/actions.ts: user_id, servicio_slug,
-- mensaje) y obliga a que todo lo de voz/WhatsApp venga en blanco.

alter table public.solicitudes
  alter column user_id drop not null;

alter table public.solicitudes
  add column if not exists origen            text not null default 'portal',
  add column if not exists contacto_nombre   text,
  add column if not exists contacto_telefono text,
  add column if not exists contacto_email    text,
  -- traza al hecho que la originó
  add column if not exists llamada_id        uuid references public.llamadas_voz (id) on delete set null,
  add column if not exists conversacion      text,
  -- idempotencia de la ingesta: 'voz:<conversation_id>' | 'wa:<ref del bot>'
  add column if not exists clave_origen      text,
  -- cita
  add column if not exists cita_inicio       timestamptz,
  add column if not exists cita_fin          timestamptz,
  add column if not exists cita_meet_url     text,
  add column if not exists cita_evento_id    text,
  add column if not exists cita_link_google  text,
  -- lo que dijo la persona cuando no hubo fecha parseable
  add column if not exists cita_texto_crudo  text;

-- `add constraint` NO acepta `if not exists`: drop + add para que el script
-- se pueda correr dos veces sin reventar (el resto ya es idempotente).
alter table public.solicitudes
  drop constraint if exists solicitudes_origen_chk,
  drop constraint if exists solicitudes_identifica_chk;

alter table public.solicitudes
  add constraint solicitudes_origen_chk
    check (origen in ('portal', 'voz', 'whatsapp')),
  -- toda solicitud identifica a alguien: cuenta de portal o teléfono
  add constraint solicitudes_identifica_chk
    check (user_id is not null or contacto_telefono is not null);

create unique index if not exists solicitudes_clave_origen_uq
  on public.solicitudes (clave_origen) where clave_origen is not null;

create index if not exists solicitudes_agenda_idx
  on public.solicitudes (cita_inicio) where cita_inicio is not null;

-- ---- Política de INSERT del cliente, reforzada -------------------------------
-- Mismas condiciones que en portal.sql, más: origen 'portal' (el default) y
-- TODAS las columnas de este script en NULL. Las solicitudes de voz/WhatsApp
-- entran por service-role (src/lib/solicitudes/entrada.ts) y no pasan por esta
-- política, así que no pierden nada. Correr portal.sql después de este archivo
-- vuelve a dejar la política laxa: si eso pasa, re-correr este script.
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
    -- lo que solo Zak (service-role) puede escribir
    and origen = 'portal'
    and contacto_nombre is null
    and contacto_telefono is null
    and contacto_email is null
    and llamada_id is null
    and conversacion is null
    and clave_origen is null
    and cita_inicio is null
    and cita_fin is null
    and cita_meet_url is null
    and cita_evento_id is null
    and cita_link_google is null
    and cita_texto_crudo is null
  );
