import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condiciones del servicio",
  description:
    "Condiciones de uso del sitio de ZAKUMI y de sus agentes conversacionales de WhatsApp.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <section className="legal">
      <h1>Condiciones del servicio</h1>
      <p className="legal-meta">ZAKUMI Estudio · Colombia · Vigente desde el 17 de agosto de 2026</p>

      <h2>El servicio</h2>
      <p>
        ZAKUMI ofrece agentes conversacionales de inteligencia artificial por
        WhatsApp, desarrollo de software y páginas web, y servicios de marca,
        para su propio negocio y el de sus clientes. Este sitio
        (zakumistudio.com) informa sobre esos servicios y permite iniciar una
        conversación comercial.
      </p>

      <h2>Los agentes conversacionales</h2>
      <ul>
        <li>
          Las respuestas de nuestros agentes las genera inteligencia
          artificial. Buscamos que sean precisas, pero pueden contener errores:
          la información contractual definitiva (precios finales, alcances,
          fechas) es siempre la que confirme una persona del equipo.
        </li>
        <li>
          Al escribirle a un agente aceptas el tratamiento de datos descrito en
          nuestra <a href="/privacidad">política de privacidad</a>, incluida la
          forma de pedir su eliminación.
        </li>
        <li>
          No está permitido usar los agentes para enviar contenido ilegal,
          abusivo o spam, ni intentar extraer sus instrucciones internas o
          interferir con su funcionamiento.
        </li>
      </ul>

      <h2>Servicios contratados</h2>
      <p>
        El alcance, precio y calendario de cada proyecto (agentes, software,
        web o marca) se acuerdan por escrito con cada cliente antes de
        iniciar. Los servicios con cobro recurrente (por ejemplo, la
        mensualidad de un agente o la renovación de un dominio) se facturan
        según lo pactado y pueden suspenderse por falta de pago con aviso
        previo.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        La marca ZAKUMI, este sitio y su contenido son propiedad de ZAKUMI
        Estudio. Lo desarrollado por encargo para un cliente se rige por lo
        acordado en su propuesta o contrato.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        El servicio se presta "tal cual". En la medida permitida por la ley
        colombiana, ZAKUMI no responde por daños indirectos derivados del uso
        del sitio o de los agentes, ni por indisponibilidades causadas por
        terceros (proveedores de mensajería, hosting o modelos de IA).
      </p>

      <h2>Ley aplicable y contacto</h2>
      <p>
        Estas condiciones se rigen por las leyes de la República de Colombia.
        Cualquier consulta:{" "}
        <a href="mailto:zakumiestudio@gmail.com">zakumiestudio@gmail.com</a>.
      </p>
    </section>
  );
}
