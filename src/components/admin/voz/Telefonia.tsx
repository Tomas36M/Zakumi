"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  buscarNumerosTwilio,
  comprarNumeroTelefonia,
  estadoTelefonia,
  importarNumeroExistente,
  type EstadoTelefonia,
} from "@/lib/admin/voz-actions";
import type { NumeroDisponible } from "@/lib/voz/twilio";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { useConfirmar } from "@/components/admin/ui/Confirmar";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Input, Select } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Island } from "@/components/admin/ui/Island";
import { ListRow } from "@/components/admin/ui/ListRow";
import { Skeleton } from "@/components/admin/ui/Skeleton";

const PAISES: readonly { valor: string; label: string; nota: string }[] = [
  { valor: "US", label: "Estados Unidos", nota: "el más barato y sin trámites (~US$1.15/mes)" },
  { valor: "CO", label: "Colombia", nota: "Twilio exige documentación del país" },
  { valor: "MX", label: "México", nota: "Twilio exige documentación del país" },
  { valor: "ES", label: "España", nota: "Twilio exige documentación del país" },
] as const;

/**
 * Telefonía: comprar el número en Twilio e importarlo a ElevenLabs sin salir
 * del panel. El número queda listo para asignárselo a un agente desde su
 * ficha — sin tocar variables de entorno ni desplegar.
 */
export function Telefonia({ onCerrar }: { onCerrar: () => void }) {
  const [cargando, startCargar] = useTransition();
  const [buscando, startBuscar] = useTransition();
  const [comprando, startComprar] = useTransition();
  const { confirmar, dialogo } = useConfirmar();

  const [estado, setEstado] = useState<EstadoTelefonia | null>(null);
  const [pais, setPais] = useState("US");
  const [prefijo, setPrefijo] = useState("");
  const [disponibles, setDisponibles] = useState<NumeroDisponible[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aImportar, setAImportar] = useState("");
  const [importando, startImportar] = useTransition();

  function importar() {
    setError(null);
    setAviso(null);
    startImportar(async () => {
      try {
        const r = await importarNumeroExistente(aImportar, "Zakumi");
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setAviso(`${aImportar.trim()} importado. Asígnalo a un agente en su ficha.`);
        setAImportar("");
        recargar();
      } catch {
        setError("Se perdió la conexión importando el número.");
      }
    });
  }

  function recargar() {
    startCargar(async () => {
      try {
        setEstado(await estadoTelefonia());
      } catch {
        setError("No se pudo leer el estado de la telefonía.");
      }
    });
  }

  useEffect(recargar, []);

  function buscar() {
    setError(null);
    startBuscar(async () => {
      try {
        const r = await buscarNumerosTwilio(pais, prefijo);
        if ("error" in r) {
          setError(r.error);
          setDisponibles([]);
          return;
        }
        setDisponibles(r.numeros);
      } catch {
        setError("Se perdió la conexión buscando números.");
      }
    });
  }

  async function comprar(n: NumeroDisponible) {
    const ok = await confirmar({
      titulo: `¿Comprar ${n.numero}?`,
      mensaje:
        "Se cobra en tu cuenta de Twilio (~US$1.15/mes) y queda importado en ElevenLabs. " +
        "Después se lo asignas a un agente desde su ficha.",
      accion: "Comprar número",
    });
    if (!ok) return;
    setError(null);
    setAviso(null);
    startComprar(async () => {
      try {
        const r = await comprarNumeroTelefonia(n.numero, "Zakumi");
        if ("error" in r) {
          setError(r.error);
          return;
        }
        setAviso(`${n.numero} comprado e importado. Asígnalo a un agente en su ficha.`);
        setDisponibles((prev) => (prev ?? []).filter((x) => x.numero !== n.numero));
        recargar();
      } catch {
        setError(
          "Se perdió la conexión durante la compra. Revisa en Twilio si el número quedó comprado ANTES de reintentar.",
        );
      }
    });
  }

  const notaPais = PAISES.find((p) => p.valor === pais)?.nota;

  return (
    <Island
      titulo="Telefonía"
      acciones={
        <IconButton etiqueta="Cerrar" onClick={onCerrar}>
          <X className="h-4 w-4" />
        </IconButton>
      }
      className="flex flex-col gap-4 bg-isla-alta/50"
    >
      {error && <Banner variante="error">{error}</Banner>}
      {aviso && <Banner>{aviso}</Banner>}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-tinta-60">Números del workspace</p>
        {cargando && !estado ? (
          <Skeleton className="h-10 w-full" />
        ) : (estado?.numeros.length ?? 0) === 0 ? (
          <EmptyState
            titulo="Todavía no hay números."
            detalle="Compra uno abajo: sin número el agente conversa por el navegador, pero no llama por teléfono."
          />
        ) : (
          <div className="flex flex-col gap-1">
            {estado?.numeros.map((n) => (
              <ListRow key={n.phone_number_id} interactiva={false} className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-tinta">{n.numero}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-tinta-40">{n.etiqueta}</span>
                {estado.numeroEnv === n.phone_number_id && <Badge tono="vivo">Por defecto</Badge>}
                <code className="rounded-full bg-isla px-2 py-0.5 text-xs text-tinta-60">
                  {n.phone_number_id}
                </code>
              </ListRow>
            ))}
          </div>
        )}
      </div>

      {/* La ruta sin comprar nada: una línea que ya existe (SIM o fijo). */}
      <div className="flex flex-col gap-2 rounded-fila bg-isla p-4">
        <p className="text-xs font-medium text-tinta-60">
          ¿Ya tienes una línea? (SIM de tienda o fijo)
        </p>
        <p className="text-xs text-tinta-60">
          Una SIM no puede <strong>hacer</strong> llamadas con IA — no es telefonía
          programable. Pero sí puede <strong>recibirlas</strong>: desvías la línea al
          número de Zakumi y el agente contesta, sin portar nada y reversible cuando
          quieras.
        </p>
        <div className="flex flex-col gap-1 text-xs text-tinta-40">
          <span>
            Desviar todas las llamadas: marcar{" "}
            <code className="rounded bg-isla-alta px-1.5 py-0.5 text-tinta-60">
              **21*NÚMERO#
            </code>{" "}
            · solo si no contesta:{" "}
            <code className="rounded bg-isla-alta px-1.5 py-0.5 text-tinta-60">
              **61*NÚMERO#
            </code>{" "}
            · cancelar:{" "}
            <code className="rounded bg-isla-alta px-1.5 py-0.5 text-tinta-60">##21#</code>
          </span>
          <span>
            Ojo: desviar a un número de otro país puede costar tarifa internacional en
            esa línea — otra razón para que el número de Zakumi sea +57.
          </span>
        </div>
      </div>

      {!estado?.twilioListo ? (
        <Banner>
          Para comprar o importar números falta conectar Twilio: crea la cuenta en
          twilio.com y pon TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en el servidor.
        </Banner>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-fila bg-isla p-4">
            <p className="text-xs font-medium text-tinta-60">
              ¿Ya compraste un número en Twilio? Impórtalo
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-56">
                <Field label="Número (E.164)">
                  <Input
                    value={aImportar}
                    onChange={(e) => setAImportar(e.target.value)}
                    placeholder="+13055550123"
                  />
                </Field>
              </div>
              <Button onClick={importar} disabled={importando || !aImportar.trim()}>
                {importando ? "Importando…" : "Importar"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-fila bg-isla p-4">
            <p className="text-xs font-medium text-tinta-60">Comprar un número</p>
            <Banner>
              Para prospectar en Colombia, un número <strong>+57</strong> se contesta
              mucho más que uno de Estados Unidos (un +1 llamando a un negocio local
              parece spam). Twilio pide documentación del país para los +57: si aún no la
              tienes, compra uno de EE. UU. para probar y tramita el colombiano en
              paralelo.
            </Banner>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-56">
              <Field label="País">
                <Select value={pais} onChange={(e) => setPais(e.target.value)}>
                  {PAISES.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="w-40">
              <Field label="Indicativo (opcional)">
                <Input
                  value={prefijo}
                  onChange={(e) => setPrefijo(e.target.value)}
                  placeholder="305"
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Button onClick={buscar} disabled={buscando}>
              {buscando ? "Buscando…" : "Buscar números"}
            </Button>
          </div>
          {notaPais && <p className="text-xs text-tinta-40">{notaPais}</p>}

          {disponibles !== null && disponibles.length === 0 && !buscando && (
            <EmptyState titulo="Sin números con ese filtro." detalle="Prueba otro indicativo o país." />
          )}

          {(disponibles?.length ?? 0) > 0 && (
            <div className="barra-fina flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
              {disponibles?.map((n) => (
                <ListRow key={n.numero} interactiva={false} className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-tinta">{n.amigable}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-tinta-40">
                    {[n.localidad, n.region].filter(Boolean).join(", ")}
                  </span>
                  <Button disabled={comprando} onClick={() => void comprar(n)}>
                    Comprar
                  </Button>
                </ListRow>
              ))}
            </div>
            )}
          </div>
        </>
      )}
      {dialogo}
    </Island>
  );
}
