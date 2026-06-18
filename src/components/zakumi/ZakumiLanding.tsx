"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";
import {
  EMAIL, WHATSAPP_URL, INSTAGRAM_HANDLE, INSTAGRAM_URL,
  TELEGRAM_ENABLED, TELEGRAM_URL,
} from "./contact";
import { HERO_IMAGES } from "./content";

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

const NAV_ITEMS = [
  { href: "#servicios", label: "Servicios" },
  { href: "#seleccion", label: "Selección" },
  { href: "#datos", label: "Cómo trabajamos" },
  { href: "#contacto", label: "Contacto" },
] as const;

const HERO_INTERVAL = 5000;

export function ZakumiLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeService, setActiveService] = useState<number | null>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const applyHeroSize = () => {
      const wide = window.matchMedia("(min-width: 721px)").matches;
      if (wide) {
        document.documentElement.style.setProperty(
          "--hero-size",
          `${TWEAK_DEFAULTS.heroSize}rem`,
        );
      } else {
        document.documentElement.style.removeProperty("--hero-size");
      }
    };
    applyHeroSize();
    const mq = window.matchMedia("(min-width: 721px)");
    const onBreakpoint = () => {
      applyHeroSize();
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    mq.addEventListener("change", onBreakpoint);

    document.documentElement.style.setProperty("--orange", TWEAK_DEFAULTS.accent);
    const bg = document.getElementById("bg");
    if (bg) {
      bg.classList.toggle("bg-full", TWEAK_DEFAULTS.bgMode === "full");
      bg.classList.toggle("bg-mix", TWEAK_DEFAULTS.bgMode === "mix");
    }

    return () => mq.removeEventListener("change", onBreakpoint);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.matchMedia("(min-width: 721px)").matches) setMenuOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

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

      gsap.utils.toArray(".show-tile").forEach((tile, i) => {
        gsap.from(tile as gsap.DOMTarget, {
          y: 60,
          opacity: 0,
          duration: 1,
          delay: (i % 2) * 0.1 + Math.floor(i / 2) * 0.08,
          ease: "expo.out",
          scrollTrigger: {
            trigger: ".showcase-grid",
            start: "top 82%",
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

  useEffect(() => {
    const slides = gsap.utils.toArray(".hero-slide") as HTMLElement[];
    if (slides.length === 0) return;
    const dots = gsap.utils.toArray(".hero-dot") as HTMLElement[];

    const zoom = (el: HTMLElement, secs: number, loop = false) => {
      const img = el.querySelector("img");
      if (!img) return;
      gsap.killTweensOf(img);
      if (loop) {
        gsap.fromTo(
          img,
          { scale: 1.0 },
          { scale: 1.12, duration: secs, ease: "sine.inOut", yoyo: true, repeat: -1 },
        );
      } else {
        gsap.fromTo(img, { scale: 1.0 }, { scale: 1.12, duration: secs, ease: "none" });
      }
    };

    slides.forEach((s, i) => gsap.set(s, { opacity: i === 0 ? 1 : 0 }));

    // Una sola imagen: zoom lento continuo (movimiento sutil)
    if (slides.length < 2) {
      zoom(slides[0], 14, true);
      return;
    }

    let current = 0;
    zoom(slides[0], HERO_INTERVAL / 1000 + 1.5);

    const go = (next: number) => {
      if (next === current) return;
      gsap.to(slides[current], { opacity: 0, duration: 1.2, ease: "power2.inOut" });
      gsap.to(slides[next], { opacity: 1, duration: 1.2, ease: "power2.inOut" });
      zoom(slides[next], HERO_INTERVAL / 1000 + 1.5);
      dots[current]?.classList.remove("is-active");
      dots[next]?.classList.add("is-active");
      current = next;
    };

    let timer = window.setInterval(
      () => go((current + 1) % slides.length),
      HERO_INTERVAL,
    );
    const restart = () => {
      window.clearInterval(timer);
      timer = window.setInterval(
        () => go((current + 1) % slides.length),
        HERO_INTERVAL,
      );
    };

    const handlers = dots.map((d, i) => {
      const h = () => {
        go(i);
        restart();
      };
      d.addEventListener("click", h);
      return h;
    });

    return () => {
      window.clearInterval(timer);
      dots.forEach((d, i) => d.removeEventListener("click", handlers[i]));
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

        <nav className={menuOpen ? "nav-menu-open" : undefined}>
          <div className="nav-logo">
            <span>
              ZAKUMI
              <span style={{ color: "var(--orange)" }}>.</span>
            </span>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map(({ href, label }) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </div>
          <button
            type="button"
            className={`nav-toggle${menuOpen ? " is-open" : ""}`}
            aria-expanded={menuOpen}
            aria-controls="zakumi-mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="sr-only">{menuOpen ? "Cerrar menú" : "Abrir menú"}</span>
            <span className="nav-toggle-bars" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </nav>

        <div
          id="zakumi-mobile-nav"
          className={`nav-overlay${menuOpen ? " is-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <div
            className="nav-overlay-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="nav-overlay-panel">
            <div className="nav-overlay-heading">Navegación</div>
            {NAV_ITEMS.map(({ href, label }) => (
              <a
                key={`m-${href}`}
                href={href}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

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

          <h1 key={TWEAK_DEFAULTS.headline}>{renderHeadline()}</h1>

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

        <section id="servicios" className="zakumi-servicios-section">
          <div className="servicios-head">
            <div className="servicios-head-text">
              <div className="section-num">01 / Servicios</div>
              <h2 className="section-title">
                Dos caminos.
                <br />
                <em>Un estudio.</em>
              </h2>
              <p className="servicios-lead">
                No hacemos de todo. Hacemos dos cosas — y las hacemos bien:{" "}
                <em>marcas que se recuerdan</em> y <em>software que funciona</em>.
                Bajo el mismo techo, el mismo equipo, sin traspasos perdidos
                entre el diseño y el código.
              </p>
              <ul className="servicios-tags">
                <li>Identidad</li>
                <li>Estrategia</li>
                <li>Diseño de producto</li>
                <li>Frontend</li>
                <li>Backend</li>
                <li>Sin handoffs</li>
              </ul>
            </div>
            <figure className="servicios-visual">
              <div className="servicios-visual-frame">
                <Image
                  src="/work/zk-servicios.webp"
                  alt="Marca y software en un mismo escritorio: identidad impresa junto a una laptop con código"
                  fill
                  sizes="(max-width: 900px) 100vw, 46vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <figcaption>Marca a un lado. Software al otro. El mismo equipo.</figcaption>
            </figure>
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
                  <span className="k">Equipo</span>
                  <span className="v">Diseño + dirección dedicada</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Inversión</span>
                  <span className="v">A medida · Propuesta sin compromiso</span>
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
                  <span className="k">Equipo</span>
                  <span className="v">Diseño y código, mismo techo</span>
                </div>
                <div className="service-meta-row">
                  <span className="k">Inversión</span>
                  <span className="v">A medida · Propuesta sin compromiso</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="showcase" id="seleccion">
          <div className="section-num">02 / Selección</div>
          <h2 className="section-title">
            Marca y producto,
            <br />
            <em>con intención.</em>
          </h2>

          <div className="showcase-grid">
            <figure className="show-tile tile-brand">
              <div className="show-mock">
                <Image
                  src="/work/zk-brand-foto2.webp"
                  alt="Sistema de identidad de marca Zakumi: papelería, tarjeta y paleta"
                  fill
                  className="show-img"
                  sizes="(max-width: 720px) 100vw, 50vw"
                />
              </div>
              <figcaption>
                <span className="show-tag">Identidad</span>
                <span className="show-title">Sistemas de marca</span>
              </figcaption>
            </figure>

            <figure className="show-tile tile-soft">
              <div className="show-mock">
                <Image
                  src="/work/zk-software-foto.webp"
                  alt="Dashboard de producto Zakumi con métricas de ingresos y conversión"
                  fill
                  className="show-img"
                  sizes="(max-width: 720px) 100vw, 50vw"
                />
              </div>
              <figcaption>
                <span className="show-tag">Producto</span>
                <span className="show-title">Interfaces que venden</span>
              </figcaption>
            </figure>

            <figure className="show-tile tile-form">
              <div className="show-mock">
                <Image
                  src="/work/zk-form-foto.webp"
                  alt="Landing page de alta conversión diseñada por Zakumi"
                  fill
                  className="show-img"
                  sizes="(max-width: 720px) 100vw, 25vw"
                />
              </div>
              <figcaption>
                <span className="show-tag">Web</span>
                <span className="show-title">Landings que convierten</span>
              </figcaption>
            </figure>

            <figure className="show-tile tile-ink">
              <div className="show-mock">
                <Image
                  src="/work/zk-ink-foto.webp"
                  alt="Código de producción en Next.js y TypeScript por Zakumi"
                  fill
                  className="show-img"
                  sizes="(max-width: 720px) 100vw, 25vw"
                />
              </div>
              <figcaption>
                <span className="show-tag">Código</span>
                <span className="show-title">Listo para producción</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="stats-section" id="datos">
          <div className="stats-inner">
            <div className="section-num">03 / Cómo trabajamos</div>
            <div className="stats-intro">
              <h2 className="section-title">
                Sin letra chica.
                <br />
                <em>Solo compromisos.</em>
              </h2>
              <p className="lead">
                Somos un estudio joven, y eso es una ventaja: trabajamos con{" "}
                <em>obsesión</em>, sin <em>plantillas</em> y cuidamos cada
                proyecto como si fuera el nuestro.
              </p>
            </div>

            <div className="stats-grid">
            <div className="stat">
              <div className="num" data-num="2">
                <span data-target="2">0</span>
              </div>
              <div className="stat-label">Disciplinas, un equipo</div>
              <div className="stat-desc">
                Marca y software bajo un mismo techo. Sin intermediarios entre
                quien diseña y quien programa.
              </div>
            </div>
            <div className="stat">
              <div className="num" data-num="100">
                <span data-target="100">0</span>
                <span className="acc">%</span>
              </div>
              <div className="stat-label">Hecho por nosotros</div>
              <div className="stat-desc">
                Diseño y código propios, de principio a fin. Nada tercerizado.
              </div>
            </div>
            <div className="stat">
              <div className="num">0</div>
              <div className="stat-label">Plantillas</div>
              <div className="stat-desc">
                Cada proyecto se construye a la medida, desde cero. Nunca un
                molde reutilizado.
              </div>
            </div>
            <div className="stat">
              <div className="num">∞</div>
              <div className="stat-label">Iteraciones</div>
              <div className="stat-desc">
                Ajustamos las veces que haga falta, hasta que cada detalle quede
                exacto.
              </div>
            </div>
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
            <em>Empecemos hoy.</em>
          </h2>
          <div className="right">
            <p>
              Estamos recibiendo nuevos proyectos. Cuéntanos qué quieres construir
              y empecemos la conversación — sin formularios eternos. La primera
              llamada es gratis y sin compromiso.
            </p>
            <div className="contact-actions">
              <a
                href={WHATSAPP_URL}
                className="cta"
                style={{ opacity: 1 }}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="wa-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
                  </svg>
                </span>
                <span>Escríbenos por WhatsApp</span>
                <span className="arrow">→</span>
              </a>
              <a
                href={`mailto:${EMAIL}`}
                className="cta cta-ghost"
                style={{ opacity: 1 }}
              >
                <span>{EMAIL}</span>
                <span className="arrow">→</span>
              </a>
            </div>
          </div>
        </section>

        <footer>
          <div>© 2026 ZAKUMI Studio · Colombia</div>
          <a
            className="footer-social"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Síguenos en Instagram — @zakumiestudio"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            <span className="footer-handle">@{INSTAGRAM_HANDLE}</span>
          </a>
          <div>v.02 — gsap</div>
        </footer>
      </div>
    </>
  );
}
