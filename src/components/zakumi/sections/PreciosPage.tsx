"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, magneticCtas, revealBlocks } from "@/lib/motion";
import { waLink } from "../contact";
import {
  BROCHURE,
  COMBO_DESTACADO,
  COMBOS,
  cop,
  GRUPOS,
  MENSUALIDAD_ZAK,
  PARA_EMPRESAS,
  REGLAS,
  SUFIJO,
  WA_PRECIOS,
  type Combo,
} from "../precios";

function WaCta({ href, label, ghost }: { href: string; label: string; ghost?: boolean }) {
  return (
    <a
      className={`cta${ghost ? " cta-ghost" : ""}`}
      style={{ opacity: 1 }}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>{label}</span>
      <span className="arrow">→</span>
    </a>
  );
}

function Cifra({ precio, sufijo, grande }: { precio: number; sufijo: string; grande?: boolean }) {
  return (
    <div className={`precios-precio${grande ? " precios-precio-grande" : ""}`}>
      <span className="precios-cifra">{cop(precio)}</span>
      <span className="precios-sufijo">{sufijo}</span>
    </div>
  );
}

/** Tarjeta de combo: el mismo `.plan-card` de las páginas de servicio, con la cifra grande. */
function ComboCard({ combo }: { combo: Combo }) {
  return (
    <div className={`plan-card reveal-item${combo.destacado ? " plan-featured" : ""}`}>
      <h3>{combo.nombre}</h3>
      <p className="plan-tagline">{combo.para}</p>
      <Cifra precio={combo.precio} sufijo="pago único" />
      <ul>
        {combo.incluye.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
      <p className="precios-mensual-nota">
        + {cop(MENSUALIDAD_ZAK)} al mes de Zak desde el segundo mes, sin permanencia.
        {combo.sueltos !== undefined && (
          <>
            {" "}
            <span className="precios-ahorro">
              Ahorras {cop(combo.sueltos - combo.precio)} frente a las piezas sueltas.
            </span>
          </>
        )}
      </p>
      <WaCta href={waLink(combo.waMsg)} label="Quiero este combo" ghost={!combo.destacado} />
    </div>
  );
}

/**
 * /precios — el tarifario público. Un solo bloque de precios en forma de
 * lista (nombre a la izquierda, cifra en Playfair a la derecha), agrupado por
 * cómo se paga: al mes, una vez, desde. Las reglas de cobro van pegadas al
 * lado, como el precio de Academia. Nada de precios inventados: los siete del
 * catálogo salen de src/lib/catalogo.ts.
 */
export function PreciosPage() {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let releaseCtas: (() => void) | undefined;

    const ctx = gsap.context(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        revealBlocks(el);
        releaseCtas = magneticCtas(el);
      }
    }, el);

    requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      releaseCtas?.();
      ctx.revert();
    };
  }, []);

  const destacado = COMBO_DESTACADO;
  const otrosCombos = COMBOS.filter((c) => !c.destacado);

  return (
    <main className="service-view precios-view" ref={rootRef}>
      {/* ——— Hero: la tesis y el combo que más vende ——— */}
      <section className="precios-hero reveal">
        <div className="precios-hero-text">
          <div className="hero-tag reveal-item">
            <span className="line" />
            <span className="dot" />
            <span>Precios · Colombia · pesos</span>
          </div>
          <h1 className="svc-wipe">
            <span>Precios claros.</span>
            <br />
            <em>Alcance a medida.</em>
          </h1>
          <p className="service-lead reveal-item">
            Son precios de entrada para negocios de barrio, no de agencia. Sin permanencia, y se
            prueba antes: le escribes a Zak y ves cómo atiende antes de pagar un peso.
          </p>
          <div className="svc-cta-row reveal-item">
            <WaCta href={WA_PRECIOS} label="Escríbele a Zak" />
            <a className="cta cta-ghost" href="#tarifas" style={{ opacity: 1 }}>
              <span>Ver el tarifario</span>
              <span className="arrow">→</span>
            </a>
            <a
              className="precios-brochure"
              href={BROCHURE}
              target="_blank"
              rel="noopener noreferrer"
            >
              Descargar el brochure (PDF)
            </a>
          </div>
        </div>

        <aside className="precios-destacado reveal-item" aria-label="Combo destacado">
          <span className="precios-destacado-label">Landing + agente de WhatsApp</span>
          <h2>{destacado.nombre}</h2>
          <p className="precios-destacado-para">{destacado.para}</p>
          <Cifra precio={destacado.precio} sufijo="pago único" grande />
          <ul>
            {destacado.incluye.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
          <p className="precios-destacado-nota">
            + {cop(MENSUALIDAD_ZAK)} al mes de Zak desde el segundo mes, sin permanencia.
            {destacado.sueltos !== undefined && (
              <> Ahorras {cop(destacado.sueltos - destacado.precio)} frente a comprar la landing y el montaje por separado.</>
            )}
          </p>
          <WaCta href={waLink(destacado.waMsg)} label="Quiero el plan completo" />
        </aside>
      </section>

      {/* ——— Tarifario ——— */}
      <section className="service-block precios-tarifas reveal" id="tarifas">
        <header className="block-head">
          <span className="section-num svc-wipe">Tarifario</span>
          <h2 className="section-title reveal-item">
            Lo que cuesta <em>cada cosa.</em>
          </h2>
        </header>

        <div className="precios-grid">
          <div className="precios-ledger">
            {/* Grupos como div, no section: el `section { padding: 8rem }` global es para bloques de página. */}
            {GRUPOS.map((g) => (
              <div className="precios-grupo" role="group" key={g.cadencia} aria-labelledby={`cad-${g.cadencia}`}>
                <h3 className="precios-cadencia reveal-item" id={`cad-${g.cadencia}`}>
                  <span>{g.titulo}</span>
                  <small>{g.nota}</small>
                </h3>
                <ul>
                  {g.tarifas.map((t) => (
                    <li className="precios-fila reveal-item" key={t.slug}>
                      <div className="precios-fila-texto">
                        <strong>{t.nombre}</strong>
                        <p>{t.desc}</p>
                      </div>
                      <div className="precios-fila-precio">
                        <Cifra precio={t.precio} sufijo={SUFIJO[t.cadencia]} />
                        {t.montaje !== undefined && (
                          <span className="precios-montaje">
                            + {cop(t.montaje)} de montaje, una sola vez
                          </span>
                        )}
                      </div>
                      <a
                        className="precios-fila-cta"
                        href={waLink(t.waMsg)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Escríbenos por esto <span aria-hidden>→</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <aside className="precios-aside reveal-item" aria-label="Cómo cobramos">
            <span className="precios-aside-label">Cómo cobramos</span>
            <ul>
              {REGLAS.map((r) => (
                <li key={r.titulo}>
                  <strong>{r.titulo}</strong> {r.desc}
                </li>
              ))}
            </ul>
            <WaCta href={WA_PRECIOS} label="No sé qué me conviene" />
            <p className="precios-aside-nota">
              Zak te hace dos preguntas y te dice por dónde empezar. Tomás arma la propuesta con tus
              números.
            </p>
          </aside>
        </div>
      </section>

      {/* ——— Combos ——— */}
      <section className="service-block service-planes reveal" id="combos">
        <header className="block-head">
          <span className="section-num svc-wipe">Combos</span>
          <h2 className="section-title reveal-item">
            Lo que va junto <em>sale mejor.</em>
          </h2>
        </header>
        <div className="planes-grid">
          {otrosCombos.map((c) => (
            <ComboCard combo={c} key={c.slug} />
          ))}
        </div>
        <p className="planes-nota reveal-item">
          Todos los combos traen el montaje de Zak incluido; desde el segundo mes se paga su
          mensualidad de {cop(MENSUALIDAD_ZAK)}, sin permanencia. El plan completo está arriba, en el
          hero.
        </p>
      </section>

      {/* ——— Para empresas ——— */}
      <section className="service-block precios-empresas reveal">
        <header className="block-head">
          <span className="section-num svc-wipe">Para empresas</span>
          <h2 className="section-title reveal-item">
            Lo grande <em>se cotiza.</em>
          </h2>
        </header>
        <ul className="precios-empresas-lista">
          {PARA_EMPRESAS.map((p) => (
            <li className="reveal-item" key={p.nombre}>
              <h3>{p.nombre}</h3>
              <p>{p.desc}</p>
            </li>
          ))}
        </ul>
        <div className="svc-cta-row reveal-item precios-empresas-cta">
          <WaCta
            href={waLink("Hola Zakumi, necesito una cotización para un proyecto grande. ¿Cuándo hablamos?")}
            label="Pedir una cotización"
            ghost
          />
        </div>
      </section>
    </main>
  );
}
