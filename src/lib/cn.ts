import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases; ante conflicto de utilidades Tailwind gana la última. */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
