import Image from "next/image";
import {
  siNextdotjs,
  siReact,
  siTypescript,
  siPostgresql,
  siTailwindcss,
  siGreensock,
  siAnthropic,
  siGooglegemini,
  siN8n,
} from "simple-icons";
import { PROYECTOS, TECNOLOGIAS } from "../content";

// Logos monocromáticos por tecnología (OpenAI no está en simple-icons → solo texto).
const LOGOS: Record<string, { path: string } | undefined> = {
  "Next.js": siNextdotjs,
  React: siReact,
  TypeScript: siTypescript,
  Postgres: siPostgresql,
  Tailwind: siTailwindcss,
  GSAP: siGreensock,
  Anthropic: siAnthropic,
  Gemini: siGooglegemini,
  n8n: siN8n,
};

export function Proyectos() {
  return (
    <section className="showcase" id="proyectos">
      <div className="section-num">03 / Proyectos</div>
      <h2 className="section-title">Lo que construimos.</h2>
      <div className="showcase-grid">
        {PROYECTOS.map((p) => (
          <figure className="show-tile" key={p.title}>
            <div className="show-mock">
              <Image
                src={p.img}
                alt={p.alt}
                fill
                className="show-img"
                sizes="(max-width: 720px) 100vw, 33vw"
              />
            </div>
            <figcaption>
              <span className="show-tag">{p.tag}</span>
              <span className="show-title">{p.title}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="tecnologias">
        <div className="small">Con qué construimos</div>
        <div className="marquee">
          <div className="marquee-track tecnologias-track">
            {[...TECNOLOGIAS, ...TECNOLOGIAS].map((t, i) => {
              const logo = LOGOS[t];
              return (
                <span className="tech-chip" key={i}>
                  {logo && (
                    <svg
                      className="tech-logo"
                      role="img"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path d={logo.path} />
                    </svg>
                  )}
                  <span className="tech-name">{t}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
