"use client";

import React, { useLayoutEffect } from "react";
import {
  gsap,
  ScrollTrigger,
  heroParallax,
  litWords,
  loopMarquee,
  magneticCtas,
  pinnedCrossfade,
  revealEditorial,
  revealTiles,
  scriptedChat,
  scrollReactiveMarquee,
  statCounters,
} from "@/lib/motion";
import { Hero } from "./sections/Hero";
import { ProductosShowcase } from "./sections/ProductosShowcase";
import { AgentDemo } from "./sections/AgentDemo";
import { ComoTrabajamos } from "./sections/ComoTrabajamos";
import { Filosofia } from "./sections/Filosofia";
import { Proyectos } from "./sections/Proyectos";
import { ContactoSection } from "./sections/ContactoSection";

export function ZakumiHome() {
  const philosophyLine1 = "IA con criterio humano:".split(" ");
  const philosophyLine2 = ["diseño", "y", "código", "bajo", "el", "mismo"];
  const philosophyEm = ["techo."];
  const philosophyLine3 = ["Sin", "intermediarios."];

  useLayoutEffect(() => {
    let releaseCtas: (() => void) | undefined;

    const ctx = gsap.context(() => {
      heroParallax();
      scrollReactiveMarquee(".marquee-track");
      revealEditorial();
      revealTiles(".showcase-grid", ".show-tile");
      statCounters();
      litWords(".philosophy", ".phil-word");
      releaseCtas = magneticCtas();

      // Producto: escenario fijado con crossfade (Landings · CRM · Ecommerce).
      pinnedCrossfade({
        trigger: ".products",
        pin: ".product-stage",
        blocks: ".products .product-block",
        dots: ".products .product-dot",
        media: ".product-img-wrap",
      });

      loopMarquee(".tecnologias-track", 18);
      scriptedChat(".agent-demo");

      ScrollTrigger.refresh();
    });

    return () => {
      releaseCtas?.();
      ctx.revert();
    };
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
      <ProductosShowcase />
      <AgentDemo />
      <Proyectos />
      <ComoTrabajamos />
      <Filosofia line1={philosophyLine1} line2={philosophyLine2} em={philosophyEm} line3={philosophyLine3} />
      <ContactoSection />
    </>
  );
}
