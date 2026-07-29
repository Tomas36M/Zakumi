"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HERO_SLIDES } from "../content";
import Link from "next/link";
import { TELEGRAM_ENABLED, TELEGRAM_URL, waLink } from "../contact";

const AUTO_MS = 9000;

export function Hero() {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) setActive((a) => (a + 1) % HERO_SLIDES.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, []);

  const slide = HERO_SLIDES[active];
  const go = (i: number) =>
    setActive((i + HERO_SLIDES.length) % HERO_SLIDES.length);

  return (
    <section
      className={`hero hero-active-${slide.id}`}
      id="hero"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <figure className="hero-visual" aria-hidden>
        <div className="hero-carousel">
          {HERO_SLIDES.map((s, i) => (
            <div
              className={`hero-slide${i === active ? " is-active" : ""}`}
              key={s.id}
            >
              <Image
                src={s.img}
                alt=""
                fill
                /* preload emite el <link rel="preload"> en el <head> durante el
                   SSR. Sin él el hero es el elemento LCP y la descarga no
                   arrancaba hasta hidratar: 2.5s de retraso medidos. */
                preload={i === 0}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                quality={90}
                /* ≤720px la foto es una figura en el flujo con 5vw de gutter a
                   cada lado; por encima va a sangre completa. */
                sizes="(max-width: 720px) 90vw, 100vw"
                style={{ objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
        <span className="hero-visual-frame" />
      </figure>

      <button
        type="button"
        className="hero-arrow hero-arrow-prev"
        aria-label="Servicio anterior"
        onClick={() => go(active - 1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="hero-arrow hero-arrow-next"
        aria-label="Siguiente servicio"
        onClick={() => go(active + 1)}
      >
        ›
      </button>

      {/* No es un tablist: no hay tabpanels. Un grupo etiquetado es lo honesto
          y además no falla aria-required-children. */}
      <div className="hero-dots" role="group" aria-label="Elegir servicio">
        {HERO_SLIDES.map((s, i) => (
          <button
            type="button"
            key={s.id}
            className={`hero-dot${i === active ? " is-active" : ""}`}
            aria-label={s.cta}
            aria-current={i === active ? "true" : undefined}
            onClick={() => go(i)}
          />
        ))}
      </div>

      <div className="hero-copy-stable">
        <div className="hero-copy" key={slide.id}>
          <div className="hero-tag">
            <span className="line" />
            <span className="dot" />
            <span>{slide.tag}</span>
          </div>

          <h1>
            <span className="line-mask" style={{ display: "block" }}>
              <span className="word">{slide.titulo1}</span>
            </span>
            <span className="line-mask" style={{ display: "block" }}>
              <em
                className="word"
                style={{ fontStyle: "italic", color: "var(--orange)" }}
              >
                {slide.tituloEm}
              </em>
            </span>
          </h1>

          <p className="hero-sub">{slide.sub}</p>

          <div className="hero-ctas">
            {slide.ctaWa ? (
              <a
                className="cta"
                href={waLink(slide.waMsg)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ opacity: 1 }}
                aria-label={`${slide.cta} — ${slide.tag}`}
              >
                <span>{slide.cta}</span>
                <span className="arrow">→</span>
              </a>
            ) : (
              <Link
                className="cta"
                href={slide.href}
                style={{ opacity: 1 }}
                aria-label={`${slide.cta} — ${slide.tag}`}
              >
                <span>{slide.cta}</span>
                <span className="arrow">→</span>
              </Link>
            )}
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
      </div>

      <div className="hero-meta">
        <div className="hero-meta-inner" key={slide.id}>
          {slide.meta.map((m) => (
            <div className="meta-block" key={m.label}>
              <div className="label">{m.label}</div>
              <div className="val">{m.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-deco">EST. 2026 — ZKM ·</div>

      <div className="scroll-indicator">
        <span>scroll</span>
        <span className="bar" />
      </div>
    </section>
  );
}
