"use client";

import { ContactoSection } from "./ContactoSection";
import { ContactForm } from "./ContactForm";

/** Vista de la ruta /contacto: la sección de contacto (CTAs + Instagram) + el formulario. */
export function ContactoView() {
  return (
    <>
      <ContactoSection />
      <ContactForm />
    </>
  );
}
