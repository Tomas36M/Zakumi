import { CHAT_GUION } from "../content";
import { WHATSAPP_URL } from "../contact";

export function AgentDemo() {
  return (
    <section className="agent-demo" id="demo-agente">
      <div className="section-num">— en vivo —</div>
      <h2 className="section-title">
        Míralo vender. <em>Luego habla con él.</em>
      </h2>
      <div className="agent-phone">
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
      </div>
      <a
        className="cta"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Prueba el agente de IA en WhatsApp"
      >
        <span>Pruébalo tú mismo</span>
        <span className="arrow">→</span>
      </a>
    </section>
  );
}
