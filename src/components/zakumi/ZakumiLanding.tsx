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
import { Hero } from "./sections/Hero";
import { Servicios } from "./sections/Servicios";
import { CrmIA } from "./sections/CrmIA";
import { AgentDemo } from "./sections/AgentDemo";
import { ComoTrabajamos } from "./sections/ComoTrabajamos";
import { Filosofia } from "./sections/Filosofia";
import { Contacto } from "./sections/Contacto";
import { Proyectos } from "./sections/Proyectos";

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

      // ——— Burbuja de chat: animación de escritura ———
      const bubble = document.querySelector(".hero-chat-bubble");
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const typing = bubble?.querySelector(".hero-chat-typing");
        const text = bubble?.querySelector(".hero-chat-text") as HTMLElement | null;
        if (!typing || !text) return;
        const tl = gsap.timeline({ delay: 1.6 });
        tl.to(typing, { duration: 1.1 })          // "escribe"
          .set(typing, { display: "none" })
          .set(text, { display: "inline" })
          .from(text, { autoAlpha: 0, y: 6, duration: 0.4 });
      });

      // ——— CRM con IA: ensamblado de tarjetas + contador ———
      const mmCrm = gsap.matchMedia();
      mmCrm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { reduced } = context.conditions as { motion: boolean; reduced: boolean };
          const crmCards = gsap.utils.toArray<HTMLElement>(".crm-mock .crm-card");
          const counterEl = document.querySelector(".crm-counter [data-target]") as HTMLElement | null;

          if (reduced) {
            // Estado final inmediato: tarjetas visibles, número en valor final
            if (crmCards.length) gsap.set(crmCards, { autoAlpha: 1, y: 0 });
            if (counterEl) {
              const target = Number(counterEl.getAttribute("data-target"));
              counterEl.textContent = String(target);
            }
            return;
          }

          if (crmCards.length) {
            gsap.from(crmCards, {
              scrollTrigger: { trigger: ".crm-mock", start: "top 75%", once: true },
              y: 24,
              autoAlpha: 0,
              stagger: 0.12,
              duration: 0.5,
              ease: "power3.out",
            });
          }

          if (counterEl) {
            const target = Number(counterEl.getAttribute("data-target"));
            const obj = { v: 0 };
            ScrollTrigger.create({
              trigger: ".crm-counter",
              start: "top 80%",
              once: true,
              onEnter: () =>
                gsap.to(obj, {
                  v: target,
                  duration: 1.4,
                  ease: "power1.out",
                  onUpdate: () => {
                    counterEl.textContent = String(Math.round(obj.v));
                  },
                }),
            });
          }
        },
      );

      // ——— Marquee "con qué construimos" ———
      const mmTech = gsap.matchMedia();
      mmTech.add("(prefers-reduced-motion: no-preference)", () => {
        const techTrack = document.querySelector(".tecnologias-track");
        if (techTrack) {
          gsap.to(techTrack, {
            xPercent: -50,
            duration: 18,
            ease: "none",
            repeat: -1,
          });
        }
      });

      // ——— Demo del agente: chat guionizado con typing → texto ———
      const mmAgent = gsap.matchMedia();
      mmAgent.add("(prefers-reduced-motion: no-preference)", () => {
        const msgs = gsap.utils.toArray<HTMLElement>(".agent-demo .agent-msg");
        if (!msgs.length) return;
        const tl = gsap.timeline({
          scrollTrigger: { trigger: ".agent-demo", start: "top 65%", once: true },
        });
        msgs.forEach((msg) => {
          const typing = msg.querySelector(".agent-typing");
          const text = msg.querySelector(".agent-text") as HTMLElement | null;
          tl.set(msg, { autoAlpha: 1 })
            .from(msg, {
              y: 14,
              scale: 0.96,
              transformOrigin: msg.classList.contains("is-cliente")
                ? "right bottom"
                : "left bottom",
              duration: 0.3,
              ease: "power3.out",
            })
            .to({}, { duration: 0.7 })           // "escribiendo…"
            .set(typing, { display: "none" })
            .set(text, { display: "block" })
            .from(text, { autoAlpha: 0, duration: 0.25, ease: "power2.out" });
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

  const philosophyLine1 = "IA con criterio humano:".split(" ");
  const philosophyLine2 = ["diseño", "y", "código", "bajo", "el", "mismo"];
  const philosophyEm = ["techo."];
  const philosophyLine3 = ["Sin", "intermediarios."];

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

        <Hero />

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

        <Servicios
          activeService={activeService}
          onMouseEnter={setActiveService}
          onMouseLeave={() => setActiveService(null)}
        />

        <CrmIA />

        <AgentDemo />

        <Proyectos />

        <ComoTrabajamos />

        <Filosofia
          line1={philosophyLine1}
          line2={philosophyLine2}
          em={philosophyEm}
          line3={philosophyLine3}
        />

        <Contacto />
      </div>
    </>
  );
}
