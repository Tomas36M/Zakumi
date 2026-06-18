import Image from "next/image";
import { PROYECTOS, TECNOLOGIAS } from "../content";

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
        <div className="small">— con qué construimos —</div>
        <div className="marquee">
          <div className="marquee-track tecnologias-track">
            {[...TECNOLOGIAS, ...TECNOLOGIAS].map((t, i) => (
              <span className="marquee-item" key={i}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
