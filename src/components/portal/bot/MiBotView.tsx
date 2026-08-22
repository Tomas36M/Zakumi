"use client";

import { useState } from "react";
import type { Lead } from "@/lib/bots/tipos";
import type { CampoGuiado } from "@/lib/portal/conocimiento";
import { EditorConocimiento } from "./EditorConocimiento";
import { LabsPortal } from "./LabsPortal";
import { ConversacionesCliente } from "./ConversacionesCliente";

type Tab = "personalidad" | "probar" | "conversaciones" | "contactos";

type Props = {
  instanciaId: string;
  /** null = sin conexión con el bot. */
  activo: boolean | null;
  conversaciones: number | null;
  prompt: { baseVersion: number; campos: Record<CampoGuiado, string> } | null;
  leads: Lead[] | null;
};

export function MiBotView({ instanciaId, activo, conversaciones, prompt, leads }: Props) {
  const [tab, setTab] = useState<Tab>("personalidad");

  const TABS: { valor: Tab; label: string }[] = [
    { valor: "personalidad", label: "Personalidad" },
    { valor: "probar", label: "Probar" },
    { valor: "conversaciones", label: "Conversaciones" },
    { valor: "contactos", label: `Contactos${leads ? ` (${leads.length})` : ""}` },
  ];

  return (
    <div>
      <div className="app-grid" style={{ marginBottom: "1.3rem" }}>
        <div className="app-card">
          <p className="app-card-titulo">Estado</p>
          {activo === null ? (
            <span className="app-chip app-chip--neutro">Sin conexión</span>
          ) : activo ? (
            <span className="app-chip app-chip--ok">Atendiendo</span>
          ) : (
            <span className="app-chip app-chip--neutro">Apagado</span>
          )}
          {activo === null && (
            <p className="app-card-nota">
              No pudimos hablar con tu agente ahora mismo. Vuelve a intentar en
              un momento.
            </p>
          )}
        </div>
        <div className="app-card">
          <p className="app-card-titulo">Conversaciones atendidas</p>
          <p className="app-cifra">{conversaciones ?? "—"}</p>
        </div>
      </div>

      <div className="app-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.valor}
            type="button"
            role="tab"
            aria-selected={tab === t.valor}
            className={tab === t.valor ? "app-tab app-tab--activa" : "app-tab"}
            onClick={() => setTab(t.valor)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "personalidad" &&
        (prompt ? (
          <EditorConocimiento
            instanciaId={instanciaId}
            baseVersion={prompt.baseVersion}
            camposIniciales={prompt.campos}
          />
        ) : (
          <p className="app-aviso">
            No pudimos cargar la configuración de tu agente. Recarga la página en
            un momento.
          </p>
        ))}

      {tab === "probar" && <LabsPortal instanciaId={instanciaId} />}

      {tab === "conversaciones" && <ConversacionesCliente instanciaId={instanciaId} />}

      {tab === "contactos" && <TablaContactos leads={leads} />}
    </div>
  );
}

function TablaContactos({ leads }: { leads: Lead[] | null }) {
  if (leads === null) {
    return (
      <p className="app-aviso">
        No pudimos cargar los contactos ahora mismo. Vuelve a intentar en un
        momento.
      </p>
    );
  }
  if (leads.length === 0) {
    return (
      <div className="app-vacio app-card">
        <p>
          Cuando alguien le deje sus datos a tu agente, aparecerá aquí como
          contacto.
        </p>
      </div>
    );
  }
  return (
    <div className="app-tabla-scroll">
      <table className="app-tabla">
        <thead>
          <tr>
            <th>Teléfono</th>
            <th>Datos que dejó</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, i) => (
            <tr key={`${lead.phone}-${i}`}>
              <td className="app-tabla-num">{lead.phone}</td>
              <td>
                {Object.entries(lead.datos).length === 0
                  ? "—"
                  : Object.entries(lead.datos)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
