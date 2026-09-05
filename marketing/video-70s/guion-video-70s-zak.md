# ZAKUMI — Video de 70 s con Zak

**Para Magnific · Seedance 2.0.** Cada prompt de abajo es **autocontenido**: lleva adentro la
descripción completa de Zak, la paleta, la luz y la cámara. Se copia y se pega tal cual en el
cuadro de Seedance, sin necesidad de ningún contexto previo.

> **Nota de nombre:** en `prompts-imagenes-zaku.md` la mascota se llama *ZAKU* y el agente de
> WhatsApp que ya está vivo se llama *Zak*. Son el mismo personaje. En el video uso **Zak**, que es
> el nombre al que la gente le escribe.

---

## Cómo generarlo en Magnific

1. **Sube `zaku_tech_render.png` como imagen de referencia** en cada generación. Es lo único que va
   a mantener a Zak idéntico entre tomas — el prompt escrito ayuda, pero la referencia visual manda.
2. **Un prompt = una toma.** No pidas varias escenas en un mismo prompt; el corte lo haces tú en
   edición.
3. **Encadena por último fotograma.** Cuando dos tomas son continuas (la 5 y la 6, la 8 y la 9),
   usa el último fotograma de la anterior como imagen de partida de la siguiente.
4. **Cero texto dentro del generador.** Todos los modelos de video siguen escribiendo mal. La placa
   final y los subtítulos van en edición.
5. **Genera 2 o 3 versiones de cada toma** y quédate con la que respete mejor a Zak. Descartar es
   parte del proceso, no una señal de que el prompt esté mal.

**Dos cosas que conviene que verifiques en la interfaz de Magnific** (varían según el plan y la
versión del modelo): la **duración máxima por clip** — el guion está armado en tomas de 5 a 7 s
para ir sobre seguro — y si la generación **trae audio**. El guion asume que **no**: la locución y
la música las montas aparte.

**Versión en inglés:** los mismos 12 prompts están traducidos en
`prompts-video-70s-zak-EN.md`. Si notas que Seedance no está respetando bien los prompts en
español, usa esos — casi todos los modelos de video obedecen mejor en inglés. La locución se queda
en español en las dos versiones.

---

## Personajes

**Zak** — bulldog francés robótico negro mate, mascota y agente de Zakumi. Va descrito completo
dentro de cada prompt.

**Marcela** — colombiana de unos 40 años, dueña de una tienda de ropa pequeña en Bogotá. Cálida,
cansada al principio, tranquila al final.

> **Truco de consistencia:** mantener una cara humana idéntica entre tomas es difícil y es el error
> que más se nota. Por eso el guion la muestra casi siempre en **manos, silueta, espalda y contraluz**,
> y le da **un solo plano de cara clara** (toma 9). Así el video se ve intencional en vez de
> descuidado. Si quieres más cara, genera primero un retrato de referencia de ella en Magnific y
> súbelo junto al de Zak.

---

## Estructura

| Bloque | Seg | Qué hace |
|---|---|---|
| Gancho | 0–10 | El dolor, sin explicarlo |
| Zak | 10–18 | Aparece el protagonista |
| El caso | 18–38 | Zak trabaja de noche |
| El resultado | 38–46 | La mañana siguiente |
| **Qué es Zakumi** | **46–65** | El estudio, los tres pilares, la idea de fondo |
| Cierre | 65–70 | A dónde escribir |

---

## Locución

Español de Colombia, cálida y conversacional, ritmo pausado. Que suene a alguien contando algo que
vio, no vendiendo. ~165 palabras.

| Seg | Locución |
|---|---|
| 0–04 | *(silencio: solo el celular vibrando)* |
| 04–10 | "Once de la noche. Tu negocio cerró hace rato. Tu WhatsApp no." |
| 10–14 | "Y cada mensaje que no contestas es una venta que se fue a otra parte." |
| 14–18 | "Él es Zak. Es un agente de inteligencia artificial. Y no duerme." |
| 18–26 | "Responde el precio. Confirma la talla. Toma el pedido." |
| 26–32 | "Cobra. Y agenda el domicilio para mañana temprano." |
| 32–38 | "Mientras tanto, Marcela hizo algo rarísimo: se acostó a dormir." |
| 38–46 | "Al otro día no la esperan mensajes sin leer. La esperan pedidos listos para despachar." |
| 46–50 | "Eso es Zakumi." |
| 50–58 | "Un estudio pequeño, en Bogotá, que construye tres cosas para negocios como el tuyo." |
| 58–62 | "Agentes de inteligencia artificial que atienden y venden por WhatsApp, a toda hora." |
| 62–66 | "Software hecho a tu medida, para sacarte de los Excel y los cuadernos." |
| 66–70 | "Y tu marca, publicando sola. Escríbele a Zak: te atiende él mismo." |

> Si al grabar te queda largo, el corte natural es la línea de los 62–66. El bloque de Zakumi
> aguanta perder el software antes que perder los agentes.

**Música:** una sola pieza. Primera mitad mínima y nocturna (piano o sintetizador grave, notas
sueltas). Cambio de textura en el segundo 38, cuando entra la mañana — más aire, más luz. Corte
seco en el 66 para dejar la última frase limpia.

**Sonido:** el zumbido del celular en la toma 1 es el único efecto protagonista. Después, ambiente
suave: ciudad lejana de noche, la persiana de la tienda en la mañana.

---

# Los 12 prompts

Copia y pega cada bloque tal cual. Cada uno funciona solo.

---

### Toma 1 · 0–5 s · El celular que no para

```
Primer plano cenital de un smartphone moderno apoyado boca abajo sobre una mesa de madera oscura,
en la sala en penumbra de una casa colombiana modesta y cálida. Es de noche. El teléfono vibra
repetidamente y se desplaza unos milímetros sobre la superficie con cada zumbido; la pantalla,
oculta contra la mesa, filtra pulsos de luz naranja terracota que se reflejan en la madera. Una
sola lámpara cálida y lejana ilumina apenas el fondo, todo lo demás cae en negro carbón y azul
marino profundo. Fotografía cinematográfica realista, óptica de 85 mm, profundidad de campo muy
corta, grano fino. Cámara completamente estática con un temblor de mano casi imperceptible. Paleta
de negro carbón, azul marino y un único acento cálido naranja terracota. Sin ningún texto ni
número legible en la escena.
```

---

### Toma 2 · 5–10 s · Los mensajes que se acumulan

```
Plano lateral en contraluz de una mujer colombiana de unos 40 años, cabello oscuro recogido y ropa
cómoda de casa, sentada de perfil en el sofá de su sala en penumbra al final de un día largo. Su
rostro queda en sombra y solo se recorta su silueta contra el brillo azulado del smartphone que
sostiene; en la pantalla se acumulan burbujas de mensajes entrantes, una tras otra, sin ninguna
respuesta. Sus hombros se hunden ligeramente. Al fondo, muy desenfocadas, cajas de mercancía
apiladas de su tienda. Fotografía cinematográfica realista, óptica de 50 mm, profundidad de campo
corta. Iluminación de un solo brillo frío de pantalla contra la oscuridad. La cámara se acerca
muy lentamente. Paleta de negro carbón, azul marino y crema apagado. Sin ningún texto ni número
legible en la escena.
```

---

### Toma 3 · 10–14 s · La conversación sin responder

```
Plano macro de la pantalla de un smartphone sostenido por una mano femenina de mujer adulta: una
conversación de chat en la que van apareciendo burbujas grises entrantes, una tras otra, empujando
el hilo hacia arriba, sin que aparezca jamás una burbuja de respuesta. Las burbujas son formas
suaves y redondeadas, completamente vacías, sin letras ni números. El brillo de la pantalla es lo
único que ilumina la piel de la mano y el resto del encuadre está en negro. Fotografía
cinematográfica realista, óptica macro, profundidad de campo extrema con bokeh en los bordes.
Cámara fija; el único movimiento es el desplazamiento de la conversación. Paleta de negro carbón,
gris pizarra y azul marino. Sin ningún texto ni número legible en la escena.
```

---

### Toma 4 · 14–18 s · Zak se enciende

```
Zak, un bulldog francés robótico de cuerpo rechoncho y adorable con superficie negra mate suave,
mitad mascota y mitad robot de gama alta: finas articulaciones y costuras de metal oscuro, placas
sutiles en el lomo, ojos grandes y expresivos tipo pantalla, orejas de murciélago erguidas con un
fino borde de luz, hocico y detalles en gris carbón pulido y un collar-placa minimalista con un
acento naranja. Está sentado sobre el mostrador de madera de una pequeña tienda de ropa cerrada,
de noche. Empieza apagado e inmóvil y sus ojos tipo pantalla se encienden progresivamente en
naranja terracota cálido, mientras el borde de luz naranja de sus orejas cobra vida. Detrás, en
suave desenfoque, percheros con ropa y una persiana metálica bajada. Render 3D de personaje
premium, aspecto de figura coleccionable de alta gama, tierno y elegante. Óptica de 50 mm,
profundidad de campo corta con bokeh. Contrapicado muy suave que se acerca despacio. Paleta de
negro carbón, azul marino y naranja terracota. Sin ningún texto ni número legible en la escena.
```

---

### Toma 5 · 18–26 s · Zak atiende

```
Zak, un bulldog francés robótico de cuerpo rechoncho y adorable con superficie negra mate suave,
mitad mascota y mitad robot de gama alta: finas articulaciones y costuras de metal oscuro, placas
sutiles en el lomo, ojos grandes tipo pantalla que brillan en naranja terracota cálido, orejas de
murciélago erguidas con un fino borde de luz naranja, hocico gris carbón pulido y un collar-placa
minimalista con acento naranja. Lleva una pequeña diadema de call-center y está sentado en el
mostrador de una tienda de ropa por la noche, sosteniendo un smartphone con sus dos patas
delanteras y tecleando con precisión y concentración amable. En la pantalla, una conversación de
chat activa donde van apareciendo burbujas de respuesta en naranja terracota, rápidas y seguidas,
todas vacías y sin letras. Sobre el mostrador hay prendas dobladas y bolsas de empaque en color
crema. Render 3D de personaje premium, figura coleccionable de alta gama. Luz cálida de una
lámpara de mostrador más el brillo de la pantalla sobre su cara negra mate. Óptica de 50 mm,
travelling lateral lento. Paleta de negro carbón, azul marino, naranja terracota y crema. Sin
ningún texto ni número legible en la escena.
```

---

### Toma 6 · 26–32 s · La venta cerrada

```
Plano medio del mostrador de una tienda de ropa pequeña por la noche: un datáfono de pago con una
luz verde suave que acaba de confirmar una transacción y, junto a él, tres bolsas de pedido en
papel crema ya empacadas y alineadas, cada una con una etiqueta de envío en blanco y
completamente vacía. En un costado del encuadre, Zak, un bulldog francés robótico de cuerpo
rechoncho y adorable con superficie negra mate suave, articulaciones y costuras de metal oscuro,
ojos grandes tipo pantalla que brillan en naranja terracota cálido, orejas de murciélago erguidas
con un fino borde de luz naranja y un collar-placa minimalista con acento naranja, coloca con la
patita la última bolsa al final de la fila. Render 3D de personaje premium integrado en una escena
fotorrealista. Luz cálida cenital concentrada sobre el mostrador y el resto en penumbra. Óptica de
35 mm, descenso suave de cámara. Paleta de negro carbón, naranja terracota y crema. Sin ningún
texto ni número legible en la escena.
```

---

### Toma 7 · 32–38 s · Marcela se acuesta

```
Plano fijo del interior de una habitación sencilla y cálida de noche. Una mujer colombiana de unos
40 años, vista de espaldas y de medio cuerpo, extiende el brazo y apaga la lámpara de la mesa de
noche con un gesto tranquilo y sin prisa. La luz cálida se extingue y la habitación queda en una
penumbra azulada con un solo hilo de luz de la calle entrando por las rendijas de la persiana.
Sensación de calma, no de agotamiento. Fotografía cinematográfica realista, óptica de 35 mm,
profundidad de campo media. Cámara completamente estática: todo el movimiento de la toma lo hace
el cambio de luz. Paleta de azul marino profundo, negro carbón y un resto de naranja terracota que
desaparece. Sin ningún texto ni número legible en la escena.
```

---

### Toma 8 · 38–43 s · Amanece

```
Amanecer con luz natural dorada y suave. Desde el interior de una pequeña tienda de ropa, la
silueta a contraluz de una mujer colombiana de unos 40 años levanta la persiana metálica y la luz
de la mañana entra de golpe, barriendo el local. Sobre el mostrador de madera aparecen seis bolsas
de pedido en papel crema, perfectamente alineadas y listas para despachar, con etiquetas en blanco
completamente vacías. El polvo flota en el haz de luz. Fotografía cinematográfica realista, óptica
de 35 mm, profundidad de campo media, entrada lenta de cámara hacia el mostrador. Paleta de crema,
madera cálida, dorado suave y acentos de naranja terracota. Sin ningún texto ni número legible en
la escena.
```

---

### Toma 9 · 43–46 s · La cara de Marcela

```
Primer plano del rostro de una mujer colombiana de unos 40 años, cabello oscuro recogido, piel
real con textura y pequeñas líneas de expresión, iluminada por la luz dorada y suave de la mañana
que entra de lado. Mira algo fuera de cuadro y una sonrisa contenida de sorpresa agradable le
crece despacio; los hombros se le sueltan. Fondo de tienda de ropa completamente desenfocado en
tonos crema y madera. Fotografía cinematográfica realista, óptica de 85 mm, profundidad de campo
muy corta. Cámara fija. Paleta de crema, dorado cálido y un acento suave de naranja terracota. Sin
ningún texto ni número legible en la escena.
```

---

### Toma 10 · 46–52 s · Eso es Zakumi

```
Retrato editorial de estudio: Zak, un bulldog francés robótico de cuerpo rechoncho y adorable con
superficie negra mate suave, mitad mascota y mitad robot de gama alta, con finas articulaciones y
costuras de metal oscuro, placas sutiles en el lomo, ojos grandes tipo pantalla que brillan en
naranja terracota cálido, orejas de murciélago erguidas con un fino borde de luz naranja, hocico
gris carbón pulido y un collar-placa minimalista con acento naranja, está sentado sobre el
mostrador de madera de una tienda de ropa junto a una mujer colombiana de unos 40 años de pie
detrás del mostrador. Ambos miran directamente a cámara con expresión tranquila y amable.
Composición asimétrica y elegante con generoso aire negativo a la derecha del encuadre. El fondo
de la tienda queda en suave desenfoque. Render 3D de personaje premium integrado con fotografía
realista, luz de estudio suave y direccional. Óptica de 50 mm, profundidad de campo corta, cámara
totalmente fija. Paleta de negro carbón, crema, azul marino y naranja terracota. Sin ningún texto
ni número legible en la escena.
```

---

### Toma 11a · 52–58 s · Pilar 1, los agentes

```
Zak, un bulldog francés robótico de cuerpo rechoncho y adorable con superficie negra mate suave,
articulaciones y costuras de metal oscuro, ojos grandes tipo pantalla que brillan en naranja
terracota cálido, orejas de murciélago erguidas con un fino borde de luz naranja y un collar-placa
minimalista con acento naranja, sentado de noche ante un escritorio-consola con una ventana oscura
detrás que sugiere la madrugada. Atiende al mismo tiempo tres dispositivos: un smartphone, una
tablet y un portátil, cada uno con una conversación de chat distinta hecha de burbujas suaves y
completamente vacías, sin letras. Gira la cabeza de una pantalla a otra con soltura. Render 3D de
personaje premium, figura coleccionable de alta gama. Luz cálida de lámpara de escritorio más el
brillo de las tres pantallas sobre su cara negra mate. Óptica de 35 mm, empuje lento de cámara
hacia adelante. Paleta de negro carbón, azul marino, naranja terracota y crema. Sin ningún texto
ni número legible en la escena.
```

---

### Toma 11b · 58–62 s · Pilar 2, el software

```
Zak, un bulldog francés robótico de cuerpo rechoncho y adorable con superficie negra mate suave,
articulaciones y costuras de metal oscuro, ojos grandes tipo pantalla que brillan en naranja
terracota cálido, orejas de murciélago erguidas con un fino borde de luz naranja y un collar-placa
minimalista con acento naranja, sentado frente a un monitor grande que muestra un panel de control
limpio y ordenado: columnas de tarjetas alineadas y una gráfica de barras que asciende, todo
compuesto únicamente por formas y bloques de color, sin una sola letra ni número. Zak observa la
pantalla con atención, como si estuviera organizando la información. Sobre el escritorio, a un
lado, cuadernos de papel cerrados y apilados y un smartphone apoyado. Render 3D de personaje
premium. Brillo equilibrado de pantalla combinado con una luz cálida lateral. Óptica de 50 mm,
enfoque nítido con fondo en bokeh, empuje lento de cámara. Paleta de negro carbón, azul marino en
la interfaz, naranja terracota en lo destacado y crema. Sin ningún texto ni número legible en la
escena.
```

---

### Toma 11c · 62–66 s · Pilar 3, la marca

```
Zak, un bulldog francés robótico de cuerpo rechoncho y adorable con superficie negra mate suave,
articulaciones y costuras de metal oscuro, ojos grandes tipo pantalla que brillan en naranja
terracota cálido, orejas de murciélago erguidas con un fino borde de luz naranja y un collar-placa
minimalista con acento naranja, sentado sobre una mesa de estudio de diseño junto a un kit de
marca físico: muestras de pintura en naranja terracota, papelería en papel crema, tarjetas
impresas en blanco y una tablet apoyada que muestra una cuadrícula ordenada de fotografías, sin
ninguna letra. En la pared del fondo, un planificador mensual real de papel con varios días
marcados a mano, sugiriendo publicación constante. Render 3D de personaje premium, dirección de
arte de estudio cuidada. Luz natural suave y direccional. Óptica de 50 mm, profundidad de campo
corta, ligerísimo travelling lateral. Paleta de superficie oscura, azul marino, naranja terracota
vivo y crema. Sin ningún texto ni número legible en la escena.
```

---

### Toma 12 · 66–70 s · El saludo

```
Zak, un bulldog francés robótico de cuerpo rechoncho y adorable con superficie negra mate suave,
mitad mascota y mitad robot de gama alta: finas articulaciones y costuras de metal oscuro, placas
sutiles en el lomo, ojos grandes y expresivos tipo pantalla que brillan en naranja terracota
cálido, orejas de murciélago erguidas con un fino borde de luz naranja, hocico gris carbón pulido
y un collar-placa minimalista con acento naranja. Está sentado sobre una superficie oscura y
limpia, mirando directamente a cámara con expresión amigable, y levanta despacio la pata delantera
en un gesto de saludo. Fondo negro carbón liso con abundante aire negativo a la derecha del
encuadre. Render 3D de personaje premium, figura coleccionable de alta gama. Luz cálida envolvente
con un contraluz sutil de naranja terracota que le recorta la silueta. Óptica de 50 mm,
profundidad de campo corta, cámara completamente fija. Sin ningún texto ni número legible en la
escena.
```

**Placa final (en edición, no en Seedance):** `ZAKUMI` en Playfair Display crema `#f5efe3`, y
debajo `zakumistudio.com` en Inter, más pequeño. Aparecen en el aire negativo de la derecha con un
fundido de 0,4 s.

---

## Notas de montaje

- **Subtítulos quemados:** obligatorios, casi todo el mundo lo va a ver sin sonido. Inter en crema
  `#f5efe3` sobre una barra negra semitransparente, abajo pero no pegado al borde.
- **Formato:** genera en 9:16 para Instagram y TikTok. Para 16:9 recorta el mismo material — las
  tomas 4, 10 y 12 tienen aire negativo suficiente para aguantar los dos encuadres.
- **Corte de 30 s para pauta:** tomas 1, 2, 4, 5, 8, 10, 12. Conserva el caso completo y sacrifica
  los tres pilares; el bloque de Zakumi se reduce a "Eso es Zakumi. Agentes de inteligencia
  artificial que atienden y venden. Escríbele a Zak."
- **Coherencia con el sitio:** las tomas 5, 10, 11a, 11b, 11c y 12 salen casi iguales a los prompts
  1, 7, 10, 4, 12 y 9 de `prompts-imagenes-zaku.md`. Es a propósito — quien vea el video y entre a
  zakumistudio.com debe reconocer el mismo mundo.

---

## Apéndice · Contexto de marca

Para cuando necesites explicarle Zakumi a otra herramienta (copy, voz, guiones nuevos). No hace
falta pegarlo en Seedance: los prompts de arriba ya lo llevan adentro.

```
Zakumi es un estudio boutique AI-first con sede en Bogotá, Colombia. No es una agencia de marketing
ni una fábrica de software: es un equipo pequeño que le construye a negocios reales tres cosas que
normalmente van por separado, y las entrega funcionando juntas.

1. Agentes de IA. Vendedores y asistentes de inteligencia artificial que atienden por WhatsApp y
   Telegram las 24 horas: responden dudas, cotizan, toman pedidos y cierran ventas. Es el producto
   protagonista, y la prueba está viva: nuestro propio agente, Zak, atiende a quien le escriba.
2. Software y plataformas a medida. Reemplazamos Excel, procesos manuales y herramientas sueltas
   por sistemas web construidos desde cero: CRM con IA multimodelo, tiendas en línea, paneles de
   operación, bases de datos serias que aguantan crecer.
3. Marca y contenido. Identidad visual con carácter y publicación automática en redes, para que la
   marca siga presente sin que el dueño tenga que pensar en publicar.

Posicionamiento: "Creamos marcas. Desarrollamos el futuro." La idea de fondo es que la IA no
reemplaza al dueño del negocio, le devuelve el tiempo. Automatizar no es un lujo de empresa grande:
es lo que hace que un negocio de dos personas atienda como uno de veinte.

A quién le hablamos: dueños de negocios pequeños y medianos en Colombia — tiendas, servicios,
consultorios, marcas que venden por WhatsApp. Gente que trabaja mucho y contesta mensajes a las
once de la noche.

Tono: español de Colombia, sin mezclar idiomas. Directo, cálido, concreto y honesto. Frases cortas,
cero jerga técnica, cero promesas infladas. No decimos "multiplica tu productividad por diez" ni
"domina la IA": mostramos un caso concreto y dejamos que hable solo. El ángulo que funciona es el
reconocimiento, "a ti también te pasa".

Paleta bloqueada: negro carbón #0A0C12, azul marino #023661, naranja terracota #DB5227,
crema #f5efe3, gris pizarra #76828E. Tipografía: Playfair Display en titulares e Inter en texto.

Sitio: zakumistudio.com · Instagram: @zakumiestudio · Canal vivo del agente: WhatsApp.
```
