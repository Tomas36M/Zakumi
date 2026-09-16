"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, MessageSquare, Trash2, UserPlus } from "lucide-react";
import { eliminarNegocios } from "@/lib/admin/actions";
import { convertirNegocioEnCliente } from "@/lib/admin/cartera-actions";
import type { Negocio } from "@/lib/admin/negocios";
import type { EstadoVozZak } from "@/lib/admin/voz-estado";
import { linkChatZak } from "@/lib/admin/zak";
import { noEraInteresReal } from "@/lib/admin/zak-actions";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { BotonLlamarZak } from "@/components/admin/voz/BotonLlamarZak";

type Props = {
  negocio: Negocio;
  vozZak: EstadoVozZak;
  onCerrar: () => void;
  onEliminado: () => void;
  /** router.refresh() del dueño tras un cambio de estado. */
  onCambio?: () => void;
};

/** Lo que se puede hacer con un lead: escribirle o llamarlo con Zak,
 * abrir su sitio, convertirlo en cliente o borrarlo del CRM. */
export function FichaLeadAcciones({ negocio, vozZak, onCerrar, onEliminado, onCambio }: Props) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirmar();
  const [ocupado, startAccion] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const chatZak = linkChatZak(negocio);

  async function eliminar() {
    const ok = await confirmar({
      titulo: `¿Eliminar ${negocio.nombre} del CRM?`,
      mensaje:
        "Se borran también sus notas. Si ya era cliente, el cliente no se toca, y las conversaciones de Zak siguen en su bandeja.",
      accion: "Eliminar",
      peligro: true,
    });
    if (!ok) return;
    setError(null);
    startAccion(async () => {
      const res = await eliminarNegocios([negocio.id]);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onEliminado();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {dialogo}
      <div className="flex flex-wrap items-center gap-2">
        {chatZak !== null ? (
          <Link
            href={chatZak}
            className="inline-flex h-control items-center justify-center gap-2 rounded-full bg-acento px-4 text-sm font-medium text-white transition-colors hover:bg-acento-85"
          >
            <MessageSquare className="h-4 w-4" /> Chat con Zak
          </Link>
        ) : (
          <Button disabled title="Sin celular con WhatsApp">
            <MessageSquare className="h-4 w-4" /> Chat con Zak
          </Button>
        )}
        {negocio.telefono !== null && (
          <BotonLlamarZak
            vozZak={vozZak}
            telefono={negocio.telefono}
            nombre={negocio.nombre}
            negocioId={negocio.id}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {negocio.sitio_web && (
          <a
            href={negocio.sitio_web}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-control items-center justify-center gap-2 rounded-full bg-isla-alta px-4 text-sm font-medium text-tinta-85 transition-colors hover:bg-acento-10 hover:text-tinta"
          >
            <ExternalLink className="h-4 w-4" /> Sitio web
          </a>
        )}
        {negocio.estado === "interesado" && negocio.telefono !== null && (
          <Button
            disabled={ocupado}
            onClick={() => {
              void (async () => {
                const ok = await confirmar({
                  titulo: "¿No era interés real?",
                  mensaje:
                    "Vuelve a Contactado (o a Respondió si ya escribió una persona) y Zak no lo volverá a marcar hasta que alguien escriba algo nuevo.",
                  accion: "Desmarcar",
                });
                if (!ok) return;
                setError(null);
                startAccion(async () => {
                  const res = await noEraInteresReal(negocio.id, negocio.telefono as string);
                  if ("error" in res) {
                    setError(res.error);
                    return;
                  }
                  onCambio?.();
                  router.refresh();
                });
              })();
            }}
          >
            No era interés real
          </Button>
        )}
        <Button
          disabled={ocupado}
          onClick={() => {
            setError(null);
            startAccion(async () => {
              const res = await convertirNegocioEnCliente(negocio.id);
              if ("error" in res) {
                setError(res.error);
                return;
              }
              // Idempotente: si ya era cliente, aterriza en su misma ficha.
              onCerrar();
              router.push(`/admin/clientes?cliente=${res.clienteId}`);
            });
          }}
        >
          <UserPlus className="h-4 w-4" /> Convertir en cliente
        </Button>
        <Button variante="peligro" disabled={ocupado} onClick={() => void eliminar()}>
          <Trash2 className="h-4 w-4" /> Eliminar
        </Button>
      </div>

      {error && <Banner variante="error">{error}</Banner>}
    </div>
  );
}
