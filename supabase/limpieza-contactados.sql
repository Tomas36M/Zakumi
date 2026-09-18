-- ============================================================================
-- Limpiar la lista de negocios: sacar del camino a los «contactado» que nunca
-- dieron señales, y dejar trabajando solo a los que respondieron o se
-- interesaron (2026-09-18, pedido de Tomás).
--
-- ⚠️ ESTO NO BORRA FILAS, Y ES A PROPÓSITO. Las tres razones, medidas:
--
--   1. Cada fila se pagó DOS veces: la consulta a Google Places que la
--      descubrió (US$0,035 por tesela) y la plantilla de WhatsApp que se le
--      entregó ($46 COP). Y no vuelven solas: su tesela queda marcada en
--      `teselas_hechas`, así que un barrido normal de esa zona NO la vuelve a
--      consultar — borrarlas es perderlas de verdad.
--   2. Borrar la fila del CRM no borra su conversación: los chats viven en la
--      base del bot (Railway), que es otra. La cola «Por llamar» y la bandeja
--      seguirían mostrando esos números, pero sin nombre, sin vertical y sin
--      `negocio_id` — o sea, teléfonos pelados, y «Llamar con IA» dejaría de
--      correlacionar la llamada con el CRM.
--   3. `descartado` ya hace lo que se busca: un negocio descartado NO entra en
--      las tandas ni en el barrido (`/admin/api/zak/negocios` excluye
--      `cliente` y `descartado`), así que deja de estorbar igual que si no
--      existiera — pero si escribe, sigue teniendo nombre e historia.
--
-- Y LO IMPORTANTE para el «si ellos escriben pues genial»: esto se hace por
-- SQL y NO por el panel. El cambio de estado del panel (la ficha o el cambio
-- en lote) pone `estado_fijado_manual = true`, que CONGELA la fila: la
-- sincronización de Zak no la vuelve a mover nunca, así que si esa persona
-- escribiera, jamás pasaría a `respondido` ni a `interesado`. Acá se deja el
-- candado en false.
-- ============================================================================

-- Requisito: la columna `estado_fijado_manual` la crea
-- `supabase/zak-automatizacion.sql`. Si el PASO 1 se queja de que no existe,
-- corre ese archivo primero (es idempotente, solo `add column if not exists`).
--
-- ---------------------------------------------------------------------------
-- PASO 1 — mirar antes de tocar (solo lectura). Corre esto primero y revisa
-- las cifras: es la única foto de lo que el paso 2 va a mover.
-- ---------------------------------------------------------------------------
select estado,
       count(*)                                                as negocios,
       count(*) filter (where estado_fijado_manual)             as fijados_a_mano,
       count(*) filter (where telefono is not null)             as con_telefono
from public.negocios
group by estado
order by negocios desc;

-- ---------------------------------------------------------------------------
-- PASO 2 — apartar los contactados sin señales.
--
-- Qué NO toca: `respondido`, `interesado`, `cliente` (los que sí dieron
-- señales), ni `nuevo` (esos todavía no se han trabajado: no hay nada que
-- limpiar ahí, y son la materia prima de la próxima tanda), ni nada que ya
-- tenga el estado fijado a mano.
--
-- Deja constancia en `notas` para que dentro de un mes se sepa por qué esta
-- fila está descartada y no parezca un descarte a dedo.
-- ---------------------------------------------------------------------------
with apartados as (
  update public.negocios
  set estado               = 'descartado',
      estado_fijado_manual = false,   -- que la automatización los pueda revivir
      updated_at           = now()
  where estado = 'contactado'
    and not estado_fijado_manual
  returning id
)
insert into public.notas (negocio_id, texto, automatica)
select id,
       'Descartado en la limpieza del 18 sep 2026: se le escribió y no dio señales. '
       'Si escribe, la sincronización de Zak lo vuelve a mover (el estado no quedó fijado a mano).',
       true
from apartados;

-- ---------------------------------------------------------------------------
-- PASO 3 — comprobar (solo lectura). Los descartados de hoy y cuántos quedan
-- trabajando.
-- ---------------------------------------------------------------------------
select estado, count(*) as negocios
from public.negocios
group by estado
order by negocios desc;
