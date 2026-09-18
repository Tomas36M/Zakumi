-- ============================================================================
-- El genérico pasa a `saludo_dueno_v2` (2026-09-18) — plantilla NUEVA.
--
-- El texto lo escribió Tomás después de probar la versión anterior en su
-- celular: se presenta como agente de IA, dice qué es Zakumi, nombra los tres
-- servicios de la imagen y cierra preguntando si habla con el dueño, más el
-- enlace a la página. Acá va con la puntuación corregida y ni una palabra
-- cambiada.
--
-- ⚠️ Por qué otra plantilla y no una edición: `saludo_dueno` ya había gastado
-- su edición del día (Meta respondió `code 100 · subcode 2388124 — "Solo
-- puedes editar una plantilla activa una vez cada 24 horas"`). Esperar a
-- mañana costaba un día de prospección, así que se creó `saludo_dueno_v2`
-- (id 3404517709727463, MARKETING · es, header de imagen, cero variables).
-- `saludo_dueno` queda aprobada en Meta y nadie la manda, igual que
-- `saludo_general` y `saludo_zakumi`.
--
-- `envios_revision` vuelve a '{}': la fila pasa a seguir una plantilla nueva,
-- cuyo contador de ediciones de Meta arranca limpio. Dejar el timestamp de la
-- edición de ayer haría que el panel se niegue a editar una plantilla que sí
-- puede.
--
-- Cómo queda: en revisión (borrador = este texto, vigente = el viejo, estado
-- PENDING). El envío del genérico está bloqueado a propósito mientras Meta
-- revise, así que no hay riesgo de mandar el texto anterior. Al aprobar,
-- «Refrescar estados» en /admin/zak → Plantillas promueve borrador→vigente.
--
-- Idempotente: si la fila ya apunta a esta plantilla con este texto, no toca
-- nada.
-- ============================================================================

update public.plantillas_zak
set
  plantilla            = 'saludo_dueno_v2',
  meta_template_id     = '3404517709727463',
  texto_borrador       = E'¡Hola! ¿Qué tal? Soy Zak, un agente de inteligencia artificial. Te escribo de Zakumi Estudio, una agencia de software que ayuda a emprendedores a impulsar sus ventas.\n\nHacemos tres cosas para negocios como el tuyo: páginas web que convierten, aplicaciones web y móviles, y agentes de IA que atienden tu WhatsApp para que no se quede ningún cliente sin respuesta.\n\nAntes de contarte más: ¿con quién hablo? ¿Eres el dueño del negocio?\n\n¿Quieres más información? Visita nuestra página web: https://zakumistudio.com/',
  folleto_url_borrador = 'https://zakumistudio.com/folletos/generico-v2.jpg',
  borrador_enviado_en  = now(),
  estado_meta          = 'PENDING',
  motivo_rechazo       = null,
  envios_revision      = '{}'::timestamptz[]
where slug = 'generico'
  and (
    plantilla is distinct from 'saludo_dueno_v2'
    or texto_borrador is distinct from E'¡Hola! ¿Qué tal? Soy Zak, un agente de inteligencia artificial. Te escribo de Zakumi Estudio, una agencia de software que ayuda a emprendedores a impulsar sus ventas.\n\nHacemos tres cosas para negocios como el tuyo: páginas web que convierten, aplicaciones web y móviles, y agentes de IA que atienden tu WhatsApp para que no se quede ningún cliente sin respuesta.\n\nAntes de contarte más: ¿con quién hablo? ¿Eres el dueño del negocio?\n\n¿Quieres más información? Visita nuestra página web: https://zakumistudio.com/'
  );
