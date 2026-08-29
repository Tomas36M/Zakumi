import { describe, expect, it } from "vitest";

import {
  mapConversaciones,
  mapHistorial,
  mapHistorialLabs,
  mapInstancia,
  mapJobs,
  mapLeads,
  mapPausados,
  mapPlantillasMeta,
  mapPromptActivo,
  mapProspectos,
  mapRespuestaLabs,
  mapStatusGlobal,
  mapStatusInstancia,
  mapTandas,
  mapVersiones,
} from "../mappers";
import { canalDeProveedor, esLabs } from "../tipos";

// Fixture calcada de un GET /instancias/<id> real: secretos ya redactados
// por el bot (•••XXXX) y timestamps ISO.
const INSTANCIA_CRUDA = {
  id: 2,
  slug: "espiguita",
  nombre: "Espiguita",
  activo: true,
  proveedor: "cloud",
  green_api_url: null,
  green_instance_id: null,
  green_api_token: null,
  green_webhook_token: null,
  meta_phone_number_id: "744554432058105",
  meta_waba_id: "1338663527853316",
  meta_access_token: "•••R8ZD",
  meta_graph_version: "v23.0",
  escalation_notify_to: "573001112233",
  escalation_template: null,
  escalation_template_lang: "es",
  acuse_escalado: "Ya aviso al equipo, te escriben en breve.",
  fallback_reply: "Dame un momento y te respondo.",
  modelo: "claude-sonnet-5",
  effort: "low",
  max_tokens: 4096,
  prompt_version: 3,
  limite_por_numero: 12,
  limite_ventana_s: 60,
  presupuesto_tokens_dia: 500000,
  creado_en: "2026-08-10T21:14:03.120933+00:00",
  actualizado_en: "2026-08-17T02:41:55.002911+00:00",
};

describe("mapInstancia", () => {
  it("deriva canal whatsapp para green y cloud, voz para eleven (futuro)", () => {
    expect(mapInstancia(INSTANCIA_CRUDA).canal).toBe("whatsapp");
    expect(mapInstancia({ ...INSTANCIA_CRUDA, proveedor: "green" }).canal).toBe("whatsapp");
    expect(canalDeProveedor("eleven")).toBe("voz");
  });

  it("deja pasar los secretos redactados tal cual (solo se muestran, nunca se reenvían)", () => {
    const inst = mapInstancia(INSTANCIA_CRUDA);
    expect(inst.meta_access_token).toBe("•••R8ZD");
    expect(inst.green_api_token).toBeNull();
  });

  it("no se rompe con JSON vacío o basura (Railway a medias)", () => {
    const inst = mapInstancia(null);
    expect(inst.id).toBe(0);
    expect(inst.activo).toBe(false);
    expect(inst.canal).toBe("whatsapp");
    expect(mapInstancia({ presupuesto_tokens_dia: "mucho" }).presupuesto_tokens_dia).toBeNull();
  });
});

describe("mapStatusGlobal", () => {
  it("mapea cola, desglose por instancia y resumen de instancias", () => {
    const status = mapStatusGlobal({
      cola: {
        jobs_pendientes: 2,
        jobs_trabajando: 1,
        jobs_fallidos: 0,
        jobs_hechos: 154,
        edad_del_job_mas_viejo_s: 4,
      },
      por_instancia: [{ instancia_id: 2, pendientes: 2, trabajando: 1, fallidos: 0 }],
      instancias: [
        { id: 1, slug: "zak", nombre: "Zak", proveedor: "green", activo: true, prompt_version: 1 },
        { id: 2, slug: "espiguita", nombre: "Espiguita", proveedor: "cloud", activo: true, prompt_version: 3 },
      ],
    });
    expect(status.cola.jobs_hechos).toBe(154);
    expect(status.por_instancia[0].pendientes).toBe(2);
    expect(status.instancias.map((i) => i.canal)).toEqual(["whatsapp", "whatsapp"]);
  });

  it("con respuesta vacía devuelve un status en ceros, no un crash", () => {
    const status = mapStatusGlobal(null);
    expect(status.cola.jobs_pendientes).toBe(0);
    expect(status.instancias).toEqual([]);
  });
});

describe("mapStatusInstancia", () => {
  it("mapea instancia + uso_hoy + contadores", () => {
    const s = mapStatusInstancia({
      instancia: INSTANCIA_CRUDA,
      uso_hoy: {
        tokens_entrada: 1200,
        tokens_salida: 800,
        tokens_cache_lectura: 9000,
        tokens_cache_escritura: 0,
        llamadas: 7,
        dia: "2026-08-18",
        instancia_id: 2,
      },
      conversaciones: 12,
      pausados: 1,
      fallidos: 0,
    });
    expect(s.instancia.slug).toBe("espiguita");
    expect(s.uso_hoy.llamadas).toBe(7);
    expect(s.conversaciones).toBe(12);
  });
});

describe("prompt y versiones", () => {
  it("mapea el prompt activo con su versión", () => {
    const p = mapPromptActivo({
      version: 3,
      activa: true,
      system_prompt: "Eres Espiguita",
      knowledge: "Panes: mogolla, rollo…",
      tools_config: null,
      notas: "ajuste de tono",
      creado_en: "2026-08-15T10:00:00+00:00",
    });
    expect(p.version).toBe(3);
    expect(p.activa).toBe(true);
    expect(p.knowledge).toContain("mogolla");
  });

  it("mapea el historial de versiones con la marca de activa", () => {
    const versiones = mapVersiones({
      versiones: [
        { version: 3, notas: null, creado_por: "panel", creado_en: "2026-08-15T10:00:00+00:00", activa: true },
        { version: 2, notas: "precios", creado_por: "panel", creado_en: "2026-08-12T09:00:00+00:00", activa: false },
      ],
    });
    expect(versiones).toHaveLength(2);
    expect(versiones[0].activa).toBe(true);
    expect(versiones[1].notas).toBe("precios");
  });
});

describe("conversaciones, pausados, leads y jobs", () => {
  it("mapea la lista de conversaciones", () => {
    const convs = mapConversaciones({
      conversations: [
        { phone: "573001112222", messages: 14, paused: false, last: "gracias!", last_at: "2026-08-18T01:00:00+00:00" },
      ],
    });
    expect(convs[0].messages).toBe(14);
    expect(convs[0].last_at).toContain("2026-08-18");
  });

  it("convierte el dict de pausados del bot en filas", () => {
    const filas = mapPausados({
      paused: { "573001112222": { motivo: "pidió humano", acuse_enviado: true } },
    });
    expect(filas).toEqual([
      { telefono: "573001112222", motivo: "pidió humano", acuse_enviado: true },
    ]);
  });

  it("separa phone de los datos libres del lead y distingue los de prueba", () => {
    const leads = mapLeads({
      leads: [
        { phone: "573001112222", nombre: "Marta", interes: "torta de milo" },
        { phone: "labs:a1b2c3d4", nombre: "Prueba" },
      ],
    });
    expect(leads[0].datos).toEqual({ nombre: "Marta", interes: "torta de milo" });
    expect(esLabs(leads[1].phone)).toBe(true);
    expect(esLabs(leads[0].phone)).toBe(false);
  });

  it("mapea jobs fallidos", () => {
    const jobs = mapJobs({
      jobs: [
        { id: 40, instancia_id: 2, telefono: "573001112222", texto: "hola", error: "429 del proveedor", intentos: 3, creado_en: "2026-08-18T00:10:00+00:00" },
      ],
    });
    expect(jobs[0].error).toContain("429");
  });
});

describe("historial con hora", () => {
  it("conserva creado_en cuando el bot lo manda (ISO)", () => {
    const h = mapHistorial({
      phone: "573001112222",
      paused: false,
      messages: [
        { role: "user", content: "hola", creado_en: "2026-08-29T14:00:00+00:00" },
        { role: "assistant", content: "¡hola!", creado_en: "2026-08-29T14:00:05+00:00" },
      ],
      ultimo_del_cliente: "2026-08-29T14:00:00+00:00",
    });
    expect(h.messages[0].creado_en).toBe("2026-08-29T14:00:00+00:00");
    expect(h.messages[1].creado_en).toBe("2026-08-29T14:00:05+00:00");
  });

  it("bot viejo sin creado_en (o con basura) → null, jamás rompe", () => {
    const h = mapHistorial({
      phone: "573001112222",
      paused: false,
      messages: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "ok", creado_en: 42 },
      ],
      ultimo_del_cliente: null,
    });
    expect(h.messages[0].creado_en).toBeNull();
    expect(h.messages[1].creado_en).toBeNull();
  });
});

describe("mapPlantillasMeta", () => {
  it("mapea la lista de Graph con los campos convenience del bot", () => {
    const [p] = mapPlantillasMeta({
      plantillas: [
        {
          id: "111", nombre: "saludo_panaderia", estado: "APPROVED",
          categoria: "MARKETING", motivo_rechazo: null,
          cuerpo: "Hola panadería", tiene_header_imagen: true,
        },
      ],
    });
    expect(p).toEqual({
      id: "111", nombre: "saludo_panaderia", estado: "APPROVED",
      categoria: "MARKETING", motivo_rechazo: null,
      cuerpo: "Hola panadería", tiene_header_imagen: true,
    });
  });

  it("sin convenience, extrae BODY y HEADER del components crudo de Graph", () => {
    const [p] = mapPlantillasMeta({
      plantillas: [
        {
          id: "222", nombre: "saludo_moda", estado: "PENDING",
          components: [
            { type: "HEADER", format: "IMAGE" },
            { type: "BODY", text: "Hola moda" },
          ],
        },
      ],
    });
    expect(p.cuerpo).toBe("Hola moda");
    expect(p.tiene_header_imagen).toBe(true);
  });

  it("estado raro o basura → DESCONOCIDO, jamás truena", () => {
    const [p] = mapPlantillasMeta({ plantillas: [{ nombre: "x", estado: "IN_APPEAL" }] });
    expect(p.estado).toBe("DESCONOCIDO");
    expect(mapPlantillasMeta(null)).toEqual([]);
  });

  it("sin components NI convenience, el header es DESCONOCIDO (null), no false", () => {
    // Un payload sin evidencia no puede apagar header_aprobado en la
    // promoción: eso mandaría el saludo sin header contra una plantilla
    // aprobada CON header (4xx permanente).
    const [p] = mapPlantillasMeta({ plantillas: [{ nombre: "x", estado: "APPROVED" }] });
    expect(p.tiene_header_imagen).toBeNull();
    const [q] = mapPlantillasMeta({
      plantillas: [{ nombre: "y", estado: "APPROVED", components: [{ type: "BODY", text: "hola" }] }],
    });
    expect(q.tiene_header_imagen).toBe(false); // components presentes sin HEADER = evidencia real
  });
});

describe("labs", () => {
  it("mapea un turno normal y uno silenciado por escalado", () => {
    expect(mapRespuestaLabs({ reply: "¡Hola! ¿Qué pan buscas?", paused: false })).toEqual({
      reply: "¡Hola! ¿Qué pan buscas?",
      paused: false,
    });
    expect(mapRespuestaLabs({ reply: null, paused: true })).toEqual({
      reply: null,
      paused: true,
    });
  });

  it("mapea el historial de una sesión de prueba", () => {
    const h = mapHistorialLabs({
      messages: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "¡Hola! ¿Qué pan buscas?" },
      ],
      paused: false,
    });
    expect(h.messages).toHaveLength(2);
    expect(h.messages[1].role).toBe("assistant");
  });
});

describe("prospección", () => {
  it("mapea tandas con su funnel completo", () => {
    const tandas = mapTandas({
      tandas: [{
        id: 3, plantilla: "saludo_zakumi", notas: "primera tanda Ubaté",
        creado_en: "2026-08-20T15:00:00+00:00",
        funnel: { pendiente: 2, enviado: 1, entregado: 4, leido: 3, respondido: 2, fallido: 1 },
        interesados: 1,
      }],
    });
    expect(tandas[0].funnel.respondido).toBe(2);
    expect(tandas[0].interesados).toBe(1);
  });

  it("mapea prospectos y degrada estados desconocidos a pendiente", () => {
    const prospectos = mapProspectos({
      prospectos: [
        {
          id: 7, tanda_id: 3, telefono: "573124916869", negocio_id: "uuid-wengue",
          contexto: { nombre: "Wengué", categoria: "manufacturer", ciudad: "ubate" },
          estado_envio: "respondido", interesado: true,
          interes_resumen: "quiere bot para pedidos", error: null,
          creado_en: "2026-08-20T15:01:00+00:00", actualizado_en: "2026-08-20T16:00:00+00:00",
        },
        { id: 8, tanda_id: 3, telefono: "573001", estado_envio: "raro-nuevo" },
      ],
    });
    expect(prospectos[0].contexto.nombre).toBe("Wengué");
    expect(prospectos[0].interesado).toBe(true);
    expect(prospectos[1].estado_envio).toBe("pendiente");
    expect(prospectos[1].negocio_id).toBeNull();
  });

  it("con basura devuelve listas vacías, no un crash", () => {
    expect(mapTandas(null)).toEqual([]);
    expect(mapProspectos({ prospectos: "nada" })).toEqual([]);
  });
});
