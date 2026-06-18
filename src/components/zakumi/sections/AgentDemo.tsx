import { CHAT_GUION } from "../content";
import { WHATSAPP_URL } from "../contact";

const PUNTOS = [
  "Responde al instante, 24/7",
  "Entiende la intención y califica",
  "Agenda y cierra sin que tú estés",
];

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
            atender tu WhatsApp. Mira cómo resuelve dudas y cierra una venta —
            solo.
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
                <span className="agent-wa-av">Z</span>
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
    </section>
  );
}
