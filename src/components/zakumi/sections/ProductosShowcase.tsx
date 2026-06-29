import Image from "next/image";
import { PRODUCTOS_SHOWCASE } from "../content";

export function ProductosShowcase() {
  return (
    <section className="products" id="producto">
      <div className="product-stage">
        <div className="product-head">
          <span className="section-num">02 / Producto</span>
          <div className="product-dots" aria-hidden>
            {PRODUCTOS_SHOWCASE.map((p, i) => (
              <i key={p.idx} className={`product-dot${i === 0 ? " is-active" : ""}`} />
            ))}
          </div>
        </div>

        <div className="product-track">
          {PRODUCTOS_SHOWCASE.map((p, i) => (
            <article className={`product-block${i === 0 ? " is-active" : ""}`} key={p.idx}>
              <div className="product-panel">
                <span className="product-idx">{`0${p.idx}`}</span>
                <h2 className="section-title">
                  {p.titulo1} <em>{p.tituloEm}</em>
                </h2>
                <p className="product-sub">{p.sub}</p>
                <ul className="product-features">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="product-img-wrap">
                <Image
                  className="product-img"
                  src={p.img}
                  alt={p.alt}
                  fill
                  sizes="(max-width: 720px) 100vw, 50vw"
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
