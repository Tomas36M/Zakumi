import { describe, expect, it } from "vitest";
import {
  ciudadLimpia,
  filaDeNegocio,
  localidadDe,
  marcarImportados,
  placeANegocio,
  soloConTelefono,
  urlHttpONull,
} from "../places";
import type { PlaceApi, ResultadoPlace } from "../places";

const FERRETERIA_UBATE: PlaceApi = {
  id: "ChIJferreteria123",
  displayName: { text: "Ferretería El Tornillo" },
  formattedAddress: "Cra. 7 #8-21, Ubaté, Cundinamarca, Colombia",
  location: { latitude: 5.3081, longitude: -73.8146 },
  nationalPhoneNumber: "601 7430000",
  internationalPhoneNumber: "+57 601 7430000",
  rating: 4.4,
  websiteUri: "https://eltornillo.co",
  types: ["hardware_store", "point_of_interest", "establishment"],
  businessStatus: "OPERATIONAL",
  addressComponents: [
    { longText: "Ubaté", types: ["locality", "political"] },
    { longText: "Cundinamarca", types: ["administrative_area_level_1"] },
    { longText: "Colombia", types: ["country"] },
  ],
};

describe("placeANegocio", () => {
  it("mapea el resultado completo de Places al shape del panel", () => {
    expect(placeANegocio(FERRETERIA_UBATE)).toEqual({
      placeId: "ChIJferreteria123",
      nombre: "Ferretería El Tornillo",
      direccion: "Cra. 7 #8-21, Ubaté, Cundinamarca, Colombia",
      lat: 5.3081,
      lng: -73.8146,
      categoria: "hardware_store",
      rating: 4.4,
      sitioWeb: "https://eltornillo.co",
      telefono: "+576017430000",
      tipoTelefono: "fijo",
      ciudad: "Ubaté",
      operativo: true,
      yaImportado: false,
    });
  });

  it("sin teléfono ni web ni rating → nulls, nunca undefined", () => {
    const pelado: PlaceApi = {
      id: "ChIJpelado",
      displayName: { text: "Tienda Doña Marta" },
      location: { latitude: 4.73, longitude: -74.26 },
    };
    const r = placeANegocio(pelado);
    expect(r.telefono).toBeNull();
    expect(r.tipoTelefono).toBe("desconocido");
    expect(r.sitioWeb).toBeNull();
    expect(r.rating).toBeNull();
    expect(r.direccion).toBeNull();
    expect(r.categoria).toBeNull();
  });

  it("la categoría ignora los types genéricos de Google", () => {
    const soloGenericos: PlaceApi = {
      ...FERRETERIA_UBATE,
      types: ["point_of_interest", "establishment"],
    };
    expect(placeANegocio(soloGenericos).categoria).toBeNull();
  });

  it("negocio cerrado permanentemente → operativo false", () => {
    const cerrado: PlaceApi = {
      ...FERRETERIA_UBATE,
      businessStatus: "CLOSED_PERMANENTLY",
    };
    expect(placeANegocio(cerrado).operativo).toBe(false);
  });

  it("prefiere el teléfono internacional sobre el nacional", () => {
    const soloNacional: PlaceApi = {
      ...FERRETERIA_UBATE,
      internationalPhoneNumber: undefined,
      nationalPhoneNumber: "310 1234567",
    };
    expect(placeANegocio(soloNacional).telefono).toBe("+573101234567");
    expect(placeANegocio(soloNacional).tipoTelefono).toBe("movil");
  });
});

describe("localidadDe", () => {
  it("saca el municipio del componente locality", () => {
    expect(
      localidadDe([
        { longText: "Madrid", types: ["locality", "political"] },
        { longText: "Cundinamarca", types: ["administrative_area_level_1"] },
      ]),
    ).toBe("Madrid");
  });

  it("cae a administrative_area_level_2 cuando no hay locality", () => {
    expect(
      localidadDe([
        { longText: "Ubaté", types: ["administrative_area_level_2"] },
        { longText: "Colombia", types: ["country"] },
      ]),
    ).toBe("Ubaté");
  });

  it("devuelve null cuando Google no manda localidad", () => {
    expect(localidadDe([{ longText: "Colombia", types: ["country"] }])).toBeNull();
    expect(localidadDe(undefined)).toBeNull();
    expect(localidadDe([])).toBeNull();
  });

  it("no confunde 'Madrid, España' con Madrid Cundinamarca: la localidad es literal", () => {
    // regionCode=CO en el handler evita el caso; aquí solo se exige que la
    // función NO normalice ni adivine nada.
    expect(localidadDe([{ longText: "Madrid", types: ["locality"] }])).toBe("Madrid");
  });
});

describe("soloConTelefono", () => {
  it("descarta los resultados sin teléfono: sin número no hay venta", () => {
    const conTelefono = placeANegocio(FERRETERIA_UBATE);
    const sinTelefono = placeANegocio({
      ...FERRETERIA_UBATE,
      id: "ChIJsinTel",
      nationalPhoneNumber: undefined,
      internationalPhoneNumber: undefined,
    });
    expect(soloConTelefono([conTelefono, sinTelefono])).toEqual([conTelefono]);
  });

  it("lista vacía → lista vacía", () => {
    expect(soloConTelefono([])).toEqual([]);
  });
});

describe("marcarImportados", () => {
  it("marca exactamente los placeIds que ya existen en la base", () => {
    const resultados = [
      placeANegocio(FERRETERIA_UBATE),
      placeANegocio({ ...FERRETERIA_UBATE, id: "ChIJotro456" }),
    ];
    const marcados = marcarImportados(resultados, new Set(["ChIJotro456"]));
    expect(marcados.map((r) => r.yaImportado)).toEqual([false, true]);
  });
});

// Único escritor de `negocios.sitio_web`, y el valor se pinta tal cual en un
// <a href>. Vive en places.ts justo para que el barrido —que mete muchísimas
// más filas que la importación manual— no lo esquive.
describe("urlHttpONull", () => {
  it("deja pasar http y https", () => {
    expect(urlHttpONull("https://zakumistudio.com")).toBe("https://zakumistudio.com");
    expect(urlHttpONull("http://ferreteria-ubate.co/tienda")).toBe(
      "http://ferreteria-ubate.co/tienda",
    );
  });

  it("recorta espacios alrededor", () => {
    expect(urlHttpONull("  https://zakumistudio.com  ")).toBe("https://zakumistudio.com");
  });

  it("mata los esquemas que no son navegables", () => {
    expect(urlHttpONull("javascript:alert(1)")).toBeNull();
    expect(urlHttpONull("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(urlHttpONull("//evil.example")).toBeNull();
    expect(urlHttpONull("zakumistudio.com")).toBeNull();
  });

  it("null para lo vacío y lo que no es texto", () => {
    expect(urlHttpONull("")).toBeNull();
    expect(urlHttpONull("   ")).toBeNull();
    expect(urlHttpONull(null)).toBeNull();
    expect(urlHttpONull(undefined)).toBeNull();
    expect(urlHttpONull(42)).toBeNull();
  });
});

const FERRETERIA: ResultadoPlace = {
  placeId: "ChIJferreteria123",
  nombre: "  Ferretería El Tornillo  ",
  direccion: "Cra. 7 #8-21, Ubaté",
  lat: 5.3081,
  lng: -73.8146,
  categoria: "hardware_store",
  rating: 4.4,
  sitioWeb: "https://eltornillo.co",
  telefono: "+576017430000",
  tipoTelefono: "fijo",
  ciudad: "  Ubaté  ",
  operativo: true,
  yaImportado: false,
};

describe("ciudadLimpia", () => {
  it("recorta y conserva el municipio tal como viene", () => {
    expect(ciudadLimpia("  Ubaté  ")).toBe("Ubaté");
  });

  it("null para lo vacío y lo que no es texto", () => {
    expect(ciudadLimpia("   ")).toBeNull();
    expect(ciudadLimpia(null)).toBeNull();
    expect(ciudadLimpia(undefined)).toBeNull();
    expect(ciudadLimpia(42)).toBeNull();
  });

  it("recorta a 120 caracteres (el largo que acepta la columna)", () => {
    expect(ciudadLimpia("x".repeat(300))).toHaveLength(120);
  });
});

describe("filaDeNegocio", () => {
  it("arma la fila de negocios con el territorio de origen", () => {
    expect(filaDeNegocio(FERRETERIA, "terr-1")).toEqual({
      nombre: "Ferretería El Tornillo",
      direccion: "Cra. 7 #8-21, Ubaté",
      ciudad: "Ubaté",
      lat: 5.3081,
      lng: -73.8146,
      categoria: "hardware_store",
      rating: 4.4,
      sitio_web: "https://eltornillo.co",
      telefono: "+576017430000",
      tipo_telefono: "fijo",
      google_place_id: "ChIJferreteria123",
      fuente: "places",
      territorio_id: "terr-1",
    });
  });

  it("la importación manual pasa territorio null y sale la MISMA fila", () => {
    // El invariante que justifica que exista esta función: los dos escritores
    // de `negocios` escriben lo mismo salvo el territorio. Estuvo duplicada y
    // ya había divergido en la ciudad.
    const conTerritorio = filaDeNegocio(FERRETERIA, "terr-1");
    const sinTerritorio = filaDeNegocio(FERRETERIA, null);
    expect(sinTerritorio).toEqual({ ...conTerritorio, territorio_id: null });
  });

  it("sanea la ciudad: dos grafías de un municipio serían dos filtros", () => {
    // Era la divergencia real: el barrido la metía cruda y la importación no.
    expect(filaDeNegocio({ ...FERRETERIA, ciudad: " Madrid " }, null).ciudad).toBe(
      "Madrid",
    );
    expect(filaDeNegocio({ ...FERRETERIA, ciudad: null }, null).ciudad).toBeNull();
  });

  it("el nombre cabe en el check de la base y nunca queda vacío", () => {
    // Un solo nombre demasiado largo tumbaba el upsert ENTERO: tesela cobrada
    // y los otros 19 negocios de esa tesela perdidos.
    const largo = filaDeNegocio({ ...FERRETERIA, nombre: "x".repeat(500) }, null);
    expect(largo.nombre).toHaveLength(300);
    const vacio = filaDeNegocio({ ...FERRETERIA, nombre: "   " }, null);
    expect(vacio.nombre).toBe("(sin nombre)");
  });

  it("el sitio web pasa por urlHttpONull: se pinta en un href", () => {
    expect(
      filaDeNegocio({ ...FERRETERIA, sitioWeb: "javascript:alert(1)" }, null).sitio_web,
    ).toBeNull();
  });

  it("re-normaliza el teléfono en vez de confiar en quien lo mandó", () => {
    // Del barrido llega ya normalizado (idempotente); de la importación llega
    // lo que quiso el cliente.
    const fila = filaDeNegocio({ ...FERRETERIA, telefono: "300 123 4567" }, null);
    expect(fila.telefono).toBe("+573001234567");
    expect(fila.tipo_telefono).toBe("movil");
    expect(filaDeNegocio(FERRETERIA, null).telefono).toBe("+576017430000");
  });

  it("null en los campos opcionales que no llegan con el tipo esperado", () => {
    const fila = filaDeNegocio(
      {
        ...FERRETERIA,
        direccion: null,
        categoria: null,
        rating: null,
        sitioWeb: null,
      },
      null,
    );
    expect(fila.direccion).toBeNull();
    expect(fila.categoria).toBeNull();
    expect(fila.rating).toBeNull();
    expect(fila.sitio_web).toBeNull();
  });
});
