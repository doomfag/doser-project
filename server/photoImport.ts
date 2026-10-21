import { retailerImageUrl } from "../src/domain/photoSources.ts";
export { retailerImageUrl } from "../src/domain/photoSources.ts";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { normalize, type Medicine } from "../src/domain/catalog.ts";

export interface PhotoIdentity {
  ean: string;
  registration: string;
  presentationRegistration: string;
  name: string;
  ingredient: string;
  holderCnpj: string;
  presentation: string;
  cmedSha256: string;
}
export interface PhotoCandidate extends PhotoIdentity {
  id: string;
  productTitle: string;
  src: string;
  sourcePage: string;
  sourceRegistration: string;
  registrationConflict: boolean;
  sourceMetadataSha256: string;
  position: number;
  sourceLabel: string;
  checkedAt: string;
  reviewStatus: "pending-file-review";
}

export function validEan(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{13}$/.test(value) ||
    /^0+$/.test(value)
  )
    return false;
  const sum = [...value.slice(0, 12)].reduce(
    (s, d, i) => s + Number(d) * (i % 2 ? 3 : 1),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(value[12]);
}

/** Join a barcode to an active registration, exact brand and holder. Never use name-only matching. */
export function buildPhotoIdentityIndex(
  bytes: Uint8Array,
  medicines: Medicine[],
) {
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const medicineIndex = new Map(
    medicines
      .filter((m) => m.registration)
      .map((m) => [m.registration!.number, m]),
  );
  const ambiguous = new Set<string>();
  const index = new Map<string, PhotoIdentity>();
  const rows = parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes), {
    bom: true,
    delimiter: ";",
    skip_empty_lines: true,
    max_record_size: 20000,
    columns: (headers: string[]) => {
      for (const key of [
        "REGISTRO",
        "PRODUTO",
        "CNPJ",
        "APRESENTAÇÃO",
        "EAN 1",
        "EAN 2",
        "EAN 3",
      ])
        if (!headers.includes(key)) throw Error("Formato CMED mudou: " + key);
      return headers;
    },
  }) as Record<string, string>[];
  if (!rows.length || rows.length > 100000)
    throw Error("Quantidade CMED inválida.");
  for (const row of rows) {
    const reg = row.REGISTRO.trim();
    if (!/^\d{13}$/.test(reg)) continue;
    const m = medicineIndex.get(reg.slice(0, 9));
    const cnpj = row.CNPJ.replace(/\D/g, "");
    if (
      !m?.registration ||
      m.registration.situation !== "Ativo" ||
      normalize(m.name) !== normalize(row.PRODUTO) ||
      !/^\d{14}$/.test(cnpj) ||
      !m.registration.holder?.startsWith(cnpj) ||
      !row["APRESENTAÇÃO"]?.trim()
    )
      continue;
    const identity = {
      registration: m.registration.number,
      presentationRegistration: reg,
      name: m.name,
      ingredient: m.ingredient,
      holderCnpj: cnpj,
      presentation: row["APRESENTAÇÃO"].trim(),
      cmedSha256: sourceHash,
    };
    for (const col of ["EAN 1", "EAN 2", "EAN 3"]) {
      const ean = row[col]?.trim();
      if (!validEan(ean)) continue;
      const previous = index.get(ean);
      if (
        previous &&
        (previous.registration !== identity.registration ||
          normalize(previous.presentation) !== normalize(identity.presentation))
      ) {
        ambiguous.add(ean);
        index.delete(ean);
        continue;
      }
      if (!ambiguous.has(ean)) index.set(ean, { ...identity, ean });
    }
  }
  return { index, ambiguous };
}

export function publicProductData(html: string): Record<string, unknown> {
  if (html.length > 8_000_000) throw Error("Página excede limite.");
  const match = html.match(
    /<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) throw Error("Página pública sem dados estruturados esperados.");
  const json = JSON.parse(match[1]);
  const product = json?.props?.pageProps?.productData;
  if (!product || typeof product !== "object")
    throw Error("Página não descreve um produto.");
  return product;
}

/** Public VTEX catalog metadata. No prices, stock or clinical text are imported. */
export function collectPagueMenosPhotos(
  raw: unknown,
  index: Map<string, PhotoIdentity>,
  checkedAt: string,
): PhotoCandidate[] {
  if (!Array.isArray(raw) || raw.length > 100)
    throw Error("Formato público VTEX mudou.");
  const photos: PhotoCandidate[] = [];
  for (const product of raw) {
    if (
      typeof product?.productName !== "string" ||
      product.productName.length > 300 ||
      !Array.isArray(product.items)
    )
      continue;
    let page: URL;
    try {
      page = new URL(product.link);
    } catch {
      continue;
    }
    if (
      page.origin !== "https://www.paguemenos.com.br" ||
      !/^\/[a-z0-9-]+\/p$/.test(page.pathname) ||
      page.search ||
      page.hash ||
      page.username ||
      page.password
    )
      continue;
    for (const item of product.items) {
      if (
        item.isKit ||
        !item.sellers?.some((s: { sellerId: string }) => s.sellerId === "1") ||
        !validEan(item.ean)
      )
        continue;
      const identity = index.get(item.ean);
      if (
        !identity ||
        !normalize(product.productName).includes(normalize(identity.name))
      )
        continue;
      const images = Array.isArray(item.images)
        ? item.images.filter((p: { imageUrl: unknown }) =>
            retailerImageUrl(p.imageUrl),
          )
        : [];
      const sourceRegistration = String(
        product.NumeroRegistroMS?.[0] ?? "",
      ).replace(/\D/g, "");
      const metadataHash = createHash("sha256")
        .update(
          JSON.stringify({
            sourcePage: page.href,
            title: product.productName,
            ean: item.ean,
            sourceRegistration,
            images: images.map((p: { imageUrl: string }) => p.imageUrl),
          }),
        )
        .digest("hex");
      const seen = new Set<string>();
      for (const [i, p] of images.slice(0, 12).entries()) {
        if (seen.has(p.imageUrl)) continue;
        seen.add(p.imageUrl);
        photos.push({
          ...identity,
          id:
            "pm-" +
            item.ean +
            "-" +
            createHash("sha256").update(p.imageUrl).digest("hex").slice(0, 12),
          productTitle: product.productName,
          src: p.imageUrl,
          sourcePage: page.href,
          sourceRegistration,
          registrationConflict:
            !!sourceRegistration &&
            sourceRegistration.slice(0, 9) !== identity.registration,
          sourceMetadataSha256: metadataHash,
          position: i,
          sourceLabel: "Pague Menos",
          checkedAt,
          reviewStatus: "pending-file-review",
        });
      }
    }
  }
  return photos;
}

export function collectProductPhotos(
  html: string,
  sourcePage: string,
  index: Map<string, PhotoIdentity>,
  checkedAt: string,
): PhotoCandidate[] {
  const url = new URL(sourcePage);
  if (
    url.origin !== "https://www.drogasil.com.br" ||
    !/^\/[a-z0-9-]+\.html$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw Error("Página de origem não permitida.");
  const product = publicProductData(html);
  if (product.is3p === true || product.kitComposition) return [];
  const ean = String(product.productEan ?? "");
  if (!validEan(ean)) return [];
  const identity = index.get(ean);
  if (!identity) return [];
  const title = typeof product.name === "string" ? product.name.trim() : "";
  if (
    !title ||
    title.length > 300 ||
    !normalize(title).includes(normalize(identity.name))
  )
    return [];
  const attrs = Array.isArray(product.custom_attributes)
    ? product.custom_attributes
    : [];
  const sourceRegistration = String(
    attrs.find((a) => a?.attribute_code === "ms")?.value_string?.[0] ?? "",
  ).replace(/\D/g, "");
  const gallery = Array.isArray(product.mediaGallery)
    ? product.mediaGallery
    : [];
  const images = gallery.filter(
    (p) =>
      p?.media_type === "image" &&
      p.disabled !== true &&
      p.disabled !== 1 &&
      retailerImageUrl(p.file),
  );
  const projection = {
    sourcePage,
    ean,
    title,
    sourceRegistration,
    images: images.map((p) => ({ src: p.file, position: p.position })),
  };
  const metadataHash = createHash("sha256")
    .update(JSON.stringify(projection))
    .digest("hex");
  const seen = new Set<string>();
  return images
    .flatMap((p, i) => {
      if (seen.has(p.file)) return [];
      seen.add(p.file);
      return [
        {
          ...identity,
          id:
            "rd-" +
            ean +
            "-" +
            createHash("sha256").update(p.file).digest("hex").slice(0, 12),
          productTitle: title,
          src: p.file,
          sourcePage: url.href,
          sourceRegistration,
          registrationConflict:
            !!sourceRegistration &&
            sourceRegistration.slice(0, 9) !== identity.registration,
          sourceMetadataSha256: metadataHash,
          position: Number.isSafeInteger(p.position) ? p.position : i,
          sourceLabel: "Drogasil",
          checkedAt,
          reviewStatus: "pending-file-review" as const,
        },
      ];
    })
    .slice(0, 12);
}

export function searchProductLinks(
  html: string,
): { url: string; name: string }[] {
  const match = html.match(
    /<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) throw Error("Pesquisa sem dados estruturados.");
  const products = JSON.parse(match[1])?.props?.pageProps?.pageProps?.results
    ?.products;
  if (!Array.isArray(products)) throw Error("Formato de pesquisa mudou.");
  return products
    .filter(
      (p) =>
        !p.isKit &&
        !p.isThirdPartner &&
        typeof p.url === "string" &&
        typeof p.name === "string",
    )
    .flatMap((p) => {
      const u = new URL(p.url, "https://www.drogasil.com.br");
      return u.origin === "https://www.drogasil.com.br" &&
        /^\/[a-z0-9-]+\.html$/.test(u.pathname)
        ? [{ url: u.origin + u.pathname, name: p.name }]
        : [];
    });
}
