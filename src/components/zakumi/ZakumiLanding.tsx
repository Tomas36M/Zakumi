"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/** Valores por defecto del diseño (panel Tweaks solo en el artefacto original). */
const TWEAK_DEFAULTS: {
  heroSize: number;
  bgMode: "full" | "mix";
  headline: string;
  accent: string;
} = {
  heroSize: 8.5,
  bgMode: "full",
  headline: "Creamos marcas. Desarrollamos el futuro.",
  accent: "#DB5227",
};

export function ZakumiLanding() {
  const [activeService, setActiveService] = useState<number | null>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--hero-size",
      `${TWEAK_DEFAULTS.heroSize}rem`,
    );
    document.documentElement.style.setProperty("--orange", TWEAK_DEFAULTS.accent);
    const bg = document.getElementById("bg");
    if (bg) {
      bg.classList.toggle("bg-full", TWEAK_DEFAULTS.bgMode === "full");
      bg.classList.toggle("bg-mix", TWEAK_DEFAULTS.bgMode === "mix");
    }
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const counter = { v: 0 };
      const counterEl = document.getElementById("curtain-counter");
      const tl = gsap.timeline();

      if (counterEl) {
        tl.to(counter, {
          v: 100,
          duration: 1.4,
          ease: "power2.inOut",
          onUpdate: () => {
            counterEl.textContent = String(Math.floor(counter.v)).padStart(2, "0");
          },
        })
          .to(
            ".curtain-inner, .curtain-label, .curtain-counter",
            {
              opacity: 0,
              y: -20,
              duration: 0.6,
              ease: "power3.in",
            },
            "+=0.15",
          )
          .to(
            "#curtain-panel",
            {
              scaleY: 0,
              duration: 1.1,
              ease: "expo.inOut",
              transformOrigin: "top center",
            },
            "-=0.3",
          )
          .set("#curtain", { display: "none" });
      }

      tl.from(
        ".nav-logo > span",
        {
          yPercent: 110,
          duration: 0.9,
          ease: "expo.out",
        },
        counterEl ? "-=0.7" : 0,
      ).from(
          ".nav-links a",
          {
            yPercent: 100,
            opacity: 0,
            stagger: 0.06,
            duration: 0.7,
            ease: "expo.out",
          },
          "<+0.1",
        )
        .to(".hero-tag", { opacity: 1, duration: 0.5 }, "-=0.6")
        .to(
          ".hero-tag .line",
          { scaleX: 1, duration: 0.8, ease: "expo.out" },
          "<",
        )
        .to(
          ".hero-tag .dot",
          {
            keyframes: [{ scale: 1.4 }, { scale: 1 }],
            duration: 0.8,
            ease: "power2.inOut",
          },
          "<",
        )
        .from(
          ".hero h1 .word",
          {
            yPercent: 110,
            rotate: 4,
            stagger: 0.06,
            duration: 1.05,
            ease: "expo.out",
          },
          "-=0.5",
        )
        .to(
          ".meta-block",
          {
            opacity: 1,
            y: 0,
            stagger: 0.1,
            duration: 0.8,
            ease: "power3.out",
          },
          "-=0.7",
        )
        .from(
          ".meta-block",
          {
            y: 16,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
          },
          "<",
        )
        .to(
          ".hero .cta",
          {
            opacity: 1,
            duration: 0.6,
            ease: "power3.out",
          },
          "-=0.5",
        )
        .from(
          ".hero .cta",
          {
            y: 18,
            duration: 0.7,
            ease: "power3.out",
          },
          "<",
        )
        .to(
          ".hero-deco, .scroll-indicator",
          {
            opacity: 1,
            duration: 0.6,
            stagger: 0.1,
          },
          "-=0.4",
        );

      ScrollTrigger.create({
        start: "top -50",
        end: 99999,
        toggleClass: { className: "scrolled", targets: "nav" },
      });

      gsap.to("#scroll-fill", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
      });

      gsap.to(".hero h1", {
        yPercent: -12,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(".hero-meta", {
        yPercent: -25,
        opacity: 0.4,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(".hero-deco", {
        yPercent: -50,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 0.8,
        },
      });
      gsap.to(".scroll-indicator", {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "40% top",
          scrub: true,
        },
      });

      const track = document.querySelector(".marquee-track");
      if (track) {
        const totalWidth = track.scrollWidth / 2;
        const marqueeTween = gsap.to(track, {
          x: -totalWidth,
          duration: 35,
          ease: "none",
          repeat: -1,
        });

        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            const v = self.getVelocity();
            const speed = gsap.utils.clamp(0.6, 6, 1 + Math.abs(v) / 600);
            gsap.to(marqueeTween, {
              timeScale: v < 0 ? -speed : speed,
              duration: 0.4,
              overwrite: true,
            });
            gsap.to(marqueeTween, {
              timeScale: 1,
              duration: 1.4,
              delay: 0.4,
              overwrite: "auto",
            });
          },
        });
      }

      gsap.utils
        .toArray(
          ".section-num, .section-title, .stats-intro .lead, .outro h2, .outro .right p, .outro .right .cta, .philosophy .small, .philosophy .signature",
        )
        .forEach((el) => {
          gsap.fromTo(
            el as gsap.DOMTarget,
            { clipPath: "inset(0 100% 0 0)", y: 30, opacity: 0 },
            {
              clipPath: "inset(0 0% 0 0)",
              y: 0,
              opacity: 1,
              duration: 1.1,
              ease: "expo.out",
              scrollTrigger: {
                trigger: el as HTMLElement,
                start: "top 88%",
                once: true,
              },
            },
          );
        });

      gsap.utils.toArray(".service").forEach((card, i) => {
        gsap.from(card as gsap.DOMTarget, {
          y: 80,
          opacity: 0,
          duration: 1.1,
          delay: i * 0.12,
          ease: "expo.out",
          scrollTrigger: {
            trigger: ".services",
            start: "top 80%",
            once: true,
          },
        });
      });

      gsap.utils.toArray(".stat").forEach((stat) => {
        const statEl = stat as HTMLElement;
        const numEl = statEl.querySelector(".num") as HTMLElement | null;
        const target = numEl?.getAttribute("data-num");

        gsap
          .timeline({
            scrollTrigger: {
              trigger: statEl,
              start: "top 85%",
              once: true,
            },
          })
          .to(statEl, { duration: 0.01 })
          .fromTo(
            statEl.querySelector(".num"),
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 1.0, ease: "expo.out" },
          )
          .fromTo(
            statEl.querySelectorAll(".stat-label, .stat-desc"),
            { y: 20, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.7,
              stagger: 0.1,
              ease: "power3.out",
            },
            "-=0.6",
          );

        gsap.fromTo(
          statEl,
          { "--bar": 0 } as gsap.TweenVars,
          {
            duration: 0.9,
            ease: "expo.out",
            scrollTrigger: { trigger: statEl, start: "top 85%", once: true },
            onStart: () => {
              const bar = document.createElement("div");
              bar.style.cssText =
                "position:absolute;top:0;left:0;right:0;height:1px;background:var(--orange);transform:scaleX(0);transform-origin:left;";
              statEl.appendChild(bar);
              gsap.to(bar, { scaleX: 1, duration: 0.9, ease: "expo.out" });
            },
          },
        );

        if (target && numEl) {
          const obj = { v: 0 };
          const final = parseFloat(target);
          const isFloat = target.includes(".");
          gsap.to(obj, {
            v: final,
            duration: 1.6,
            ease: "power2.out",
            scrollTrigger: { trigger: statEl, start: "top 85%", once: true },
            onUpdate: () => {
              const targetSpan = numEl.querySelector("[data-target]");
              if (targetSpan) {
                targetSpan.textContent = isFloat
                  ? obj.v.toFixed(2)
                  : String(Math.floor(obj.v));
              }
            },
          });
        }
      });

      const philWords = gsap.utils.toArray(".philosophy .phil-word");
      ScrollTrigger.create({
        trigger: ".philosophy",
        start: "top 80%",
        end: "bottom 60%",
        scrub: 0.8,
        onUpdate: (self) => {
          const lit = Math.floor(self.progress * philWords.length);
          philWords.forEach((w, i) => {
            (w as HTMLElement).classList.toggle("lit", i <= lit);
          });
        },
      });

      gsap.utils.toArray(".cta").forEach((btn) => {
        const el = btn as HTMLElement;
        const onMove = (e: MouseEvent) => {
          const r = el.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2);
          const y = e.clientY - (r.top + r.height / 2);
          gsap.to(el, {
            x: x * 0.25,
            y: y * 0.35,
            duration: 0.5,
            ease: "power3.out",
          });
        };
        const onLeave = () =>
          gsap.to(el, {
            x: 0,
            y: 0,
            duration: 0.7,
            ease: "elastic.out(1, 0.4)",
          });
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
      });

      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener("click", (e) => {
          const id = a.getAttribute("href");
          if (id && id.length > 1 && document.querySelector(id)) {
            e.preventDefault();
            gsap.to(window, {
              duration: 1.2,
              scrollTo: { y: id, offsetY: 60 },
              ease: "expo.inOut",
            });
          }
        });
      });

      ScrollTrigger.refresh();
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const xDot = gsap.quickTo(dot, "x", { duration: 0.18, ease: "power3" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.18, ease: "power3" });
    const xRing = gsap.quickTo(ring, "x", { duration: 0.5, ease: "power3" });
    const yRing = gsap.quickTo(ring, "y", { duration: 0.5, ease: "power3" });

    const onMove = (e: MouseEvent) => {
      xDot(e.clientX);
      yDot(e.clientY);
      xRing(e.clientX);
      yRing(e.clientY);
    };
    document.addEventListener("mousemove", onMove);

    const enter = () => {
      gsap.to(ring, {
        width: 70,
        height: 70,
        borderColor: "rgba(219,82,39,0.8)",
        duration: 0.4,
        ease: "power3.out",
      });
      gsap.to(dot, { scale: 0, duration: 0.3 });
    };
    const leave = () => {
      gsap.to(ring, {
        width: 40,
        height: 40,
        borderColor: "rgba(245,239,227,0.5)",
        duration: 0.4,
        ease: "power3.out",
      });
      gsap.to(dot, { scale: 1, duration: 0.3 });
    };

    const targets = document.querySelectorAll("a, button, .service, .cta");
    targets.forEach((el) => {
      el.addEventListener("mouseenter", enter);
      el.addEventListener("mouseleave", leave);
    });

    return () => {
      document.removeEventListener("mousemove", onMove);
      targets.forEach((el) => {
        el.removeEventListener("mouseenter", enter);
        el.removeEventListener("mouseleave", leave);
      });
    };
  }, []);

  const renderHeadline = () => {
    const words = TWEAK_DEFAULTS.headline.split(" ");
    return words.map((w, i) => {
      const isItalic = i >= words.length - 2;
      return (
        <span
          className="line-mask"
          key={i}
          style={{ display: "inline-block", verticalAlign: "top" }}
        >
          <span
            className="word"
            style={
              isItalic
                ? { fontStyle: "italic", color: "var(--orange)" }
                : undefined
            }
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </span>
        </span>
      );
    });
  };

  const philosophyLine1 = "Diseñamos como si el código importara.".split(" ");
  const philosophyLine2 = ["Programamos", "como", "si", "el"];
  const philosophyEm = ["diseño"];
  const philosophyLine3 = ["fuera", "ley."];

  return (
    <>
      <div className="bg-base bg-full" id="bg" />
      <div className="grain" />

      <div className="curtain" id="curtain">
        <div className="curtain-panel" id="curtain-panel" />
        <div className="curtain-inner">
          <span>ZAKUMI</span>
          <span className="dot" />
          <span>ESTUDIO</span>
        </div>
        <div className="curtain-label">CARGANDO · MMXXVI</div>
        <div className="curtain-counter" id="curtain-counter">
          00
        </div>
      </div>

      <div className="scroll-progress">
        <div className="fill" id="scroll-fill" />
      </div>

      <div id="app" ref={rootRef}>
        <div className="cursor-ring" ref={ringRef} />
        <div className="cursor-dot" ref={dotRef} />

        <nav>
          <div className="nav-logo">
            <span>
              ZAKUMI
              <span style={{ color: "var(--orange)" }}>.</span>
            </span>
          </div>
          <div className="nav-links">
            <a href="#servicios">Servicios</a>
            <a href="#datos">Datos</a>
            <a href="#filosofia">Filosofía</a>
            <a href="#contacto">Contacto</a>
          </div>
        </nav>

        <section className="hero" id="hero">
          <div className="hero-tag">
            <span className="line" />
            <span className="dot" />
            <span>Estudio · Marca &amp; Software · 2026</span>
          </div>

          <h1 key={TWEAK_DEFAULTS.headline}>{renderHeadline()}</h1>

          <div className="hero-meta">
            <div className="meta-block">
              <div className="label">Disciplinas</div>
              <div className="val">Marca · Producto · Código</div>
            </div>
            <div className="meta-block">
              <div className="label">Sede</div>
              <div className="val">CDMX · Remoto</div>
            </div>
            <div className="meta-block">
              <div className="label">Estatus</div>
              <div className="val">Aceptando 2 proyectos · Q3</div>
            </div>
          </div>

          <a href="#contacto" className="cta">
            <span>Impulsa tu visión</span>
            <span className="arrow">→</span>
          </a>

          <div className="hero-deco">EST. 2026 — ZKM ·</div>

          <div className="scroll-indicator">
            <span>scroll</span>
            <span className="bar" />
          </div>
        </section>

        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((k) => (
              <div className="marquee-item" key={k}>
                <span>Identidad</span>
                <span className="star">✦</span>
                <span>Estrategia</span>
                <span className="star">✦</span>
                <span>Software a medida</span>
                <span className="star">✦</span>
                <span>Producto digital</span>
                <span className="star">✦</span>
                <span>Diseño editorial</span>
                <span className="star">✦</span>
                <span>Sistemas de marca</span>
                <span className="star">✦</span>
              </div>
            ))}
          </div>
        </div>

        <section id="servicios" style={{ padding: "8rem 0 0" }}>
          <div style={{ padding: "0 4vw 4rem" }}>
            <div className="section-num">01 / Servicios</div>
            <h2 className="section-title">
              Dos caminos.
              <br />
              <em>Un estudio.</em>
            </h2>
          </div>

          <div className="services">
            <div
              className={`service${activeService === 0 ? " active" : ""}`}
              onMouseEnter={() => setActiveService(0)}
              onMouseLeave={() => setActiveService(null)}
            >
              <div className="service-arrow">↗</div>
              <div>
                <div className="service-num">— I.</div>
                <h3>
                  Identidad
                  <br />
                  <em>de marca.</em>
                </h3>
                <p>
                  Construimos marcas que se reconocen en una sola línea. Sistemas visuales precisos:
                  tipografía, color, voz, aplicación. Lo justo. Nada más.
                </p>
              </div>
              <div className="service-meta">
                <div className="service-meta-row">
                  <span className="k">Entregables</span>
                  <span className="v">Sistema · Manual · Activos</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Plazo</span>
                  <span className="v">4 — 8 semanas</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Equipo</span>
                  <span className="v">2 diseñadores · 1 director</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Desde</span>
                  <span className="v">$120k MXN</span>
                </div>
              </div>
            </div>

            <div
              className={`service${activeService === 1 ? " active" : ""}`}
              onMouseEnter={() => setActiveService(1)}
              onMouseLeave={() => setActiveService(null)}
            >
              <div className="service-arrow">↗</div>
              <div>
                <div className="service-num">— II.</div>
                <h3>
                  Software
                  <br />
                  <em>a medida.</em>
                </h3>
                <p>
                  Producto digital end-to-end. Desde el primer prototipo hasta la versión 3.0. Diseño y
                  código bajo el mismo techo, sin handoffs perdidos.
                </p>
              </div>
              <div className="service-meta">
                <div className="service-meta-row">
                  <span className="k">Stack</span>
                  <span className="v">React · TypeScript · Postgres</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Plazo</span>
                  <span className="v">8 — 24 semanas</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Equipo</span>
                  <span className="v">3 ingenieros · 1 PM</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Desde</span>
                  <span className="v">$280k MXN</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="stats-section" id="datos">
          <div className="section-num">02 / Datos</div>
          <div className="stats-intro">
            <h2 className="section-title" style={{ margin: 0, maxWidth: "none" }}>
              Sin relleno.
              <br />
              <em>Solo señal.</em>
            </h2>
            <p className="lead">
              Nuestro trabajo se mide en <em>velocidad</em>, <em>fidelidad</em> y <em>retención</em>. Lo demás es
              ruido.
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat">
              <div className="num" data-num="14">
                <span data-target="14">0</span>
                <span className="acc">.</span>
              </div>
              <div className="stat-label">Marcas lanzadas · 2026</div>
              <div className="stat-desc">Nueve startups, tres consumer, dos fintech.</div>
            </div>
            <div className="stat">
              <div className="num" data-num="0.92">
                <em>
                  <span data-target="0.92">0.00</span>
                </em>
              </div>
              <div className="stat-label">Lighthouse · Performance</div>
              <div className="stat-desc">Score promedio en producción.</div>
            </div>
            <div className="stat">
              <div className="num" data-num="38">
                +<span data-target="38">0</span>
                <span className="acc">%</span>
              </div>
              <div className="stat-label">Conversión · post-rebrand</div>
              <div className="stat-desc">Mediana en clientes con seguimiento de 6 meses.</div>
            </div>
            <div className="stat">
              <div className="num" data-num="6">
                <span data-target="6">0</span>
                <span className="acc">w</span>
              </div>
              <div className="stat-label">Time to ship · MVP</div>
              <div className="stat-desc">Desde kickoff hasta producción.</div>
            </div>
            <div className="stat">
              <div className="num" data-num="100">
                <span data-target="100">0</span>
                <span className="acc">%</span>
              </div>
              <div className="stat-label">Renovación de retainer</div>
              <div className="stat-desc">Clientes que continúan al año.</div>
            </div>
            <div className="stat">
              <div className="num" data-num="3">
                <em>
                  <span data-target="3">0</span>
                </em>
              </div>
              <div className="stat-label">Personas · proyecto</div>
              <div className="stat-desc">Equipos pequeños, decisiones rápidas.</div>
            </div>
            <div className="stat">
              <div className="num" data-num="2">
                <span data-target="2">0</span>
                <span className="acc">/yr</span>
              </div>
              <div className="stat-label">Cupos abiertos</div>
              <div className="stat-desc">Trabajamos pocos proyectos a la vez. A propósito.</div>
            </div>
            <div className="stat">
              <div className="num">∞</div>
              <div className="stat-label">Iteraciones incluidas</div>
              <div className="stat-desc">Hasta que el detalle suene exacto.</div>
            </div>
          </div>
        </section>

        <section className="philosophy" id="filosofia">
          <div className="small">— filosofía —</div>
          <p className="big">
            {philosophyLine1.map((w, i) => (
              <React.Fragment key={`a${i}`}>
                <span className="phil-word">{w}</span>{" "}
              </React.Fragment>
            ))}
            <br />
            {philosophyLine2.map((w, i) => (
              <React.Fragment key={`b${i}`}>
                <span className="phil-word">{w}</span>{" "}
              </React.Fragment>
            ))}
            <em>
              <span className="phil-word">{philosophyEm[0]}</span>
            </em>{" "}
            {philosophyLine3.map((w, i) => (
              <React.Fragment key={`c${i}`}>
                <span className="phil-word">{w}</span>
                {i < philosophyLine3.length - 1 ? " " : ""}
              </React.Fragment>
            ))}
          </p>
          <p className="signature">— ZKM Studio</p>
        </section>

        <section className="outro" id="contacto">
          <h2>
            ¿Tienes una visión?
            <br />
            <em>Empecemos.</em>
          </h2>
          <div className="right">
            <p>
              Aceptamos un nuevo proyecto cada seis semanas. Si lo tuyo encaja con lo que hacemos — y nosotros
              con lo tuyo — agendemos una llamada de 30 minutos.
            </p>
            <a href="mailto:hola@zakumi.studio" className="cta" style={{ opacity: 1 }}>
              <span>hola@zakumi.studio</span>
              <span className="arrow">→</span>
            </a>
          </div>
        </section>

        <footer>
          <div>© 2026 ZAKUMI Studio · CDMX</div>
          <div>Diseño · Código · Marca</div>
          <div>v.02 — gsap</div>
        </footer>
      </div>
    </>
  );
}
