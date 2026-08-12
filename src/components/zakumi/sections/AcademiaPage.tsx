"use client";

import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  magneticCtas,
  revealBlocks,
  statCounters,
} from "@/lib/motion";
import { waLink } from "../contact";
import { CURSO, HOTMART_CHECKOUT } from "../curso";

/** CTA de compra: va derecho al checkout de Hotmart. */
function ComprarCta({ label, ghost }: { label?: string; ghost?: boolean }) {
  return (
    <a
      className={`cta${ghost ? " cta-ghost" : ""}`}
      style={{ opacity: 1 }}
      href={HOTMART_CHECKOUT}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>{label ?? "Inscribirme"}</span>
      <span className="arrow">→</span>
    </a>
  );
}

/** CTA secundario: habla con Zak, que además es la prueba de que hacemos agentes. */
function ZakCta({ label }: { label?: string }) {
  return (
    <a
      className="cta cta-ghost"
      style={{ opacity: 1 }}
      href={waLink(CURSO.waMsg)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>{label ?? "Pregúntale a Zak"}</span>
      <span className="arrow">→</span>
    </a>
  );
}

const isNum = (s: string) => /^\d+$/.test(s);

/**
 * Página de ventas del curso. Reutiliza el sistema editorial del sitio
 * (`zakumi-design.css` + helpers de `@/lib/motion`) — nada de tarjetas
 * genéricas. El orden de las secciones está pensado para convertir: la malla
 * completa va arriba del precio, porque es lo que resuelve la duda real.
 */
export function AcademiaPage() {
  const rootRef = useRef<HTMLElement>(null);
  const totalClases = CURSO.malla.modulos.reduce((n, m) => n + m.clases.length, 0);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let releaseCtas: (() => void) | undefined;

    const ctx = gsap.context(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        revealBlocks(el);
        releaseCtas = magneticCtas(el);
      }
      statCounters(el);
    }, el);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      releaseCtas?.();
      ctx.revert();
    };
  }, []);

  return (
    <main className="service-view academia-view" ref={rootRef}>
      {/* ——— Hero ——— */}
      <section className="service-intro reveal">
        <div className="service-intro-text">
          <div className="hero-tag reveal-item">
            <span className="line" />
            <span className="dot" />
            <span>{CURSO.tag}</span>
          </div>
          <h1 className="svc-wipe">
            <span>{CURSO.titulo1}</span>
            <br />
            <em style={{ fontStyle: "italic", color: "var(--orange)" }}>{CURSO.tituloEm}</em>
          </h1>
          <p className="service-lead reveal-item">{CURSO.lead}</p>
          <div className="svc-cta-row reveal-item">
            <ComprarCta />
            <a className="cta cta-ghost" href="#malla" style={{ opacity: 1 }}>
              <span>Ver el temario</span>
              <span className="arrow">→</span>
            </a>
          </div>
          <p className="acad-precio-nota reveal-item">
            {CURSO.precio.nota} · Garantía de 15 días.
          </p>
        </div>
        <figure className="service-intro-visual">
          <Image
            src={CURSO.heroImg}
            alt=""
            fill
            quality={90}
            sizes="(max-width: 900px) 100vw, 46vw"
            style={{ objectFit: "cover" }}
            loading="eager"
            fetchPriority="high"
          />
          <figcaption className="svc-visual-badge">{CURSO.academia}</figcaption>
        </figure>
      </section>

      {/* ——— Datos clave del hero ——— */}
      <section className="svc-meta-band reveal">
        <dl className="svc-meta">
          {CURSO.heroMeta.map((m) => (
            <div className="svc-meta-block reveal-item" key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.val}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ——— Por qué ahora ——— */}
      <section className="service-block acad-porque reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">01 / El porqué</span>
          <h2 className="section-title reveal-item">
            {CURSO.porQueAhora.titulo} <em>{CURSO.porQueAhora.em}</em>
          </h2>
        </header>
        <ol className="acad-puntos">
          {CURSO.porQueAhora.puntos.map((p) => (
            <li className="acad-punto reveal-item" key={p.titulo}>
              <h3>{p.titulo}</h3>
              <p>{p.desc}</p>
            </li>
          ))}
        </ol>
        <blockquote className="acad-remate reveal-item">{CURSO.porQueAhora.remate}</blockquote>
      </section>

      {/* ——— Para quién es ——— */}
      <section className="service-block acad-paraquien reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">02 / Para ti</span>
          <h2 className="section-title reveal-item">
            {CURSO.paraQuien.titulo} <em>{CURSO.paraQuien.em}</em>
          </h2>
        </header>
        <div className="acad-dos-col">
          <div className="reveal-item">
            <h3 className="acad-col-head">Este curso es para ti si…</h3>
            <ul className="acad-lista">
              {CURSO.paraQuien.señales.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="acad-nota">{CURSO.paraQuien.nota}</p>
          </div>
          <div className="reveal-item">
            <h3 className="acad-col-head">Lo que vas a poder hacer</h3>
            <ul className="acad-lista acad-lista-check">
              {CURSO.paraQuien.logros.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
        <figure className="acad-banda reveal-item">
          <Image
            src={CURSO.paraQuien.img}
            alt=""
            width={1500}
            height={1000}
            sizes="(max-width: 900px) 100vw, 92vw"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </figure>
      </section>

      {/* ——— El método CLARO: lo que nos diferencia ——— */}
      <section className="service-block acad-metodo reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">03 / El método</span>
          <h2 className="section-title reveal-item">
            {CURSO.metodo.titulo} <em>{CURSO.metodo.em}</em>
          </h2>
          <p className="block-lead reveal-item">{CURSO.metodo.lead}</p>
        </header>
        <ol className="acad-letras">
          {CURSO.metodo.letras.map((l) => (
            <li className="acad-letra reveal-item" key={l.letra}>
              <span className="acad-letra-inicial" aria-hidden>
                {l.letra}
              </span>
              <div>
                <h3>{l.nombre}</h3>
                <p>{l.pregunta}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="acad-remate-sm reveal-item">{CURSO.metodo.remate}</p>
      </section>

      {/* ——— Datos ——— */}
      <section className="stats-section service-stats reveal">
        <div className="stats-inner">
          <div className="section-num svc-wipe">04 / En números</div>
          <div className="stats-intro reveal-item">
            <h2 className="section-title">
              Una semana. <em>Todo lo que te llevas.</em>
            </h2>
            <p className="lead">
              No es un curso de mirar videos: son {totalClases} clases con ejercicios, materiales y un
              proyecto que termina publicado en internet.
            </p>
          </div>
          <div className="stats-grid">
            {CURSO.stats.map((s) => (
              <div className="stat" key={s.label}>
                <span className="stat-bar" aria-hidden />
                {isNum(s.num) ? (
                  <div className="num" data-num={s.num}>
                    <span data-target={s.num}>0</span>
                    {"acc" in s && s.acc && <span className="acc">{s.acc}</span>}
                  </div>
                ) : (
                  <div className="num">
                    {s.num}
                    {"acc" in s && s.acc && <span className="acc">{s.acc}</span>}
                  </div>
                )}
                <div className="stat-label">{s.label}</div>
                <div className="stat-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Las herramientas ——— */}
      <section className="service-block acad-herramientas reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">05 / El arsenal</span>
          <h2 className="section-title reveal-item">
            {CURSO.herramientas.titulo} <em>{CURSO.herramientas.em}</em>
          </h2>
          <p className="block-lead reveal-item">{CURSO.herramientas.lead}</p>
        </header>
        <div className="acad-herr-grid">
          {CURSO.herramientas.items.map((h) => (
            <article className="acad-herr-card reveal-item" key={h.nombre}>
              <h3>
                {h.nombre}
                {h.marca && <span className="acad-herr-marca"> ({h.marca})</span>}
              </h3>
              <p className="acad-herr-como">{h.comoPensarla}</p>
              <p className="acad-herr-para">{h.paraQue}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ——— La malla completa: la sección que más convierte ——— */}
      <section className="service-block acad-malla reveal" id="malla">
        <header className="block-head">
          <span className="section-num svc-wipe">06 / El plan</span>
          <h2 className="section-title reveal-item">
            {CURSO.malla.titulo} <em>{CURSO.malla.em}</em>
          </h2>
          <p className="block-lead reveal-item">{CURSO.malla.lead}</p>
        </header>
        <div className="acad-modulos">
          {CURSO.malla.modulos.map((m) => {
            const mins = m.clases.reduce((n, c) => n + c.min, 0);
            return (
              <details className="acad-modulo reveal-item" key={m.num}>
                <summary>
                  <span className="acad-mod-num" aria-hidden>
                    {m.num}
                  </span>
                  <span className="acad-mod-head">
                    {m.dia && <span className="acad-mod-dia">{m.dia}</span>}
                    <span className="acad-mod-titulo">
                      {m.titulo} {m.tituloEm && <em>{m.tituloEm}</em>}
                    </span>
                    <span className="acad-mod-promesa">{m.promesa}</span>
                  </span>
                  <span className="acad-mod-meta">
                    {m.abierto && <span className="acad-mod-abierto">Acceso libre</span>}
                    <span className="acad-mod-cifras">
                      {m.clases.length} clases · {mins} min
                    </span>
                    <span className="acad-mod-icon" aria-hidden>
                      +
                    </span>
                  </span>
                </summary>
                <ol className="acad-clases">
                  {m.clases.map((c) => (
                    <li key={c.n}>
                      <span className="acad-clase-n">{c.n}</span>
                      <span className="acad-clase-titulo">{c.titulo}</span>
                      <span className="acad-clase-min">{c.min} min</span>
                    </li>
                  ))}
                </ol>
              </details>
            );
          })}
        </div>
      </section>

      {/* ——— Cómo aprenderás ——— */}
      <section className="service-block acad-como svc-tight reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">07 / Cómo aprenderás</span>
          <h2 className="section-title reveal-item">
            {CURSO.comoAprenderas.titulo} <em>{CURSO.comoAprenderas.em}</em>
          </h2>
        </header>
        <ol className="proceso-list">
          {CURSO.comoAprenderas.pasos.map((p) => (
            <li className="proceso-step reveal-item" key={p.titulo}>
              <h3>{p.titulo}</h3>
              <p>{p.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ——— Instructor ——— */}
      <section className="service-block acad-instructor reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">08 / Tu instructor</span>
          <h2 className="section-title reveal-item">
            {CURSO.instructor.nombre} — <em>{CURSO.instructor.rol}</em>
          </h2>
          <p className="acad-kicker reveal-item">{CURSO.instructor.kicker}</p>
        </header>
        <div className="acad-instructor-grid">
          <figure className="acad-retrato reveal-item">
            <Image
              src={CURSO.instructor.img}
              alt={`${CURSO.instructor.nombre}, fundador de Zakumi`}
              width={1100}
              height={1466}
              sizes="(max-width: 900px) 100vw, 32vw"
              style={{ width: "100%", height: "auto", objectFit: "cover" }}
            />
          </figure>
          <div className="acad-instructor-texto">
            <blockquote className="acad-cita svc-wipe">“{CURSO.instructor.cita}”</blockquote>
            {CURSO.instructor.bio.map((p) => (
              <p className="reveal-item" key={p.slice(0, 24)}>
                {p}
              </p>
            ))}
            <ul className="acad-pilares reveal-item">
              {CURSO.instructor.pilares.map((p) => (
                <li key={p.titulo}>
                  <strong>{p.titulo}</strong>
                  <span>{p.desc}</span>
                </li>
              ))}
            </ul>
            <p className="acad-prueba reveal-item">{CURSO.instructor.prueba}</p>
            <div className="reveal-item">
              <ZakCta label="Háblale a Zak y compruébalo" />
            </div>
          </div>
        </div>
      </section>

      {/* ——— Qué incluye + precio ——— */}
      <section className="service-block acad-oferta reveal" id="inscribirme">
        <header className="block-head">
          <span className="section-num svc-wipe">09 / La inscripción</span>
          <h2 className="section-title reveal-item">
            {CURSO.incluye.titulo} <em>{CURSO.incluye.em}</em>
          </h2>
        </header>
        <div className="acad-oferta-grid">
          <ul className="acad-incluye">
            {CURSO.incluye.items.map((i) => (
              <li className={`reveal-item${i.destacado ? " is-destacado" : ""}`} key={i.titulo}>
                <h3>{i.titulo}</h3>
                <p>{i.desc}</p>
              </li>
            ))}
          </ul>
          <aside className="acad-precio reveal-item">
            <span className="acad-precio-label">Precio de lanzamiento</span>
            <div className="acad-precio-cifra">
              <span className="acad-precio-moneda">$</span>
              <span className="acad-precio-num">{CURSO.precio.lanzamiento}</span>
              <span className="acad-precio-cop">{CURSO.precio.moneda}</span>
            </div>
            <p className="acad-precio-antes">
              Después de esta cohorte: <s>${CURSO.precio.normal}</s>
            </p>
            <ComprarCta label="Inscribirme ahora" />
            <ZakCta label="Tengo una duda" />
            <ul className="acad-precio-tranquilidad">
              <li>Garantía de 15 días, sin preguntas</li>
              <li>Pago único · acceso de por vida</li>
              <li>Certificado incluido</li>
            </ul>
          </aside>
        </div>
      </section>

      {/* ——— Garantía ——— */}
      <section className="service-block acad-garantia svc-tight reveal">
        <div className="acad-garantia-inner">
          <h2 className="svc-wipe">
            {CURSO.garantia.titulo} <em>{CURSO.garantia.em}</em>
          </h2>
          <p className="reveal-item">{CURSO.garantia.desc}</p>
        </div>
      </section>

      {/* ——— Lo que NO prometemos: honestidad como argumento de venta ——— */}
      <section className="service-block acad-nopromete svc-tight reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">10 / Sin humo</span>
          <h2 className="section-title reveal-item">
            {CURSO.noPrometemos.titulo} <em>{CURSO.noPrometemos.em}</em>
          </h2>
          <p className="block-lead reveal-item">{CURSO.noPrometemos.lead}</p>
        </header>
        <ul className="acad-nolista">
          {CURSO.noPrometemos.items.map((i) => (
            <li className="reveal-item" key={i}>
              {i}
            </li>
          ))}
        </ul>
      </section>

      {/* ——— FAQ ——— */}
      <section className="service-block service-faq svc-tight reveal">
        <div className="faq-grid">
          <header className="block-head">
            <span className="section-num svc-wipe">11 / Preguntas frecuentes</span>
            <h2 className="section-title reveal-item">
              Lo que la gente <em>siempre pregunta.</em>
            </h2>
            <p className="block-lead reveal-item">
              ¿Otra duda? Háblale a Zak por WhatsApp y te responde al momento.
            </p>
            <div className="reveal-item">
              <ZakCta />
            </div>
          </header>
          <div className="faq-list">
            {CURSO.faq.map((f) => (
              <details className="faq-item reveal-item" key={f.q}>
                <summary>
                  <span className="faq-q">{f.q}</span>
                  <span className="faq-icon" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Cierre ——— */}
      <section className="service-cierre reveal">
        <div className="service-cierre-inner">
          <h2 className="svc-wipe">
            {CURSO.cierre.titulo} <em>{CURSO.cierre.em}</em>
          </h2>
          <p className="service-cierre-sub reveal-item">{CURSO.cierre.sub}</p>
          <div className="svc-cta-row reveal-item">
            <ComprarCta />
            <ZakCta />
          </div>
          <p className="acad-precio-nota reveal-item">{CURSO.precio.nota}</p>
        </div>
      </section>
    </main>
  );
}
