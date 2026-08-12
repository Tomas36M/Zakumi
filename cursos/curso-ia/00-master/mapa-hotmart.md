# Mapa de Hotmart — cómo se monta el curso en el Club

Documento operativo. Traduce `curriculo.md` a la estructura exacta que hay que crear en
**Hotmart Club** (área de miembros) y en la **oferta** del producto `7970555`.

---

## 0 · Estado del producto (2026-07-29 · act. 2026-08-12)

### Hecho y verificado

| Campo | Estado |
|---|---|
| **Nombre** | ✅ "Introducción a la Inteligencia Artificial" (era "Domina la Inteligencia Artificial sin Conocimientos Técnicos") |
| **Descripción** | ✅ Reemplazada por el copy de `lanzamiento/hotmart-descripcion.md` |
| **Módulos del Club** | ✅ 8 módulos, en orden. Borrado el placeholder "Bienvenido a tu curso". |
| **Clases** | ✅ **51** — las 40 del currículo + 11 entradas en Recursos |
| **Certificado** | ✅ Activado (verificado tras recargar) |
| **Enlace de checkout** | ✅ `pay.hotmart.com/A106414286A` — ya en `curso.ts` y en la base de Zak. **VIVO desde 2026-08-12** (`curl -sI` → HTTP 200; antes 307 a página de error). |
| **Precio base** | ✅ **COP 129.900** configurado a mano en el panel (2026-08-12). La web, el JSON-LD y `curso.ts` se alinearon a 129.900 y `CHECKOUT_ACTIVO` pasó a `true`. |
| **Garantía** | 15 días (ya estaban; se dejan) |

Reparto de clases por módulo:

| Módulo | Clases | ID interno |
|---|---|---|
| 0 · Antes de empezar | 4 | `M7qzd1gyOx` |
| 1 · Día 1 | 6 | `y4bwVzqdeR` |
| 2 · Día 2 | 7 | `BeZlNjvWOw` |
| 3 · Día 3 | 6 | `Z721RkYLeN` |
| 4 · Día 4 | 7 | `RONl9VKAeP` |
| 5 · Día 5 | 6 | `R4jKbQNaea` |
| 6 · Tu certificado y qué sigue | 4 | `146ZVkvo4d` |
| Recursos · Tus materiales | 11 | `k45ZQkBjel` |

### Pendiente — hay que hacerlo a mano

| Qué | Por qué no se automatizó |
|---|---|
| **Adjuntar los 11 PDFs** | Las clases existen pero vacías. Cada una necesita su PDF desde el editor de la clase. |
| **Liberación programada (drip)** | Depende de la fecha de la cohorte, que no está definida. |
| **Order bump** | Pendiente de confirmar. |
| **Recuperador Automático de Ventas** | El panel lo muestra **«No disponible»** (visto 2026-08-12). Averiguar qué requisito falta — recupera carritos abandonados. |

> Contexto del precio (resuelto, pero la trampa sigue viva para ofertas futuras): Hotmart
> **bloquea el precio** de una oferta existente ("Una vez que definas el precio, no podrás
> cambiarlo") y el formulario de oferta nueva no envía por automatización — moneda, forma de
> pago y precio son componentes personalizados cuyo estado interno no registra la selección.

> ⚠️ **El campo de precio tiene máscara de centavos.** Escribir `129000` produce **1.290,00**.
> Para 129.000 hay que escribir `12900000` y **confirmar en pantalla que dice `129.000,00`**
> antes de guardar.

### Notas técnicas de la automatización

Si hay que volver a tocar el Club por script:

1. **No usar refs `@eN` para rellenar campos** en el editor de contenido. El SPA re-renderiza entre
   el snapshot y el comando siguiente, el ref caduca y `fill` falla **en silencio** (devuelve "Done"
   y el campo queda vacío). Usar `find label "..." fill "..."`.
2. **Ir directo a `.../modules/<ID>/content/new`** en vez del menú "Añadir contenido → Clase", que
   solo abre si el módulo está expandido y falla la mayoría de las veces.
3. El botón **"Publicar" del panel solo se renderiza cuando el título tiene texto**, y es el último
   de los tres "Publicar" de la página.
4. **No usar `wait --load networkidle`** en Hotmart: mantiene conexiones abiertas, nunca alcanza ese
   estado y la pestaña acaba en `about:blank`. Usar esperas fijas.
5. El navegador hay que lanzarlo **siempre** con `--headed --profile ~/.profiles/hotmart`. Si el
   demonio se reinicia solo, vuelve a headless con perfil temporal y se pierde la sesión.
6. La sesión de Hotmart caduca cada 10–15 minutos.
7. **Las pestañas del producto (Información básica, Área de Miembros, Página de producto)
   ignoran los clics programáticos** — hay que abrirlas a mano y dejar el script en la URL
   interna correcta.

Scripts usados — viven **junto a este doc**: `cursos/curso-ia/00-master/crear-modulos.sh` y
`cursos/curso-ia/00-master/crear-clases.sh`.

---

## 1 · Datos del producto

| Campo | Valor |
|---|---|
| Nombre | **Introducción a la Inteligencia Artificial** |
| Subtítulo | Aprende a usar la IA en tu día a día. En español y desde cero. |
| Categoría | Tecnología / Desarrollo personal |
| Idioma | Español |
| Formato | Curso online (híbrido: cohorte en vivo + grabaciones) |
| Área de miembros | Hotmart Club |
| Página de ventas | **Externa** → `https://zakumistudio.com/academia` |
| Garantía | **15 días** (ya configurados — se dejan) |
| Certificado | Activado |

---

## 2 · Oferta y precios

| Oferta | Precio | Cuándo |
|---|---|---|
| **Lanzamiento** (primera cohorte) | **COP 129.900** (quedó así al configurarla; web y JSON-LD alineados el 2026-08-12) | Hasta que cierre la cohorte |
| **Precio normal** | COP 199.000 | Después del lanzamiento |

- Pago único. Habilitar cuotas si Hotmart lo permite en COP (baja la objeción de precio).
- **Order bump:** *Mentoría 1:1 de 30 minutos con Tomás* — +COP 79.000. **Pendiente de confirmar.**
- La urgencia es real: el precio sube de verdad al cerrar la cohorte. No usar contadores falsos.
- El precio base de 300.000 que estaba configurado se baja: sin reseñas de una primera cohorte es
  muy difícil vender en frío a ese precio, y las reseñas de Hotmart son las que después venden solas.

---

## 3 · Módulos y clases del Club

Siete módulos. El **Módulo 0 va abierto** (visible sin comprar): es lo que convence al que duda y lo
que Hotmart usa como muestra.

| Orden | Módulo en el Club | Clases | Liberación |
|---|---|---|---|
| 1 | **0 · Antes de empezar** | 4 | Inmediata · **abierto** |
| 2 | **1 · Día 1 — Pierde el miedo** | 6 | Día 1 de la cohorte |
| 3 | **2 · Día 2 — ChatGPT y Gemini** | 7 | Día 2 |
| 4 | **3 · Día 3 — Claude** | 6 | Día 3 |
| 5 | **4 · Día 4 — Manus y los agentes** | 7 | Día 4 |
| 6 | **5 · Día 5 — Crea de verdad** | 6 | Día 5 |
| 7 | **6 · Tu certificado y qué sigue** | 4 | Al terminar el Día 5 |
| 8 | **Recursos — Tus materiales** | 8 archivos | Inmediata |

Los nombres de las clases salen tal cual de las tablas de `curriculo.md` (columna *Clase*).

**Liberación programada (drip):** cada módulo de día se abre el día que corresponde. Sirve para dos
cosas — que nadie se adelante y se pierda, y que la gente vuelva cinco días seguidos (el
compromiso sube y las reseñas mejoran).

Para la cohorte en vivo, cada módulo de día lleva además una **clase tipo transmisión en vivo** al
inicio con el enlace de la sesión, y después se reemplaza por la grabación.

---

## 4 · Módulo "Recursos" — materiales complementarios

Se sube como módulo aparte y también como material adjunto en la clase que corresponde:

Los 11 PDFs ya están generados en `cursos/curso-ia/pdf/`. Se regeneran con:

```bash
node cursos/curso-ia/pdf/build-pdf.mjs
```

| Archivo (PDF) | Pág. | Se adjunta también en |
|---|---|---|
| `kit-bienvenida.pdf` | 4 | Módulo 0, clase 0.1 |
| `cuaderno-dia-1.pdf` … `cuaderno-dia-5.pdf` | 7 c/u | Primera clase de cada módulo de día |
| `biblioteca-prompts.pdf` | 21 | Módulo 1, clase 1.3 (y en Recursos) |
| `guias-herramientas.pdf` (las 6 en un solo PDF) | 18 | Recursos |
| `plantillas.pdf` (CLARO, calendario, propuesta, encargo, mapa de mi semana) | 8 | Recursos |
| `proyecto-final.pdf` | 4 | Módulo 5, clase 5.6 |
| `plan-30-dias.pdf` | 4 | Módulo 6, clase 6.2 |

---

## 5 · Certificado

- Activar en la pestaña **Certificado** del producto.
- Imagen de fondo **2480 × 3508 px** (calidad estándar) en paleta Zakumi: fondo negro `#0A0C12`
  con azul marino `#023661`, filete y acentos en naranja `#DB5227`, texto crema `#f5efe3`.
  Tipografía Playfair Display para el nombre, Inter para el resto.
- Texto: *"Certifica que [nombre] completó el curso Introducción a la Inteligencia Artificial —
  40 clases · 10 h 45 min — Zakumi Academy."* Firma de Tomás y fecha.
- Requisito de emisión: completar el porcentaje de clases que exija Hotmart (configurar al máximo
  que permita sin bloquear a quien vio las grabaciones).

---

## 6 · Orden de configuración

1. Leer el estado actual del producto y reportar qué falta.
2. Crear el Club (o vincular el existente) y los 8 módulos.
3. Crear las clases de cada módulo con sus nombres definitivos.
4. Subir los PDFs al módulo Recursos y adjuntarlos donde corresponde.
5. Configurar la liberación programada.
6. Oferta: precio de lanzamiento, garantía 7 días, cuotas.
7. Certificado: activar y subir fondo.
8. Order bump (solo después de confirmar).
9. Página de ventas → externa.
10. Enviar a revisión de Hotmart (~15 min) y probar el checkout en ventana privada.

Relacionado: `curriculo.md`
