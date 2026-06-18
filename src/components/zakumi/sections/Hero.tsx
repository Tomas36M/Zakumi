import Image from "next/image";
import { HERO, HERO_IMAGES } from "../content";
import {
  WHATSAPP_URL,
  TELEGRAM_ENABLED,
  TELEGRAM_URL,
} from "../contact";

export function Hero() {
  return (
    <section className="hero" id="hero">
      <figure className="hero-visual" aria-hidden>
        <div className="hero-carousel">
          {HERO_IMAGES.map((src, i) => (
            <div
              className={`hero-slide${i === 0 ? " is-active" : ""}`}
              data-slide={i}
              key={src}
            >
              <Image
                src={src}
                alt=""
                fill
                priority={i === 0}
                sizes="(max-width: 1100px) 100vw, 40vw"
                style={{ objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
        <span className="hero-visual-frame" />

        {/* Burbuja de chat animada */}
        <div className="hero-chat-bubble" aria-hidden>
          <span className="hero-chat-typing"><i></i><i></i><i></i></span>
          <span className="hero-chat-text">¿Hacen tiendas con pago en línea?</span>
        </div>
      </figure>

      {HERO_IMAGES.length > 1 && (
        <div className="hero-dots" role="tablist" aria-label="Galería del estudio">
          {HERO_IMAGES.map((src, i) => (
            <button
              type="button"
              key={`dot-${src}`}
              className={`hero-dot${i === 0 ? " is-active" : ""}`}
              data-dot={i}
              aria-label={`Ver imagen ${i + 1}`}
            />
          ))}
        </div>
      )}

      <div className="hero-tag">
        <span className="line" />
        <span className="dot" />
        <span>{HERO.tag}</span>
      </div>

      <h1>
        <span
          className="line-mask"
          style={{ display: "block" }}
        >
          <span className="word">{HERO.titulo1}</span>
        </span>
        <span
          className="line-mask"
          style={{ display: "block" }}
        >
          <em className="word" style={{ fontStyle: "italic", color: "var(--orange)" }}>
            {HERO.tituloEm}
          </em>
        </span>
      </h1>

      <div className="hero-strip" aria-hidden>
        <div className="hero-strip-track">
          <div className="strip-card strip-card-brand">
            <span className="strip-card-logo">
              ZAKUMI<span className="dot">.</span>
            </span>
            <span className="strip-card-sub">Manual · Logo · Papelería</span>
          </div>
          <div className="strip-card strip-card-ui">
            <div className="strip-bars">
              <span style={{ height: "55%" }} />
              <span style={{ height: "80%" }} />
              <span style={{ height: "45%" }} />
              <span style={{ height: "100%" }} />
            </div>
            <span className="strip-card-sub">Agente · CRM · Dashboard</span>
          </div>
          <div className="strip-card strip-card-web">
            <span className="strip-url">tumarca.com</span>
            <span className="strip-cta">Cotizar →</span>
            <span className="strip-card-sub">WhatsApp · Bot · Web</span>
          </div>
        </div>
      </div>

      <div className="hero-meta">
        <div className="meta-block">
          <div className="label">Disciplinas</div>
          <div className="val">IA · Software · Marca</div>
        </div>
        <div className="meta-block">
          <div className="label">Sede</div>
          <div className="val">Colombia · Toda LatAm en remoto</div>
        </div>
        <div className="meta-block">
          <div className="label">Estatus</div>
          <div className="val">Agenda abierta 2026 · Cupos limitados</div>
        </div>
      </div>

      <p className="hero-sub">{HERO.sub}</p>

      {/* CTA primario: WhatsApp */}
      <a
        href={WHATSAPP_URL}
        className="cta"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Habla con nuestro agente de IA por WhatsApp"
      >
        <span>{HERO.ctaPrimario}</span>
        <span className="arrow">→</span>
      </a>

      {/* CTA secundario: Telegram (solo cuando esté habilitado) */}
      {TELEGRAM_ENABLED && (
        <a
          href={TELEGRAM_URL}
          className="cta cta-ghost"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escríbenos por Telegram"
        >
          <span>{HERO.ctaSecundario}</span>
          <span className="arrow">→</span>
        </a>
      )}

      <div className="hero-deco">EST. 2026 — ZKM ·</div>

      <div className="scroll-indicator">
        <span>scroll</span>
        <span className="bar" />
      </div>
    </section>
  );
}
