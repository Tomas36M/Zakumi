# Plantilla de saludo en frío: `saludo_dueno` (2026-09-18)

El primer mensaje de una tanda. Reemplaza a `saludo_general` en el genérico.

## Por qué se reescribe

Los números de las tandas 4, 5 y 6 (15–17 sep, 150 negocios) dicen tres cosas:

- **Lo abren**: 75 de los 108 que llegaron a un teléfono = **69 %**. No es un
  problema de visibilidad ni de spam.
- **Casi nadie contesta de verdad**: de 22 conversaciones con respuesta, **18
  eran la contestadora del negocio** (horario, menú, «gracias por tu
  mensaje»). En las tandas 4 y 5 juntas, 16 respuestas = 15 máquinas + 1
  humano. Personas de verdad en todo el histórico: dos.
- **El texto viejo invita a la máquina.** Era un catálogo de cuatro servicios
  con emojis que terminaba en «Cuéntame qué hace tu negocio» — y del otro lado
  hay un número de atención al cliente cuyo oficio es responder eso con su
  bienvenida automática. Nada decía que quien escribe **no es un cliente**, ni
  pedía al dueño.

Lo que sí funcionaba estaba en el turno equivocado: el segundo mensaje de Zak
sabía decir «parece que esto llegó como si yo fuera tu cliente 😄». Eso va
ahora en el primero.

## El texto (el que van a leer 50 negocios)

```
¡Hola! 👋 Este mensaje lo escribe una IA: soy Zak, el asistente de Zakumi
Estudio. No te escribo para pedir nada — esto es justo lo que hacemos.

Montamos agentes como yo para que atiendan el WhatsApp de un negocio:
responden al instante, toman el pedido o la reserva completos y no se les
escapa un cliente en hora pico.

¿Hablo con el dueño o con quien decide estas cosas? Te muestro en un minuto
cómo se vería en tu negocio.
```

Tres decisiones, por si se quiere discutir alguna:

1. **Abre diciendo que es una IA.** Es verdad, desarma la sospecha de estafa y
   de paso es la demostración del producto: el mensaje que lee es el trabajo
   que vende. No hay forma más corta de explicar qué hacemos.
2. **«No te escribo para pedir nada»** es la línea que rompe el reflejo de la
   contestadora: el humano que abra el chat después entiende en un segundo que
   esto no es un pedido.
3. **Termina en una pregunta que solo un humano puede contestar** («¿hablo con
   el dueño?»). Su bot no sabe responderla, así que la respuesta —si llega— es
   de una persona. Y si no llega, el número cae en la cola de llamadas.

Sin cifras (regla dura: los precios los dice la página) y sin lista de
viñetas, que en chat se leen mal.

### Alternativa más sobria

Si el «lo escribe una IA» no convence, esta dice lo mismo sin el gancho:

```
¡Hola! 👋 Soy Zak, el asistente de IA de Zakumi Estudio. Ojo: no soy un
cliente escribiendo, te escribo por trabajo.

Montamos agentes como yo para que atiendan el WhatsApp de un negocio:
responden, toman pedidos y reservas y no pierden clientes en hora pico.

¿Hablo con el dueño? Te muestro en un minuto cómo se vería en el tuyo.
```

Cambiarla es cambiar **un string en dos archivos**, y tienen que quedar
idénticos byte a byte (Meta guarda el texto y el panel lo compara para
promover borrador→vigente):

- `whatsapp-bot/scripts/crear_plantilla_saludo.py` → `CUERPO`
- `supabase/plantillas-saludo-dueno.sql` → `texto_borrador`

## Runbook de encendido

La plantilla **nueva** se crea; `saludo_general` no se edita. Meta solo acepta
**1 edición cada 24 h** por plantilla aprobada y cuenta las ediciones «sin
cambios» — esa trampa ya costó un día el 13 sep.

1. **Crear en Meta** (la aprobación tarda de minutos a 24 h):

   ```
   railway run --service bot python scripts/crear_plantilla_saludo.py
   ```

   Imprime el id y el estado. Con `--dry` solo muestra el payload sin crear.

2. **Esperar APPROVED**: `/admin/zak` → Plantillas → «Refrescar estados», o
   mirar la consola de Meta.

3. **Apuntar el genérico a la plantilla nueva**: pegar el id que imprimió el
   paso 1 en `supabase/plantillas-saludo-dueno.sql` y correrlo en el SQL Editor
   de Supabase.

4. **Refrescar estados** otra vez en el panel: con APPROVED y el texto
   coincidente, el borrador pasa a vigente y el selector deja mandarla.

5. La primera tanda con el texto nuevo va **con la cola de llamadas al lado**:
   lo que no responda queda en `/admin/zak` → Voz → **Por llamar**.

`saludo_general` queda aprobada en Meta y nadie la manda, igual que
`saludo_zakumi`. No se borra: borrar una plantilla aprobada es perder el
historial de su calidad.
