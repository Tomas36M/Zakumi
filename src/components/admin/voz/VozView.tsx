"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearAgenteVoz, crearAgenteZakVoz } from "@/lib/admin/voz-actions";
import type { AgenteVozFila } from "@/lib/admin/voz";
import type { VozEleven } from "@/lib/voz/api";
import { seccionesVacias } from "@/lib/voz/guias";
import { Badge } from "@/components/admin/ui/Badge";
import { Banner } from "@/components/admin/ui/Banner";
import { Button } from "@/components/admin/ui/Button";
import { Cockpit, CockpitBody } from "@/components/admin/ui/Cockpit";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Field, Input, Select, TextArea } from "@/components/admin/ui/Field";
import { IconButton } from "@/components/admin/ui/IconButton";
import { Island } from "@/components/admin/ui/Island";
import { BibliotecaVoces } from "./BibliotecaVoces";
import { Telefonia } from "./Telefonia";

type Cliente = { id: string; nombre: string };

function OpcionesVoz({ voces }: { voces: VozEleven[] }) {
  return (
    <>
      {voces.map((v) => (
        <option key={v.voice_id} value={v.voice_id}>
          {v.nombre}
          {v.etiquetas ? ` — ${v.etiquetas}` : ""}
        </option>
      ))}
    </>
  );
}

/** Selector de voz con oído: el nombre no dice nada, el preview sí. Español primero. */
export function SelectorVoz({
  voces,
  valor,
  onCambio,
}: {
  voces: VozEleven[];
  valor: string;
  onCambio: (voiceId: string) => void;
}) {
  const elegida = useMemo(() => voces.find((v) => v.voice_id === valor) ?? null, [voces, valor]);
  const enEspanol = useMemo(() => voces.filter((v) => v.idioma === "es"), [voces]);
  const otras = useMemo(() => voces.filter((v) => v.idioma !== "es"), [voces]);
  return (
    <div className="flex flex-col gap-2">
      <Select value={valor} onChange={(e) => onCambio(e.target.value)}>
        <option value="">Elige una voz…</option>
        {enEspanol.length > 0 ? (
          <>
            <optgroup label="En español">
              <OpcionesVoz voces={enEspanol} />
            </optgroup>
            <optgroup label="Otros idiomas (suenan con acento extranjero)">
              <OpcionesVoz voces={otras} />
            </optgroup>
          </>
        ) : (
          <OpcionesVoz voces={otras} />
        )}
      </Select>
      {enEspanol.length === 0 && (
        <p className="text-xs text-tinta-40">
          El workspace aún no tiene voces en español — agrégalas desde “Voces en
          español” arriba en la consola; las llamadas son en español y estas
          voces sonarían con acento extranjero.
        </p>
      )}
      {elegida?.preview_url && (
        // key: al cambiar de voz el <audio> recarga el preview nuevo.
        <audio
          key={elegida.voice_id}
          className="h-10 w-full"
          controls
          preload="none"
          src={elegida.preview_url}
        />
      )}
    </div>
  );
}

function NuevoAgenteForm({
  voces,
  clientes,
  onCerrar,
}: {
  voces: VozEleven[];
  clientes: Cliente[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [primerMensaje, setPrimerMensaje] = useState(
    "¡Hola, muy buenas! Soy el asistente virtual de …. ¿Con quién tengo el gusto?",
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await crearAgenteVoz({
            nombre,
            clienteId: clienteId || null,
            voiceId,
            primerMensaje,
            secciones: seccionesVacias(),
            extraccion: [], // la action pone la extracción de lead por defecto
            capDiario: 5,
          });
          if ("error" in r) {
            setError(r.error);
            return;
          }
          router.push(`/admin/voz/${r.id}`);
        });
      }}
    >
      <Island className="flex max-w-2xl flex-col gap-4 bg-isla-alta/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-tinta">Agente de voz nuevo</h2>
            <p className="text-xs text-tinta-40">
              Nace con la extracción de lead y las reglas duras puestas; el guion y
              los detalles se afinan en la ficha.
            </p>
          </div>
          <IconButton etiqueta="Cancelar" onClick={onCerrar}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
            Identidad
          </legend>
          <Field label="Nombre *">
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej.: Recepción Clínica Sonría"
              maxLength={200}
              required
              autoFocus
            />
          </Field>
          <Field label="Cliente (vacío = demo de Zakumi)">
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">— Sin cliente (demo) —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-xs font-semibold tracking-wide text-tinta-60 uppercase">
            Voz y saludo
          </legend>
          <Field label="Voz *">
            <SelectorVoz voces={voces} valor={voiceId} onCambio={setVoiceId} />
          </Field>
          <Field label="Primer mensaje * (debe presentarse como asistente virtual)">
            <TextArea
              rows={2}
              maxLength={500}
              value={primerMensaje}
              onChange={(e) => setPrimerMensaje(e.target.value)}
              required
            />
          </Field>
        </fieldset>

        {error && <Banner variante="error">{error}</Banner>}

        <Button
          variante="primaria"
          type="submit"
          className="self-start"
          disabled={pendiente || !nombre.trim() || !voiceId}
        >
          {pendiente ? "Creando…" : "Crear agente"}
        </Button>
      </Island>
    </form>
  );
}

/** Alta de un clic de la voz de Zak: todo viene sembrado menos la voz. */
function CrearZak({ voces }: { voces: VozEleven[] }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState("");

  return (
    <Island
      titulo="Zak todavía no tiene voz"
      className="flex max-w-2xl flex-col gap-3 bg-acento-10"
    >
      <p className="text-xs text-tinta-60">
        Se crea con su prompt completo (quién es, catálogo con precios, guion de
        llamada, horarios y límites) y la extracción de leads. Solo falta
        elegirle la voz — en español, que es el idioma de las llamadas.
      </p>
      <Field label="Voz de Zak *">
        <SelectorVoz voces={voces} valor={voiceId} onCambio={setVoiceId} />
      </Field>
      {error && <Banner variante="error">{error}</Banner>}
      <Button
        variante="primaria"
        className="self-start"
        disabled={pendiente || !voiceId}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const r = await crearAgenteZakVoz(voiceId);
              if ("error" in r) {
                setError(r.error);
                return;
              }
              if (r.aviso) {
                // Fallo parcial (ElevenLabs caído, o es_zak sin marcar): se
                // muestra tal cual y NO se navega como si fuera éxito total.
                setError(r.aviso);
                router.refresh();
                return;
              }
              router.push(`/admin/voz/${r.id}`);
            } catch {
              setError("Se perdió la conexión — mira la lista antes de reintentar (pudo crearse).");
            }
          });
        }}
      >
        {pendiente ? "Creando a Zak…" : "Crear a Zak"}
      </Button>
    </Island>
  );
}

export function VozView({
  agentes,
  llamadasHoy,
  voces,
  clientes,
}: {
  agentes: AgenteVozFila[];
  llamadasHoy: Record<string, number>;
  voces: VozEleven[] | null;
  clientes: Cliente[];
}) {
  const [creando, setCreando] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  const [telefonia, setTelefonia] = useState(false);

  return (
    <Cockpit>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <h1 className="text-lg font-semibold text-tinta">Voz</h1>
        <span className="text-xs text-tinta-40">
          {agentes.length === 1 ? "1 agente" : `${agentes.length} agentes`}
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={() => setTelefonia((v) => !v)}>Telefonía</Button>
          <Button onClick={() => setBiblioteca((v) => !v)} disabled={voces === null}>
            Voces en español
          </Button>
          <Button
            variante="primaria"
            onClick={() => setCreando((v) => !v)}
            disabled={voces === null}
          >
            {creando ? "Cancelar" : "Nuevo agente de voz"}
          </Button>
        </div>
      </header>

      <CockpitBody>
        {voces === null && (
          <Banner>
            Sin conexión con ElevenLabs — falta ELEVENLABS_API_KEY o el proveedor no
            responde. Los agentes ya creados se listan igual.
          </Banner>
        )}

        {telefonia && <Telefonia onCerrar={() => setTelefonia(false)} />}

        {biblioteca && voces !== null && (
          <BibliotecaVoces onCerrar={() => setBiblioteca(false)} />
        )}

        {voces !== null && !agentes.some((a) => a.es_zak) && <CrearZak voces={voces} />}

        {creando && voces !== null && (
          <NuevoAgenteForm voces={voces} clientes={clientes} onCerrar={() => setCreando(false)} />
        )}

        {agentes.length === 0 && !creando ? (
          <EmptyState
            titulo="Todavía no hay agentes de voz."
            detalle="El primero debería ser la demo de Zakumi: créalo sin cliente y pruébalo en su Lab antes de venderlo."
          />
        ) : (
          <div className="grid gap-aire md:grid-cols-2 xl:grid-cols-3">
            {agentes.map((a) => {
              const hoy = llamadasHoy[a.id] ?? 0;
              return (
                <Link
                  key={a.id}
                  href={`/admin/voz/${a.id}`}
                  className="flex flex-col gap-1 rounded-isla bg-isla-alta/50 p-4 transition-colors hover:bg-isla-alta"
                >
                  <header className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold text-tinta">{a.nombre}</h2>
                    <span className="flex shrink-0 items-center gap-1">
                      {a.es_zak && <Badge tono="cliente">Zak</Badge>}
                      <Badge tono={a.activo ? "vivo" : "peligro"}>
                        {a.activo ? "Activo" : "Apagado"}
                      </Badge>
                    </span>
                  </header>
                  <p className="text-xs text-tinta-60">
                    Voz · {a.cliente_nombre ?? "Demo de Zakumi"}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-tinta-40">
                    {!a.agent_id_eleven && <Badge tono="contactado">Sin sincronizar</Badge>}
                    <span>
                      hoy {hoy}/{a.cap_diario} salientes
                    </span>
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </CockpitBody>
    </Cockpit>
  );
}
