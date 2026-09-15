"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollToPlugin from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Flag de módulo: la cortina de intro solo debe correr una vez por sesión (no en cada regreso a home via SPA).
let curtainPlayed = false;

/** Entrada del nav: logo y enlaces suben a su sitio. */
function navIntro(tl: gsap.core.Timeline, at: gsap.Position) {
  tl.from(".nav-logo a", { yPercent: 110, duration: 0.9, ease: "expo.out" }, at).from(
    ".nav-links a",
    { yPercent: 100, opacity: 0, stagger: 0.06, duration: 0.7, ease: "expo.out" },
    "<+0.1",
  );
}

/**
 * Todo lo del sitio público que depende de GSAP: cortina, barra de
 * progreso, cursor, smooth-scroll de anclas, intro del nav. No pinta nada —
 * anima los nodos que SiteShell ya renderizó (#curtain, #scroll-fill,
 * .cursor-ring/.cursor-dot), así el markup SSR es idéntico con o sin este
 * componente. SiteShell lo carga con next/dynamic (sin SSR) y NO lo monta
 * en las páginas legales: no llevan animación y no tienen por qué pagar
 * ~44KB gzip de GSAP. El toggle de `nav.scrolled` NO vive acá a propósito:
 * es vanilla en SiteShell, para que funcione también donde esto no se monta.
 */
export function SiteMotion({ isHome }: { isHome: boolean }) {
  const pathname = usePathname();

  // ——— ScrollTrigger refresh al cambiar de breakpoint y de ruta ———
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");
    const onBreakpoint = () => {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    mq.addEventListener("change", onBreakpoint);
    return () => mq.removeEventListener("change", onBreakpoint);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [pathname]);

  // ——— GSAP: cortina (solo home), barra de progreso, smooth-scroll ———
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Cortina — solo en home, y solo la primera vez por sesión
      if (isHome) {
        if (curtainPlayed) {
          // Regreso SPA a home: ocultar la cortina sin animarla de nuevo. Puede
          // no existir: SiteShell solo la pinta si el documento arrancó en home
          // (y un gsap.set sobre un selector vacío avisa por consola).
          const cortina = document.getElementById("curtain");
          if (cortina) gsap.set(cortina, { display: "none" });
        } else {
          curtainPlayed = true;
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

            navIntro(tl, "-=0.7");
          } else {
            navIntro(tl, 0);
          }
        }
      } else {
        // Deep-link a una vista interna. La cortina es un gesto de carga
        // inicial: dispararla al volver a home por SPA parecería una recarga,
        // así que se marca como vista. Pero la página no debe abrir en frío —
        // el nav entra igual, sin cortina.
        curtainPlayed = true;
        // #curtain solo se renderiza en la home (y solo si el documento
        // arrancó ahí), así que no se toca aquí.
        navIntro(gsap.timeline(), 0);
      }

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
    const dot = document.querySelector<HTMLDivElement>(".cursor-dot");
    const ring = document.querySelector<HTMLDivElement>(".cursor-ring");
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

  return null;
}
