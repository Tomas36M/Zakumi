import { CRM } from "../content";

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
        <div className="crm-card">
          Lead nuevo · <b>IA respondió</b>
        </div>
        <div className="crm-card">Seguimiento agendado</div>
        <div className="crm-card">Resumen de conversación</div>
        <div className="crm-counter">
          <span data-target="128">0</span> leads atendidos hoy
        </div>
      </div>
    </section>
  );
}
