import type { Signature } from "../services";

/**
 * Visual de la sección "estrella" de cada página de servicio.
 * Solo el visual (el texto lo pone ServicePage). Se elige por signature.kind.
 */
export function ServiceSignature({ signature }: { signature: Signature }) {
  if (signature.kind === "chat") return <SignatureChat signature={signature} />;
  if (signature.kind === "producto") return <SignatureProducto />;
  return <SignatureMarca />;
}

/* ——— Agentes IA: chat de WhatsApp con guion (animado por GSAP en ServicePage) ——— */
function SignatureChat({
  signature,
}: {
  signature: Extract<Signature, { kind: "chat" }>;
}) {
  return (
    <div className="sig-phone" role="img" aria-label="Conversación de ejemplo con el agente de IA">
      <span className="sig-phone-island" aria-hidden />
      <div className="sig-phone-screen">
        <div className="sig-wa-head" aria-hidden>
          <span className="sig-wa-back">‹</span>
          <span className="sig-wa-av">
            Z<span className="sig-wa-online" />
          </span>
          <span className="sig-wa-meta">
            <span className="sig-wa-name">{signature.chatName}</span>
            <span className="sig-wa-status">en línea</span>
          </span>
          <span className="sig-wa-icons">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="6" width="12" height="12" rx="2.5" />
              <path d="M15 10l5-3v10l-5-3z" />
            </svg>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M5 4h3l1.4 4-2 1.4a11 11 0 005 5l1.4-2 4 1.4v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
            </svg>
          </span>
        </div>

        <div className="sig-chat">
          <div className="sig-chat-day" aria-hidden>
            <span>Hoy</span>
          </div>
          {signature.guion.map((m, i) => (
            <div className={`agent-msg is-${m.from}`} key={i}>
              <span className="agent-typing" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span className="agent-text">{m.text}</span>
            </div>
          ))}
        </div>

        <div className="sig-wa-input" aria-hidden>
          <span className="sig-wa-box">Escribe un mensaje…</span>
          <span className="sig-wa-send">↑</span>
        </div>
      </div>
    </div>
  );
}

/* ——— Software: ventana de app / panel a medida ——— */
const SIG_KPIS = [
  { l: "Ventas del mes", v: "$4.2M", d: "▲ 12%" },
  { l: "Pedidos", v: "318", d: "▲ 8%" },
  { l: "Ticket medio", v: "$132k", d: "▲ 4%" },
];
const SIG_ROWS = [
  { ini: "TX", name: "Tienda XYZ", tag: "Pagado", val: "$1.2M" },
  { ini: "IN", name: "Innovatech", tag: "En proceso", val: "$860k" },
  { ini: "CS", name: "Comercial Sur", tag: "Pagado", val: "$540k" },
];

function SignatureProducto() {
  return (
    <div className="sig-window" role="img" aria-label="Vista previa de un panel a medida">
      <div className="sig-window-bar">
        <span className="sig-window-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="sig-window-url">app.zakumi.studio</span>
        <span className="sig-window-live" aria-hidden>
          <i />
          en vivo
        </span>
      </div>
      <div className="sig-app">
        <aside className="sig-app-side" aria-hidden>
          <span className="sig-app-logo">Z</span>
          <span className="sig-app-navi is-active" />
          <span className="sig-app-navi" />
          <span className="sig-app-navi" />
          <span className="sig-app-navi" />
        </aside>
        <div className="sig-app-main">
          <div className="sig-app-head">
            <span className="sig-app-title">Panel de operación</span>
            <span className="sig-app-chip">Hoy</span>
          </div>
          <div className="sig-app-kpis">
            {SIG_KPIS.map((k) => (
              <span className="sig-app-kpi" key={k.l}>
                <span className="sig-app-kpi-l">{k.l}</span>
                <span className="sig-app-kpi-v">{k.v}</span>
                <span className="sig-app-kpi-d">{k.d}</span>
              </span>
            ))}
          </div>
          <div className="sig-app-chart" aria-hidden>
            {[42, 66, 51, 84, 60, 76, 92].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="sig-app-rows">
            {SIG_ROWS.map((r) => (
              <span className="sig-app-row" key={r.name}>
                <span className="sig-app-av">{r.ini}</span>
                <span className="sig-app-name">{r.name}</span>
                <span className={`sig-app-tag${r.tag === "Pagado" ? " is-ok" : ""}`}>{r.tag}</span>
                <span className="sig-app-val">{r.val}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ——— Marca: tablero de identidad (paleta + tipografía + pieza) ——— */
const SIG_SWATCHES = [
  { hex: "#DB5227", name: "Terracota" },
  { hex: "#023661", name: "Navy" },
  { hex: "#f5efe3", name: "Paper" },
  { hex: "#0A0C12", name: "Tinta" },
];

function SignatureMarca() {
  return (
    <div className="sig-board" role="img" aria-label="Sistema de marca: logo, paleta, tipografía y una pieza de redes">
      <div className="sig-board-brand">
        <span className="sig-board-mark">Z</span>
        <span className="sig-board-word">
          ZAKUMI<b>.</b>
        </span>
        <span className="sig-board-tag">Estudio · Marca</span>
      </div>

      <div className="sig-board-swatches">
        {SIG_SWATCHES.map((s) => (
          <span className="sig-swatch" key={s.hex}>
            <span className="sig-swatch-chip" style={{ background: s.hex }} />
            <span className="sig-swatch-name">{s.name}</span>
            <span className="sig-swatch-hex">{s.hex}</span>
          </span>
        ))}
      </div>

      <div className="sig-board-type" aria-hidden>
        <span className="sig-board-aa">Aa</span>
        <span className="sig-board-type-meta">
          <span className="sig-board-type-name">Playfair Display</span>
          <span className="sig-board-type-sub">Inter · sistema tipográfico</span>
        </span>
      </div>

      <div className="sig-board-post" aria-hidden>
        <span className="sig-post-media" />
        <span className="sig-post-body">
          <span className="sig-post-h">Tu marca, viva.</span>
          <span className="sig-post-sub">Publicada hoy · en automático</span>
        </span>
      </div>
    </div>
  );
}
