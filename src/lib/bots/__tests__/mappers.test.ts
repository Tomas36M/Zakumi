import { describe, expect, it } from "vitest";

import {
  mapConversaciones,
  mapHistorialLabs,
  mapInstancia,
  mapJobs,
  mapLeads,
  mapPausados,
  mapPromptActivo,
  mapRespuestaLabs,
  mapStatusGlobal,
  mapStatusInstancia,
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
