import Image from "next/image";
import { HERO_IMAGES } from "../content";

interface HeroProps {
  renderHeadline: () => React.ReactNode;
  headlineKey: string;
}

export function Hero({ renderHeadline, headlineKey }: HeroProps) {
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
        <span>Estudio · Marca &amp; Software · 2026</span>
      </div>

      <h1 key={headlineKey}>{renderHeadline()}</h1>

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
            <span className="strip-card-sub">Dashboard · MVP · App</span>
          </div>
          <div className="strip-card strip-card-web">
            <span className="strip-url">tumarca.com</span>
            <span className="strip-cta">Cotizar →</span>
            <span className="strip-card-sub">Landing · E-commerce</span>
          </div>
        </div>
      </div>

      <div className="hero-meta">
        <div className="meta-block">
          <div className="label">Disciplinas</div>
          <div className="val">Marca · Producto · Código</div>
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

      <a href="#contacto" className="cta">
        <span>Hablemos de tu proyecto</span>
        <span className="arrow">→</span>
      </a>

      <div className="hero-deco">EST. 2026 — ZKM ·</div>

      <div className="scroll-indicator">
        <span>scroll</span>
        <span className="bar" />
      </div>
    </section>
  );
}
