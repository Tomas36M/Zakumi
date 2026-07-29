# Curso "Introducción a la Inteligencia Artificial"

Producto completo de **Zakumi Academy**: contenido, materiales del estudiante, página de ventas y
copy de lanzamiento.

**Formato:** híbrido — cohorte en vivo (5 días · 10 h 45 min) + todo grabado y ordenado en Hotmart
Club, para que después se venda solo.
**Precio:** COP 129.000 de lanzamiento · 199.000 después. Garantía de 15 días.
**Producto de Hotmart:** `7970555` (cuenta Zakumi Estudio).

---

## Qué hay acá

```
cursos/curso-ia/
├── 00-master/
│   ├── curriculo.md          ← FUENTE DE VERDAD. 7 módulos, 40 clases.
│   └── mapa-hotmart.md       ← cómo se monta en el Club + estado real del producto
├── guiones/                  ← para dictar sin improvisar (internos, no se entregan)
│   └── dia-1..5-guion.md
├── estudiante/               ← lo que reciben los alumnos (markdown = fuente)
│   ├── 00-kit-bienvenida.md
│   ├── cuaderno-dia-1..5.md  ← ejercicios + el reto del día al final
│   ├── biblioteca-prompts.md ← 62 prompts en español
│   ├── plantillas.md         ← CLARO, calendario, propuesta, encargo, mapa de mi semana
│   ├── proyecto-final.md
│   ├── plan-30-dias.md
│   └── guias/                ← 1 página por herramienta (6)
├── pdf/                      ← los 11 PDFs que se suben al Club
│   └── build-pdf.mjs         ← script que los genera
└── lanzamiento/
    ├── hotmart-descripcion.md  ← descripción, checkout, certificado, correo de compra
    ├── emails.md               ← 8 correos de la cohorte
    ├── redes.md                ← reels, carruseles, historias
    └── zak-whatsapp.md         ← cómo Zak vende por WhatsApp
```

---

## El método CLARO

Todo el curso cuelga de una idea: cinco preguntas para pedirle cosas a una IA.

**C**ontexto · **L**abor · **A**udiencia · **R**eferencia · **O**bjeciones

No es un truco: es hablarle claro. El alumno lo aprende el Día 1 y lo usa hasta el Día 5, y le
funciona con cualquier herramienta que salga después. Los 62 prompts de la biblioteca están escritos
con esa estructura para que vea el patrón repetido.

---

## Regenerar los PDFs

```bash
node cursos/curso-ia/pdf/build-pdf.mjs
```

**Por qué hay un script y no se llama a `make-pdf` directo:** el binario estampa "CONFIDENTIAL" en
el pie de cada página y su flag `--no-confidential` está roto en el build instalado (se come el
archivo de entrada). En material que se le entrega a alumnos eso no puede salir. El script usa
make-pdf para la tipografía y la paginación, parchea el CSS (pie de Zakumi, idioma español, acentos
de marca) e imprime con Chromium. Verifica al final que no quede rastro de CONFIDENTIAL.

**Sobre el fondo blanco:** es a propósito. Los cuadernos se imprimen y se escriben a mano; un fondo
negro de marca gastaría tinta y no se podría rellenar. La marca va en los acentos naranja, los
títulos en azul marino y el pie de página.

---

## La página de ventas

`/academia` en el sitio de Zakumi.

- Datos: `src/components/zakumi/curso.ts` — **si cambia la malla, cambia acá**
- Componente: `src/components/zakumi/sections/AcademiaPage.tsx`
- Ruta y JSON-LD (`Course`): `src/app/academia/page.tsx`
- Estilos: bloque `ACADEMIA` al final de `src/styles/zakumi-design.css`

Reutiliza el sistema editorial del sitio y los helpers de `@/lib/motion`. El orden de las secciones
está pensado para convertir: **la malla completa va arriba del precio**, porque es lo que resuelve la
duda real.

---

## Zak ya conoce el curso

`whatsapp-bot/scripts/build_knowledge.mjs` lee `curso.ts` y genera la base de conocimiento del
agente. Después de tocar el curso:

```bash
node whatsapp-bot/scripts/build_knowledge.mjs
```

Con eso Zak sabe la malla completa, el precio, las FAQ y el enlace de inscripción sin copiar nada a
mano. Las reglas de conversación están en `lanzamiento/zak-whatsapp.md`.

---

## Pendientes

- [ ] **Enlace de checkout real.** `HOTMART_CHECKOUT` en `curso.ts` apunta hoy a la página del
      producto, no al pago. El real sale de Hotmart → producto 7970555 → *Links de divulgación*.
      Al cambiarlo, regenerar la base de Zak.
- [ ] **Fecha y horario de la primera cohorte.** El copy los necesita para la urgencia, y Zak para
      poder darlos sin inventar.
- [ ] **Montar el Club:** 8 módulos, ~40 clases, subir los PDFs, liberación programada.
- [ ] **Cambiar el nombre del producto** en Hotmart: hoy dice "Domina la Inteligencia Artificial sin
      Conocimientos Técnicos: Curso Práctico y Certificado".
- [ ] **Bajar el precio** de 300.000 a 129.000.
- [ ] **Activar ventas** (hoy están desactivadas) y el certificado.
- [ ] **Confirmar el order bump** de mentoría 1:1 antes de activarlo.
- [ ] Correo de contacto definitivo: el folleto dice `hola@zakumi.studio`, la cuenta de Hotmart usa
      `zakumiestudio@gmail.com`.

---

## Lo que este curso no promete

Está escrito en el currículo y en la página de ventas, y hay que respetarlo en todo el copy:

- No promete clientes ni dinero por tomarlo.
- No promete que se aprende a "programar" en una semana.
- No promete que la IA acierta sola — todo el curso insiste en revisar.
- No promete dominar todas las herramientas. Es de introducción, y lo dice.

Nada de testimonios inventados, cifras de alumnos que no existen ni contadores falsos. La única
urgencia que se usa es real: la fecha de la cohorte y el precio que sube de verdad al cerrarla.
