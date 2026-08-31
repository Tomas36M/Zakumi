import { verifySession } from "@/lib/admin/dal";
import { agenteZakVoz, contarLlamadasHoy, llamadasDeAgente } from "@/lib/admin/voz";
import { catalogoVerticales } from "@/lib/admin/zak-verticales";
import { pestanaInicial } from "@/lib/admin/zak-caras";
import { listarVoces } from "@/lib/voz/api";
import type { EstadoVozZak } from "@/components/admin/voz/BotonLlamarZak";
import {
  listarProspectos,
  listarTandas,
  listarVersiones,
  obtenerInstancia,
  obtenerPrompt,
  statusInstancia,
} from "@/lib/bots/api";
import { ID_ZAK } from "@/lib/bots/tipos";
import { ZakView } from "@/components/admin/bots/ZakView";

export const metadata = { title: "Zak" };

export default async function ZakPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; telefono?: string }>;
}) {
  const { supabase } = await verifySession();
  const { tab, telefono } = await searchParams;
  // Deep-link desde el CRM: abrir la bandeja con este chat (exista o no).
  const telefonoInicial = /^[0-9]{7,15}$/.test(telefono ?? "") ? (telefono as string) : null;

  // Con Railway caído el cockpit carga igual: cada pieza degrada por su lado.
  const [instancia, prompt, versiones, status, tandas, prospectos, catalogo, zakVoz] =
    await Promise.all([
      obtenerInstancia(ID_ZAK),
      obtenerPrompt(ID_ZAK),
      listarVersiones(ID_ZAK),
      statusInstancia(ID_ZAK),
      listarTandas(ID_ZAK),
      listarProspectos(ID_ZAK),
      catalogoVerticales(supabase), // vivo; sin la tabla cae al estático
      agenteZakVoz(supabase), // la voz de Zak: su cara de Voz y "Llamar con IA"
    ]);

  // La cara de Voz solo necesita datos si Zak YA tiene agente; si no, lo único
  // que se pinta es el alta (que sí necesita el catálogo de voces).
  const [llamadasVoz, llamadasVozHoy, voces] = await Promise.all([
    zakVoz ? llamadasDeAgente(supabase, zakVoz.id) : Promise.resolve([]),
    zakVoz ? contarLlamadasHoy(supabase, zakVoz.id) : Promise.resolve(0),
    listarVoces(),
  ]);

  const clientes = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  // Cada rechazo con su remedio: el tooltip del botón guía al fix correcto.
  const vozZak: EstadoVozZak = !zakVoz
    ? "sin_agente"
    : !zakVoz.agent_id_eleven
      ? "sin_sincronizar"
      : !zakVoz.activo
        ? "apagada"
        : Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID) ||
            Boolean(zakVoz.phone_number_id_eleven)
          ? "lista"
          : "sin_numero";

  return (
    <ZakView
      telefonoInicial={telefonoInicial}
      instancia={instancia.ok ? instancia.data : null}
      prompt={prompt.ok ? prompt.data : null}
      versiones={versiones.ok ? versiones.data : []}
      status={status.ok ? status.data : null}
      tandas={tandas.ok ? tandas.data : []}
      prospectos={prospectos.ok ? prospectos.data : []}
      tabInicial={telefonoInicial ? "bandeja" : pestanaInicial(tab)}
      verticales={[...catalogo.todos]}
      plantillas={catalogo.filas}
      vozZak={vozZak}
      agenteVoz={zakVoz}
      llamadasVoz={llamadasVoz}
      llamadasVozHoy={llamadasVozHoy ?? 0}
      voces={voces.ok ? voces.data : null}
      clientes={(clientes.data ?? []) as { id: string; nombre: string }[]}
      telefoniaLista={
        Boolean(process.env.ELEVENLABS_PHONE_NUMBER_ID) ||
        Boolean(zakVoz?.phone_number_id_eleven)
      }
    />
  );
}
