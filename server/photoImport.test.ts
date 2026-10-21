import { describe, it, expect } from "vitest";
import type { Medicine } from "../src/domain/catalog.ts";
import {
  buildPhotoIdentityIndex,
  collectProductPhotos,
  publicProductData,
  searchProductLinks,
  validEan,
} from "./photoImport.ts";
const ean = "7891058017507";
const medicine = {
  id: "fixture",
  name: "MEDICAMENTO TESTE",
  ingredient: "Substância sintética de teste",
  registration: {
    number: "123456789",
    situation: "Ativo",
    holder: "12345678000199 - LABORATÓRIO SINTÉTICO",
  },
} as Medicine;
const header = "REGISTRO;PRODUTO;CNPJ;APRESENTAÇÃO;EAN 1;EAN 2;EAN 3\n";
const csv = (rows: string[]) =>
  Buffer.from("\ufeff" + header + rows.join("\n"));
const row = (
  reg = "1234567890001",
  name = medicine.name,
  cnpj = "12.345.678/0001-99",
  presentation = "10 MG COM X 20",
) => `${reg};${name};${cnpj};${presentation};${ean};;`;
const index = () => buildPhotoIdentityIndex(csv([row()]), [medicine]).index;
const page = "https://www.drogasil.com.br/medicamento-sintetico-teste.html";
const gallery = [1, 2, 3, 4].map((i) => ({
  file: `https://product-data.raiadrogasil.io/images/${i}.webp`,
  media_type: "image",
  position: i - 1,
  disabled: null,
}));
function html(overrides: Record<string, unknown> = {}) {
  const product = {
    name: "Medicamento teste 10 mg 20 comprimidos",
    productEan: ean,
    is3p: false,
    kitComposition: null,
    mediaGallery: gallery,
    custom_attributes: [
      { attribute_code: "ms", value_string: ["1234567890001"] },
    ],
    price: 9.99,
    description: "DO NOT IMPORT DOSE, PRICE OR STOCK",
    ...overrides,
  };
  return `<html><script type="application/json" id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { productData: product } } })}</script></html>`;
}
describe("photo identity import", () => {
  it("requires a valid EAN checksum and joins official registration/name/CNPJ", () => {
    expect(validEan(ean)).toBe(true);
    expect(validEan("7891058017508")).toBe(false);
    expect(validEan("0000000000000")).toBe(false);
    expect(index().get(ean)?.registration).toBe("123456789");
    for (const r of [
      row("9876543210001"),
      row(undefined, "OTHER BRAND"),
      row(undefined, undefined, "99.999.999/0001-99"),
    ])
      expect(buildPhotoIdentityIndex(csv([r]), [medicine]).index.size).toBe(0);
  });
  it("excludes ambiguous EANs instead of selecting one registration", () => {
    const result = buildPhotoIdentityIndex(
      csv([
        row(),
        row("1234567890002", medicine.name, undefined, "50 MG COM X 10"),
      ]),
      [medicine],
    );
    expect(result.index.has(ean)).toBe(false);
    expect(result.ambiguous.has(ean)).toBe(true);
  });
  it("keeps source registration conflicts explicit without rewriting either source", () => {
    const photos = collectProductPhotos(
      html({
        custom_attributes: [
          { attribute_code: "ms", value_string: ["9876543210001"] },
        ],
      }),
      page,
      index(),
      "2026-10-21",
    );
    expect(photos).toHaveLength(4);
    expect(photos[0].registrationConflict).toBe(true);
    expect(photos[0].sourceRegistration).toBe("9876543210001");
    expect(photos[0].registration).toBe("123456789");
  });
  it("collects unique image candidates while keeping them pending file review", () => {
    const photos = collectProductPhotos(
      html({
        mediaGallery: [
          ...gallery,
          gallery[0],
          { ...gallery[1], file: "https://evil.example/fake.webp" },
          { ...gallery[2], disabled: true },
        ],
      }),
      page,
      index(),
      "2026-10-21",
    );
    expect(photos).toHaveLength(4);
    expect(photos.every((p) => p.reviewStatus === "pending-file-review")).toBe(
      true,
    );
    expect(new Set(photos.map((p) => p.src)).size).toBe(4);
    expect(JSON.stringify(photos)).not.toMatch(
      /DO NOT IMPORT|price|stock|dosage/,
    );
  });
  it("rejects other medicines, invalid barcodes, kits and marketplace products", () => {
    for (const p of [
      { name: "OTHER PRODUCT" },
      { productEan: "7891058017508" },
      { is3p: true },
      { kitComposition: [{}] },
    ])
      expect(
        collectProductPhotos(html(p), page, index(), "2026-10-21"),
      ).toEqual([]);
  });
  it("reads JSON without executing markup and refuses unrelated or tracking URLs", () => {
    expect(() =>
      publicProductData("<script>alert('not executed')</script>"),
    ).toThrow();
    for (const u of [
      "https://evil.example/test.html",
      page + "?origin=search",
      "https://user:pass@www.drogasil.com.br/test.html",
    ])
      expect(() =>
        collectProductPhotos(html(), u, index(), "2026-10-21"),
      ).toThrow();
  });
  it("only returns canonical public product pages from search, dropping tracking", () => {
    const data = {
      props: {
        pageProps: {
          pageProps: {
            results: {
              products: [
                { url: "/teste.html?origin=search", name: "Fixture" },
                { url: "https://evil.example/test.html", name: "Bad" },
                { url: "/kit.html", name: "Kit", isKit: true },
              ],
            },
          },
        },
      },
    };
    expect(
      searchProductLinks(
        `<script id="__NEXT_DATA__">${JSON.stringify(data)}</script>`,
      ),
    ).toEqual([
      { url: "https://www.drogasil.com.br/teste.html", name: "Fixture" },
    ]);
  });
});
