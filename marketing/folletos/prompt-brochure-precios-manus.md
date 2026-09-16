# Brochure de servicios y precios — prompt para Manus

Reemplaza a `brochure-zakumi-servicios-precios.pdf` (BROCHURE 2026), cuyos precios
quedaron viejos el 15 sep 2026.

**Los precios de aquí son los mismos de `zakumistudio.com/precios`** (fuente:
`src/lib/catalogo.ts` + `src/components/zakumi/precios.ts`). Si cambian allá,
este prompt se actualiza y el PDF se regenera — nunca al revés.

**Salida esperada:** un PDF A4 vertical, 6 páginas, listo para mandar por
WhatsApp (que pese menos de 5 MB). Nombre del archivo:
`brochure-zakumi-servicios-precios.pdf` → va a `public/folletos/` del sitio.

---

## El prompt (copiar de aquí abajo, entero)

Necesito un **brochure de servicios y precios en PDF, A4 vertical, 6 páginas**,
para **Zakumi**, un estudio de marca y software de Bogotá, Colombia. Se manda
por WhatsApp a dueños de negocios pequeños y medianos, así que tiene que leerse
bien en un celular: tipografía grande, mucho aire, una idea por página.

### Identidad visual (respetarla al pie de la letra)

- **Fondo negro** `#0A0C12` en todas las páginas. Texto en hueso `#f5efe3`.
- **Un solo acento: naranja** `#DB5227`. Nada de degradados, ni de un segundo
  color de acento. El naranja se usa para: la palabra en cursiva de cada
  titular, los numerales de sección, las líneas finas de separación y **una**
  página entera con fondo naranja (la del plan completo).
- Grises de apoyo: `#98A3AE` para texto secundario, `#76828E` para las
  líneas finas.
- **Tipografías**: titulares en **Playfair Display** (regular, nunca bold; la
  palabra acentuada va en *cursiva* y en naranja). Texto, precios y etiquetas en
  **Inter**. Las etiquetas pequeñas van en MAYÚSCULAS con mucho espaciado entre
  letras (tracking amplio).
- **Cero esquinas redondeadas. Cero sombras. Cero iconos genéricos de stock.**
  Líneas de 1px, tablas sin bordes exteriores, aire generoso entre bloques.
  Estética editorial, de revista impresa, no de plantilla de presentación.
- Los precios son el protagonista visual: cifra grande en Playfair, y debajo,
  pequeñita y en mayúsculas espaciadas, la etiqueta «AL MES» o «PAGO ÚNICO».
- Márgenes amplios y consistentes: 18 mm por lado.

### Página 1 — portada

```
ZAKUMI
BROCHURE 2026

Precios claros.
Alcance a medida.

Marca, software y agentes de IA para negocios que quieren avanzar.
Sin plantillas. Sin intermediarios. A tu medida.

IA · SOFTWARE · MARCA
zakumistudio.com · WhatsApp +57 318 088 9780
```

El logotipo «ZAKUMI» arriba a la izquierda, en Inter, mayúsculas, muy
espaciado, con el punto de la «U» en naranja si se puede. «Alcance a medida.»
en cursiva y naranja. El resto de la página, vacío: que respire.

### Página 2 — el plan completo (única página con fondo naranja)

Fondo naranja `#DB5227`, texto en negro `#0A0C12`.

```
EL PLAN COMPLETO

Landing + agente de WhatsApp
Para cualquier negocio: página propia y un agente que atiende el WhatsApp.

$690.000
PAGO ÚNICO

— Landing con tu marca, tu dominio el primer año y el QR para el local
— Zak atendiendo tu WhatsApp: responde, toma pedidos y agenda citas
— Montaje del agente incluido
— Botón directo a WhatsApp y posicionamiento local básico

+ $129.900 al mes desde el segundo mes, sin permanencia.
Ahorras $99.900 frente a comprar la landing y el montaje por separado.
```

### Página 3 — lo que cuesta cada cosa (al mes)

Titular: **Lo que cuesta *cada cosa.*** («cada cosa» en cursiva naranja.)

Etiqueta de sección: `AL MES — sin permanencia: se paga mes a mes y se cancela
cuando quieras.`

Lista de cuatro filas. Cada fila: nombre en Playfair a la izquierda, descripción
en Inter gris debajo, y el precio a la derecha en Playfair grande. Una línea
fina naranja separa fila de fila.

```
Zak, tu agente de WhatsApp          $129.900 AL MES
Responde, toma pedidos y agenda citas a toda hora, con tus precios y tu
forma de hablar. Hasta 150 conversaciones al mes.
+ $199.900 de montaje, una sola vez

Agente de voz                        $249.900 AL MES
Contesta y hace llamadas por ti, se presenta como IA y te deja el resumen
de cada una. 120 minutos al mes.
+ $199.900 de montaje, una sola vez

CRM                                   $99.900 AL MES
Tus clientes, pedidos y conversaciones en un solo lugar, sin hojas de cálculo.

Mantenimiento web                     $49.900 AL MES
Hosting, dominio, dos cambios de contenido al mes y alguien a quien
escribirle cuando algo falla.
```

### Página 4 — lo que se paga una vez

Etiqueta de sección: `UNA VEZ — anticipo del 50 % para arrancar y el saldo
contra entrega.`

```
Landing o menú digital con QR        $590.000 PAGO ÚNICO
Una página con tu marca y tu dominio el primer año, botón directo a
WhatsApp y el QR para el local.

Página web                         $1.190.000 PAGO ÚNICO
Hasta cinco secciones, formulario, posicionamiento local y botón directo
a WhatsApp.

Tienda online con pagos            $1.490.000 PAGO ÚNICO
Hasta 50 productos, carrito, pagos con Wompi o Bold y cada pedido directo
a tu WhatsApp.
```

Abajo, separado por una línea fina, la segunda etiqueta: `DESDE — precio de
entrada; el valor final depende del alcance.`

```
Automatización de procesos           $890.000 DESDE
Que el formulario, el WhatsApp, el correo y la hoja de cálculo se hablen solos.

Identidad de marca                   $890.000 DESDE
Logo, paleta, tipografías y una guía para que todo lo que publiques se vea tuyo.

Marca + estrategia                 $1.990.000 DESDE
Posicionamiento, narrativa, identidad y las piezas base para salir al mercado.
```

### Página 5 — lo que va junto sale mejor

Titular: **Lo que va junto *sale mejor.***

Tres bloques en columna, separados por líneas finas. Cada uno: nombre en
Playfair, la frase de «para quién» en cursiva, el precio grande, y lo que
incluye en viñetas con raya (—), nunca con bolitas.

```
Domicilios propios                                      $890.000 PAGO ÚNICO
Para el restaurante que vive de las apps de domicilio o de llamadas.
— Menú digital con QR y tu marca
— Pedidos por WhatsApp que el agente toma completos: plato, dirección y pago
— Link de pago en línea, sin comisión por pedido
— Montaje del agente incluido

Agenda llena                                            $690.000 PAGO ÚNICO
Para salones, veterinarias y talleres que agendan por chat.
— Landing con reservas
— El agente agenda, reagenda y recuerda
— Montaje del agente incluido

Tienda + Zak                                          $1.590.000 PAGO ÚNICO
Para moda, hogar y encargos que se venden con foto.
— Tienda online con pagos
— El agente responde tallas, aparta y toma pedidos
— Montaje del agente incluido
```

Al pie: `Todos los combos traen el montaje del agente incluido; desde el segundo
mes se paga su mensualidad de $129.900, sin permanencia.`

### Página 6 — cómo cobramos y cómo empezamos

Titular: **Empecemos.**

Cuatro puntos, cada uno con la primera frase en hueso y el resto en gris:

```
Se prueba antes. Le escribes al agente desde tu celular y ves cómo atiende
antes de pagar.
Sin permanencia. Las mensualidades se cancelan cuando quieras, sin cláusulas.
Anticipo del 50 %. Lo de pago único arranca con la mitad; el saldo, contra entrega.
El alcance manda. Son precios de entrada; pantallas, integraciones y contenido
mueven el valor final.
```

Abajo, un bloque aparte con línea fina arriba:

```
PARA EMPRESAS — por cotización
Aplicación web · Aplicación móvil · Software a medida · CRM con IA
```

Y el cierre, grande:

```
Hablemos de tu proyecto
WhatsApp +57 318 088 9780
zakumistudio.com/precios

IA · SOFTWARE · MARCA
```

### Reglas de redacción (importantes)

- Español de Colombia, tuteo. **Prohibida la palabra «stack»** — si hace falta,
  «tecnología» o «herramientas».
- Nada de «brindamos soluciones», «potenciamos», «sinergia» ni «estimado
  cliente». Frases cortas y concretas.
- Los precios se escriben con punto de miles y signo de pesos: `$129.900`.
  **Nunca** en dólares.
- No inventes servicios, cifras, plazos, descuentos, garantías ni clientes.
  Solo lo que está escrito arriba.
- No pongas fotos de stock de gente sonriendo con portátiles. Si necesitas
  material gráfico, usa formas geométricas simples en naranja sobre negro,
  líneas finas o tipografía grande como elemento visual.
