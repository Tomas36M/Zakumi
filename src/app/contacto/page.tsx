import type { Metadata } from "next";
import { ContactoView } from "@/components/zakumi/sections/ContactoView";

export const metadata: Metadata = {
  title: "Contacto",
  description:
    "Habla con nuestro agente de IA por WhatsApp o escríbenos. Estudio de marca, agentes de IA y software a medida en Colombia.",
  alternates: { canonical: "/contacto" },
};

export default function ContactoPage() {
  return <ContactoView />;
}
