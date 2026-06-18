"use client";

import React, { useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Hero } from "./sections/Hero";
import { CrmIA } from "./sections/CrmIA";
import { AgentDemo } from "./sections/AgentDemo";
import { ComoTrabajamos } from "./sections/ComoTrabajamos";
import { Filosofia } from "./sections/Filosofia";
import { Proyectos } from "./sections/Proyectos";

gsap.registerPlugin(ScrollTrigger);

export function ZakumiHome() {
  const philosophyLine1 = "IA con criterio humano:".split(" ");
  const philosophyLine2 = ["diseño", "y", "código", "bajo", "el", "mismo"];
  const philosophyEm = ["techo."];
  const philosophyLine3 = ["Sin", "intermediarios."];

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // ——— Hero entrance ———
      gsap.to(".hero-copy-stable", {
        yPercent: -10,
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

      // ——— Marquee velocidad por scroll ———
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

      // ——— Reveals de sección ———
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

      // ——— Stats tiles + contadores ———
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

      // ——— Filosofía por palabras ———
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

      // ——— Marquee "con qué construimos" (tecnologías) ———
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
            .to({}, { duration: 0.7 })
            .set(typing, { display: "none" })
            .set(text, { display: "block" })
            .from(text, { autoAlpha: 0, duration: 0.25, ease: "power2.out" });
        });
      });

      ScrollTrigger.refresh();
    });

    return () => ctx.revert();
  }, []);

  return (
    <>
      <Hero />
      <div className="marquee">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <div className="marquee-item" key={k}>
              <span>Identidad</span><span className="star">✦</span>
              <span>Estrategia</span><span className="star">✦</span>
              <span>Software a medida</span><span className="star">✦</span>
              <span>Producto digital</span><span className="star">✦</span>
              <span>Diseño editorial</span><span className="star">✦</span>
              <span>Sistemas de marca</span><span className="star">✦</span>
            </div>
          ))}
        </div>
      </div>
      <CrmIA />
      <AgentDemo />
      <Proyectos />
      <ComoTrabajamos />
      <Filosofia line1={philosophyLine1} line2={philosophyLine2} em={philosophyEm} line3={philosophyLine3} />
    </>
  );
}
