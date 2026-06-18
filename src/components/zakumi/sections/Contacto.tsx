import {
  EMAIL,
  WHATSAPP_URL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  TELEGRAM_ENABLED,
  TELEGRAM_URL,
} from "../contact";
import { CONTACTO } from "../content";

export function Contacto() {
  return (
    <>
      <section className="outro" id="contacto">
        <h2>
          {CONTACTO.titulo1}
          <br />
          <em>{CONTACTO.tituloEm}</em>
        </h2>
        <div className="right">
          <p>{CONTACTO.sub}</p>
          <div className="contact-actions">
            <a
              href={WHATSAPP_URL}
              className="cta"
              style={{ opacity: 1 }}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="wa-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
                </svg>
              </span>
              <span>Habla con nuestro agente</span>
              <span className="arrow">→</span>
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="cta cta-ghost"
              style={{ opacity: 1 }}
            >
              <span>{EMAIL}</span>
              <span className="arrow">→</span>
            </a>
            {TELEGRAM_ENABLED && (
              <a
                href={TELEGRAM_URL}
                className="cta cta-ghost"
                target="_blank"
                rel="noopener noreferrer"
                style={{ opacity: 1 }}
              >
                <span>Telegram</span>
                <span className="arrow">→</span>
              </a>
            )}
          </div>
        </div>
      </section>

      <footer>
        <div>© 2026 ZAKUMI Studio · Colombia</div>
        <a
          className="footer-social"
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Síguenos en Instagram — @zakumiestudio"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
          </svg>
          <span className="footer-handle">@{INSTAGRAM_HANDLE}</span>
        </a>
        {TELEGRAM_ENABLED && (
          <a
            className="footer-social"
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram de ZAKUMI"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            <span className="footer-handle">Telegram</span>
          </a>
        )}
        <div>IA · Software · Marca</div>
      </footer>
    </>
  );
}
