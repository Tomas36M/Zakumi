"use client";

import { useSyncExternalStore } from "react";
import {
  COOKIE_SIDEBAR,
  colapsadoDeCookie,
  cookieSidebar,
  valorDeCookie,
} from "@/lib/admin/sidebar-cookie";

/** Colapso del sidebar persistido en cookie. Patrón useSyncExternalStore sin
 *  contexto. El estado inicial lo manda el servidor (leyó la misma cookie), así
 *  que no hay hydration mismatch ni flash expandido→colapsado al cargar. */

const oyentes = new Set<() => void>();

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

function instantanea(): boolean {
  try {
    return colapsadoDeCookie(valorDeCookie(document.cookie, COOKIE_SIDEBAR));
  } catch {
    return false;
  }
}

export function alternarSidebar(): void {
  try {
    document.cookie = cookieSidebar(!instantanea());
  } catch {
    /* sin cookies no hay persistencia, pero tampoco crash */
  }
  for (const oyente of oyentes) oyente();
}

/** `inicial` es lo que el servidor pintó: es la instantánea de hidratación. */
export function useSidebarColapsado(inicial: boolean): boolean {
  return useSyncExternalStore(suscribir, instantanea, () => inicial);
}
