-- ============================================================================
-- Agentes de voz ElevenLabs — canal 'voz' del CRM y la tienda.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de portal.sql. Idempotente.
--
-- agentes_voz es la FUENTE DE VERDAD de la config (ElevenLabs es el ejecutor):
-- agent_id_eleven / phone_number_id_eleven son referencias BLANDAS a recursos
-- del workspace de ElevenLabs, mismo patrón que productos_contratados.
-- instancia_id. llamadas_voz es append-only: una fila por conversación,
-- idempotente por conversation_id (el webhook post-call puede reintentar).
--
-- La RPC registrar_llamada_voz es el ÚNICO escritor (SECURITY DEFINER, solo
-- service_role): la invoca el webhook público /api/voz/webhook después de
-- verificar la firma HMAC. Ahí mismo se promueven los leads extraídos
-- (lead_nombre / lead_telefono / lead_detalle) a ventas_cliente (origen 'bot').
-- ============================================================================

-- ---- Tablas ----------------------------------------------------------------

create table if not exists public.agentes_voz (
  id                     uuid primary key default gen_random_uuid(),
  -- null = agente demo/interno de Zakumi (no pertenece a ningún cliente)
  cliente_id             uuid references public.clientes (id) on delete set null,
  nombre                 text not null check (length(nombre) between 1 and 200),
  -- id del agente en ElevenLabs; null = creado aquí pero sin sincronizar aún
  agent_id_eleven        text unique,
  -- número propio del cliente (entrantes); null = usa el compartido de env
  phone_number_id_eleven text,
  voice_id               text,
  primer_mensaje         text check (primer_mensaje is null or length(primer_mensaje) <= 500),
  -- secciones guiadas del comportamiento (personalidad, negocio, guion,
  -- horarios, noDecir) — las serializa src/lib/voz/guias.ts
  secciones              jsonb not null default '{}'::jsonb,
  -- data collection tipada: array de { clave, tipo, descripcion }
  extraccion             jsonb not null default '[]'::jsonb,
  cap_diario             integer not null default 5 check (cap_diario between 0 and 500),
  activo                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- direccion/estado/resultado como text+check (no enum): espejan valores de
-- ElevenLabs y ampliar un check no exige ALTER TYPE. Los normaliza TS antes
-- de insertar (src/lib/voz/webhook.ts), así el check nunca rebota un evento.
create table if not exists public.llamadas_voz (
  id                uuid primary key default gen_random_uuid(),
  agente_id         uuid not null references public.agentes_voz (id) on delete cascade,
  conversation_id   text not null unique,
  direccion         text not null check (direccion in ('saliente', 'entrante', 'widget', 'prueba')),
  telefono          text,
  estado            text not null check (estado in ('done', 'failed', 'fallo_inicio')),
  resultado         text check (resultado in ('success', 'failure', 'unknown')),
  duracion_seg      integer,
  costo_creditos    integer,
  resumen           text check (resumen is null or length(resumen) <= 4000),
  transcript        jsonb,
  datos             jsonb,
  criterios         jsonb,
  dynamic_variables jsonb,
  batch_id          text,
  tiene_audio       boolean not null default false,
  iniciada_en       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists agentes_voz_cliente_idx on public.agentes_voz (cliente_id);
create index if not exists llamadas_voz_agente_idx on public.llamadas_voz (agente_id, created_at desc);

drop trigger if exists agentes_voz_updated_at on public.agentes_voz;
create trigger agentes_voz_updated_at
  before update on public.agentes_voz
  for each row execute function public.set_updated_at();

-- ---- RPC: el único escritor de llamadas_voz ---------------------------------
-- SECURITY DEFINER + grant solo a service_role: el webhook no tiene sesión de
-- usuario y la app normal (anon + RLS) no puede escribir llamadas. Idempotente
-- por conversation_id. Devuelve jsonb {status: ok|duplicado|sin_agente, ...}.
-- 'sin_agente' = evento de un agente ajeno del mismo workspace (p. ej. Luci):
-- se responde 200 y no se guarda nada.

create or replace function public.registrar_llamada_voz(
  p_agent_id_eleven   text,
  p_conversation_id   text,
  p_direccion         text,
  p_telefono          text,
  p_estado            text,
  p_resultado         text,
  p_duracion_seg      integer,
  p_costo_creditos    integer,
  p_resumen           text,
  p_transcript        jsonb,
  p_datos             jsonb,
  p_criterios         jsonb,
  p_dynamic_variables jsonb,
  p_batch_id          text,
  p_tiene_audio       boolean,
  p_iniciada_en       timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agente     public.agentes_voz%rowtype;
  v_llamada_id uuid;
  v_user_id    uuid;
  v_contacto   text;
  v_telefono   text;
  v_detalle    text;
  v_lead       boolean := false;
begin
  select * into v_agente
    from agentes_voz
   where agent_id_eleven = p_agent_id_eleven;
  if not found then
    return jsonb_build_object('status', 'sin_agente');
  end if;

  insert into llamadas_voz (
    agente_id, conversation_id, direccion, telefono, estado, resultado,
    duracion_seg, costo_creditos, resumen, transcript, datos, criterios,
    dynamic_variables, batch_id, tiene_audio, iniciada_en
  ) values (
    v_agente.id, p_conversation_id, p_direccion, nullif(trim(coalesce(p_telefono, '')), ''),
    p_estado, p_resultado, p_duracion_seg, p_costo_creditos,
    left(p_resumen, 4000), p_transcript, p_datos, p_criterios,
    p_dynamic_variables, p_batch_id, coalesce(p_tiene_audio, false), p_iniciada_en
  )
  on conflict (conversation_id) do nothing
  returning id into v_llamada_id;

  if v_llamada_id is null then
    return jsonb_build_object('status', 'duplicado');
  end if;

  -- Lead extraído → ventas_cliente del portal. Sin cliente o sin perfil el
  -- lead NO se pierde: queda íntegro en llamadas_voz.datos.
  v_contacto := nullif(trim(coalesce(p_datos ->> 'lead_nombre', '')), '');
  v_telefono := nullif(trim(coalesce(p_datos ->> 'lead_telefono', '')), '');
  if v_telefono is not null and v_telefono !~ '^\+[1-9][0-9]{6,14}$' then
    v_telefono := null; -- ventas_cliente exige E.164; un formato raro no tumba la llamada
  end if;

  if (v_contacto is not null or v_telefono is not null)
     and v_agente.cliente_id is not null then
    select user_id into v_user_id
      from perfiles
     where cliente_id = v_agente.cliente_id
     order by user_id
     limit 1;
    if v_user_id is not null then
      v_detalle := nullif(trim(coalesce(p_datos ->> 'lead_detalle', p_resumen, '')), '');
      insert into ventas_cliente (user_id, contacto, telefono, detalle, origen)
      values (
        v_user_id,
        left(coalesce(v_contacto, v_telefono), 200),
        v_telefono,
        left(v_detalle, 2000),
        'bot'
      );
      v_lead := true;
    end if;
  end if;

  return jsonb_build_object('status', 'ok', 'llamada_id', v_llamada_id, 'lead', v_lead);
end;
$$;

-- ---- RLS: admin todo; el cliente lee lo suyo (fase 2 del portal lista) -------

alter table public.agentes_voz  enable row level security;
alter table public.llamadas_voz enable row level security;

drop policy if exists agentes_voz_admin_todo on public.agentes_voz;
create policy agentes_voz_admin_todo on public.agentes_voz
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists agentes_voz_lee_los_suyos on public.agentes_voz;
create policy agentes_voz_lee_los_suyos on public.agentes_voz
  for select to authenticated
  using (cliente_id = (select public.mi_cliente_id()));

drop policy if exists llamadas_voz_admin_todo on public.llamadas_voz;
create policy llamadas_voz_admin_todo on public.llamadas_voz
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists llamadas_voz_lee_las_suyas on public.llamadas_voz;
create policy llamadas_voz_lee_las_suyas on public.llamadas_voz
  for select to authenticated
  using (exists (
    select 1 from public.agentes_voz av
    where av.id = llamadas_voz.agente_id
      and av.cliente_id = (select public.mi_cliente_id())
  ));

revoke all on public.agentes_voz  from anon;
revoke all on public.llamadas_voz from anon;

-- La RPC: nadie salvo service_role (el webhook). El default de Postgres da
-- EXECUTE a public en toda función nueva — se revoca explícito.
revoke all on function public.registrar_llamada_voz(
  text, text, text, text, text, text, integer, integer, text,
  jsonb, jsonb, jsonb, jsonb, text, boolean, timestamptz
) from public, anon, authenticated;
grant execute on function public.registrar_llamada_voz(
  text, text, text, text, text, text, integer, integer, text,
  jsonb, jsonb, jsonb, jsonb, text, boolean, timestamptz
) to service_role;
