import { describe, expect, it } from "vitest";
import {
  localidadDe,
  marcarImportados,
  placeANegocio,
  soloConTelefono,
} from "../places";
import type { PlaceApi } from "../places";

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
    { longText: "Ubaté", shortText: "Ubaté", types: ["locality", "political"] },
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
