import Image from "next/image";
import { PILARES } from "../content";

interface ServiciosProps {
  activeService: number | null;
  onMouseEnter: (index: number) => void;
  onMouseLeave: () => void;
}

export function Servicios({ activeService, onMouseEnter, onMouseLeave }: ServiciosProps) {
  return (
    <section id="servicios" className="zakumi-servicios-section">
      <div className="servicios-head">
        <div className="servicios-head-text">
          <div className="section-num">01 / Servicios</div>
          <h2 className="section-title">
            Tres pilares.
            <br />
            <em>Un estudio.</em>
          </h2>
          <p className="servicios-lead">
            IA & Automatización · Software & Plataformas · Marca & Contenido.{" "}
            Tres disciplinas bajo el mismo techo, el mismo equipo,{" "}
            <em>sin traspasos perdidos</em> entre lo que piensas, lo que ves y lo que funciona.
          </p>
          <ul className="servicios-tags">
            <li>Agentes de IA</li>
            <li>Software a medida</li>
            <li>Identidad visual</li>
            <li>Automatización</li>
            <li>Contenido</li>
            <li>Sin handoffs</li>
          </ul>
        </div>
        <figure className="servicios-visual">
          <div className="servicios-visual-frame">
            <Image
              src="/work/zk-servicios.webp"
              alt="IA, software y marca en un mismo escritorio: tecnología e identidad construidas por el mismo equipo"
              fill
              sizes="(max-width: 900px) 100vw, 46vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <figcaption>IA a un lado. Marca al otro. El mismo equipo.</figcaption>
        </figure>
      </div>

      <div className="services">
        {PILARES.map((p, i) => (
          <div
            key={p.titulo}
            className={`service${activeService === i ? " active" : ""}`}
            onMouseEnter={() => onMouseEnter(i)}
            onMouseLeave={onMouseLeave}
          >
            <div className="service-arrow">↗</div>
            <div>
              <div className="service-num">{p.num}</div>
              <h3>{p.titulo}</h3>
              <p>{p.desc}</p>
            </div>
            <div className="service-meta">
              {p.tags.map((t) => (
                <div className="service-meta-row" key={t}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
