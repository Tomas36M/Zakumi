"use client";

import { useState } from "react";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";

function snippetWidget(agentId: string): string {
  return (
    `<elevenlabs-convai agent-id="${agentId}"></elevenlabs-convai>\n` +
    `<script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>`
  );
}

/** Snippet del widget para pegar en la web del cliente. */
export function WidgetVoz({ agentIdEleven }: { agentIdEleven: string | null }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!agentIdEleven) {
    return <Banner>Sincroniza el agente para obtener el snippet.</Banner>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-tinta-60">
        Pega esto en la web del cliente (antes de cerrar el body). El visitante habla
        con el agente desde el navegador — sin número, sin costo de telefonía.
      </p>
      <pre className="overflow-x-auto rounded-fila bg-isla-alta p-4 text-xs leading-relaxed text-tinta-85">
        {snippetWidget(agentIdEleven)}
      </pre>
      <Button
        className="self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(snippetWidget(agentIdEleven));
            setError(null);
            setMensaje("Snippet copiado.");
          } catch {
            setMensaje(null);
            setError("El navegador no dejó copiar. Selecciona el snippet y cópialo a mano.");
          }
        }}
      >
        Copiar snippet
      </Button>
      {mensaje && <Banner>{mensaje}</Banner>}
      {error && <Banner variante="error">{error}</Banner>}
    </div>
  );
}
