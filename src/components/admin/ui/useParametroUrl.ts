"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { conParametro } from "@/lib/admin/url-params";

/**
 * Lee y escribe UN parámetro de la URL sin volver al servidor.
 *
 * Escribe con `history.replaceState` y no con `router.replace`: el segundo
 * re-renderiza la page en el servidor (en Zak son ocho fetches a Railway y
 * ElevenLabs por cada pestaña que se toca) y el primero solo actualiza la
 * URL — Next 16 sincroniza `useSearchParams` igual. Replace y no push: doce
 * pestañas de un cockpit no merecen doce entradas en el botón de atrás.
 *
 * La lectura viene de `useSearchParams` (reactiva). La escritura parte de
 * `window.location.search` en el momento del clic, para no pisar un
 * parámetro que otro hook acabe de poner.
 */
export function useParametroUrl(
  clave: string,
): [valor: string | null, poner: (valor: string | null) => void] {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const valor = searchParams.get(clave);

  const poner = useCallback(
    (nuevo: string | null) => {
      const search = conParametro(window.location.search, clave, nuevo);
      window.history.replaceState(null, "", `${pathname}${search}`);
    },
    [clave, pathname],
  );

  return [valor, poner];
}
