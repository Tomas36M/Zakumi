"use client";

import React, { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/components/zakumi/contact";
import { SERVICIOS, SERVICE_SLUGS } from "@/components/zakumi/services";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const TWEAK_DEFAULTS = { heroSize: 8.5, bgMode: "full" as const, accent: "#DB5227" };

const NAV_ITEMS = [
  ...SERVICE_SLUGS.map((s) => ({ href: `/${s}`, label: SERVICIOS[s].nav })),
  { href: "/contacto", label: "Contacto" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [menuOpen, setMenuOpen] = React.useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // ——— CSS vars: --hero-size / --orange / bg-* ———
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
      const mode = TWEAK_DEFAULTS.bgMode as string;
      bg.classList.toggle("bg-full", mode === "full");
      bg.classList.toggle("bg-mix", mode === "mix");
    }

    return () => mq.removeEventListener("change", onBreakpoint);
  }, []);

  // ——— Menú móvil ———
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

  // ——— ScrollTrigger refresh on route change ———
  useEffect(() => {
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [pathname]);

  // ——— GSAP: cortina (solo home), barra de progreso, cursor, smooth-scroll ———
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Cortina — solo en home
      if (isHome) {
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

          tl.from(
            ".nav-logo a",
            {
              yPercent: 110,
              duration: 0.9,
              ease: "expo.out",
            },
            "-=0.7",
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
          );
        } else {
          tl.from(
            ".nav-logo a",
            {
              yPercent: 110,
              duration: 0.9,
              ease: "expo.out",
            },
            0,
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
          );
        }
      }

      ScrollTrigger.create({
        start: "top -50",
        end: 99999,
        toggleClass: { className: "scrolled", targets: "nav" },
      });

      // Barra de progreso
      gsap.to("#scroll-fill", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
      });

      // Smooth-scroll de anclas
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
    });

    return () => ctx.revert();
  }, [isHome]);

  // ——— Cursor ring/dot ———
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

    const targets = document.querySelectorAll("a, button, .cta");
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

  return (
    <>
      <div className="bg-base bg-full" id="bg" />
      <div className="grain" />

      {isHome && (
        <div className="curtain" id="curtain">
          <div className="curtain-panel" id="curtain-panel" />
          <div className="curtain-inner"><span>ZAKUMI</span><span className="dot" /><span>ESTUDIO</span></div>
          <div className="curtain-label">CARGANDO · MMXXVI</div>
          <div className="curtain-counter" id="curtain-counter">00</div>
        </div>
      )}

      <div className="scroll-progress"><div className="fill" id="scroll-fill" /></div>

      <div id="app">
        <div className="cursor-ring" ref={ringRef} />
        <div className="cursor-dot" ref={dotRef} />

        <nav className={menuOpen ? "nav-menu-open" : undefined}>
          <div className="nav-logo">
            <Link href="/">ZAKUMI<span style={{ color: "var(--orange)" }}>.</span></Link>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </div>
          <button type="button" className={`nav-toggle${menuOpen ? " is-open" : ""}`}
            aria-expanded={menuOpen} aria-controls="zakumi-mobile-nav" onClick={() => setMenuOpen((o) => !o)}>
            <span className="sr-only">{menuOpen ? "Cerrar menú" : "Abrir menú"}</span>
            <span className="nav-toggle-bars" aria-hidden><span /><span /><span /></span>
          </button>
        </nav>

        <div id="zakumi-mobile-nav" className={`nav-overlay${menuOpen ? " is-open" : ""}`} aria-hidden={!menuOpen}>
          <div className="nav-overlay-backdrop" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="nav-overlay-panel">
            <div className="nav-overlay-heading">Navegación</div>
            {NAV_ITEMS.map(({ href, label }) => (
              <Link key={`m-${href}`} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>
            ))}
          </div>
        </div>

        {children}

        <footer>
          <div>© 2026 ZAKUMI Studio · Colombia</div>
          <a className="footer-social" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
            aria-label={`Síguenos en Instagram — @${INSTAGRAM_HANDLE}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            <span className="footer-handle">@{INSTAGRAM_HANDLE}</span>
          </a>
          <div>IA · Software · Marca</div>
        </footer>
      </div>
    </>
  );
}
