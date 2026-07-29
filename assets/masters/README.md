# Masters de imagen

Aquí van los archivos **fuente** de las fotos del sitio. Están fuera de git (ver
`.gitignore`) porque pesan megas; **haz backup tú aparte** — el repo no los guarda.

Para exportar a `public/work/`:

```bash
node scripts/optimize-images.mjs          # exporta lo que encuentre aquí
node scripts/optimize-images.mjs --check  # solo audita public/work, sin escribir
```

---

## Por qué importa el master

Los tres heroes que estaban en el repo se exportaron a **0.17–0.33 bits/píxel**.
Los heroes anteriores del mismo proyecto estaban a 0.86–1.04 bpp. A ese bitrate
una imagen de 2400px se ve peor que una de 1200px bien codificada, y **subir
`quality` en `next/image` no lo arregla**: el detalle ya no está en el archivo.
La documentación de Next lo dice sin rodeos — *"If the original image is already
low quality, setting a high quality value will increase the file size without
improving appearance."*

Además el optimizador de Next **nunca agranda** por encima del source
(`resize(..., { withoutEnlargement: true })`), así que el ancho del master es el
techo real de nitidez en pantallas grandes. En un MacBook Air de 1512px con DPR 2
el hero necesita 3024px de dispositivo; en un 5K, 5120.

## Especificación

| Asset | Aspecto | Ancho mínimo | Rol |
|---|---|---|---|
| `zk-hero-agentes-chat-v4` | **16:9 exacto** | 3200 px | slide 1 del hero |
| `zk-hero-software-v1` | **16:9 exacto** | 3200 px | slide 2 del hero |
| `zk-hero-marca-v1` | **16:9 exacto** | 3200 px | slide 3 del hero |
| `zk-prod-landing` | 4:3 | 2000 px | showcase de producto |
| `zk-prod-crm` | 4:3 | 2000 px | showcase de producto |
| `zk-prod-ecommerce` | 4:3 | 2000 px | showcase de producto |
| `zk-brand-foto2` | 4:3 | 1800 px | marca — hero y casos |
| `zk-software-foto` | 4:3 | 1800 px | software — hero y casos |
| `zk-ink-foto` | 4:3 | 1800 px | casos de uso |
| `zk-form-foto` | 4:3 | 1800 px | casos de uso |
| `zk-hero-foto` | 5:7 vertical | 1800 px | hero de /contacto |

**Formato del master**: PNG, o JPEG a calidad 95+. No exportes el master en WebP
si puedes evitarlo — el sitio ya re-codifica a WebP/AVIF, y partir de un WebP
suma una generación de pérdida innecesaria.

**El nombre manda**: el script empareja por nombre de archivo, así que
`zk-hero-marca-v1.png` produce `public/work/zk-hero-marca-v1.webp`. Si hay varias
versiones del mismo asset, gana la de mayor resolución.

### El 16:9 de los heroes no es negociable

El hero es `object-fit: cover` sobre `min-height: 100vh`. En un viewport 1512×982
eso ya recorta ~13% del ancho por sí solo. Si el master viene en 4:3 o 3:2, el
recorte se acumula y pierdes el sujeto de la composición además de resolución
útil. Pide el render directamente en 16:9.

### Deja aire alrededor del sujeto

El navegador recorta desde el centro y, según el slide, desplaza el encuadre
(`object-position` va de 58% a 64% según el caso). Un sujeto pegado a un borde se
corta. Compón con margen.

## Qué NO es un master

`~/.cursor/projects/Users-tom-Desktop-Zakumi/assets/` tiene PNG a 1536×1024 de
una iteración de diseño **anterior** (`zk-brand.png`, `zk-ink.png`,
`zk-software.png`…). Se comprobó por similitud de píxeles que no corresponden a
las fotos que hoy están en `public/work/`: son otra tanda de arte. No sirven para
re-exportar.
