import manifest from "../data/manufacturerPhotos.json" with { type: "json" };
import { normalize, type Medicine } from "./catalog.ts";

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
}
export const manufacturerPhotos: readonly ManufacturerPhoto[] = manifest;
export const manufacturerCopyright =
  "® Opella Healthcare Brazil Ltda - Todos os direitos reservados";
const hosts = new Set(["www.dorflex.com.br", "www.novalgina.com.br"]);

export function isManufacturerPhoto(p: ManufacturerPhoto): boolean {
  try {
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

export function manufacturerPhotosFor(m: Medicine): ManufacturerPhoto[] {
  if (!m.registration || !m.registration.holder?.includes("38391432000143"))
    return [];
  return manufacturerPhotos.filter(
    (p) =>
      isManufacturerPhoto(p) &&
      p.registration === m.registration?.number &&
      normalize(p.name) === normalize(m.name) &&
      normalize(p.ingredient) === normalize(m.ingredient),
  );
}

/** Verify private native downloads before displaying or caching them. */
export async function verifiedManufacturerImage(
  data: unknown,
  p: Pick<ManufacturerPhoto, "sha256" | "bytes">,
): Promise<string> {
  if (typeof data !== "string" || data.length > 1_400_000)
    throw Error("A imagem recebida tem formato ou tamanho inválido.");
  // Android's native Base64.DEFAULT inserts line breaks; iOS returns a single line.
  const base64 = data.replace(/[\t\n\r ]/g, "");
  if (base64.length > 1_333_336 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw Error("A imagem recebida tem formato ou tamanho inválido.");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (
    bytes.length !== p.bytes ||
    new TextDecoder().decode(bytes.slice(0, 4)) !== "RIFF" ||
    new TextDecoder().decode(bytes.slice(8, 12)) !== "WEBP"
  )
    throw Error("O conteúdo da imagem não corresponde ao arquivo conferido.");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== p.sha256)
    throw Error("A imagem mudou na origem e precisa ser conferida novamente.");
  return "data:image/webp;base64," + base64;
}
