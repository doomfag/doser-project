import manifest from "../data/manufacturerPhotos.json" with { type: "json" };
import { normalize, type Medicine } from "./catalog.ts";
import { retailerPageMatches } from "./photoSources.ts";

export interface ManufacturerPhoto {
  id: string;
  name: string;
  registration: string;
  ingredient: string;
  label: string;
  src: string;
  sourcePage: string;
  sha256: string;
  bytes: number;
  checkedAt: string;
  sourceKind?: "retailer";
  sourceLabel?: string;
  holderCnpj?: string;
  productTitle?: string;
  ean?: string;
  presentation?: string;
  sourceRegistration?: string;
  registrationConflict?: boolean;
  sourceMetadataSha256?: string;
  cmedSha256?: string;
  contentType?: "image/webp" | "image/jpeg" | "image/png";
  width?: number;
  height?: number;
  position?: number;
  reviewStatus?: "validated-file";
}
export const manufacturerPhotos = manifest as readonly ManufacturerPhoto[];
export const manufacturerCopyright =
  "® Opella Healthcare Brazil Ltda - Todos os direitos reservados";
const hosts = new Set(["www.dorflex.com.br", "www.novalgina.com.br"]);

export function isManufacturerPhoto(p: ManufacturerPhoto): boolean {
  try {
    if (p.sourceKind === "retailer") {
      const checksum = (value: string) => {
        const sum = [...value.slice(0, 12)].reduce(
          (s, d, i) => s + Number(d) * (i % 2 ? 3 : 1),
          0,
        );
        return (10 - (sum % 10)) % 10 === Number(value[12]);
      };
      return (
        retailerPageMatches(p.src, p.sourcePage, p.sourceLabel ?? "") &&
        p.reviewStatus === "validated-file" &&
        /^\d{13}$/.test(p.ean ?? "") &&
        checksum(p.ean!) &&
        /^\d{9}$/.test(p.registration) &&
        /^\d{14}$/.test(p.holderCnpj ?? "") &&
        /^[a-f0-9]{64}$/.test(p.sha256) &&
        /^[a-f0-9]{64}$/.test(p.sourceMetadataSha256 ?? "") &&
        /^[a-f0-9]{64}$/.test(p.cmedSha256 ?? "") &&
        p.bytes > 12 &&
        p.bytes <= 2_000_000 &&
        ["image/webp", "image/jpeg", "image/png"].includes(
          p.contentType ?? "",
        ) &&
        Number.isSafeInteger(p.width) &&
        Number.isSafeInteger(p.height) &&
        p.width! >= 80 &&
        p.height! >= 80 &&
        p.width! * p.height! <= 24_000_000 &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.checkedAt)
      );
    }
    const src = new URL(p.src);
    const page = new URL(p.sourcePage);
    return (
      hosts.has(src.hostname) &&
      src.origin === page.origin &&
      src.protocol === "https:" &&
      !src.username &&
      !src.password &&
      !page.username &&
      !page.password &&
      !src.port &&
      !src.hash &&
      !src.search &&
      src.pathname.startsWith("/dam/jcr:") &&
      src.pathname.endsWith(".webp") &&
      page.pathname.startsWith("/produtos/") &&
      /^\d{9}$/.test(p.registration) &&
      /^[a-f0-9]{64}$/.test(p.sha256) &&
      p.bytes > 12 &&
      p.bytes <= 1_000_000 &&
      /^\d{4}-\d{2}-\d{2}$/.test(p.checkedAt)
    );
  } catch {
    return false;
  }
}

const indexedPhotos = new Map<string, ManufacturerPhoto[]>();
for (const p of manufacturerPhotos)
  if (isManufacturerPhoto(p)) {
    const list = indexedPhotos.get(p.registration) ?? [];
    list.push(p);
    indexedPhotos.set(p.registration, list);
  }
export function manufacturerPhotosFor(m: Medicine): ManufacturerPhoto[] {
  if (!m.registration) return [];
  return (indexedPhotos.get(m.registration.number) ?? []).filter(
    (p) =>
      !!m.registration?.holder?.startsWith(p.holderCnpj ?? "38391432000143") &&
      p.registration === m.registration?.number &&
      normalize(p.name) === normalize(m.name) &&
      normalize(p.ingredient) === normalize(m.ingredient),
  );
}

/** Verify private native downloads before displaying or caching them. */
export async function verifiedManufacturerImage(
  data: unknown,
  p: Pick<ManufacturerPhoto, "sha256" | "bytes" | "contentType">,
): Promise<string> {
  if (typeof data !== "string" || data.length > 2_800_000)
    throw Error("A imagem recebida tem formato ou tamanho inválido.");
  // Android's native Base64.DEFAULT inserts line breaks; iOS returns a single line.
  const base64 = data.replace(/[\t\n\r ]/g, "");
  if (base64.length > 2_666_668 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw Error("A imagem recebida tem formato ou tamanho inválido.");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const mime = p.contentType ?? "image/webp";
  const signature =
    mime === "image/webp"
      ? new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
      : mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : mime === "image/png" &&
          [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (bytes.length !== p.bytes || !signature)
    throw Error("O conteúdo da imagem não corresponde ao arquivo conferido.");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== p.sha256)
    throw Error("A imagem mudou na origem e precisa ser conferida novamente.");
  return "data:" + mime + ";base64," + base64;
}

export function photoPresentationGroups(photos: readonly ManufacturerPhoto[]) {
  const groups = new Map<
    string,
    { id: string; label: string; photos: ManufacturerPhoto[] }
  >();
  for (const photo of photos) {
    const id = photo.ean ?? photo.id;
    const g = groups.get(id) ?? {
      id,
      label: photo.productTitle ?? photo.label,
      photos: [],
    };
    if (!g.photos.some((p) => p.sha256 === photo.sha256)) g.photos.push(photo);
    groups.set(id, g);
  }
  return [...groups.values()];
}
