import { NextResponse } from "next/server";
import { getSesion } from "@/lib/admin/dal";
import { CIUDADES, type Ciudad } from "@/lib/admin/negocios";
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
].join(",");

type Payload = { query?: unknown; ciudad?: unknown };

export async function POST(request: Request) {
  // La key de Places vive solo en el servidor; la sesión evita que este
  // endpoint sea un proxy abierto que queme la cuota a nombre de Zakumi.
  const sesion = await getSesion();
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

  const ciudad = CIUDADES.find((c) => c.valor === payload.ciudad);

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
        ...(ciudad
          ? {
              locationBias: {
                circle: {
                  center: {
                    latitude: ciudad.centro.lat,
                    longitude: ciudad.centro.lng,
                  },
                  radius: ciudad.radio,
                },
              },
            }
          : {}),
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
  const sesgo = ciudad?.valor as Exclude<Ciudad, "otra"> | undefined;
  // Al mapa solo llegan negocios contactables: sin teléfono no hay venta.
  const resultados: ResultadoPlace[] = soloConTelefono(
    (data.places ?? []).map((p) => placeANegocio(p, sesgo)),
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
