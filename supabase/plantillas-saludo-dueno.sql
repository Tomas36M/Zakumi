-- ============================================================================
-- Saludo en frío → plantilla nueva `saludo_dueno` (2026-09-18).
--
-- Por qué: las tandas 4, 5 y 6 (15–17 sep, 150 negocios) dejaron el dato
-- crudo. El 69 % de los que reciben el mensaje LO ABREN, pero de 22
-- conversaciones con respuesta, 18 eran la contestadora del negocio (horario,
-- menú, «gracias por tu mensaje»); en las tandas 4 y 5 juntas, 16 respuestas =
-- 15 máquinas + 1 humano. El texto viejo (`saludo_general`) era un catálogo de
-- cuatro servicios que terminaba en «Cuéntame qué hace tu negocio» — o sea,
-- justo lo que la bienvenida automática de un número de atención al cliente
-- está hecha para contestar. No decía en ninguna parte que quien escribe NO es
-- un cliente, ni preguntaba por el dueño.
--
-- El texto nuevo dice las tres cosas que faltaban: que lo escribe una IA (que
-- es la demostración del producto), que no viene a pedir nada, y una pregunta
-- que solo una persona puede contestar («¿hablo con el dueño?»). Detalle y
-- alternativa de copy: marketing/plantillas/saludo-dueno.md.
--
-- Se CREA una plantilla nueva, no se edita `saludo_general`: Meta solo acepta
-- 1 edición cada 24 h por plantilla aprobada y cuenta las «sin cambios» (la
-- trampa que costó un día el 13 sep). `saludo_general` queda aprobada y nadie
-- la manda, igual que `saludo_zakumi`.
--
-- ⚠️ Pasos 1 y 2 ya HECHOS el 2026-09-18: la plantilla está creada en Meta
-- (id `3260201447512388`, PENDING · MARKETING · es, header de imagen) y el id
-- ya está pegado abajo. Se creó con el mismo payload del script
-- (`whatsapp-bot/scripts/crear_plantilla_saludo.py`, que sigue siendo el camino
-- reproducible: correrlo otra vez ve que ya existe y no duplica nada) porque
-- este checkout no tiene railway linkeado ni DATABASE_URL del bot.
--   3) el texto de abajo es IDÉNTICO byte a byte al `CUERPO` del script y al
--      que quedó guardado en Meta (verificado) — el panel compara el texto
--      para promover borrador→vigente.
--
-- Cómo queda: como una edición EN REVISIÓN (borrador = lo nuevo, vigente = lo
-- viejo, estado PENDING). El selector del cockpit no deja mandar el genérico
-- hasta que Meta apruebe, y «Refrescar estados» en /admin/zak → Plantillas
-- promueve borrador→vigente en cuanto vea APPROVED con este mismo texto.
--
-- Idempotente: si la fila ya apunta a saludo_dueno no toca nada.
-- ============================================================================

-- Guarda: sin el id real de Meta, esto REVIENTA con un mensaje claro en vez de
-- correr en silencio (una fila apuntando a un template_id inventado rompe
-- «Refrescar estados» sin decir por qué). El lado derecho está partido a
-- propósito: un reemplazar-todo del marcador no lo toca.
do $$
begin
  if '3260201447512388' = 'PEGAR_ID' || '_META' then
    raise exception 'Falta pegar el meta_template_id: corre antes whatsapp-bot/scripts/crear_plantilla_saludo.py y pon el id que imprima';
  end if;
end $$;

update public.plantillas_zak
set
  plantilla            = 'saludo_dueno',
  texto_borrador       = E'¡Hola! 👋 Este mensaje lo escribe una IA: soy Zak, el asistente de Zakumi Estudio. No te escribo para pedir nada — esto es justo lo que hacemos.\n\nMontamos agentes como yo para que atiendan el WhatsApp de un negocio: responden al instante, toman el pedido o la reserva completos y no se les escapa un cliente en hora pico.\n\n¿Hablo con el dueño o con quien decide estas cosas? Te muestro en un minuto cómo se vería en tu negocio.',
  folleto_url_borrador = 'https://zakumistudio.com/folletos/generico-v2.jpg',
  borrador_enviado_en  = now(),
  estado_meta          = 'PENDING',
  motivo_rechazo       = null,
  categoria_meta       = 'MARKETING',
  meta_template_id     = '3260201447512388',
  envios_revision      = '{}'::timestamptz[]   -- plantilla nueva: el contador de ediciones arranca en cero
where slug = 'generico'
  and plantilla <> 'saludo_dueno';
