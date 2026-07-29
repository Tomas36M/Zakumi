"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { waLink, WHATSAPP_URL } from "../contact";
import type { Service } from "../services";
import { TECH_LOGOS } from "../techLogos";
import { ServiceSignature } from "./ServiceSignature";

gsap.registerPlugin(ScrollTrigger);

const isNum = (s: string) => /^\d+$/.test(s);

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

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!reduce) {
        // ——— Reveal editorial: wipe (clip-path) para títulos + fade para el resto ———
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

        // ——— Hero visual: cortina vertical + parallax suave ———
        const heroVisual = root.current?.querySelector<HTMLElement>(".service-intro-visual");
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

        // ——— Sección estrella: entrada + escalonado de elementos internos ———
        const sigVisual = root.current?.querySelector<HTMLElement>(".sig-visual");
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
          const bars = sigVisual.querySelectorAll<HTMLElement>(".sig-app-chart span");
          if (bars.length)
            gsap.from(bars, {
              scaleY: 0,
              transformOrigin: "bottom",
              duration: 0.7,
              ease: "expo.out",
              stagger: 0.06,
              scrollTrigger: { trigger: ".service-signature", start: "top 70%", once: true },
            });
          const chips = sigVisual.querySelectorAll<HTMLElement>(".sig-swatch-chip");
          if (chips.length)
            gsap.from(chips, {
              scaleX: 0,
              transformOrigin: "left",
              duration: 0.7,
              ease: "expo.out",
              stagger: 0.08,
              scrollTrigger: { trigger: ".service-signature", start: "top 70%", once: true },
            });
          const tiles = sigVisual.querySelectorAll<HTMLElement>(".sig-app-kpi, .sig-app-row");
          if (tiles.length)
            gsap.from(tiles, {
              y: 14,
              opacity: 0,
              duration: 0.6,
              ease: "power3.out",
              stagger: 0.07,
              scrollTrigger: { trigger: ".service-signature", start: "top 70%", once: true },
            });
        }

        // ——— Chat guionizado (signature.kind === "chat") ———
        const msgs = gsap.utils.toArray<HTMLElement>(".sig-chat .agent-msg");
        if (msgs.length) {
          const tl = gsap.timeline({
            scrollTrigger: { trigger: ".service-signature", start: "top 62%", once: true },
          });
          msgs.forEach((msg) => {
            const typing = msg.querySelector(".agent-typing");
            const text = msg.querySelector(".agent-text") as HTMLElement | null;
            tl.set(msg, { autoAlpha: 1 })
              .from(msg, {
                y: 14,
                scale: 0.96,
                transformOrigin: msg.classList.contains("is-cliente") ? "right bottom" : "left bottom",
                duration: 0.3,
                ease: "power3.out",
              })
              .to({}, { duration: 0.7 })
              .set(typing, { display: "none" })
              .set(text, { display: "block" })
              .from(text, { autoAlpha: 0, duration: 0.25, ease: "power2.out" });
          });
        }

        // ——— Chips de tecnología: pop escalonado ———
        const techChips = gsap.utils.toArray<HTMLElement>(".svc-tech-chip");
        if (techChips.length)
          gsap.from(techChips, {
            y: 16,
            opacity: 0,
            scale: 0.9,
            duration: 0.5,
            ease: "back.out(1.4)",
            stagger: 0.05,
            scrollTrigger: { trigger: ".svc-tech-list", start: "top 88%", once: true },
          });

        // ——— CTA magnético ———
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

      // ——— Datos clave: contador + barra naranja (corre también con reduce) ———
      gsap.utils.toArray<HTMLElement>(".service-stats .stat").forEach((stat) => {
        const numEl = stat.querySelector<HTMLElement>(".num");
        const targetSpan = stat.querySelector<HTMLElement>("[data-target]");
        const bar = stat.querySelector<HTMLElement>(".stat-bar");
        if (!reduce) {
          gsap
            .timeline({ scrollTrigger: { trigger: stat, start: "top 85%", once: true } })
            .fromTo(numEl, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0, ease: "expo.out" })
            .fromTo(
              stat.querySelectorAll(".stat-label, .stat-desc"),
              { y: 20, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" },
              "-=0.6",
            );
          if (bar)
            gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: stat, start: "top 85%", once: true } });
        }
        if (targetSpan) {
          const final = parseFloat(targetSpan.getAttribute("data-target") || "");
          if (!Number.isNaN(final)) {
            if (reduce) {
              targetSpan.textContent = String(final);
            } else {
              const obj = { v: 0 };
              gsap.to(obj, {
                v: final,
                duration: 1.6,
                ease: "power2.out",
                scrollTrigger: { trigger: stat, start: "top 85%", once: true },
                onUpdate: () => {
                  targetSpan.textContent = String(Math.floor(obj.v));
                },
              });
            }
          }
        }
      });
    }, root);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => ctx.revert();
  }, []);

  const sig = data.signature;

  return (
    <main className="service-view" ref={root}>
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
          <dl className="svc-meta reveal-item">
            {data.heroMeta.map((m) => (
              <div className="svc-meta-block" key={m.label}>
                <dt>{m.label}</dt>
                <dd>{m.val}</dd>
              </div>
            ))}
          </dl>
        </div>
        <figure className="service-intro-visual">
          <Image src={data.heroImg} alt="" fill quality={90} sizes="(max-width: 900px) 100vw, 46vw" style={{ objectFit: "cover" }} priority />
          <figcaption className="svc-visual-badge">{data.nav}</figcaption>
        </figure>
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
              <Image src={data.incluyeImg} alt="" fill sizes="(max-width: 900px) 100vw, 38vw" style={{ objectFit: "cover" }} />
            </span>
          </figure>
        </div>
      </section>

      {/* ——— Sección estrella ——— */}
      <section className="service-signature reveal">
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

      {/* ——— Casos de uso (bento con caption superpuesta) ——— */}
      <section className="service-block service-ejemplos reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">04 / Casos de uso</span>
          <h2 className="section-title reveal-item">
            {sec.casos.titulo} <em>{sec.casos.em}</em>
          </h2>
        </header>
        <div className="ejemplos-grid">
          {data.ejemplos.map((e) => (
            <article className="ejemplo-tile reveal-item" key={e.titulo}>
              {e.img && (
                <div className="ejemplo-img">
                  <Image src={e.img} alt="" fill sizes="(max-width: 900px) 100vw, 32vw" style={{ objectFit: "cover" }} />
                </div>
              )}
              <figcaption className="ejemplo-cap">
                {e.cat && <span className="show-tag">{e.cat}</span>}
                <span className="ejemplo-titulo">{e.titulo}</span>
                <span className="ejemplo-desc">{e.desc}</span>
              </figcaption>
            </article>
          ))}
        </div>
      </section>

      {/* ——— Cómo trabajamos ——— */}
      <section className="service-block service-proceso reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">05 / Cómo trabajamos</span>
          <h2 className="section-title reveal-item">
            {sec.proceso.titulo} <em>{sec.proceso.em}</em>
          </h2>
        </header>
        <ol className="proceso-list">
          {data.proceso.map((p, i) => (
            <li className="proceso-step reveal-item" key={p.titulo}>
              <span className="proceso-n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{p.titulo}</h3>
              <p>{p.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ——— Tecnologías ——— */}
      <section className="service-tech reveal">
        <header className="svc-tech-head">
          <span className="section-num svc-wipe">06 / {data.tech.titulo}</span>
          <p className="svc-tech-nota reveal-item">{data.tech.nota}</p>
        </header>
        <div className="svc-tech-list">
          {data.tech.items.map((t) => {
            const logo = TECH_LOGOS[t];
            return (
              <span className="tech-chip svc-tech-chip" key={t}>
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
      </section>

      {/* ——— Por qué Zakumi ——— */}
      <section className="service-block service-porque reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">07 / Por qué Zakumi</span>
          <h2 className="section-title reveal-item">
            {sec.porQue.titulo} <em>{sec.porQue.em}</em>
          </h2>
        </header>
        <div className="porque-grid">
          {data.porQue.map((g, i) => (
            <div className="porque-card reveal-item" key={g.titulo}>
              <span className="porque-n" aria-hidden>
                {String(i + 1).padStart(2, "0")}
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
      <section className="service-block service-faq reveal">
        <div className="faq-grid">
          <header className="block-head">
            <span className="section-num svc-wipe">09 / Preguntas frecuentes</span>
            <h2 className="section-title reveal-item">
              {sec.faq.titulo} <em>{sec.faq.em}</em>
            </h2>
            <p className="block-lead reveal-item">¿Otra duda? Escríbenos y te respondemos en minutos.</p>
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
