import { describe, it, expect } from "vitest";
import {
  moneyCents,
  rankedOffers,
  parseOffers,
  type Offer,
} from "../domain/offers";
const now = Date.parse("2026-10-20T20:00:00Z");
const quote = (
  id: string,
  priceCents: number,
  shippingCents: number | null,
  deliveryDays: number | null,
): Offer => ({
  id,
  medicineId: "product",
  product: "Synthetic",
  presentation: "500 mg, 20 comprimidos",
  pharmacy: id,
  cep: "01001000",
  url: "https://example.org/product",
  priceCents,
  shippingCents,
  deliveryDays,
  available: true,
  checkedAt: new Date(now).toISOString(),
});
const rank = (o: Offer[], order: "total" | "delivery" = "total") =>
  rankedOffers(o, "product", "500 mg, 20 comprimidos", "01001000", order, now);
describe("comparable pharmacy quotes", () => {
  it("parses cents without floating point rounding or ambiguous thousands", () => {
    expect(moneyCents("19,90")).toBe(1990);
    expect(moneyCents("0")).toBe(0);
    for (const v of ["1.234,56", "1e3", "-4", "19,999", ""])
      expect(moneyCents(v)).toBeNull();
  });
  it("ranks the actual total including freight", () => {
    expect(
      rank([quote("cheap", 1000, 2000, 1), quote("total", 2000, 0, 2)])[0].id,
    ).toBe("total");
  });
  it("treats fastest delivery separately from cheapest", () => {
    expect(
      rank(
        [quote("cheap", 1000, 0, 5), quote("fast", 3000, 0, 0)],
        "delivery",
      )[0].id,
    ).toBe("fast");
  });
  it("does not treat missing freight or unknown days as free or immediate", () => {
    expect(rank([quote("unknown", 100, null, null)])).toEqual([]);
    expect(rank([quote("unknown", 100, 0, null)], "delivery")).toEqual([]);
  });
  it("excludes different products, presentations, CEPs, stale, future and unavailable quotes", () => {
    const q = quote("x", 100, 0, 0);
    for (const change of [
      { medicineId: "other" },
      { presentation: "1000 mg, 20 comprimidos" },
      { cep: "02002000" },
      { checkedAt: new Date(now - 86400001).toISOString() },
      { checkedAt: new Date(now + 120000).toISOString() },
      { available: false },
    ])
      expect(rank([{ ...q, ...change }])).toEqual([]);
  });
  it("rejects unsafe links and corrupt persisted numbers", () => {
    expect(() =>
      parseOffers([{ ...quote("x", 100, 0, 0), url: "javascript:alert(1)" }]),
    ).toThrow();
    expect(() => parseOffers([quote("x", NaN, 0, 0)])).toThrow();
  });
});
