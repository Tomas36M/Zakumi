import Image from "next/image";

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
            Dos caminos.
            <br />
            <em>Un estudio.</em>
          </h2>
          <p className="servicios-lead">
            No hacemos de todo. Hacemos dos cosas — y las hacemos bien:{" "}
            <em>marcas que se recuerdan</em> y <em>software que funciona</em>.
            Bajo el mismo techo, el mismo equipo, sin traspasos perdidos
            entre el diseño y el código.
          </p>
          <ul className="servicios-tags">
            <li>Identidad</li>
            <li>Estrategia</li>
            <li>Diseño de producto</li>
            <li>Frontend</li>
            <li>Backend</li>
            <li>Sin handoffs</li>
          </ul>
        </div>
        <figure className="servicios-visual">
          <div className="servicios-visual-frame">
            <Image
              src="/work/zk-servicios.webp"
              alt="Marca y software en un mismo escritorio: identidad impresa junto a una laptop con código"
              fill
              sizes="(max-width: 900px) 100vw, 46vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <figcaption>Marca a un lado. Software al otro. El mismo equipo.</figcaption>
        </figure>
      </div>

      <div className="services">
        <div
          className={`service${activeService === 0 ? " active" : ""}`}
          onMouseEnter={() => onMouseEnter(0)}
          onMouseLeave={onMouseLeave}
        >
          <div className="service-arrow">↗</div>
          <div>
            <div className="service-num">— I.</div>
            <h3>
              Identidad
              <br />
              <em>de marca.</em>
            </h3>
            <p>
              Construimos marcas que se reconocen en una sola línea. Sistemas visuales precisos:
              tipografía, color, voz, aplicación. Lo justo. Nada más.
            </p>
          </div>
          <div className="service-meta">
            <div className="service-meta-row">
              <span className="k">Entregables</span>
              <span className="v">Sistema · Manual · Activos</span>
            </div>
            <div className="service-meta-row">
              <span className="k">Equipo</span>
              <span className="v">Diseño + dirección dedicada</span>
            </div>
            <div className="service-meta-row">
              <span className="k">Inversión</span>
              <span className="v">A medida · Propuesta sin compromiso</span>
            </div>
          </div>
        </div>

        <div
          className={`service${activeService === 1 ? " active" : ""}`}
          onMouseEnter={() => onMouseEnter(1)}
          onMouseLeave={onMouseLeave}
        >
          <div className="service-arrow">↗</div>
          <div>
            <div className="service-num">— II.</div>
            <h3>
              Software
              <br />
              <em>a medida.</em>
            </h3>
            <p>
              Producto digital end-to-end. Desde el primer prototipo hasta la versión 3.0. Diseño y
              código bajo el mismo techo, sin handoffs perdidos.
            </p>
          </div>
          <div className="service-meta">
            <div className="service-meta-row">
              <span className="k">Stack</span>
              <span className="v">React · TypeScript · Postgres</span>
            </div>
            <div className="service-meta-row">
              <span className="k">Equipo</span>
              <span className="v">Diseño y código, mismo techo</span>
            </div>
            <div className="service-meta-row">
              <span className="k">Inversión</span>
              <span className="v">A medida · Propuesta sin compromiso</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
