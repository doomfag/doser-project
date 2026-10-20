import { normalize } from "./text";
import { safeUrl } from "./catalog";
export interface Offer {
  id: string;
  medicineId: string;
  product: string;
  presentation: string;
  pharmacy: string;
  priceCents: number;
  shippingCents: number | null;
  deliveryDays: number | null;
  cep: string;
  url: string;
  checkedAt: string;
  available: boolean;
}
export function moneyCents(value: string): number | null {
  const v = value.trim().replace(/^R\$\s*/, "");
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(v)) return null;
  const [whole, fraction = ""] = v.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function parseOffers(input: unknown): Offer[] {
  if (!Array.isArray(input) || input.length > 100)
    throw Error("Cotações inválidas.");
  const ids = new Set<string>();
  return input.map((x: Offer) => {
    const str = (v: unknown, max: number) =>
      typeof v === "string" && v.trim().length > 0 && v.length <= max;
    if (
      !x ||
      !str(x.id, 100) ||
      ids.has(x.id) ||
      !str(x.medicineId, 200) ||
      !str(x.product, 200) ||
      !str(x.presentation, 1000) ||
      !str(x.pharmacy, 100) ||
      !safeUrl(x.url) ||
      !/^\d{8}$/.test(x.cep) ||
      !Number.isSafeInteger(x.priceCents) ||
      x.priceCents <= 0 ||
      x.priceCents > 1e9 ||
      !(
        x.shippingCents === null ||
        (Number.isSafeInteger(x.shippingCents) &&
          x.shippingCents >= 0 &&
          x.shippingCents <= 1e9)
      ) ||
      !(
        x.deliveryDays === null ||
        (Number.isInteger(x.deliveryDays) &&
          x.deliveryDays >= 0 &&
          x.deliveryDays <= 365)
      ) ||
      typeof x.available !== "boolean" ||
      !Number.isFinite(Date.parse(x.checkedAt))
    )
      throw Error(
        "Confira produto, preço, frete, prazo, CEP e link da cotação.",
      );
    ids.add(x.id);
    return x;
  });
}
export const offerTotal = (o: Offer) =>
  o.shippingCents === null ? null : o.priceCents + o.shippingCents;
export function rankedOffers(
  offers: Offer[],
  medicineId: string,
  presentation: string,
  cep: string,
  order: "total" | "delivery",
  now = Date.now(),
) {
  return offers
    .filter(
      (o) =>
        o.medicineId === medicineId &&
        normalize(o.presentation) === normalize(presentation) &&
        o.cep === cep &&
        o.available &&
        now - Date.parse(o.checkedAt) >= -60000 &&
        now - Date.parse(o.checkedAt) <= 86400000,
    )
    .filter((o) =>
      order === "total" ? offerTotal(o) !== null : o.deliveryDays !== null,
    )
    .sort((a, b) =>
      order === "total"
        ? offerTotal(a)! - offerTotal(b)! ||
          (a.deliveryDays ?? Infinity) - (b.deliveryDays ?? Infinity)
        : a.deliveryDays! - b.deliveryDays! ||
          (offerTotal(a) ?? Infinity) - (offerTotal(b) ?? Infinity),
    );
}
const key = "doser.offers.v1";
export function readOffers(): Offer[] {
  try {
    return parseOffers(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return [];
  }
}
export function writeOffers(offers: Offer[]) {
  localStorage.setItem(key, JSON.stringify(parseOffers(offers)));
}
