-- ============================================================================
-- Plantillas de Meta por vertical — gestor de plantillas del cockpit de Zak.
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de los 6 archivos existentes
-- (schema → cartera → hub → perfiles → rls → portal). Idempotente: re-correrlo
-- JAMÁS pisa ediciones hechas desde el panel (seed con on conflict do nothing).
--
-- El catálogo de src/lib/admin/zak.ts pasa a ser SEED/fallback; esta tabla es
-- la fuente viva: texto_vigente + folleto_url_vigente + header_aprobado son lo
-- ÚNICO que usa el envío; los *_borrador son la edición en curso camino a Meta.
-- ============================================================================

create table if not exists public.plantillas_zak (
  slug                   text primary key,
  orden                  int  not null unique,          -- el matching respeta este orden
  label                  text not null,
  plantilla              text not null unique,          -- nombre en Meta (inmutable v1)
  matchers               text[] not null default '{}',  -- substrings de negocios.categoria
  angulo                 text not null,

  -- Lo aprobado (lo que sale por WhatsApp):
  texto_vigente          text not null check (length(texto_vigente) between 1 and 1024),
  folleto_url_vigente    text not null,
  header_aprobado        boolean not null default true, -- la versión APROBADA lleva imagen

  -- La edición en curso (null = sin borrador):
  texto_borrador         text check (texto_borrador is null or length(texto_borrador) between 1 and 1024),
  folleto_url_borrador   text,
  borrador_enviado_en    timestamptz,                   -- null = borrador local, aún no en Meta

  -- Espejo del estado real en Meta:
  estado_meta            text not null default 'DESCONOCIDO'
    check (estado_meta in ('APPROVED','PENDING','REJECTED','PAUSED','DISABLED','DESCONOCIDO')),
  motivo_rechazo         text,
  categoria_meta         text,
  meta_template_id       text,
  envios_revision        timestamptz[] not null default '{}', -- contadores 10/30d y 1/24h
  estados_refrescados_en timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists plantillas_zak_updated_at on public.plantillas_zak;
create trigger plantillas_zak_updated_at
  before update on public.plantillas_zak
  for each row execute function public.set_updated_at();

-- ---- RLS: solo admins (patrón rls.sql) -------------------------------------

alter table public.plantillas_zak enable row level security;

drop policy if exists plantillas_zak_solo_admin on public.plantillas_zak;
create policy plantillas_zak_solo_admin on public.plantillas_zak
  for all to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

revoke all on public.plantillas_zak from anon;

-- ---- Bucket público de folletos (el equipo cambia imágenes sin deploy) -----
-- Lectura: URL pública del bucket. Escritura: solo admins. Los PNG actuales de
-- public/folletos/ siguen sirviendo como fallback; entran al bucket a medida
-- que se editen (SIEMPRE con nombre nuevo: el CDN de Supabase cachea el path).

insert into storage.buckets (id, name, public)
values ('folletos', 'folletos', true)
on conflict (id) do update set public = true;

drop policy if exists folletos_escribe_admin on storage.objects;
create policy folletos_escribe_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'folletos' and (select public.es_admin()));

drop policy if exists folletos_actualiza_admin on storage.objects;
create policy folletos_actualiza_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'folletos' and (select public.es_admin()))
  with check (bucket_id = 'folletos' and (select public.es_admin()));

drop policy if exists folletos_borra_admin on storage.objects;
create policy folletos_borra_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'folletos' and (select public.es_admin()));

-- ---- Seed: los 11 verticales tal cual el catálogo TS (generado, no a mano) --
-- on conflict DO NOTHING: re-correr este archivo nunca pisa lo editado.

insert into public.plantillas_zak
  (slug, orden, label, plantilla, matchers, angulo, texto_vigente, folleto_url_vigente)
values
  ('restaurante', 1, 'Restaurante', 'saludo_restaurante', array['restaurant', 'food', 'cafe', 'coffee', 'burger', 'pizza', 'comida'],
   'Pedidos completos y reservas sin perder llamadas en hora pico: el agente toma el pedido con dirección y forma de pago mientras la cocina trabaja.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a restaurantes a tomar pedidos y reservas por WhatsApp 24/7, sin perder llamadas en hora pico — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 🍽️',
   'https://zakumistudio.com/folletos/restaurante.png'),
  ('panaderia', 2, 'Panadería', 'saludo_panaderia', array['bakery', 'pastry', 'panader'],
   'Encargos de tortas y pedidos del día sin ocupar el mostrador; el agente confirma sabores, porciones y fecha de entrega.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a panaderías a vender el surtido del día y tomar encargos de tortas por WhatsApp 24/7 — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 🥐',
   'https://zakumistudio.com/folletos/panaderia.png'),
  ('ferreteria', 3, 'Ferretería', 'saludo_ferreteria', array['hardware', 'building materials', 'paint', 'ferreter', 'electrical supply', 'plumbing'],
   'Los ''¿tienen X? ¿a cómo?'' respondidos al instante desde el catálogo; pedidos listos para recoger o despachar a obra.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a ferreterías a responder precios y disponibilidad y tomar pedidos por WhatsApp 24/7, sin filas en el mostrador — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 🔧',
   'https://zakumistudio.com/folletos/ferreteria.png'),
  ('veterinaria', 4, 'Veterinaria', 'saludo_veterinaria', array['veterinar', 'pet'],
   'Citas y recordatorios de vacunas; los dueños preguntan a cualquier hora y el agente agenda sin interrumpir la consulta.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a veterinarias a agendar citas y responder a los dueños de mascotas a toda hora — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 🐾',
   'https://zakumistudio.com/folletos/veterinaria.png'),
  ('farmacia', 5, 'Droguería', 'saludo_farmacia', array['pharmacy', 'drugstore', 'drogueria', 'droguería'],
   'Domicilios y disponibilidad al momento, con el teléfono siempre desocupado.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a droguerías a tomar pedidos a domicilio y responder disponibilidad al instante — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 💊',
   'https://zakumistudio.com/folletos/farmacia.png'),
  ('belleza', 6, 'Belleza', 'saludo_belleza', array['beauty', 'hair', 'barber', 'nail', 'spa', 'peluquer'],
   'Agenda llena sin soltar las tijeras: el agente da citas, reagenda y manda recordatorios.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a salones y barberías a llenar la agenda por WhatsApp 24/7, sin interrumpir el servicio — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 💇',
   'https://zakumistudio.com/folletos/belleza.png'),
  ('taller', 7, 'Taller', 'saludo_taller', array['car repair', 'auto parts', 'motorcycle', 'mechanic', 'taller', 'car wash', 'tire'],
   'Citas de revisión y cotización de repuestos mientras el equipo trabaja; el cliente sabe cuándo traer el carro.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a talleres a agendar revisiones y cotizar repuestos por WhatsApp, sin soltar la herramienta — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 🔩',
   'https://zakumistudio.com/folletos/taller.png'),
  ('hogar', 8, 'Hogar y muebles', 'saludo_hogar', array['furniture', 'home goods', 'appliance', 'home improvement', 'decor', 'mueble'],
   'Cotizaciones con medidas y fotos, y coordinación de entregas sin llamadas cruzadas.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a tiendas de muebles y hogar a cotizar productos y coordinar entregas por WhatsApp 24/7 — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 🛋️',
   'https://zakumistudio.com/folletos/hogar.png'),
  ('moda', 9, 'Moda', 'saludo_moda', array['clothing', 'shoe', 'boutique', 'fashion', 'jewelry', 'ropa'],
   'Novedades, tallas y apartados: el agente vende por chat mientras la tienda atiende.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a tiendas de ropa a mostrar novedades, responder tallas y apartar prendas por WhatsApp — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 👗',
   'https://zakumistudio.com/folletos/moda.png'),
  ('comercio', 10, 'Comercio', 'saludo_comercio', array['store', 'shop', 'market', 'grocery', 'supermarket', 'convenience', 'tienda', 'florist', 'garden'],
   'Pedidos y preguntas frecuentes respondidos al momento: la venta no se enfría esperando.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Ayudamos a tiendas y comercios a responder clientes y tomar pedidos por WhatsApp 24/7 — con un agente como yo. ¿Te cuento cómo se vería en tu negocio? 🛍️',
   'https://zakumistudio.com/folletos/comercio.png'),
  ('generico', 11, 'Genérico', 'saludo_zakumi', '{}'::text[],
   'Descubre a qué se dedica el negocio y muestra cómo un agente como tú le atendería clientes 24/7.',
   '¡Hola! 👋 Soy *Zak*, el asistente de IA de Zakumi. Me pidieron saludarte por aquí — escríbeme cualquier cosa y conversamos. 🧡',
   'https://zakumistudio.com/folletos/generico.png')
on conflict (slug) do nothing;
