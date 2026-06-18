export function ComoTrabajamos() {
  return (
    <section className="stats-section" id="datos">
      <div className="stats-inner">
        <div className="section-num">03 / Cómo trabajamos</div>
        <div className="stats-intro">
          <h2 className="section-title">
            Sin letra chica.
            <br />
            <em>Solo compromisos.</em>
          </h2>
          <p className="lead">
            Somos un estudio joven, y eso es una ventaja: trabajamos con{" "}
            <em>obsesión</em>, sin <em>plantillas</em> y cuidamos cada
            proyecto como si fuera el nuestro.
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <div className="num" data-num="2">
              <span data-target="2">0</span>
            </div>
            <div className="stat-label">Disciplinas, un equipo</div>
            <div className="stat-desc">
              Marca y software bajo un mismo techo. Sin intermediarios entre
              quien diseña y quien programa.
            </div>
          </div>
          <div className="stat">
            <div className="num" data-num="100">
              <span data-target="100">0</span>
              <span className="acc">%</span>
            </div>
            <div className="stat-label">Hecho por nosotros</div>
            <div className="stat-desc">
              Diseño y código propios, de principio a fin. Nada tercerizado.
            </div>
          </div>
          <div className="stat">
            <div className="num">0</div>
            <div className="stat-label">Plantillas</div>
            <div className="stat-desc">
              Cada proyecto se construye a la medida, desde cero. Nunca un
              molde reutilizado.
            </div>
          </div>
          <div className="stat">
            <div className="num">∞</div>
            <div className="stat-label">Iteraciones</div>
            <div className="stat-desc">
              Ajustamos las veces que haga falta, hasta que cada detalle quede
              exacto.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
