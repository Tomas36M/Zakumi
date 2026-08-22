"use client";

import { useSyncExternalStore } from "react";

/** Colapso del sidebar persistido. Patrón useSyncExternalStore + localStorage:
 *  sin contexto, sin hydration mismatch (el servidor siempre ve expandido). */

const CLAVE = "zk-sidebar-colapsado";
const oyentes = new Set<() => void>();

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

function instantanea(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

function instantaneaServidor(): boolean {
  return false;
}

export function alternarSidebar(): void {
  try {
    localStorage.setItem(CLAVE, instantanea() ? "0" : "1");
  } catch {
    /* sin storage no hay persistencia, pero tampoco crash */
  }
  for (const oyente of oyentes) oyente();
}

export function useSidebarColapsado(): boolean {
  return useSyncExternalStore(suscribir, instantanea, instantaneaServidor);
}
