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

Segunda versión, del 18 sep. La primera se probó en el celular de Tomás y se
cayó — ver «Lo que no va», abajo.

```
Hola, buenas 👋 Soy Zak, de Zakumi Estudio, en Bogotá.

Hacemos tres cosas para negocios como el tuyo: páginas web que convierten,
aplicaciones web y móviles, y agentes de IA que atienden tu WhatsApp para que
no se quede ningún cliente sin respuesta.

Antes de contarte más: ¿con quién hablo? ¿Eres el dueño del negocio?
```

Tres decisiones, por si se quiere discutir alguna:

1. **Los tres servicios, con las palabras de la imagen.** El header ofrece
   «Páginas web que convierten · Aplicaciones web y móviles · Agentes de IA
   para tu negocio»: un texto que vendiera solo agentes de WhatsApp diría menos
   que su propia imagen, y eso se lee como error. Van en UNA línea y sin
   viñetas — el menú con viñetas de `saludo_general` es justo lo que invitaba a
   la contestadora.
2. **Zak firma, no se declara.** Ni «este mensaje lo escribe una IA» ni
   «asistente de inteligencia artificial»: ponerse la etiqueta de robot en la
   primera frase regala la sospecha que el mensaje tiene que desarmar. Que
   vendemos agentes de IA sí se dice — es lo que ofrecemos, no lo que firmamos.
3. **Cierra en una pregunta de sí o no que solo una persona contesta**
   («¿eres el dueño del negocio?»). Es lo más fácil de responder que existe y
   ninguna bienvenida automática la responde. Si no llega respuesta, el número
   cae en la cola de llamadas.

Sin cifras (regla dura: los precios los dice la página).

### Lo que no va (v1, rechazada el 18 sep)

El primer texto abría con «Este mensaje lo escribe una IA: soy Zak, el
asistente de Zakumi Estudio», vendía solo agentes de WhatsApp y cerraba con
«¿Hablo con el dueño o con quien decide estas cosas?». Tomás lo probó en su
celular y lo bajó por las tres cosas: la declaración de IA («esto no por
dios»), la omisión de las páginas web que la imagen sí ofrece, y la pregunta
mal redactada. Quedó como regla en el wiki de preferencias del usuario.

Cambiar el texto es cambiar **un string en tres archivos**, y los tres tienen
que quedar idénticos byte a byte (Meta guarda el texto y el panel lo compara
para promover borrador→vigente):

- `whatsapp-bot/scripts/crear_plantilla_saludo.py` → `CUERPO`
- `supabase/plantillas-saludo-dueno-texto.sql` → `texto_borrador`
- `src/lib/admin/zak.ts` → `PLANTILLA_SALUDO_TEXTO` (el espejo que se guarda
  como mensaje del asistente al abrir el chat)

## Runbook de encendido

La plantilla **nueva** se crea; `saludo_general` no se edita. Meta solo acepta
**1 edición cada 24 h** por plantilla aprobada y cuenta las ediciones «sin
cambios» — esa trampa ya costó un día el 13 sep.

1. **Crear en Meta** (la aprobación tarda de minutos a 24 h):

   ```
   railway run --service bot python scripts/crear_plantilla_saludo.py
   ```

   Imprime el id y el estado. Con `--dry` solo muestra el payload sin crear.

   ✅ **HECHO el 2026-09-18**: `saludo_dueno` = **`3260201447512388`**,
   PENDING · MARKETING · `es`, header de imagen (`generico-v2.jpg`), cuerpo
   verificado idéntico al `CUERPO` del script. Se creó llamando al Graph API con
   el mismo payload del script (dos pasos: `POST /{app_id}/uploads` + bytes con
   `Authorization: OAuth` → `header_handle`, y `POST /{waba}/message_templates`)
   porque el checkout del sitio no tiene `railway link` ni el `DATABASE_URL` del
   bot, y el script necesita la fila de la instancia. El script sigue siendo el
   camino reproducible: correrlo ahora ve que ya existe y no duplica.

2. **Esperar APPROVED**: `/admin/zak` → Plantillas → «Refrescar estados», o
   mirar la consola de Meta.

3. **Apuntar el genérico a la plantilla nueva**: correr
   `supabase/plantillas-saludo-dueno.sql` en el SQL Editor de Supabase — el id
   del paso 1 **ya está pegado** ahí (si algún día se crea otra plantilla, ese
   es el único valor que hay que cambiar).

4. **Refrescar estados** otra vez en el panel: con APPROVED y el texto
   coincidente, el borrador pasa a vigente y el selector deja mandarla.

5. La primera tanda con el texto nuevo va **con la cola de llamadas al lado**:
   lo que no responda queda en `/admin/zak` → Voz → **Por llamar**.

6. **Si el texto cambia después de aprobada** (pasó el 18 sep con la v1): es
   una EDICIÓN de `saludo_dueno`, no una plantilla nueva — mientras le quede
   edición disponible (1 cada 24 h, 10 cada 30 días). Se manda el POST al
   template id con los components COMPLETOS (header + body) y se corre
   `supabase/plantillas-saludo-dueno-texto.sql`, que anota la edición en
   `envios_revision` igual que lo haría el panel: sin ese apunte, el contador
   del panel cree que la edición del día sigue libre y deja quemar el intento.

`saludo_general` queda aprobada en Meta y nadie la manda, igual que
`saludo_zakumi`. No se borra: borrar una plantilla aprobada es perder el
historial de su calidad.
