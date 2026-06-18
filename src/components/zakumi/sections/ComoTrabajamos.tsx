import { STATS } from "../content";

export function ComoTrabajamos() {
  return (
    <section className="stats-section" id="datos">
      <div className="stats-inner">
        <div className="section-num">03 / Cómo trabajamos</div>
        <div className="stats-intro">
          <h2 className="section-title">
            Tres disciplinas,
            <br />
            <em>un equipo.</em>
          </h2>
          <p className="lead">
            IA · Software · Marca bajo el mismo techo. Sin intermediarios entre
            quien diseña, quien programa y quien despliega los agentes que{" "}
            <em>trabajan por ti 24/7</em>.
          </p>
        </div>

        <div className="stats-grid">
          {STATS.map((stat) => {
            const isNumeric = /^\d+$/.test(stat.num) && Number(stat.num) > 0;
            return (
              <div className="stat" key={stat.label}>
                {isNumeric ? (
                  <div className="num" data-num={stat.num}>
                    <span data-target={stat.num}>0</span>
                    {stat.acc && <span className="acc">{stat.acc}</span>}
                  </div>
                ) : (
                  <div className="num">
                    {stat.num}
                    {stat.acc && <span className="acc">{stat.acc}</span>}
                  </div>
                )}
                <div className="stat-label">{stat.label}</div>
                <div className="stat-desc">{stat.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
