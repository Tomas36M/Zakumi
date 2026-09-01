import { redirect } from "next/navigation";

// Dos puertas a la misma ficha se desincronizan (lección de la PR #12 con
// /admin/voz/<id-de-Zak>). Los enlaces viejos siguen funcionando.
export default function MapaPage() {
  redirect("/admin/prospeccion?tab=territorio");
}
