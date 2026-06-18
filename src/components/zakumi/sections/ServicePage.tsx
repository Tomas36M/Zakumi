"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { waLink } from "../contact";
import type { Service } from "../services";

gsap.registerPlugin(ScrollTrigger);

export function ServicePage({ data }: { data: Service }) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // Reveal editorial: por cada sección .reveal, sus .reveal-item entran escalonados (stagger).
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((section) => {
        const items = section.querySelectorAll<HTMLElement>(".reveal-item");
        gsap.from(items.length ? items : [section], {
          opacity: 0, y: 30, duration: 0.7, ease: "power3.out", stagger: 0.08,
          scrollTrigger: { trigger: section, start: "top 82%", once: true },
        });
      });
    }, root);
    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  const isWa = data.ctaTipo === "whatsapp" && !!data.waMsg;

  return (
    <main className="service-view" ref={root}>
      {/* Intro asimétrica, mismo lenguaje del hero */}
      <section className="service-intro reveal">
        <div className="service-intro-text">
          <div className="hero-tag reveal-item"><span className="line" /><span className="dot" /><span>{data.tag}</span></div>
          <h1 className="reveal-item"><span>{data.titulo1}</span><br /><em style={{ fontStyle: "italic", color: "var(--orange)" }}>{data.tituloEm}</em></h1>
          <p className="service-lead reveal-item">{data.intro}</p>
          <div className="reveal-item">
            {isWa ? (
              <a className="cta" style={{ opacity: 1 }} href={waLink(data.waMsg!)} target="_blank" rel="noopener noreferrer">
                <span>Habla con nuestro agente</span><span className="arrow">→</span>
              </a>
            ) : (
              <Link className="cta" style={{ opacity: 1 }} href="/contacto"><span>Solicitar cotización</span><span className="arrow">→</span></Link>
            )}
          </div>
        </div>
        <figure className="service-intro-visual reveal-item">
          <Image src={data.heroImg} alt="" fill sizes="(max-width: 900px) 100vw, 46vw" style={{ objectFit: "cover" }} priority />
        </figure>
      </section>

      {/* Lo que incluye — filas editoriales con índice (counter) + hairline, NO tarjetas */}
      <section className="service-block service-incluye reveal">
        <header className="block-head reveal-item"><span className="section-num">Lo que incluye</span></header>
        <ul className="incluye-list">
          {data.incluye.map((c) => (
            <li className="incluye-row reveal-item" key={c.titulo}>
              <h3>{c.titulo}</h3>
              <p>{c.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Ejemplos — imagen con zoom en hover + motivo ↗ */}
      <section className="service-block service-ejemplos reveal">
        <header className="block-head reveal-item"><span className="section-num">Ejemplos</span></header>
        <div className="ejemplos-grid">
          {data.ejemplos.map((e) => (
            <article className="ejemplo-card reveal-item" key={e.titulo}>
              {e.img && (
                <div className="ejemplo-img">
                  <Image src={e.img} alt="" fill sizes="(max-width: 900px) 100vw, 32vw" style={{ objectFit: "cover" }} />
                </div>
              )}
              <h3>{e.titulo} <span className="ejemplo-arrow" aria-hidden>↗</span></h3>
              <p>{e.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Testimonios — citas editoriales en Playfair */}
      <section className="service-block service-testimonios reveal">
        <header className="block-head reveal-item"><span className="section-num">Lo que dicen</span></header>
        <div className="testimonios-grid">
          {data.testimonios.map((t) => (
            <blockquote className="testimonio reveal-item" key={t.autor}>
              <p>&ldquo;{t.quote}&rdquo;</p>
              <footer><span className="t-autor">{t.autor}</span> · {t.rol}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Planes — sin cifras; el del medio destacado en naranja (guiño al pilar Marca) */}
      <section className="service-block service-planes reveal">
        <header className="block-head reveal-item"><span className="section-num">Planes</span></header>
        <div className="planes-grid">
          {data.planes.map((p, i) => (
            <div className={`plan-card reveal-item${i === 1 ? " plan-featured" : ""}`} key={p.nombre}>
              <h3>{p.nombre}</h3>
              <p className="plan-tagline">{p.tagline}</p>
              <ul>{p.incluye.map((it) => <li key={it}>{it}</li>)}</ul>
              <Link className={`cta${i === 1 ? "" : " cta-ghost"}`} href="/contacto" style={{ opacity: 1 }}><span>Solicitar cotización</span><span className="arrow">→</span></Link>
            </div>
          ))}
        </div>
        <p className="planes-nota reveal-item">Cotizamos por proyecto o por mes según tu alcance. Trabajamos con presupuestos pensados para el mercado colombiano — escríbenos y armamos una propuesta a tu medida.</p>
      </section>

      {/* Cierre → /contacto */}
      <section className="service-cierre reveal">
        <h2 className="reveal-item">¿Lo armamos para tu negocio?</h2>
        <div className="reveal-item"><Link className="cta" href="/contacto" style={{ opacity: 1 }}><span>Hablemos</span><span className="arrow">→</span></Link></div>
      </section>
    </main>
  );
}
