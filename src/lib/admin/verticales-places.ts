// Puente entre las verticales de prospección (que ya traen su plantilla de
// WhatsApp en zak.ts) y los includedTypes de la Tabla A de Places.
//
// Los `matchers` de zak.ts NO sirven aquí: son substrings para clasificar
// negocios.categoria después del hecho. includedTypes exige identificadores
// exactos, y uno inventado hace que Google devuelva INVALID_ARGUMENT.

export const TIPOS_POR_VERTICAL: Readonly<Record<string, readonly string[]>> = {
  restaurante: ["restaurant", "cafe", "bar", "meal_takeaway"],
  panaderia: ["bakery"],
  ferreteria: ["hardware_store", "home_improvement_store"],
  veterinaria: ["veterinary_care", "pet_store"],
  farmacia: ["pharmacy", "drugstore"],
  belleza: ["beauty_salon", "hair_salon", "nail_salon", "spa", "barber_shop"],
  taller: ["car_repair", "car_wash", "auto_parts_store"],
  hogar: ["furniture_store", "home_goods_store"],
  moda: ["clothing_store", "shoe_store", "jewelry_store"],
  comercio: ["grocery_store", "supermarket", "convenience_store", "florist"],
};

export function tiposDeVertical(slug: string): readonly string[] {
  return TIPOS_POR_VERTICAL[slug] ?? [];
}
