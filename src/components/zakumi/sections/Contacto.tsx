import {
  EMAIL,
  WHATSAPP_URL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from "../contact";

export function Contacto() {
  return (
    <>
      <section className="outro" id="contacto">
        <h2>
          ¿Tienes una visión?
          <br />
          <em>Empecemos hoy.</em>
        </h2>
        <div className="right">
          <p>
            Estamos recibiendo nuevos proyectos. Cuéntanos qué quieres construir
            y empecemos la conversación — sin formularios eternos. La primera
            llamada es gratis y sin compromiso.
          </p>
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
              <span>Escríbenos por WhatsApp</span>
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
        <div>v.02 — gsap</div>
      </footer>
    </>
  );
}
