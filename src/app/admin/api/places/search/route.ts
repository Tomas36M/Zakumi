import { NextResponse } from "next/server";
import { getSesionAdmin } from "@/lib/admin/dal";
import {
  marcarImportados,
  placeANegocio,
  soloConTelefono,
  type PlaceApi,
  type ResultadoPlace,
} from "@/lib/admin/places";

// Solo los campos que el panel usa: el FieldMask define el SKU que factura
// Google — no añadir campos sin mirar el precio.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.websiteUri",
  "places.types",
  "places.businessStatus",
  // addressComponents es tier Pro y ya pagamos Enterprise por el teléfono:
  // entra sin subir la factura (verificado 2026-08-31).
  "places.addressComponents",
].join(",");

type Payload = { query?: unknown; centro?: unknown; radio?: unknown };

const RADIO_MIN = 1_000;
const RADIO_MAX = 50_000;

/** El sesgo de la búsqueda ahora viene del viewport del mapa (centro+radio
 * del cliente), no de un preset de ciudad. Sin ninguno de los dos, la
 * búsqueda va sin locationBias — nada raro: hoy ningún cliente los manda
 * todavía (llega en una tarea posterior). */
function centroValido(valor: unknown): valor is { lat: number; lng: number } {
  if (typeof valor !== "object" || valor === null) return false;
  const { lat, lng } = valor as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

export async function POST(request: Request) {
  // La key de Places vive solo en el servidor; la sesión evita que este
  // endpoint sea un proxy abierto que queme la cuota a nombre de Zakumi.
  const sesion = await getSesionAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "consulta_invalida" }, { status: 400 });
  }

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ error: "consulta_invalida" }, { status: 400 });
  }

  // Ambos ausentes: búsqueda sin sesgo. Cualquiera presente sin el otro (o
  // fuera de rango) es una consulta mal formada — 400, no un bias silencioso.
  let locationBias: {
    circle: { center: { latitude: number; longitude: number }; radius: number };
  } | null = null;
  if (payload.centro !== undefined || payload.radio !== undefined) {
    if (
      !centroValido(payload.centro) ||
      typeof payload.radio !== "number" ||
      !Number.isFinite(payload.radio) ||
      payload.radio < RADIO_MIN ||
      payload.radio > RADIO_MAX
    ) {
      return NextResponse.json({ error: "consulta_invalida" }, { status: 400 });
    }
    locationBias = {
      circle: {
        center: { latitude: payload.centro.lat, longitude: payload.centro.lng },
        radius: payload.radio,
      },
    };
  }

  let respuesta: Response;
  try {
    respuesta = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "es",
        regionCode: "CO", // sin esto, "Madrid" es España
        pageSize: 20,
        ...(locationBias ? { locationBias } : {}),
      }),
    });
  } catch (error) {
    console.error("[places] fallo de red hacia Google:", error);
    return NextResponse.json({ error: "places_error" }, { status: 502 });
  }

  if (!respuesta.ok) {
    // El detalle va al log del servidor; el body de Google nunca al browser.
    console.error(
      `[places] Google respondió ${respuesta.status}:`,
      await respuesta.text().catch(() => "(sin body)"),
    );
    const esCuota = respuesta.status === 429;
    return NextResponse.json(
      { error: esCuota ? "cuota" : "places_error" },
      { status: esCuota ? 503 : 502 },
    );
  }

  const data = (await respuesta.json()) as { places?: PlaceApi[] };
  // Al mapa solo llegan negocios contactables: sin teléfono no hay venta.
  const resultados: ResultadoPlace[] = soloConTelefono(
    (data.places ?? []).map((p) => placeANegocio(p)),
  );

  // Dedupe visual: marcar los que ya están en la base.
  if (resultados.length > 0) {
    const { data: existentes, error } = await sesion.supabase
      .from("negocios")
      .select("google_place_id")
      .in(
        "google_place_id",
        resultados.map((r) => r.placeId),
      );
    if (error) {
      console.error("[places] error consultando duplicados:", error.message);
      return NextResponse.json({ error: "db_error" }, { status: 502 });
    }
    const ids = new Set(
      (existentes ?? []).flatMap((f) =>
        f.google_place_id ? [f.google_place_id as string] : [],
      ),
    );
    return NextResponse.json({ resultados: marcarImportados(resultados, ids) });
  }

  return NextResponse.json({ resultados });
}
