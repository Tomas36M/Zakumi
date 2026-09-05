# Marketing de Zakumi — mapa de contenidos

Todo el material de marca/venta que antes vivía regado en la raíz del repo.
El material pesado (PNG, JPG, MP4, MP3, TTF) está **fuera de git** (ver
`.gitignore`) — haz backup aparte si te importa.

## Qué hay

- `prompts-imagenes-zaku.md` — prompts para las imágenes de Zaku (mascota/marca).

### `folletos/` — folletos de prospección por sector
- `prompts-folletos-zak-manus.md` — prompts detallados para generar los folletos
  en Manus (identidad + textos verbatim).
- `humanizados/` — versión "humanizada" de los 12 folletos:
  - `flyers.html` — la fuente que genera los PNG.
  - `output/` y `human_assets_v2/` — los PNG finales por sector (fuera de git).
  - `human_art_direction.md`, `qa_humanized.md`, `README_humanized.md` — dirección
    de arte y QA.
  - Los folletos que usa el sitio están aparte, en `public/folletos/` (tracked).

### `video-70s/` — video promocional de 70 segundos (Marcela + Zak)
- `guion-video-70s-zak.md` — el guion completo.
- `prompts-video-70s-zak-EN.md` — prompts en inglés para el generador de video.
- `prompts-escenas/` — un `.txt` por escena (01–14) + scripts de ensamblaje:
  - `armar.sh` — corta, concatena, quema subtítulos y mezcla audio con ffmpeg.
    Espera `clips/`, `textos/`, `music.mp3` y `vo-70.mp3` junto a él.
  - `render_texto.py` — renderiza subtítulos/placa final como PNG (espera `fonts/`).
- `material/` — clips generados (`tomas/s01–s14.mp4`), audio (locución + música),
  referencias de personajes y los borradores ensamblados (fuera de git).

## Qué NO va aquí

- Assets del sitio → `public/` (los sirve Next).
- Masters de fotos del sitio → `assets/masters/` (ver su README).
- Material del curso de IA → `cursos/`.
- Documentos legales/administrativos → `docs/empresa/` (fuera de git).
