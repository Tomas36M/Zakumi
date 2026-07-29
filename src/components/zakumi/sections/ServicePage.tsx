"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import {
  gsap,
  ScrollTrigger,
  litWords,
  loopMarquee,
  magneticCtas,
  pinnedCrossfade,
  revealBlocks,
  revealTiles,
  scriptedChat,
  statCounters,
} from "@/lib/motion";
import { waLink, WHATSAPP_URL } from "../contact";
import type { Service } from "../services";
import { TECH_LOGOS } from "../techLogos";
import { ServiceSignature } from "./ServiceSignature";
import { Filosofia } from "./Filosofia";

const isNum = (s: string) => /^\d+$/.test(s);
const two = (n: number) => String(n + 1).padStart(2, "0");

const SIG_EYEBROW: Record<Service["signature"]["kind"], string> = {
  chat: "03 / En vivo",
  producto: "03 / Vista previa",
  marca: "03 / Identidad",
};

/** CTA principal: abre WhatsApp (con mensaje) o navega a /contacto según el servicio. */
function PrimaryCta({ data, label, ghost }: { data: Service; label: string; ghost?: boolean }) {
  const cls = `cta${ghost ? " cta-ghost" : ""}`;
  if (data.ctaTipo === "whatsapp" && data.waMsg) {
    return (
      <a className={cls} style={{ opacity: 1 }} href={waLink(data.waMsg)} target="_blank" rel="noopener noreferrer">
        <span>{label}</span>
        <span className="arrow">→</span>
      </a>
    );
  }
  return (
    <Link className={cls} style={{ opacity: 1 }} href="/contacto">
      <span>{label}</span>
      <span className="arrow">→</span>
    </Link>
  );
}

export function ServicePage({ data }: { data: Service }) {
  const root = useRef<HTMLElement>(null);
  const sec = data.secciones;
  const sig = data.signature;
  const man = data.manifiesto;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    let releaseCtas: (() => void) | undefined;

    const ctx = gsap.context(() => {
      revealBlocks(el);
      statCounters(el);
      releaseCtas = magneticCtas(el);
      litWords(".philosophy", ".phil-word");
      loopMarquee(".svc-tech-track", 22);
      revealTiles(".porque-bento", ".porque-bento > *", 3);

      // Casos de uso: escenario fijado con crossfade. Es el único momento de la
      // página que retiene el viewport y responde al scroll de forma continua.
      pinnedCrossfade({
        trigger: ".service-casos",
        pin: ".casos-stage",
        blocks: ".service-casos .caso-block",
        dots: ".service-casos .caso-dot",
        media: ".caso-img-wrap",
        root: el,
      });

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero visual: cortina vertical + parallax suave.
        const heroVisual = el.querySelector<HTMLElement>(".service-intro-visual");
        if (heroVisual) {
          gsap.fromTo(
            heroVisual,
            { clipPath: "inset(0 0 100% 0)" },
            {
              clipPath: "inset(0 0 0% 0)",
              duration: 1.2,
              ease: "expo.out",
              scrollTrigger: { trigger: ".service-intro", start: "top 80%", once: true },
            },
          );
          gsap.to(heroVisual, {
            yPercent: -10,
            ease: "none",
            scrollTrigger: { trigger: ".service-intro", start: "top top", end: "bottom top", scrub: 0.6 },
          });
        }

        // Sección estrella: entrada del mock + escalonado de sus piezas internas.
        const sigVisual = el.querySelector<HTMLElement>(".sig-visual");
        if (sigVisual) {
          gsap.fromTo(
            sigVisual,
            { y: 60, scale: 0.94, autoAlpha: 0 },
            {
              y: 0,
              scale: 1,
              autoAlpha: 1,
              duration: 1,
              ease: "expo.out",
              scrollTrigger: { trigger: ".service-signature", start: "top 78%", once: true },
            },
          );

          const inner: Array<[string, gsap.TweenVars]> = [
            [".sig-app-chart span", { scaleY: 0, transformOrigin: "bottom", stagger: 0.06 }],
            [".sig-swatch-chip", { scaleX: 0, transformOrigin: "left", stagger: 0.08 }],
            [".sig-app-kpi, .sig-app-row", { y: 14, opacity: 0, stagger: 0.07 }],
          ];
          inner.forEach(([selector, vars]) => {
            const nodes = sigVisual.querySelectorAll<HTMLElement>(selector);
            if (!nodes.length) return;
            gsap.from(nodes, {
              ...vars,
              duration: 0.7,
              ease: "expo.out",
              scrollTrigger: { trigger: ".service-signature", start: "top 70%", once: true },
            });
          });
        }

        // Chips de tecnología: pop escalonado al entrar la banda.
        const chips = el.querySelectorAll<HTMLElement>(".svc-tech-run:first-child .svc-tech-chip");
        if (chips.length) {
          gsap.from(chips, {
            y: 16,
            opacity: 0,
            scale: 0.9,
            duration: 0.5,
            ease: "back.out(1.4)",
            stagger: 0.05,
            scrollTrigger: { trigger: ".service-tech", start: "top 88%", once: true },
          });
        }
      });

      scriptedChat(".service-signature");
    }, root);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      releaseCtas?.();
      ctx.revert();
    };
  }, []);

  return (
    <main
      className="service-view"
      ref={root}
      style={{ "--accent-svc": data.accent } as React.CSSProperties}
    >
      {/* ——— Hero que ficha ——— */}
      <section className="service-intro reveal">
        <div className="service-intro-text">
          <div className="hero-tag reveal-item">
            <span className="line" />
            <span className="dot" />
            <span>{data.tag}</span>
          </div>
          <h1 className="svc-wipe">
            <span>{data.titulo1}</span>
            <br />
            <em style={{ fontStyle: "italic", color: "var(--orange)" }}>{data.tituloEm}</em>
          </h1>
          <p className="service-lead reveal-item">{data.intro}</p>
          <div className="svc-cta-row reveal-item">
            <PrimaryCta data={data} label={data.ctaLabel} />
            <a className="cta cta-ghost" href="#planes" style={{ opacity: 1 }}>
              <span>Ver planes</span>
              <span className="arrow">→</span>
            </a>
          </div>
        </div>
        <figure className="service-intro-visual">
          <Image src={data.heroImg} alt="" fill quality={90} sizes="(max-width: 900px) 100vw, 46vw" style={{ objectFit: "cover" }} loading="eager" fetchPriority="high" />
          <figcaption className="svc-visual-badge">{data.nav}</figcaption>
        </figure>
      </section>

      {/* Banda de datos del hero: horizontal, no una tercera rejilla hairline. */}
      <section className="svc-meta-band reveal">
        <dl className="svc-meta">
          {data.heroMeta.map((m) => (
            <div className="svc-meta-block reveal-item" key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.val}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ——— Datos clave ——— */}
      <section className="stats-section service-stats reveal">
        <div className="stats-inner">
          <div className="section-num svc-wipe">01 / Datos clave</div>
          <div className="stats-intro reveal-item">
            <h2 className="section-title">
              {sec.datosClave.titulo} <em>{sec.datosClave.em}</em>
            </h2>
            <p className="lead">{sec.datosClave.lead}</p>
          </div>
          <div className="stats-grid">
            {data.stats.map((s) => (
              <div className="stat" key={s.label}>
                <span className="stat-bar" aria-hidden />
                {isNum(s.num) ? (
                  <div className="num" data-num={s.num}>
                    <span data-target={s.num}>0</span>
                    {s.acc && <span className="acc">{s.acc}</span>}
                  </div>
                ) : (
                  <div className="num">
                    {s.num}
                    {s.acc && <span className="acc">{s.acc}</span>}
                  </div>
                )}
                <div className="stat-label">{s.label}</div>
                <div className="stat-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Qué hacemos ——— */}
      <section className="service-block service-incluye reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">02 / Qué hacemos</span>
          <h2 className="section-title reveal-item">
            {sec.queHacemos.titulo} <em>{sec.queHacemos.em}</em>
          </h2>
        </header>
        <div className="incluye-wrap">
          <ul className="incluye-list">
            {data.incluye.map((c) => (
              <li className="incluye-row reveal-item" key={c.titulo}>
                <h3>{c.titulo}</h3>
                <p>{c.desc}</p>
              </li>
            ))}
          </ul>
          <figure className="incluye-visual reveal-item">
            <span className="incluye-visual-media">
              <Image src={data.incluyeImg} alt="" fill quality={85} sizes="(max-width: 900px) 100vw, 38vw" style={{ objectFit: "cover" }} />
            </span>
          </figure>
        </div>
      </section>

      {/* ——— Sección estrella ——— */}
      <section className="service-signature svc-wide reveal">
        <div className="sig-grid">
          <div className="sig-intro">
            <div className="section-num svc-wipe">{SIG_EYEBROW[sig.kind]}</div>
            <h2 className="sig-title svc-wipe">
              {sig.titulo} <em>{sig.tituloEm}</em>
            </h2>
            <p className="sig-sub reveal-item">{sig.sub}</p>
            <ul className="sig-points reveal-item">
              {sig.puntos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="reveal-item">
              <PrimaryCta data={data} label={data.ctaLabel} />
            </div>
          </div>
          <div className="sig-visual">
            <ServiceSignature signature={sig} />
          </div>
        </div>
      </section>

      {/* ——— Casos de uso: escenario fijado con crossfade ——— */}
      <section className="service-casos">
        <div className="casos-stage">
          <div className="casos-head">
            <span className="section-num">04 / Casos de uso</span>
            <div className="casos-dots" aria-hidden>
              {data.ejemplos.map((e, i) => (
                <i key={e.titulo} className={`caso-dot${i === 0 ? " is-active" : ""}`} />
              ))}
            </div>
          </div>

          <div className="casos-track">
            {data.ejemplos.map((e, i) => (
              <article className={`caso-block${i === 0 ? " is-active" : ""}`} key={e.titulo}>
                <div className="caso-panel">
                  <span className="caso-idx">{two(i)}</span>
                  {e.cat && <span className="show-tag">{e.cat}</span>}
                  <h2 className="caso-titulo">{e.titulo}</h2>
                  <p className="caso-desc">{e.desc}</p>
                </div>
                {e.img && (
                  <div className="caso-img-wrap">
                    <Image src={e.img} alt="" fill quality={85} sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Manifiesto: el beat que no informa, afirma ——— */}
      <Filosofia
        label="— manifiesto —"
        signature={null}
        id=""
        line1={man.line1.split(" ")}
        line2={man.line2.split(" ")}
        em={[man.em]}
        line3={man.line3.split(" ")}
      />

      {/* ——— Cómo trabajamos ——— */}
      <section className="service-block service-proceso svc-tight reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">05 / Cómo trabajamos</span>
          <h2 className="section-title reveal-item">
            {sec.proceso.titulo} <em>{sec.proceso.em}</em>
          </h2>
        </header>
        <ol className="proceso-list">
          {data.proceso.map((p, i) => (
            <li className="proceso-step reveal-item" key={p.titulo}>
              <span className="proceso-n">{two(i)}</span>
              <h3>{p.titulo}</h3>
              <p>{p.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ——— Tecnologías: banda en movimiento, no una lista quieta ——— */}
      <section className="service-tech reveal">
        <header className="svc-tech-head">
          <span className="section-num svc-wipe">06 / {data.tech.titulo}</span>
          <p className="svc-tech-nota reveal-item">{data.tech.nota}</p>
        </header>
        <div className="svc-tech-marquee">
          <div className="svc-tech-track">
            {[0, 1].map((k) => (
              <div className="svc-tech-run" key={k} aria-hidden={k === 1}>
                {data.tech.items.map((t) => {
                  const logo = TECH_LOGOS[t];
                  return (
                    <span className="tech-chip svc-tech-chip" key={`${k}-${t}`}>
                      {logo && (
                        <svg className="tech-logo" role="img" viewBox="0 0 24 24" aria-hidden>
                          <path d={logo.path} />
                        </svg>
                      )}
                      <span className="tech-name">{t}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— Por qué Zakumi: bento asimétrico con un tile dominante ——— */}
      <section className="service-block service-porque svc-wide reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">07 / Por qué Zakumi</span>
          <h2 className="section-title reveal-item">
            {sec.porQue.titulo} <em>{sec.porQue.em}</em>
          </h2>
        </header>
        <div className="porque-bento">
          <figure className="porque-media">
            <Image src={data.porQueImg} alt="" fill quality={85} sizes="(max-width: 900px) 100vw, 34vw" style={{ objectFit: "cover" }} />
            <figcaption className="svc-visual-badge">{data.nav}</figcaption>
          </figure>
          {data.porQue.map((g, i) => (
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

      {/* ——— Planes ——— */}
      <section className="service-block service-planes reveal" id="planes">
        <header className="block-head">
          <span className="section-num svc-wipe">08 / Planes</span>
          <h2 className="section-title reveal-item">
            {sec.planes.titulo} <em>{sec.planes.em}</em>
          </h2>
        </header>
        <div className="planes-grid">
          {data.planes.map((p) => (
            <div className={`plan-card reveal-item${p.destacado ? " plan-featured" : ""}`} key={p.nombre}>
              <h3>{p.nombre}</h3>
              <p className="plan-tagline">{p.tagline}</p>
              <ul>
                {p.incluye.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
              <PrimaryCta data={data} label="Cotizar" ghost={!p.destacado} />
            </div>
          ))}
        </div>
        <p className="planes-nota reveal-item">
          Cotizamos por proyecto o por mes según tu alcance. Trabajamos con presupuestos pensados para el mercado
          colombiano — escríbenos y armamos una propuesta a tu medida.
        </p>
      </section>

      {/* ——— FAQ ——— */}
      <section className="service-block service-faq svc-tight reveal">
        <div className="faq-grid">
          <header className="block-head">
            <span className="section-num svc-wipe">09 / Preguntas frecuentes</span>
            <h2 className="section-title reveal-item">
              {sec.faq.titulo} <em>{sec.faq.em}</em>
            </h2>
            <p className="block-lead reveal-item">
              ¿Otra duda? Escríbenos y te respondemos el mismo día hábil.
            </p>
            <div className="reveal-item">
              <PrimaryCta data={data} label="Escríbenos" ghost />
            </div>
          </header>
          <div className="faq-list">
            {data.faq.map((f) => (
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
            ¿Lo armamos para tu <em>negocio</em>?
          </h2>
          <p className="service-cierre-sub reveal-item">
            Cuéntanos qué necesitas y te devolvemos una propuesta clara, sin compromiso.
          </p>
          <div className="svc-cta-row reveal-item">
            <PrimaryCta data={data} label={data.ctaLabel} />
            {data.ctaTipo === "whatsapp" ? (
              <Link className="cta cta-ghost" href="/contacto" style={{ opacity: 1 }}>
                <span>Prefiero el formulario</span>
                <span className="arrow">→</span>
              </Link>
            ) : (
              <a className="cta cta-ghost" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" style={{ opacity: 1 }}>
                <span>Escríbenos por WhatsApp</span>
                <span className="arrow">→</span>
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
