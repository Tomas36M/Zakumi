import React from "react";

interface FilosofiaProps {
  line1: string[];
  line2: string[];
  em: string[];
  line3: string[];
}

export function Filosofia({ line1, line2, em, line3 }: FilosofiaProps) {
  return (
    <section className="philosophy" id="filosofia">
      <div className="small">— filosofía —</div>
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
      <p className="signature">— ZKM Studio</p>
    </section>
  );
}
