"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HERO_SLIDES } from "../content";
import { waLink, TELEGRAM_ENABLED, TELEGRAM_URL } from "../contact";

const AUTO_MS = 6500;

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
      className="hero"
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
                priority={i === 0}
                sizes="(max-width: 1100px) 100vw, 42vw"
                style={{ objectFit: "cover" }}
              />
            </div>
          ))}
        </div>
        <span className="hero-visual-frame" />

        {slide.bubble && (
          <div className="hero-chat-bubble" aria-hidden>
            <span className="hero-chat-typing">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span className="hero-chat-text">¿Hacen tiendas con pago en línea?</span>
          </div>
        )}
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

      <div className="hero-dots" role="tablist" aria-label="Servicios">
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
            <a
              href={waLink(slide.waMsg)}
              className="cta"
              target="_blank"
              rel="noopener noreferrer"
              style={{ opacity: 1 }}
              aria-label={`${slide.cta} por WhatsApp`}
            >
              <span>{slide.cta}</span>
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
