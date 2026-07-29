"use client";

/**
 * Primitivas de animación compartidas por la home, las páginas de servicio y
 * /contacto.
 *
 * Antes cada isla repetía su propio useLayoutEffect: el CTA magnético estaba
 * escrito tres veces, el reveal y el chat guionizado dos, y los contadores de
 * stats existían en dos implementaciones distintas de la misma lógica (una
 * creaba la barra por JS, la otra usaba un span declarativo). Además
 * `ScrollTrigger.config({ ignoreMobileResize: true })` solo se aplicaba en la
 * home, así que entrar directo a /agentes-ia perdía esa configuración y los
 * pines saltaban al aparecer la barra del navegador en móvil.
 *
 * Todas las funciones están pensadas para llamarse dentro de un
 * `gsap.context(...)`, que se encarga de revertir tweens y ScrollTriggers. Lo
 * único que no gestiona el context son los listeners de DOM, así que las
 * funciones que los añaden devuelven su propio cleanup.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// En móvil, mostrar/ocultar la barra del navegador cambia el viewport y haría
// recalcular (saltar) las secciones fijadas con pin. Lo ignoramos. Vive aquí y
// no en un componente para que aplique en todas las rutas, no solo en la home.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };

/** Selectores que reciben el reveal editorial por wipe de clip-path. */
export const EDITORIAL_REVEAL_TARGETS = [
  ".section-num",
  ".section-title",
  ".stats-intro .lead",
  ".outro h2",
  ".outro .right p",
  ".outro .right .cta",
  ".philosophy .small",
  ".philosophy .signature",
].join(", ");

/**
 * Wipe editorial: el elemento se descubre de izquierda a derecha mientras sube.
 * Es el gesto de entrada de la home y lo que le da el aire de portada impresa.
 */
export function revealEditorial(selector: string = EDITORIAL_REVEAL_TARGETS) {
  gsap.utils.toArray<HTMLElement>(selector).forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: "inset(0 100% 0 0)", y: 30, opacity: 0 },
      {
        clipPath: "inset(0 0% 0 0)",
        y: 0,
        opacity: 1,
        duration: 1.1,
        ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      },
    );
  });
}

/**
 * Reveal por bloque: cada `.reveal` anima sus `.svc-wipe` (wipe) y sus
 * `.reveal-item` (fade + subida escalonada). Lo usan las páginas de servicio y
 * /contacto, donde el contenido llega en bloques y no como piezas sueltas.
 */
export function revealBlocks(root: HTMLElement) {
  gsap.utils.toArray<HTMLElement>(".reveal", root).forEach((block) => {
    const wipes = gsap.utils.toArray<HTMLElement>(".svc-wipe", block);
    const items = gsap.utils.toArray<HTMLElement>(".reveal-item", block);

    if (wipes.length) {
      gsap.fromTo(
        wipes,
        { clipPath: "inset(0 100% 0 0)", y: 24, opacity: 0 },
        {
          clipPath: "inset(0 0% 0 0)",
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "expo.out",
          stagger: 0.12,
          scrollTrigger: { trigger: block, start: "top 82%", once: true },
        },
      );
    }
    if (items.length) {
      gsap.fromTo(
        items,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: { trigger: block, start: "top 82%", once: true },
        },
      );
    }
  });
}

/**
 * CTA magnético: el botón sigue al cursor y vuelve con un rebote elástico.
 * Devuelve el cleanup de los listeners, que `gsap.context` no gestiona.
 */
export function magneticCtas(root?: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];

  gsap.utils.toArray<HTMLElement>(".cta", root).forEach((el) => {
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * 0.25,
        y: (e.clientY - (r.top + r.height / 2)) * 0.35,
        duration: 0.5,
        ease: "power3.out",
      });
    };
    const onLeave = () =>
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    cleanups.push(() => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

/**
 * Stats: número que cuenta hasta `data-num`, etiqueta y descripción en
 * cascada, y la hairline superior que se estira.
 *
 * La barra se busca como `.stat-bar` declarativa y, si no existe, se crea. Así
 * conviven el markup de la home (que no la trae) y el de las páginas de
 * servicio (que sí), sin dos implementaciones.
 */
export function statCounters(root?: HTMLElement) {
  gsap.utils.toArray<HTMLElement>(".stat", root).forEach((statEl) => {
    const numEl = statEl.querySelector<HTMLElement>(".num");
    const trigger = { trigger: statEl, start: "top 85%", once: true } as const;

    gsap
      .timeline({ scrollTrigger: trigger })
      .fromTo(
        numEl,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "expo.out" },
      )
      .fromTo(
        statEl.querySelectorAll(".stat-label, .stat-desc"),
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" },
        "-=0.6",
      );

    let bar = statEl.querySelector<HTMLElement>(".stat-bar");
    if (!bar) {
      bar = document.createElement("span");
      bar.className = "stat-bar";
      statEl.appendChild(bar);
    }
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 0.9,
        ease: "expo.out",
        scrollTrigger: trigger,
      },
    );

    const target = numEl?.getAttribute("data-num");
    const slot = numEl?.querySelector("[data-target]");
    if (!target || !slot) return;

    const isFloat = target.includes(".");
    const counter = { v: 0 };
    gsap.to(counter, {
      v: parseFloat(target),
      duration: 1.6,
      ease: "power2.out",
      scrollTrigger: trigger,
      onUpdate: () => {
        slot.textContent = isFloat
          ? counter.v.toFixed(2)
          : String(Math.floor(counter.v));
      },
    });
  });
}

/**
 * Chat guionizado: cada burbuja entra desde su emisor, muestra los puntos de
 * "escribiendo" y los reemplaza por el texto.
 */
export function scriptedChat(rootSelector: string) {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const msgs = gsap.utils.toArray<HTMLElement>(`${rootSelector} .agent-msg`);
    if (!msgs.length) return;

    const tl = gsap.timeline({
      scrollTrigger: { trigger: rootSelector, start: "top 65%", once: true },
    });

    msgs.forEach((msg) => {
      const typing = msg.querySelector(".agent-typing");
      const text = msg.querySelector<HTMLElement>(".agent-text");
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
}

/**
 * Tiles de un bento que entran en cascada diagonal: el retardo crece por
 * columna y por fila, así el ojo recorre la rejilla en lugar de verla aparecer
 * de golpe.
 */
export function revealTiles(grid: string, tile: string, cols = 2) {
  const tiles = gsap.utils.toArray<HTMLElement>(tile);
  if (!tiles.length) return;

  tiles.forEach((el, i) => {
    gsap.from(el, {
      y: 60,
      opacity: 0,
      duration: 1,
      delay: (i % cols) * 0.1 + Math.floor(i / cols) * 0.08,
      ease: "expo.out",
      scrollTrigger: { trigger: grid, start: "top 82%", once: true },
    });
  });
}

/** Marquee infinito por desplazamiento del track duplicado. */
export function loopMarquee(selector: string, duration = 18) {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const track = document.querySelector(selector);
    if (!track) return;
    gsap.to(track, { xPercent: -50, duration, ease: "none", repeat: -1 });
  });
}

/**
 * Marquee cuya velocidad reacciona al scroll: acelera con la inercia, invierte
 * la dirección al subir y vuelve a su ritmo tras 0.4s.
 */
export function scrollReactiveMarquee(selector: string, duration = 35) {
  const track = document.querySelector(selector);
  if (!track) return;

  const tween = gsap.to(track, {
    x: -(track.scrollWidth / 2),
    duration,
    ease: "none",
    repeat: -1,
  });

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const v = self.getVelocity();
      const speed = gsap.utils.clamp(0.6, 6, 1 + Math.abs(v) / 600);
      gsap.to(tween, {
        timeScale: v < 0 ? -speed : speed,
        duration: 0.4,
        overwrite: true,
      });
      gsap.to(tween, {
        timeScale: 1,
        duration: 1.4,
        delay: 0.4,
        overwrite: "auto",
      });
    },
  });
}

/**
 * Texto que se enciende palabra por palabra según el progreso del scroll.
 * Es el gesto de la sección de filosofía.
 */
export function litWords(triggerSelector: string, wordSelector: string) {
  const words = gsap.utils.toArray<HTMLElement>(
    `${triggerSelector} ${wordSelector}`,
  );
  if (!words.length) return;

  ScrollTrigger.create({
    trigger: triggerSelector,
    start: "top 80%",
    end: "bottom 60%",
    scrub: 0.8,
    onUpdate: (self) => {
      const lit = Math.floor(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle("lit", i <= lit));
    },
  });
}

type PinnedCrossfadeOptions = {
  /** Sección que dispara el pin. */
  trigger: string;
  /** Elemento que se queda fijo en pantalla. */
  pin: string;
  /** Los paneles que se turnan. */
  blocks: string;
  /** Indicadores de posición, opcionales. */
  dots?: string;
  /** Elemento por panel al que se le aplica el parallax de entrada. */
  media?: string;
  /** Prefijo para las clases is-active, por si conviven dos escenarios. */
  root?: HTMLElement;
};

/**
 * Escenario fijado con crossfade entre paneles y snap por unidad.
 *
 * Es el mecanismo del showcase de producto de la home, extraído para poder
 * reusarlo en los casos de uso de las páginas de servicio. Con
 * `prefers-reduced-motion` degrada a bloques apilados que aparecen al entrar,
 * sin pin y sin scrub.
 */
export function pinnedCrossfade(opts: PinnedCrossfadeOptions) {
  const mm = gsap.matchMedia();

  mm.add(
    {
      animate: "(prefers-reduced-motion: no-preference)",
      stacked: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      const { animate } = context.conditions as { animate: boolean };
      const blocks = gsap.utils.toArray<HTMLElement>(opts.blocks, opts.root);
      const dots = opts.dots
        ? gsap.utils.toArray<HTMLElement>(opts.dots, opts.root)
        : [];
      if (blocks.length < 2) return;

      const setActive = (idx: number) => {
        blocks.forEach((b, i) => b.classList.toggle("is-active", i === idx));
        dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
      };

      // Reduced motion: sin pin ni scrub, cada panel aparece al entrar.
      if (!animate) {
        gsap.set(blocks, { autoAlpha: 1 });
        blocks.forEach((b) =>
          gsap.from(b, {
            y: 40,
            autoAlpha: 0,
            duration: 0.9,
            ease: "expo.out",
            scrollTrigger: { trigger: b, start: "top 80%", once: true },
          }),
        );
        return;
      }

      const n = blocks.length;
      gsap.set(blocks, { autoAlpha: 0 });
      gsap.set(blocks[0], { autoAlpha: 1 });
      setActive(0);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: opts.trigger,
          start: "top top",
          end: () => "+=" + window.innerHeight * (n - 1),
          pin: opts.pin,
          scrub: 0.8,
          snap: {
            snapTo: 1 / (n - 1),
            duration: { min: 0.2, max: 0.5 },
            ease: "power1.inOut",
          },
          onUpdate: (self) => setActive(Math.round(self.progress * (n - 1))),
        },
      });

      for (let i = 1; i < n; i++) {
        const at = i - 1; // una transición por unidad de tiempo
        tl.to(blocks[i - 1], { autoAlpha: 0, ease: "none", duration: 1 }, at).fromTo(
          blocks[i],
          { autoAlpha: 0 },
          { autoAlpha: 1, ease: "none", duration: 1 },
          at,
        );

        if (!opts.media) continue;
        const media = blocks[i].querySelector<HTMLElement>(opts.media);
        if (media) {
          tl.fromTo(
            media,
            { yPercent: 8, scale: 1.05 },
            { yPercent: 0, scale: 1, ease: "power1.out", duration: 1 },
            at,
          );
        }
      }
    },
  );
}

/** Parallax del hero de la home: cada capa se mueve a su propia velocidad. */
export function heroParallax() {
  const layers: Array<[string, gsap.TweenVars, number]> = [
    [".hero-copy-stable", { yPercent: -10 }, 0.6],
    [".hero-meta", { yPercent: -25, opacity: 0.4 }, 0.6],
    [".hero-deco", { yPercent: -50 }, 0.8],
  ];

  layers.forEach(([selector, vars, scrub]) => {
    gsap.to(selector, {
      ...vars,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub,
      },
    });
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
}
