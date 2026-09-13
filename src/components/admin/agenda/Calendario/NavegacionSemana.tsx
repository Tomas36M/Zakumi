"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { etiquetaSemana, semanaVecina, type RangoSemana } from "@/lib/agenda/semana";
import { Button } from "@/components/admin/ui/Button";
import { IconButton } from "@/components/admin/ui/IconButton";

type Props = {
  rango: RangoSemana;
  /** El lunes de la semana de hoy: «Hoy» vuelve ahí. */
  lunesDeHoy: string;
};

/** ‹ · Hoy · › y la etiqueta de la semana. Navegar cambia `?semana=` y la
 * page vuelve a consultar: cada semana es una lectura chica. */
export function NavegacionSemana({ rango, lunesDeHoy }: Props) {
  const router = useRouter();
  const ir = (lunes: string) =>
    router.push(lunes === lunesDeHoy ? "/admin/agenda" : `/admin/agenda?semana=${lunes}`, {
      scroll: false,
    });

  return (
    <div className="flex items-center gap-2">
      <IconButton etiqueta="Semana anterior" onClick={() => ir(semanaVecina(rango.lunes, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </IconButton>
      <Button disabled={rango.lunes === lunesDeHoy} onClick={() => ir(lunesDeHoy)}>
        Hoy
      </Button>
      <IconButton etiqueta="Semana siguiente" onClick={() => ir(semanaVecina(rango.lunes, 1))}>
        <ChevronRight className="h-4 w-4" />
      </IconButton>
      <span className="text-sm font-medium text-tinta-85">{etiquetaSemana(rango)}</span>
    </div>
  );
}
