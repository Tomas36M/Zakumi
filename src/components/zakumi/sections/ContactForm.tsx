"use client";

import { useState } from "react";
import { waLink, EMAIL } from "../contact";

const OPCIONES_SERVICIO = [
  "Agentes de IA",
  "Software & plataformas",
  "Marca & contenido",
  "Otro / aún no estoy seguro",
];

const RAZONES = [
  "Propuesta clara, con alcance y precio",
  "Sin compromiso ni letra pequeña",
  "Te respondemos el mismo día hábil",
];

const WaGlyph = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
    <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
  </svg>
);

/**
 * Formulario de contacto sin backend: arma un mensaje con los campos y abre
 * WhatsApp. La validación se marca en `blur` (no en cada tecla) porque el
 * navegador considera `:invalid` un campo requerido vacío desde el primer
 * render, y pintarlo en rojo antes de que lo toquen es ruido.
 */
export function ContactForm() {
  const [nombre, setNombre] = useState("");
  const [servicio, setServicio] = useState(OPCIONES_SERVICIO[0]);
  const [mensaje, setMensaje] = useState("");
  const [nombreTouched, setNombreTouched] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const nombreInvalido = nombreTouched && nombre.trim().length === 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNombreTouched(true);
    if (nombre.trim().length === 0) return;

    const partes = [
      `Hola Zakumi, soy ${nombre.trim()}.`,
      `Me interesa: ${servicio}.`,
      mensaje.trim(),
    ].filter(Boolean);
    window.open(waLink(partes.join(" ")), "_blank", "noopener,noreferrer");
    setEnviado(true);
  };

  return (
    <section className="contact-form-section reveal" aria-labelledby="cf-title">
      <div className="cf-grid">
        <aside className="cf-aside">
          <span className="section-num svc-wipe">04 / Cuéntanos</span>
          <h2 id="cf-title" className="section-title reveal-item">
            Cuéntanos qué <em>necesitas.</em>
          </h2>
          <p className="cf-aside-lead reveal-item">
            Entre más contexto nos des, más precisa será la propuesta. Al enviar se abre WhatsApp con tu mensaje
            listo — tú solo confirmas.
          </p>
          <ul className="cf-reasons reveal-item">
            {RAZONES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <dl className="cf-info reveal-item">
            <div>
              <dt>Escríbenos</dt>
              <dd>
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>Lun–Vie · 8:00–18:00 (COL)</dd>
            </div>
            <div>
              <dt>Dónde</dt>
              <dd>Colombia · trabajamos en remoto</dd>
            </div>
          </dl>
        </aside>

        <form className="contact-form reveal-item" onSubmit={onSubmit} noValidate>
          <div className="cf-field">
            <label htmlFor="cf-nombre">Nombre</label>
            <input
              id="cf-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={() => setNombreTouched(true)}
              placeholder="Tu nombre"
              autoComplete="name"
              required
              aria-invalid={nombreInvalido}
              aria-describedby="cf-nombre-error"
              {...(nombreTouched ? { "data-touched": "" } : {})}
            />
            <p className="cf-error" id="cf-nombre-error" aria-live="polite">
              {nombreInvalido ? "Dinos cómo te llamas para saber a quién escribimos." : ""}
            </p>
          </div>

          <div className="cf-field">
            <label htmlFor="cf-servicio">¿Qué necesitas?</label>
            <div className="cf-select">
              <select id="cf-servicio" value={servicio} onChange={(e) => setServicio(e.target.value)}>
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
              rows={5}
              placeholder="¿Qué tienes en mente?"
            />
          </div>

          <button type="submit" className="cta" style={{ opacity: 1 }}>
            <span className="wa-icon" aria-hidden>
              <WaGlyph />
            </span>
            <span>Enviar por WhatsApp</span>
            <span className="arrow">→</span>
          </button>

          {/* Antes el submit abría una pestaña y no pasaba nada más: si el
              navegador bloqueaba el popup, el usuario no tenía señal alguna. */}
          {enviado && (
            <p className="cf-status" role="status">
              <span className="cf-status-dot" aria-hidden />
              Abrimos WhatsApp con tu mensaje. Si no se abrió, revisa el bloqueo de ventanas emergentes.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
