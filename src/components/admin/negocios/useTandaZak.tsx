import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ModoPlantilla } from "@/lib/admin/envio";
import type { Negocio } from "@/lib/admin/negocios";
import { resumenTanda } from "@/lib/admin/zak";
import { enviarTandaZak } from "@/lib/admin/zak-actions";
import { DialogoTanda, type EnvioPendiente } from "./DialogoTanda";

/**
 * «Que Zak los contacte», con su diálogo (qué plantilla usar) y su aviso. Lo
 * usan la barra de lote de la lista de Leads y el botón de la página de un
 * territorio: el mismo diálogo, el mismo envío y el mismo resumen en los dos
 * sitios.
 *
 * `dialogo` va montado una vez en el árbol de quien use el hook.
 */
export function useTandaZak(onHecho?: () => void) {
  const router = useRouter();
  const [pendiente, setPendiente] = useState<EnvioPendiente | null>(null);
  const [enviando, startEnvio] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  /** `elegibles` ya pasados por `contactables`. `nota` se suma al diálogo:
   * quiénes quedan fuera, o por qué no van todos hoy. */
  function contactar(elegibles: Negocio[], nota?: string) {
    if (elegibles.length === 0) return;
    setPendiente({ elegibles, nota });
  }

  function enviar(modo: ModoPlantilla) {
    const elegibles = pendiente?.elegibles ?? [];
    setPendiente(null);
    setAviso(null);
    startEnvio(async () => {
      const res = await enviarTandaZak(
        elegibles.map((x) => x.id),
        modo,
      );
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      setAviso(resumenTanda(res));
      onHecho?.();
      router.refresh();
    });
  }

  const dialogo = (
    <DialogoTanda pendiente={pendiente} onCancelar={() => setPendiente(null)} onConfirmar={enviar} />
  );

  return { contactar, enviando, aviso, dialogo };
}
