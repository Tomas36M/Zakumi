import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Negocio } from "@/lib/admin/negocios";
import { agruparPorVertical, resumenTanda } from "@/lib/admin/zak";
import { enviarTandaZak } from "@/lib/admin/zak-actions";
import { useConfirmar } from "@/components/admin/ui/Confirmar";

/**
 * «Que Zak los contacte», con su confirmación y su aviso. Lo usan la barra de
 * lote de la lista de Leads y el botón de la página de un territorio: el mismo
 * diálogo, el mismo envío y el mismo resumen en los dos sitios.
 *
 * `dialogo` va montado una vez en el árbol de quien use el hook.
 */
export function useTandaZak(onHecho?: () => void) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirmar();
  const [enviando, startEnvio] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  /** `elegibles` ya pasados por `contactables`. `nota` se suma al mensaje:
   * quiénes quedan fuera, o por qué no van todos hoy. */
  async function contactar(elegibles: Negocio[], nota?: string) {
    const n = elegibles.length;
    if (n === 0) return;
    const desglose = agruparPorVertical(elegibles)
      .map((g) => `${g.negocios.length} ${g.vertical.label}`)
      .join(" · ");
    const ok = await confirmar({
      titulo: `Zak abrirá conversación con ${n} negocio(s)`,
      mensaje:
        `Cada tipo con SU plantilla: ${desglose}.` +
        (nota ? `\n(${nota})` : "") +
        "\n\nCada envío inicia una conversación de marketing con costo de Meta, y el " +
        "número sin verificar admite máx. 250 iniciadas/día. Cuando respondan, Zak " +
        "conversa con el ángulo de cada vertical y marca a los interesados.",
      accion: "Que Zak los contacte",
    });
    if (!ok) return;
    setAviso(null);
    startEnvio(async () => {
      const res = await enviarTandaZak(elegibles.map((x) => x.id));
      if ("error" in res) {
        setAviso(res.error);
        return;
      }
      setAviso(resumenTanda(res));
      onHecho?.();
      router.refresh();
    });
  }

  return { contactar, enviando, aviso, dialogo };
}
