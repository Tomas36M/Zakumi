#!/bin/bash
# Ensamblaje del video de 70s de Zakumi.
# Corte guiado por el audio: los tiempos salen de las pausas reales de la locucion.
set -e
cd "$(dirname "$0")"

mkdir -p norm out

# clip inicio duracion  — el inicio salta el arranque estatico en las tomas
# que se recortan mucho, para quedarse con la accion
TOMAS="
s01 0.0  5.00
s02 0.5  4.30
s03 0.0  4.09
s04 0.0  4.09
s05 0.0  8.00
s06 1.5  3.50
s07 0.3  5.50
s08 1.2  3.10
s09 0.8  2.90
s10 0.0  6.08
s11 0.0  6.00
s12 0.0  5.00
s13 0.6  2.80
s14 0.0  4.00
"

echo "== A. normalizar y recortar =="
echo "$TOMAS" | while read -r n ini dur; do
  [ -z "$n" ] && continue
  # -nostdin: sin esto ffmpeg se come las lineas restantes del bucle
  ffmpeg -nostdin -v error -ss "$ini" -i "clips/$n.mp4" -t "$dur" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1" \
    -an -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p "norm/$n.mp4" -y
  printf "  %s %ss\n" "$n" "$dur"
done

echo "== B. placa final (ultimo fotograma congelado + texto) =="
ffmpeg -v error -sseof -0.1 -i clips/s14.mp4 -frames:v 1 -y norm/ultimo.png
# los DOS inputs van con -loop 1: sin eso la placa es un solo fotograma en t=0,
# el fundido de alfa lo deja invisible y overlay repite ese fotograma transparente
ffmpeg -v error -loop 1 -i norm/ultimo.png -loop 1 -i textos/placa.png -t 4 \
  -filter_complex "[0]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,\
eq=brightness=-0.34:saturation=0.75,fade=t=in:st=0:d=0.6[bg];\
[1]format=rgba,fade=t=in:st=0.5:d=0.7:alpha=1[tx];[bg][tx]overlay=0:0" \
  -an -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p norm/card.mp4 -y

echo "== C. concatenar =="
: > norm/lista.txt
for n in s01 s02 s03 s04 s05 s06 s07 s08 s09 s10 s11 s12 s13 s14 card; do
  echo "file '$n.mp4'" >> norm/lista.txt
done
ffmpeg -v error -f concat -safe 0 -i norm/lista.txt -c copy out/mudo.mp4 -y
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 out/mudo.mp4)
echo "  duracion total: ${DUR}s"

echo "== D. subtitulos quemados =="
# un overlay por subtitulo, activado en su ventana de tiempo
INPUTS=(-i out/mudo.mp4)
FILTER=""
PREV="0:v"
i=0
while read -r idx ini fin; do
  [ -z "$idx" ] && continue
  INPUTS+=(-i "textos/sub${idx}.png")
  n=$((i + 1))
  FILTER+="[$PREV][${n}:v]overlay=0:0:enable='between(t,${ini},${fin})'[v${n}];"
  PREV="v${n}"
  i=$n
done < textos/tiempos.txt
FILTER="${FILTER%;}"
ffmpeg -v error "${INPUTS[@]}" -filter_complex "$FILTER" -map "[$PREV]" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p out/con_subs.mp4 -y
echo "  $i subtitulos compuestos"

echo "== E. mezcla de audio =="
# La musica baja mientras habla la voz y sube en el arranque y el remate.
# La voz entra en 4.0s, donde termina el celular vibrando en silencio.
ffmpeg -v error -i music.mp3 -i vo-70.mp3 -filter_complex "\
[0:a]atrim=0:${DUR},asetpts=N/SR/TB,\
volume='if(lt(t,4),0.38,if(lt(t,63.6),0.15,0.32))':eval=frame,\
afade=t=in:st=0:d=2.5,afade=t=out:st=$(echo "$DUR-2.8" | bc):d=2.8[mus];\
[1:a]adelay=4000|4000,volume=1.6[voz];\
[mus][voz]amix=inputs=2:duration=first:dropout_transition=0,\
alimiter=limit=0.95,aresample=48000[a]" \
  -map "[a]" -c:a aac -b:a 192k out/audio.m4a -y
echo "  musica + voz mezcladas"

echo "== F. muxear =="
ffmpeg -v error -i out/con_subs.mp4 -i out/audio.m4a \
  -map 0:v -map 1:a -c:v copy -c:a copy -shortest \
  out/zakumi-70s-borrador.mp4 -y

echo
echo "LISTO: out/zakumi-70s-borrador.mp4"
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name \
  -of default=nw=1 out/zakumi-70s-borrador.mp4
