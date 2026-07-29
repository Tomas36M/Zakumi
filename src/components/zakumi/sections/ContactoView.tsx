"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  EMAIL,
  WHATSAPP_URL,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
} from "../contact";
import { ContactForm } from "./ContactForm";

gsap.registerPlugin(ScrollTrigger);

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

const PASOS = [
  { t: "Nos cuentas", d: "Nos escribes por WhatsApp o el formulario con lo que tienes en mente. No hace falta que lo tengas todo claro." },
  { t: "Te proponemos", d: "Agendamos una llamada corta, entendemos tu caso y te armamos una propuesta con alcance y precio claros." },
  { t: "Arrancamos", d: "Aprobada la propuesta, empezamos a construir y te mostramos avances rápido, sin desaparecer." },
];

export function ContactoView() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((section) => {
          const wipe = section.querySelectorAll<HTMLElement>(".svc-wipe");
          if (wipe.length) {
            gsap.fromTo(
              wipe,
              { clipPath: "inset(0 100% 0 0)", y: 24, opacity: 0 },
              {
                clipPath: "inset(0 0% 0 0)",
                y: 0,
                opacity: 1,
                duration: 1.1,
                ease: "expo.out",
                stagger: 0.12,
                scrollTrigger: { trigger: section, start: "top 85%", once: true },
              },
            );
          }
          const items = section.querySelectorAll<HTMLElement>(".reveal-item");
          if (items.length) {
            gsap.from(items, {
              opacity: 0,
              y: 30,
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.08,
              scrollTrigger: { trigger: section, start: "top 82%", once: true },
            });
          }
        });
        gsap.utils.toArray<HTMLElement>(".cta").forEach((el) => {
          const onMove = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            gsap.to(el, {
              x: (e.clientX - (r.left + r.width / 2)) * 0.25,
              y: (e.clientY - (r.top + r.height / 2)) * 0.35,
              duration: 0.5,
              ease: "power3.out",
            });
          };
          const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
          el.addEventListener("mousemove", onMove);
          el.addEventListener("mouseleave", onLeave);
        });
      }
    }, root);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
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
          <p className="contacto-promise reveal-item">
            <span className="contacto-promise-dot" aria-hidden />
            Respondemos en minutos, en horario laboral (Colombia).
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
          <Image src="/work/zk-hero-foto.webp" alt="" fill sizes="(max-width: 900px) 100vw, 46vw" style={{ objectFit: "cover" }} priority />
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
      <section className="service-block contacto-pasos reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">02 / Qué pasa cuando escribes</span>
          <h2 className="section-title reveal-item">
            Qué pasa cuando <em>escribes</em>.
          </h2>
        </header>
        <ol className="proceso-list">
          {PASOS.map((p, i) => (
            <li className="proceso-step reveal-item" key={p.t}>
              <span className="proceso-n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{p.t}</h3>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <ContactForm />
    </main>
  );
}
