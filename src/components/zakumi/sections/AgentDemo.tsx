import { CHAT_GUION } from "../content";
import { WHATSAPP_URL } from "../contact";

const PUNTOS = [
  "Responde al instante, 24/7",
  "Entiende la intención y califica solo",
  "Agenda, cobra y cierra sin que tú estés",
];

// ——— Consola CRM: el producto que vive detrás del agente ———
const NAV = [
  { id: "resumen", label: "Resumen", active: true },
  { id: "leads", label: "Leads" },
  { id: "pipeline", label: "Pipeline" },
  { id: "chats", label: "Chats" },
  { id: "ajustes", label: "Ajustes" },
];

const KPIS = [
  { label: "Prospectos", val: "1,250", delta: "12.5" },
  { label: "Calificados", val: "320", delta: "8.2" },
  { label: "Oportunidades", val: "85", delta: "15.3" },
  { label: "Conversión", val: "24.6%", delta: "6.1" },
];

const PIPELINE = [
  { stage: "Nuevo", count: "250", money: "$125k", more: "7", leads: [
    { ini: "TX", name: "Tienda XYZ", val: "$25k" },
    { ini: "SA", name: "Soluciones ABC", val: "$15k" },
  ] },
  { stage: "Contactado", count: "180", money: "$90k", more: "5", leads: [
    { ini: "IN", name: "Innovatech", val: "$20k" },
    { ini: "CS", name: "Comercial Sur", val: "$18k" },
  ] },
  { stage: "Calificado", count: "120", money: "$60k", more: "3", leads: [
    { ini: "DC", name: "DataCorp", val: "$25k" },
    { ini: "OS", name: "Óptima Sol.", val: "$20k" },
  ] },
  { stage: "Propuesta", count: "60", money: "$45k", more: "2", leads: [
    { ini: "NG", name: "Negocios G.", val: "$25k" },
  ] },
  { stage: "Ganado", count: "30", money: "$30k", more: "1", leads: [
    { ini: "GE", name: "Grupo Éxito", val: "$20k" },
  ] },
];

function NavIcon({ id }: { id: string }) {
  const c = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "resumen":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <rect x="3" y="3" width="7" height="7" rx="1.6" />
          <rect x="14" y="3" width="7" height="7" rx="1.6" />
          <rect x="3" y="14" width="7" height="7" rx="1.6" />
          <rect x="14" y="14" width="7" height="7" rx="1.6" />
        </svg>
      );
    case "leads":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8M20.5 19a5.2 5.2 0 0 0-3.4-4.7" />
        </svg>
      );
    case "pipeline":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <rect x="3" y="4" width="5" height="16" rx="1.4" />
          <rect x="9.5" y="4" width="5" height="11" rx="1.4" />
          <rect x="16" y="4" width="5" height="7" rx="1.4" />
        </svg>
      );
    case "chats":
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <path d="M4 5.5h16v10H9.5L5 19v-3.5H4z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...c}>
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      );
  }
}

export function AgentDemo() {
  return (
    <section className="agent-demo" id="demo-agente">
      <div className="agent-grid">
        <div className="agent-intro">
          <div className="section-num">— en vivo —</div>
          <h2 className="section-title">
            Míralo vender. <em>Luego habla con él.</em>
          </h2>
          <p className="agent-lead">
            No es un guion de marketing: es el mismo agente que pondríamos a
            atender tu WhatsApp. Resuelve dudas, califica y cierra una venta —
            mientras tú haces otra cosa.
          </p>
          <ul className="agent-points">
            {PUNTOS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <a
            className="cta"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Prueba el agente de IA en WhatsApp"
            style={{ opacity: 1 }}
          >
            <span>Pruébalo tú mismo</span>
            <span className="arrow">→</span>
          </a>
        </div>

        <div className="agent-stage">
          <div className="agent-devices">
            {/* Consola CRM — el software detrás del agente */}
            <div className="agent-desktop" aria-hidden>
              <div className="agent-dt-screen">
                <div className="agent-dt-bar">
                  <span className="agent-tb-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="agent-dt-url">app.zakumi.studio/crm</span>
                  <span className="agent-tb-live">
                    <i />
                    12 activas
                  </span>
                </div>

                <div className="crm-body">
                  <aside className="crm-side">
                    <span className="crm-brand">
                      <span className="crm-brand-mark">Z</span>
                      <span className="crm-brand-tx">CRM</span>
                    </span>
                    <div className="crm-nav">
                      {NAV.map((n) => (
                        <span
                          key={n.id}
                          className={`crm-nav-item${n.active ? " is-active" : ""}`}
                        >
                          <NavIcon id={n.id} />
                          <span>{n.label}</span>
                        </span>
                      ))}
                    </div>
                    <span className="crm-ia">
                      <span className="crm-ia-mark" />
                      <span className="crm-ia-label">Análisis de IA</span>
                      <span className="crm-ia-sub">3 cierres sugeridos hoy</span>
                    </span>
                  </aside>

                  <div className="crm-main">
                    <div className="crm-main-head">
                      <span className="crm-title">Resumen</span>
                      <span className="crm-search">Buscar leads…</span>
                      <span className="crm-user">CM</span>
                    </div>

                    <div className="crm-kpis">
                      {KPIS.map((k) => (
                        <span className="crm-kpi" key={k.label}>
                          <span className="crm-kpi-label">{k.label}</span>
                          <span className="crm-kpi-val">{k.val}</span>
                          <span className="crm-kpi-delta">▲ {k.delta}%</span>
                        </span>
                      ))}
                    </div>

                    <div className="crm-pipe-head">
                      <span className="crm-pipe-title">Pipeline de ventas</span>
                      <span className="crm-pipe-sum">$350k · 640 leads</span>
                    </div>
                    <div className="crm-pipe">
                      {PIPELINE.map((col, ci) => (
                        <span className={`crm-col heat-${ci}`} key={col.stage}>
                          <span className="crm-col-bar" />
                          <span className="crm-col-head">
                            <span className="crm-col-stage">{col.stage}</span>
                            <span className="crm-col-count">{col.count}</span>
                          </span>
                          <span className="crm-col-money">{col.money}</span>
                          {col.leads.map((l) => (
                            <span className="crm-lead" key={l.name}>
                              <span className="crm-lead-av">{l.ini}</span>
                              <span className="crm-lead-name">{l.name}</span>
                              <span className="crm-lead-val">{l.val}</span>
                            </span>
                          ))}
                          <span className="crm-col-more">+{col.more} más</span>
                        </span>
                      ))}
                    </div>

                    <span className="crm-ai-bar">
                      <span className="crm-ai-dot" />
                      <span className="crm-ai-tx">
                        <b>IA</b> · María Restrepo — intención de compra · 3 uds ·
                        cierre hoy
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* iPhone: chat en vivo (héroe) */}
            <div className="agent-phone">
              <span className="agent-phone-island" aria-hidden />
              <div className="agent-screen">
                <div className="agent-status" aria-hidden>
                  <span className="agent-time">9:41</span>
                  <span className="agent-status-r">
                    <span className="agent-sig">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <svg
                      className="agent-wifi"
                      viewBox="0 0 16 12"
                      width="15"
                      height="11"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    >
                      <path d="M8 10.2a.7.7 0 100-1.4.7.7 0 000 1.4z" fill="currentColor" stroke="none" />
                      <path d="M3.7 6.4a6 6 0 018.6 0M1.4 4.1a9 9 0 0113.2 0" />
                    </svg>
                    <span className="agent-batt">
                      <i />
                    </span>
                  </span>
                </div>

                <div className="agent-wa-head" aria-hidden>
                  <span className="agent-wa-back">‹</span>
                  <span className="agent-wa-av">
                    Z<span className="agent-wa-online" />
                  </span>
                  <span className="agent-wa-meta">
                    <span className="agent-wa-name">Zakumi · Agente IA</span>
                    <span className="agent-wa-status">en línea</span>
                  </span>
                  <span className="agent-wa-icons">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="3" y="6" width="12" height="12" rx="2.5" />
                      <path d="M15 10l5-3v10l-5-3z" />
                    </svg>
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M5 4h3l1.4 4-2 1.4a11 11 0 005 5l1.4-2 4 1.4v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                    </svg>
                  </span>
                </div>

                <div className="agent-chat">
                  <div className="agent-chat-day" aria-hidden>
                    <span>Hoy</span>
                  </div>
                  {CHAT_GUION.map((m, i) => (
                    <div className={`agent-msg is-${m.from}`} key={i}>
                      <span className="agent-typing" aria-hidden>
                        <i></i>
                        <i></i>
                        <i></i>
                      </span>
                      <span className="agent-text">{m.text}</span>
                    </div>
                  ))}
                </div>

                <div className="agent-input" aria-hidden>
                  <span className="agent-input-box">Escribe un mensaje…</span>
                  <span className="agent-input-send">↑</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
