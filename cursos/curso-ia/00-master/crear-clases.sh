#!/bin/zsh
# Crea clases dentro de un módulo del Hotmart Club (producto 7970555).
#
# Dos cosas que costaron sangre:
#
# 1. NO usar refs (@eN) para rellenar. El editor re-renderiza entre el snapshot
#    y el comando siguiente, así que el ref caduca y `fill` falla EN SILENCIO
#    (devuelve "Done" y el campo queda vacío). Con `find label` no hay ref que
#    caducar y sí funciona.
#
# 2. Ir DIRECTO a .../modules/<ID>/content/new en vez de pelear con el menú
#    flotante "Añadir contenido → Clase", que solo abre si el módulo está
#    expandido y falla la mayoría de las veces.
#
# El botón "Publicar" del panel solo se renderiza cuando el título tiene texto,
# y es el último de los tres que hay en la página.
#
# Uso: crear-clases.sh <ID_MODULO> "Título 1" "Título 2" ...

BASE="https://app.hotmart.com/membership/zakumi-estudio/products/edit/7970555/admin/beta/modules"
MOD="$1"; shift

for titulo in "$@"; do
  agent-browser open "$BASE/$MOD/content/new" >/dev/null 2>&1
  sleep 9

  # Rellenar por etiqueta, con reintentos y verificando que quedó EXACTAMENTE
  # el título pedido — "no vacío" no basta: un texto viejo de la SPA o un fill
  # truncado pasaba como "ok" y publicaba una clase mal titulada.
  puesto=""
  for i in 1 2 3 4; do
    agent-browser find label "Título *" fill "$titulo" >/dev/null 2>&1
    sleep 3
    r=$(agent-browser snapshot 2>/dev/null | grep -oE 'textbox "Título \*" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' | head -1)
    [[ -n "$r" ]] && puesto=$(agent-browser get value "@$r" 2>/dev/null | head -1)
    [[ "$puesto" == "$titulo" ]] && break
  done
  if [[ "$puesto" != "$titulo" ]]; then echo "FALLÓ (título quedó '$puesto')  $titulo"; continue; fi

  # "Publicar": aparece solo con título. El del panel de la clase es el último.
  pb=""
  for i in 1 2 3 4; do
    pb=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Publicar" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' | tail -1)
    [[ -n "$pb" ]] && break
    sleep 3
  done
  if [[ -z "$pb" ]]; then echo "FALLÓ (sin Publicar)  $titulo"; continue; fi

  agent-browser click "@$pb" >/dev/null 2>&1
  sleep 7
  echo "ok  $titulo"
done
