import { CRM } from "../content";

const SPARK = [38, 52, 46, 60, 54, 68, 50, 64, 72, 58, 80, 70, 88, 76];

const LEADS = [
  { ini: "M", nombre: "María Restrepo", canal: "WhatsApp", estado: "IA respondió", cls: "is-ia" },
  { ini: "A", nombre: "Andrés Gómez", canal: "WhatsApp", estado: "Agendado", cls: "is-cita" },
  { ini: "V", nombre: "Valentina Ríos", canal: "Telegram", estado: "Nuevo", cls: "is-nuevo" },
  { ini: "C", nombre: "Camilo Ortiz", canal: "WhatsApp", estado: "Ganado", cls: "is-won" },
];

export function CrmIA() {
  return (
    <section className="crm" id="crm">
      <div className="crm-text">
        <div className="section-num">02 / Producto</div>
        <h2 className="section-title">
          {CRM.titulo1} <em>{CRM.tituloEm}</em>
        </h2>
        <p className="crm-sub">{CRM.sub}</p>
        <ul className="crm-features">
          {CRM.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="crm-nota">{CRM.nota}</p>
      </div>

      <div className="crm-mock" aria-hidden>
        <div className="crm-win">
          <div className="crm-bar">
            <span className="crm-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="crm-bar-title">Zakumi CRM · Pipeline</span>
            <span className="crm-live">
              <i />
              En vivo
            </span>
          </div>

          <div className="crm-body">
            <div className="crm-kpis">
              <div className="crm-card crm-kpi crm-counter">
                <span className="crm-kpi-label">Leads hoy</span>
                <span className="crm-kpi-num">
                  <span data-target="128">0</span>
                </span>
                <span className="crm-kpi-trend up">▲ 18%</span>
              </div>
              <div className="crm-card crm-kpi">
                <span className="crm-kpi-label">Resueltos por IA</span>
                <span className="crm-kpi-num">
                  94<i>%</i>
                </span>
                <span className="crm-kpi-trend up">▲ 6%</span>
              </div>
              <div className="crm-card crm-kpi">
                <span className="crm-kpi-label">Conversión</span>
                <span className="crm-kpi-num">
                  31<i>%</i>
                </span>
                <span className="crm-kpi-trend">resp. 8s</span>
              </div>
            </div>

            <div className="crm-table">
              <div className="crm-thead">
                <span>Lead</span>
                <span>Canal</span>
                <span>Estado</span>
              </div>
              {LEADS.map((l) => (
                <div className="crm-card crm-trow" key={l.nombre}>
                  <span className="crm-lead">
                    <i className="crm-av">{l.ini}</i>
                    {l.nombre}
                  </span>
                  <span className={`crm-chan ${l.canal === "Telegram" ? "is-tg" : "is-wa"}`}>
                    {l.canal}
                  </span>
                  <span className={`crm-pill ${l.cls}`}>{l.estado}</span>
                </div>
              ))}
            </div>

            <div className="crm-spark">
              {SPARK.map((h, i) => (
                <i
                  key={i}
                  className={i >= SPARK.length - 3 ? "hi" : ""}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="crm-spark-cap">Leads · últimos 14 días</div>
          </div>
        </div>
      </div>
    </section>
  );
}
