import React from "react";

interface FilosofiaProps {
  line1: string[];
  line2: string[];
  em: string[];
  line3: string[];
  /** Eyebrow. En la home es "— filosofía —"; en servicios, "— manifiesto —". */
  label?: string;
  /** Firma de cierre. Se omite pasando null. */
  signature?: string | null;
  /** El id solo debe existir una vez por página; las rutas de servicio lo omiten. */
  id?: string;
}

/**
 * Beat de manifiesto: las palabras se encienden según el progreso del scroll
 * (ver `litWords` en @/lib/motion). Es el único momento de la página que no
 * informa, solo afirma, y por eso rompe la sucesión de bloques.
 */
export function Filosofia({
  line1,
  line2,
  em,
  line3,
  label = "— filosofía —",
  signature = "— ZKM Studio",
  id = "filosofia",
}: FilosofiaProps) {
  return (
    <section className="philosophy" {...(id ? { id } : {})}>
      <div className="small">{label}</div>
      <p className="big">
        {line1.map((w, i) => (
          <React.Fragment key={`a${i}`}>
            <span className="phil-word">{w}</span>{" "}
          </React.Fragment>
        ))}
        <br />
        {line2.map((w, i) => (
          <React.Fragment key={`b${i}`}>
            <span className="phil-word">{w}</span>{" "}
          </React.Fragment>
        ))}
        <em>
          <span className="phil-word">{em[0]}</span>
        </em>{" "}
        {line3.map((w, i) => (
          <React.Fragment key={`c${i}`}>
            <span className="phil-word">{w}</span>
            {i < line3.length - 1 ? " " : ""}
          </React.Fragment>
        ))}
      </p>
      {signature && <p className="signature">{signature}</p>}
    </section>
  );
}
