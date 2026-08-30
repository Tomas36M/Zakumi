"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  estadoLlamadaVoz,
  llamadaPruebaVoz,
  type FaseLlamadaLab,
} from "@/lib/admin/voz-actions";
import type { AgenteVozFila } from "@/lib/admin/voz";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Field, Input } from "@/components/admin/ui/Field";
import { Island } from "@/components/admin/ui/Island";
import { DetalleLlamada } from "./LlamadasVoz";

// El widget es un custom element; React 19 tipa JSX dentro del módulo react
// y eso solo se puede declarar con namespace (no hay equivalente ES2015).
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { "agent-id": string };
    }
  }
}

const POLL_MS = 4_000;
const MAX_INTENTOS = 90; // ~6 minutos: más que cualquier prueba razonable

const COPY_FASE: Record<string, string> = {
  buscando: "Marcando…",
  sonando: "Sonando en tu teléfono…",
  hablando: "En llamada — habla con el agente 📞",
  procesando: "Colgada. Procesando el transcript…",
  fallida: "No se pudo iniciar la llamada. Esperando el detalle del proveedor…",
};

/**
 * Lab de llamadas: probar el agente hablando desde el navegador (el mismo
 * widget que se vende) y con una llamada de prueba al celular narrada en vivo
 * hasta que el webhook post-call aterriza el resultado completo.
 */
export function LabVoz({
  agente,
  llamadasHoy,
  telefoniaLista,
}: {
  agente: AgenteVozFila;
  llamadasHoy: number;
  telefoniaLista: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [refrescando, startRefrescar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [telefono, setTelefono] = useState("");
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [fase, setFase] = useState<FaseLlamadaLab | null>(null);
  const [agotado, setAgotado] = useState(false);
  const [sinId, setSinId] = useState(false);
  const intentos = useRef(0);

  const widgetListo = Boolean(agente.agent_id_eleven) && agente.activo;

  useEffect(() => {
    if (!enCurso) return;
    let activo = true;
    const timer = setInterval(() => {
      void (async () => {
        intentos.current += 1;
        const f = await estadoLlamadaVoz(agente.id, enCurso);
        if (!activo) return;
        setFase(f);
        if (f.fase === "aterrizada" || f.fase === "error") {
          setEnCurso(null);
          if (f.fase === "aterrizada") router.refresh(); // contadores + pestaña Llamadas
          return;
        }
        if (intentos.current >= MAX_INTENTOS) {
          setEnCurso(null);
          setAgotado(true);
        }
      })();
    }, POLL_MS);
    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, [enCurso, agente.id, router]);

  function llamar() {
    setError(null);
    setFase(null);
    setAgotado(false);
    setSinId(false);
    intentos.current = 0;
    startTransition(async () => {
      const r = await llamadaPruebaVoz(agente.id, telefono);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      if (r.conversationId) {
        setEnCurso(r.conversationId);
        setFase({ fase: "buscando" });
      } else {
        // Sin conversation_id no hay polling: el webhook aterriza igual.
        setSinId(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Island titulo="Hablar desde el navegador" className="flex flex-col gap-3 bg-isla-alta/50">
        {!widgetListo ? (
          <Banner>
            {agente.agent_id_eleven
              ? "El agente está apagado. Enciéndelo para probarlo."
              : "Sincroniza el agente con ElevenLabs para probarlo."}
          </Banner>
        ) : (
          <>
            <p className="text-xs text-tinta-60">
              Es el mismo widget que se instala en la web del cliente: el botón del
              agente aparece abajo a la derecha. El navegador pedirá permiso de
              micrófono.
            </p>
            {agente.cliente_id && (
              <Banner>
                Una sesión de widget es una llamada real: si dictas nombre y teléfono
                se crea la venta en el portal del cliente. Solo la llamada de prueba
                telefónica está exenta.
              </Banner>
            )}
            <Script
              src="https://unpkg.com/@elevenlabs/convai-widget-embed"
              strategy="lazyOnload"
            />
            <elevenlabs-convai agent-id={agente.agent_id_eleven!} />
            <div>
              <Button
                disabled={refrescando}
                onClick={() => startRefrescar(() => router.refresh())}
              >
                {refrescando ? "Actualizando…" : "Actualizar llamadas"}
              </Button>
              <p className="mt-1 text-xs text-tinta-40">
                La sesión aterriza en la pestaña Llamadas (como “Widget”) al colgar,
                vía el webhook post-call.
              </p>
            </div>
          </>
        )}
      </Island>

      <Island titulo="Llamada de prueba a tu celular" className="flex flex-col gap-3 bg-isla-alta/50">
        {!telefoniaLista && (
          <Banner>
            Sin número saliente: falta ELEVENLABS_PHONE_NUMBER_ID (es el interruptor
            del piloto — paso 7 del runbook). El widget funciona igual.
          </Banner>
        )}
        <p className="text-xs text-tinta-60">
          El agente te llama a ti. Cuenta para el cap diario ({llamadasHoy}/
          {agente.cap_diario} hoy), queda marcada como “Prueba” y no crea ventas.
        </p>
        <Field label="Tu teléfono">
          <Input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+57 300 123 4567"
            className="max-w-72"
          />
        </Field>
        <Button
          variante="primaria"
          className="self-start"
          disabled={pendiente || !telefoniaLista || enCurso !== null}
          onClick={llamar}
        >
          {pendiente ? "Marcando…" : "Llamarme"}
        </Button>

        {error && <Banner variante="error">{error}</Banner>}
        {sinId && (
          <Banner>
            Llamada lanzada. El proveedor no devolvió el identificador para narrarla
            en vivo — el resultado aterriza en la pestaña Llamadas al colgar.
          </Banner>
        )}
        {fase && fase.fase in COPY_FASE && (
          <Banner variante={fase.fase === "fallida" ? "error" : "aviso"}>
            {COPY_FASE[fase.fase]}
          </Banner>
        )}
        {fase?.fase === "error" && <Banner variante="error">{fase.error}</Banner>}
        {agotado && (
          <Banner>
            Dejé de preguntar (~6 min). Si la llamada terminó, aparece en la pestaña
            Llamadas en cuanto llegue el webhook.
          </Banner>
        )}
      </Island>

      {fase?.fase === "aterrizada" && (
        <Island titulo="Resultado" className="flex flex-col gap-3 bg-isla-alta/50">
          <DetalleLlamada agenteId={agente.id} llamada={fase.llamada} />
        </Island>
      )}
    </div>
  );
}
