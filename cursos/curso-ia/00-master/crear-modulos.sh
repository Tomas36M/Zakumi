#!/bin/zsh
# Crea módulos en el Hotmart Club del producto 7970555.
#
# Lecciones que costaron varios intentos:
#  1. Hay DOS botones "Crear" en la página (uno es de un buscador), así que hay
#     que resolver el ref del de la barra, no usar el localizador semántico.
#  2. El botón "Crear módulo" del pie del diálogo está DISABLED hasta que el
#     nombre esté lleno. Clickearlo antes no hace nada y no da error.
#  3. El menú "Crear" es un toggle: si se hace clic dos veces se cierra. Por eso
#     se recarga la página antes de cada módulo.
#  4. Marcar "dejar disponible sin comprar" abre un modal de registro gratuito
#     que bloquea todo lo demás — se maneja aparte, al final.

URL="https://app.hotmart.com/membership/zakumi-estudio/products/edit/7970555/admin/beta/modules"

ref() { # ref <patrón-grep>
  agent-browser snapshot 2>/dev/null | grep -oE "$1 \[ref=e[0-9]+\]" | grep -oE 'e[0-9]+' | head -1
}

contar() {
  agent-browser eval "document.querySelector('main').innerText.split('Módulo principal').length-1" 2>/dev/null | tail -1
}

crear_modulo() {
  local nombre="$1"
  agent-browser open "$URL" >/dev/null 2>&1
  # El editor es un SPA pesado: el botón "Crear" existe en el DOM antes de que
  # su handler esté montado, así que hay que darle tiempo. OJO: espera FIJA,
  # nunca `wait --load networkidle` — Hotmart mantiene conexiones abiertas,
  # ese estado no llega jamás y la pestaña acaba en about:blank (nota técnica 4
  # de mapa-hotmart.md).
  sleep 9

  # Hay DOS botones "Crear" (uno es del buscador — lección 1 de la cabecera) y
  # el orden del snapshot no es confiable: se prueban TODOS los candidatos y
  # gana el que de verdad abre el menú con "Crear módulo".
  local crs=($(agent-browser snapshot -i -c 2>/dev/null | grep -oE 'button "Crear" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+'))
  [[ ${#crs[@]} -eq 0 ]] && { echo "FALLÓ (sin botón Crear)  $nombre"; return 1; }

  # El menú es un toggle y a veces el primer clic se pierde: se reintenta.
  local cm=""
  for cr in "${crs[@]}"; do
    for intento in 1 2 3; do
      agent-browser click "@$cr" >/dev/null 2>&1; sleep 3
      cm=$(ref 'button "Crear módulo"')
      [[ -n "$cm" ]] && break 2
    done
  done
  [[ -z "$cm" ]] && { echo "FALLÓ (menú no abrió)  $nombre"; return 1; }
  agent-browser click "@$cm" >/dev/null 2>&1; sleep 4

  local av=$(ref 'button "Avanzar"')
  [[ -z "$av" ]] && { echo "FALLÓ (sin Avanzar)  $nombre"; return 1; }
  agent-browser click "@$av" >/dev/null 2>&1; sleep 4

  local tb=$(ref 'textbox "Nombre del módulo \*"')
  [[ -z "$tb" ]] && { echo "FALLÓ (sin campo nombre)  $nombre"; return 1; }
  agent-browser fill "@$tb" "$nombre" >/dev/null 2>&1; sleep 2

  # Recién ahora el botón del pie deja de estar disabled.
  local ok=$(agent-browser snapshot 2>/dev/null | grep -oE 'button "Crear módulo" \[ref=e[0-9]+\]' | grep -v disabled | grep -oE 'e[0-9]+' | tail -1)
  [[ -z "$ok" ]] && { echo "FALLÓ (botón sigue disabled)  $nombre"; return 1; }
  agent-browser click "@$ok" >/dev/null 2>&1; sleep 7

  echo "ok [$(contar) módulos]  $nombre"
}

for n in "$@"; do crear_modulo "$n"; done
