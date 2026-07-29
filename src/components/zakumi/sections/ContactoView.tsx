"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  magneticCtas,
  revealBlocks,
  revealTiles,
} from "@/lib/motion";
import {
  EMAIL,
  WHATSAPP_URL,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
} from "../contact";
import { CONTACTO_PASOS, CONTACTO_PORQUE } from "../content";
import { ContactForm } from "./ContactForm";
import { ContactoSection } from "./ContactoSection";

const WaIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
const IgIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const two = (n: number) => String(n + 1).padStart(2, "0");

export function ContactoView() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    let releaseCtas: (() => void) | undefined;

    const ctx = gsap.context(() => {
      revealBlocks(el);
      revealTiles(".porque-bento", ".porque-bento > *", 3);
      releaseCtas = magneticCtas(el);
    }, root);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      releaseCtas?.();
      ctx.revert();
    };
  }, []);

  return (
    <main className="contacto-view" ref={root}>
      {/* ——— Hero de contacto ——— */}
      <section className="contacto-hero reveal">
        <div className="contacto-hero-text">
          <div className="hero-tag reveal-item">
            <span className="line" />
            <span className="dot" />
            <span>Contacto · Colombia</span>
          </div>
          <h1 className="svc-wipe">
            Hablemos de tu <em style={{ fontStyle: "italic", color: "var(--orange)" }}>proyecto.</em>
          </h1>
          <p className="contacto-lead reveal-item">
            Cuéntanos qué necesitas — un agente de IA, una plataforma a medida o tu marca en redes — y te
            devolvemos una propuesta clara, sin compromiso.
          </p>
          {/* Por canal, no como promesa global: por WhatsApp contesta el agente
              al instante; el formulario y el correo los ve una persona. */}
          <p className="contacto-promise reveal-item">
            <span className="contacto-promise-dot" aria-hidden />
            Por WhatsApp respondemos en minutos. Lun–Vie, 8:00–18:00 (Colombia).
          </p>
          <div className="svc-cta-row reveal-item">
            <a className="cta" style={{ opacity: 1 }} href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <span className="wa-icon" aria-hidden>
                <WaIcon />
              </span>
              <span>Escríbenos por WhatsApp</span>
              <span className="arrow">→</span>
            </a>
            <a className="cta cta-ghost" style={{ opacity: 1 }} href={`mailto:${EMAIL}`}>
              <span>{EMAIL}</span>
              <span className="arrow">→</span>
            </a>
          </div>
        </div>
        <figure className="contacto-hero-visual reveal-item">
          <Image src="/work/zk-hero-foto.webp" alt="" fill quality={90} sizes="(max-width: 900px) 100vw, 46vw" style={{ objectFit: "cover" }} loading="eager" fetchPriority="high" />
          <figcaption className="svc-visual-badge">Contacto</figcaption>
        </figure>
      </section>

      {/* ——— Vías de contacto ——— */}
      <section className="service-block contacto-vias reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">01 / Por dónde nos escribes</span>
          <h2 className="section-title reveal-item">
            Elige tu <em>canal</em>.
          </h2>
        </header>
        <div className="vias-grid">
          <a className="via-card via-card-wa reveal-item" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <span className="via-icon" aria-hidden>
              <WaIcon />
            </span>
            <span className="via-label">WhatsApp</span>
            <span className="via-desc">La vía más rápida. Te atiende nuestro propio agente de IA.</span>
            <span className="via-action">Abrir chat <span className="arrow">→</span></span>
          </a>
          <a className="via-card reveal-item" href={`mailto:${EMAIL}`}>
            <span className="via-icon" aria-hidden>
              <MailIcon />
            </span>
            <span className="via-label">Correo</span>
            <span className="via-desc">{EMAIL}</span>
            <span className="via-action">Enviar correo <span className="arrow">→</span></span>
          </a>
          <a className="via-card reveal-item" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            <span className="via-icon" aria-hidden>
              <IgIcon />
            </span>
            <span className="via-label">Instagram</span>
            <span className="via-desc">@{INSTAGRAM_HANDLE} — mira lo que hacemos.</span>
            <span className="via-action">Ver perfil <span className="arrow">→</span></span>
          </a>
        </div>
      </section>

      {/* ——— Qué pasa cuando escribes ——— */}
      <section className="service-block contacto-pasos svc-tight reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">02 / Qué pasa cuando escribes</span>
          <h2 className="section-title reveal-item">
            Tres pasos, sin <em>vueltas</em>.
          </h2>
        </header>
        <ol className="proceso-list">
          {CONTACTO_PASOS.map((p, i) => (
            <li className="proceso-step reveal-item" key={p.t}>
              <span className="proceso-n">{two(i)}</span>
              <h3>{p.t}</h3>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ——— Por qué Zakumi: el bloque de confianza que pedía el spec ——— */}
      <section className="service-block service-porque svc-wide reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">03 / Por qué Zakumi</span>
          <h2 className="section-title reveal-item">
            Qué puedes <em>esperar</em>.
          </h2>
        </header>
        <div className="porque-bento">
          <figure className="porque-media">
            <Image src="/work/zk-ink-foto.webp" alt="" fill quality={85} sizes="(max-width: 900px) 100vw, 34vw" style={{ objectFit: "cover" }} />
            <figcaption className="svc-visual-badge">Zakumi</figcaption>
          </figure>
          {CONTACTO_PORQUE.map((g, i) => (
            <div className="porque-card" key={g.titulo}>
              <span className="porque-n" aria-hidden>
                {two(i)}
              </span>
              <h3>{g.titulo}</h3>
              <p>{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ——— Formulario (04) ——— */}
      <ContactForm />

      {/* Cierre con los cuatro canales. Estaba huérfano: al sacarlo de esta ruta,
          los CTA de WhatsApp/correo/Instagram solo vivían en la home. */}
      <ContactoSection />
    </main>
  );
}
