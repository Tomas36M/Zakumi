import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo ZAKUMI recolecta, usa y protege tus datos en el sitio y en sus agentes de WhatsApp, y cómo pedir su eliminación.",
  alternates: { canonical: "/privacidad" },
};

// Página legal: texto plano del sitio, sin animaciones. Existe porque es lo
// correcto Y porque Meta la exige para las apps de WhatsApp en producción.
export default function PrivacidadPage() {
  return (
    <section className="legal">
      <h1>Política de privacidad</h1>
      <p className="legal-meta">ZAKUMI Estudio · Colombia · Vigente desde el 17 de agosto de 2026</p>

      <h2>Quiénes somos</h2>
      <p>
        ZAKUMI es un estudio de agentes de inteligencia artificial, software y
        marca con sede en Colombia. Operamos este sitio web
        (zakumistudio.com) y agentes conversacionales de WhatsApp para nuestro
        propio negocio y el de nuestros clientes. Contacto:{" "}
        <a href="mailto:zakumiestudio@gmail.com">zakumiestudio@gmail.com</a>.
      </p>

      <h2>Qué datos recolectamos</h2>
      <ul>
        <li>
          <strong>En el sitio web:</strong> los datos que nos envíes
          voluntariamente por los formularios de contacto (nombre, teléfono,
          correo y tu mensaje).
        </li>
        <li>
          <strong>En nuestros agentes de WhatsApp:</strong> tu número de
          teléfono, tu nombre de perfil y el contenido de los mensajes que
          intercambias con el agente. Los mensajes se procesan con modelos de
          inteligencia artificial para generar las respuestas.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Responder tus consultas y prestar el servicio que solicitaste.</li>
        <li>
          Dar continuidad a la conversación: el agente recuerda los mensajes
          recientes del chat para responder con contexto.
        </li>
        <li>
          Registrar tu interés comercial (un «lead») cuando pides información
          sobre un producto o servicio, para que una persona pueda contactarte.
        </li>
      </ul>
      <p>
        No vendemos tus datos ni los compartimos con terceros distintos de los
        proveedores tecnológicos que hacen posible el servicio (mensajería de
        WhatsApp, procesamiento de lenguaje e infraestructura de base de
        datos), que los tratan únicamente por instrucción nuestra.
      </p>

      <h2 id="eliminacion-de-datos">Eliminación de tus datos</h2>
      <p>
        Puedes pedir la eliminación de tu historial de conversación y de tus
        datos personales en cualquier momento, por cualquiera de estas vías:
      </p>
      <ul>
        <li>
          Escribe <strong>«eliminar mis datos»</strong> en el mismo chat de
          WhatsApp donde hablaste con el agente, o
        </li>
        <li>
          Envía un correo a{" "}
          <a href="mailto:zakumiestudio@gmail.com">zakumiestudio@gmail.com</a>{" "}
          desde cualquier dirección, indicando el número de teléfono usado en la
          conversación.
        </li>
      </ul>
      <p>
        Eliminaremos tu historial y tus datos de nuestros sistemas en un plazo
        máximo de 15 días hábiles y te lo confirmaremos por el mismo medio.
      </p>

      <h2>Conservación y seguridad</h2>
      <p>
        Los historiales de conversación se conservan mientras exista la
        relación comercial o hasta que pidas su eliminación. Se almacenan en
        bases de datos con acceso restringido y cifrado en tránsito.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Conforme a la Ley 1581 de 2012 (Colombia), puedes conocer, actualizar,
        rectificar y suprimir tus datos, y revocar la autorización de su
        tratamiento, escribiéndonos al correo de contacto.
      </p>

      <h2>Cambios a esta política</h2>
      <p>
        Si esta política cambia, publicaremos la versión nueva en esta misma
        página con su fecha de vigencia.
      </p>
    </section>
  );
}
