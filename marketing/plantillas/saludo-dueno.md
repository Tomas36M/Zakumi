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

**Versión viva: la escribió Tomás el 18 sep**, después de probar en su celular
las dos que había escrito Claude. Plantilla `saludo_dueno_v2`, id de Meta
`3404517709727463`. Acá va con la puntuación corregida y ni una palabra
cambiada.

```
¡Hola! ¿Qué tal? Soy Zak, un agente de inteligencia artificial. Te escribo de
Zakumi Estudio, una agencia de software que ayuda a emprendedores a impulsar
sus ventas.

Hacemos tres cosas para negocios como el tuyo: páginas web que convierten,
aplicaciones web y móviles, y agentes de IA que atienden tu WhatsApp para que
no se quede ningún cliente sin respuesta.

Antes de contarte más: ¿con quién hablo? ¿Eres el dueño del negocio?

¿Quieres más información? Visita nuestra página web: https://zakumistudio.com/
```

Qué conserva de lo aprendido:

1. **Los tres servicios, con las palabras de la imagen**, en una línea y sin
   viñetas — el menú con viñetas de `saludo_general` es lo que invitaba a la
   contestadora del negocio.
2. **Cierra en una pregunta de sí o no que solo una persona contesta**
   («¿eres el dueño del negocio?»). Si no llega respuesta, el número cae en la
   cola de llamadas.
3. **Sin cifras** (regla dura: los precios los dice la página) y sin variables
   — la personalización con el nombre del negocio es cosa del agente de voz,
   que ya llama a un local con nombre.

Y una decisión que es de Tomás, no de la evidencia: **se presenta como agente
de inteligencia artificial**. Claude había quitado esa frase; él la volvió a
poner al reescribir el texto. Queda dicho para que nadie la "arregle" creyendo
que es un descuido.

### El historial de esta plantilla (por qué hay tres)

| Plantilla | Texto | Estado |
|---|---|---|
| `saludo_general` | catálogo de 4 servicios con viñetas | aprobada, sin uso |
| `saludo_dueno` | v1 de Claude («este mensaje lo escribe una IA»), editada a v2 | aprobada, sin uso |
| `saludo_dueno_v2` | **el de Tomás — el que se manda** | la viva |

El tercer cambio del día ya no cupo como edición: Meta respondió
`code 100 · subcode 2388124 — «Solo puedes editar una plantilla activa una vez
cada 24 horas»`. Esperar hasta el otro día costaba una jornada de prospección,
así que se creó la plantilla nueva. **Esa es la razón de la regla «se crea, no
se edita»**, y ahora está medida: la primera edición del día pasó, la segunda
rebotó.

Cambiar el texto es cambiar **un string en tres archivos**, y los tres tienen
que quedar idénticos byte a byte (Meta guarda el texto y el panel lo compara
para promover borrador→vigente):

- `whatsapp-bot/scripts/crear_plantilla_saludo.py` → `CUERPO`
- `supabase/plantillas-saludo-dueno-v2.sql` → `texto_borrador`
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
