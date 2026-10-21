import {
  parseCatalog,
  parseClinicalReferences,
  assertReferenceLinks,
  type ClinicalReference,
  type Medicine,
} from "../domain/catalog";
export interface EmbeddedCatalog {
  version: 1;
  medicines: Medicine[];
  clinicalReferences: ClinicalReference[];
  status: {
    lastSuccess: string;
    count: number;
    report?: {
      rows: number;
      included: number;
      excluded: number;
      duplicates: number;
      missingIngredient: number;
      sha256: string;
    };
  };
}
export async function readEmbeddedCatalog(): Promise<EmbeddedCatalog | null> {
  const element = document.getElementById("doser-catalog");
  if (!element?.textContent) return null;
  if (element.textContent.length > 100 * 1024 * 1024)
    throw new Error("Base incluída excede o limite permitido.");
  const envelope = JSON.parse(element.textContent);
  if (envelope.encoding === "web-json") {
    if (
      document.documentElement.dataset.doserPwa !== "true" ||
      document.documentElement.dataset.doserStandalone !== "true" ||
      !/^[a-f0-9]{64}$/.test(envelope.sha256)
    )
      throw Error("Base web inválida.");
    const bytes = new TextEncoder().encode(JSON.stringify(envelope.snapshot));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = [...digest]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== envelope.sha256)
      throw Error("A integridade da base web não confere.");
    return validateSnapshot(envelope.snapshot);
  }
  if (envelope.encoding === "native-json") {
    if (document.documentElement.dataset.doserNative !== "true")
      throw new Error("Formato de base exclusivo de aplicativo empacotado.");
    return validateSnapshot(envelope.snapshot);
  }
  if (
    envelope.encoding !== "gzip-base64" ||
    typeof envelope.data !== "string" ||
    envelope.data.length > 16_000_000 ||
    !/^[a-f0-9]{64}$/.test(envelope.sha256)
  )
    throw new Error(
      "A base incluída neste arquivo é inválida. Baixe uma nova cópia.",
    );
  const bytes = Uint8Array.from(atob(envelope.data), (c) => c.charCodeAt(0));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== envelope.sha256)
    throw new Error(
      "A integridade da base incluída não confere. O catálogo não foi carregado.",
    );
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 100 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("A base incluída excede o limite permitido.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const raw = await new Blob(chunks as BlobPart[]).text();
  const snapshot = JSON.parse(raw);
  return validateSnapshot(snapshot);
}
function validateSnapshot(snapshot: unknown): EmbeddedCatalog {
  const value = snapshot as {
    clinicalReferences?: unknown;
    status?: EmbeddedCatalog["status"];
  };
  const medicines = parseCatalog(snapshot);
  const clinicalReferences = parseClinicalReferences(
    value.clinicalReferences ?? [],
  );
  assertReferenceLinks(medicines, clinicalReferences);
  if (
    !value.status ||
    typeof value.status.lastSuccess !== "string" ||
    !Number.isFinite(Date.parse(value.status.lastSuccess)) ||
    value.status.count !== medicines.length
  )
    throw new Error("Os metadados da base incluída estão incompletos.");
  return { version: 1, medicines, clinicalReferences, status: value.status };
}
