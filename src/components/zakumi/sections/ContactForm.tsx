"use client";

import { useState } from "react";
import { waLink } from "../contact";

const OPCIONES_SERVICIO = [
  "Agentes de IA",
  "Software & plataformas",
  "Marca & contenido",
  "Otro / aún no estoy seguro",
];

/**
 * Formulario de contacto sin backend: arma un mensaje con los campos y abre WhatsApp.
 */
export function ContactForm() {
  const [nombre, setNombre] = useState("");
  const [servicio, setServicio] = useState(OPCIONES_SERVICIO[0]);
  const [mensaje, setMensaje] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const partes = [
      `Hola Zakumi, soy ${nombre.trim() || "—"}.`,
      `Me interesa: ${servicio}.`,
      mensaje.trim(),
    ].filter(Boolean);
    window.open(waLink(partes.join(" ")), "_blank", "noopener,noreferrer");
  };

  return (
    <section className="contact-form-section reveal" aria-labelledby="cf-title">
      <header className="cf-head">
        <span className="section-num">Cuéntanos</span>
        <h2 id="cf-title">
          Escríbenos y te respondemos <em>por WhatsApp.</em>
        </h2>
      </header>

      <form className="contact-form" onSubmit={onSubmit}>
        <div className="cf-field">
          <label htmlFor="cf-nombre">Nombre</label>
          <input
            id="cf-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
            required
          />
        </div>

        <div className="cf-field">
          <label htmlFor="cf-servicio">¿Qué necesitas?</label>
          <div className="cf-select">
            <select
              id="cf-servicio"
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
            >
              {OPCIONES_SERVICIO.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <span className="cf-select-arrow" aria-hidden>
              ↓
            </span>
          </div>
        </div>

        <div className="cf-field cf-field-full">
          <label htmlFor="cf-mensaje">Cuéntanos un poco</label>
          <textarea
            id="cf-mensaje"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={4}
            placeholder="¿Qué tienes en mente?"
          />
        </div>

        <button type="submit" className="cta" style={{ opacity: 1 }}>
          <span className="wa-icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
            </svg>
          </span>
          <span>Enviar por WhatsApp</span>
          <span className="arrow">→</span>
        </button>
      </form>
    </section>
  );
}
