import type { Medicine } from "./catalog";
export function bularioUrl(medicine: Medicine): string {
  const query = new URLSearchParams(
    medicine.registration
      ? { numeroRegistro: medicine.registration.number }
      : { nomeProduto: medicine.name },
  );
  return `https://consultas.anvisa.gov.br/#/bulario/q/?${query.toString()}`;
}
