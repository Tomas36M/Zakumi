# Tool `registrar_solicitud` — para el bot Flask de Zak

Al cerrar una conversación en la que la persona pidió un servicio o quedó en
reunirse, Zak llama esta tool. El sitio de Zakumi crea la solicitud en
`/admin/solicitudes`, agenda en Google Calendar si hay fecha, y avisa por
WhatsApp a Tomás y a Paula. Es idempotente: repetir la llamada con el mismo
`ref` no duplica nada.

**Endpoint:** `POST {SITE_URL}/api/zak/solicitud`
**Header:** `Authorization: Bearer {ZAK_VOZ_TOKEN}` (el mismo token de
`/api/zak/llamar`, ya configurado en el bot).

## Argumentos

```json
{
  "type": "object",
  "required": ["telefono"],
  "properties": {
    "telefono":      { "type": "string", "description": "Teléfono de la persona en formato +57..." },
    "ref":           { "type": "string", "description": "Id de la conversación. Evita duplicados; si falta se usa teléfono+fecha." },
    "nombre":        { "type": "string" },
    "email":         { "type": "string" },
    "servicio":      { "type": "string", "description": "bot de WhatsApp | página web | mantenimiento | CRM | agente de voz" },
    "detalle":       { "type": "string", "description": "Qué quiere, en una frase." },
    "mejor_horario": { "type": "string", "description": "Cuándo prefiere que lo contacten, tal como lo dijo." },
    "cita":          { "type": "string", "description": "AAAA-MM-DDTHH:MM en hora de Colombia si acordaron día Y hora. Si fue vago ('el jueves por la tarde'), ese texto tal cual. Si no hablaron de reunirse, omitir." }
  }
}
```

## Respuestas

| Código | Cuerpo | Qué significa |
|---|---|---|
| 200 | `{"status":"creada"}` | Quedó en la bandeja (el aviso por WhatsApp es "mejor esfuerzo": si falla, esto igual responde 200) |
| 200 | `{"status":"duplicada"}` | Ya estaba registrada; no se hace nada |
| 400 | `{"error":"falta_telefono"}` \| `{"error":"json_invalido"}` | Body malo |
| 401 | `{"error":"no_autorizado"}` | Token malo |
| 500 | `{"error":"..."}` | Falló el registro; reintentar |
| 503 | `{"error":"sin_configurar"}` | Al sitio le faltan envs |

## Qué añadir al prompt de Zak

> Cuando la conversación termine y la persona haya pedido un servicio, pedido
> una cotización o quedado en reunirse, llama a `registrar_solicitud` con lo
> que sepas. Llámala UNA sola vez por conversación. Para `cita`: si acordaron
> día y hora concretos, escríbela como AAAA-MM-DDTHH:MM en hora de Colombia
> (hoy es {fecha_de_hoy}); si solo dijeron algo vago, copia sus palabras tal
> cual; si no hablaron de reunirse, no mandes el campo. Nunca inventes una
> fecha ni un teléfono.

## Ejemplo

```bash
curl -X POST "$SITE_URL/api/zak/solicitud" \
  -H "Authorization: Bearer $ZAK_VOZ_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "+573001112233",
    "ref": "+573001112233:2026-09-03",
    "nombre": "María Pérez",
    "servicio": "bot de WhatsApp",
    "detalle": "Quiere un bot para su restaurante, 3 sedes",
    "cita": "2026-09-03T10:00"
  }'
```

<!-- El `ref` de arriba calca el formato que el endpoint arma solo cuando el
     bot no manda ninguno (`telefono:fecha-en-Bogotá`) — es solo para que el
     ejemplo se vea real, el bot puede mandar cualquier id de conversación
     como `ref`; no tiene que coincidir con ese formato. -->
