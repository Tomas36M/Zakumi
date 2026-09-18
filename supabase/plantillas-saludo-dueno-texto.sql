-- ============================================================================
-- ⚠️ SUPERADO el mismo 2026-09-18 por `plantillas-saludo-dueno-v2.sql`: la
-- fila `generico` ya no sigue a `saludo_dueno` sino a `saludo_dueno_v2`, con
-- el texto que escribió Tomás. Este archivo queda como registro; correrlo hoy
-- revienta a propósito en la guarda de abajo (la fila no apunta a
-- `saludo_dueno`), que es lo que tiene que pasar.
--
-- Texto nuevo de `saludo_dueno` (2026-09-18, segunda versión del copy).
--
-- Por qué: Tomás probó la primera versión en su celular y la rechazó por tres
-- cosas — anunciaba que el mensaje lo escribe una IA (regala la sospecha de
-- estafa antes de la primera frase), vendía solo agentes de WhatsApp cuando la
-- imagen del header ofrece páginas web y aplicaciones, y cerraba con una
-- pregunta mal redactada («¿hablo con el dueño o con quien atiende?»).
--
-- El texto de abajo nombra los TRES servicios con las mismas palabras de la
-- imagen, en una línea y sin viñetas (el menú con viñetas de `saludo_general`
-- es lo que invitaba a la contestadora), y cierra en una pregunta de sí o no
-- que solo una persona puede contestar.
--
-- ⚠️ Se mandó a Meta como EDICIÓN de la misma plantilla (POST al template id
-- 3260201447512388), no como plantilla nueva: `saludo_dueno` se creó ese mismo
-- día y no había gastado su edición (Meta permite 1 cada 24 h y cuenta las
-- «sin cambios»). Por eso ni el nombre ni el id de la fila cambian aquí.
-- Después de esto, NO hay más ediciones disponibles hasta mañana.
--
-- Esto escribe en la fila lo mismo que habría escrito el panel al editar
-- (`enviarARevisionPlantilla`), incluido el timestamp en `envios_revision`:
-- sin él, el contador de ediciones del panel creería que la de hoy sigue
-- libre y dejaría quemar el intento contra el límite de Meta.
--
-- Después: esperar APPROVED → «Refrescar estados» en /admin/zak → Plantillas
-- (promueve borrador→vigente). Mientras Meta revise, el envío del genérico
-- queda bloqueado a propósito, así que no hay riesgo de mandar el texto viejo.
--
-- Idempotente: si el borrador ya es este texto, no toca nada (y no vuelve a
-- anotar una edición).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from public.plantillas_zak
    where slug = 'generico' and plantilla = 'saludo_dueno'
  ) then
    raise exception 'La fila `generico` no apunta a saludo_dueno: corre antes supabase/plantillas-saludo-dueno.sql';
  end if;
end $$;

update public.plantillas_zak
set
  texto_borrador       = E'Hola, buenas 👋 Soy Zak, de Zakumi Estudio, en Bogotá.\n\nHacemos tres cosas para negocios como el tuyo: páginas web que convierten, aplicaciones web y móviles, y agentes de IA que atienden tu WhatsApp para que no se quede ningún cliente sin respuesta.\n\nAntes de contarte más: ¿con quién hablo? ¿Eres el dueño del negocio?',
  folleto_url_borrador = 'https://zakumistudio.com/folletos/generico-v2.jpg',
  borrador_enviado_en  = now(),
  estado_meta          = 'PENDING',
  motivo_rechazo       = null,
  envios_revision      = array_append(envios_revision, now())
where slug = 'generico'
  and plantilla = 'saludo_dueno'
  and texto_borrador is distinct from E'Hola, buenas 👋 Soy Zak, de Zakumi Estudio, en Bogotá.\n\nHacemos tres cosas para negocios como el tuyo: páginas web que convierten, aplicaciones web y móviles, y agentes de IA que atienden tu WhatsApp para que no se quede ningún cliente sin respuesta.\n\nAntes de contarte más: ¿con quién hablo? ¿Eres el dueño del negocio?';
