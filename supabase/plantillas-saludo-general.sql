-- ============================================================================
-- Saludo genérico → plantilla nueva `saludo_general` (2026-09-13).
--
-- Por qué: la edición de `saludo_zakumi` del 13 sep salió con el texto viejo
-- y Meta la contó igual (límite de 1 edición cada 24 h por plantilla). En vez
-- de esperar el cupo se creó una plantilla NUEVA en Meta — `saludo_general`
-- (id 1468817021745554, MARKETING, es), con la imagen generico-v2.jpg y el
-- texto que dice qué es Zakumi y qué vende — y la fila del genérico pasa a
-- apuntar a ella. `saludo_zakumi` sigue aprobada en Meta, pero ya nadie la
-- manda. Una base NUEVA no necesita este archivo: el seed de plantillas.sql
-- ya trae saludo_general.
--
-- Cómo: la fila queda como una edición EN REVISIÓN (borrador = lo nuevo,
-- vigente = lo viejo, estado PENDING). Así el selector del cockpit no deja
-- mandar el genérico hasta que Meta apruebe, y «Refrescar estados» en
-- /admin/zak → Plantillas promueve borrador→vigente en cuanto vea APPROVED
-- con este mismo texto (por eso el texto de abajo es byte a byte el que Meta
-- guardó). Si Meta ya aprobó cuando se corre esto, un solo refresco lo deja
-- sincronizado.
--
-- Orden:
--   1) merge + deploy de la PR: la imagen tiene que responder en
--      https://zakumistudio.com/folletos/generico-v2.jpg ANTES del primer
--      envío (Meta la descarga en cada envío, no la guarda).
--   2) este archivo en el SQL Editor de Supabase.
--   3) /admin/zak → Plantillas → «Refrescar estados».
--
-- Idempotente: si la fila ya apunta a saludo_general no toca nada.
-- ============================================================================

update public.plantillas_zak
set
  plantilla            = 'saludo_general',
  texto_borrador       = E'¡Hola! 👋 Soy Zak, el asistente de IA de Zakumi Estudio.\n\nAyudamos a negocios como el tuyo a vender más y atender mejor con tecnología hecha a la medida:\n\n🤖 Agentes de IA para WhatsApp que responden, toman pedidos y captan clientes 24/7\n📞 Agentes de voz que contestan y hacen llamadas por ti\n🌐 Páginas web y tiendas en línea con pasarela de pagos\n📊 CRM y automatizaciones para no perder ningún cliente\n\nCuéntame qué hace tu negocio y te digo cómo podemos ayudarte. Si quieres, te mando el brochure con servicios y precios. 🧡',
  folleto_url_borrador = 'https://zakumistudio.com/folletos/generico-v2.jpg',
  borrador_enviado_en  = now(),
  estado_meta          = 'PENDING',
  motivo_rechazo       = null,
  categoria_meta       = 'MARKETING',
  meta_template_id     = '1468817021745554',
  envios_revision      = '{}'::timestamptz[]   -- plantilla nueva: el contador de ediciones arranca en cero
where slug = 'generico'
  and plantilla <> 'saludo_general';
