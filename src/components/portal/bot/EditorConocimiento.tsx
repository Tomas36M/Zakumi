"use client";

import { useState, useTransition } from "react";
import { CAMPOS_GUIADOS, MAX_POR_CAMPO, type CampoGuiado } from "@/lib/portal/conocimiento";
import { guardarSecciones } from "@/lib/portal/actions";

type Props = {
  instanciaId: string;
  baseVersion: number;
  camposIniciales: Record<CampoGuiado, string>;
};

/**
 * Secciones guiadas del agente: el cliente edita 5 campos estructurados y el
 * servidor los funde dentro del knowledge sin tocar el system_prompt ni lo
 * que Zakumi escribió a mano. Cada guardado crea una versión nueva del
 * prompt (rollback siempre posible desde el panel).
 */
export function EditorConocimiento({ instanciaId, baseVersion, camposIniciales }: Props) {
  const [campos, setCampos] = useState(camposIniciales);
  const [version, setVersion] = useState(baseVersion);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, startTransition] = useTransition();

  function guardar() {
    setMensaje(null);
    startTransition(async () => {
      const r = await guardarSecciones({ instanciaId, baseVersion: version, campos });
      if (r.ok) {
        setVersion(r.version);
        setMensaje({ ok: true, texto: "Guardado. Tu agente ya responde con esto." });
      } else {
        setMensaje({ ok: false, texto: r.error });
      }
    });
  }

  return (
    <div>
      {CAMPOS_GUIADOS.map(({ campo, titulo, ayuda, placeholder }) => (
        <div key={campo} className="app-field">
          <label className="app-field-label" htmlFor={`bot-${campo}`}>
            {titulo}
          </label>
          <textarea
            id={`bot-${campo}`}
            className="app-textarea"
            value={campos[campo]}
            maxLength={MAX_POR_CAMPO}
            placeholder={placeholder}
            onChange={(e) =>
              setCampos((c) => ({ ...c, [campo]: e.target.value }))
            }
          />
          <span className="app-field-ayuda">{ayuda}</span>
        </div>
      ))}

      {mensaje && (
        <p className={mensaje.ok ? "app-ok-texto" : "app-error"} role="status">
          {mensaje.texto}
        </p>
      )}

      <button
        type="button"
        className="app-btn"
        onClick={guardar}
        disabled={guardando}
      >
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>
      <p className="app-field-ayuda" style={{ paddingLeft: 0, marginTop: "0.6rem" }}>
        Después de guardar, escríbele en la pestaña Probar para ver cómo quedó.
      </p>
    </div>
  );
}
