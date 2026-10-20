import type { PresentationStatus } from "./presentations.ts";
import { officialText } from "./officialDocument.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  normalize,
  parseClinicalReferences,
  type ClinicalReference,
  type Medicine,
} from "../src/domain/catalog.ts";
export interface ClinicalDocument {
  id: string;
  title: string;
  url: string;
  sha256: string;
  format?: "pdf" | "plone-json";
}
export interface ClinicalDocumentState {
  id: string;
  title: string;
  status: "verified" | "cached" | "changed" | "unavailable";
  version?: string;
  checkedAt?: string;
  message?: string;
}
export interface ClinicalStatus {
  references: number;
  coveredRecords: number;
  documents: ClinicalDocumentState[];
}
export interface ClinicalManifest {
  version: number;
  documents: ClinicalDocument[];
  references: ClinicalReference[];
}
export interface EnrichedCatalog {
  presentationStatus?: PresentationStatus;
  medicines: Medicine[];
  clinicalReferences: ClinicalReference[];
  clinicalStatus: ClinicalStatus;
}
export type ClinicalEnricher = (
  medicines: Medicine[],
  previous?: ClinicalStatus,
) => Promise<EnrichedCatalog>;
export async function loadClinicalManifest(
  path = resolve("data/clinical/curated.json"),
): Promise<ClinicalManifest> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  if (
    raw.version !== 1 ||
    !Array.isArray(raw.documents) ||
    raw.documents.length > 30
  )
    throw new Error("Manifesto clínico inválido.");
  for (const document of raw.documents) {
    const url = new URL(document.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.gov.br" ||
      !(
        url.pathname.startsWith("/saude/") ||
        url.pathname.startsWith("/anvisa/pt-br/")
      ) ||
      (document.format !== undefined &&
        !["pdf", "plone-json"].includes(document.format)) ||
      (document.format === "plone-json" &&
        !url.pathname.startsWith("/anvisa/pt-br/")) ||
      !/^\w[\w-]{0,99}$/.test(document.id) ||
      !String(document.title).trim() ||
      !/^[a-f0-9]{64}$/.test(document.sha256)
    )
      throw new Error("Fonte clínica não autorizada no manifesto.");
  }
  const references = parseClinicalReferences(raw.references);
  if (
    references.some(
      (r) =>
        !raw.documents.some(
          (d: ClinicalDocument) =>
            d.id === r.documentId &&
            d.sha256 === r.source.version &&
            ["guideline", "regulatory"].includes(r.source.kind ?? "") &&
            new URL(r.source.url).href.split("#")[0] === d.url &&
            [
              ...Object.values(r.facts).map((f) => f!.source),
              ...r.usage.map((u) => u.source),
            ].every(
              (s) =>
                s.version === d.sha256 &&
                s.kind === r.source.kind &&
                s.status === "validated" &&
                new URL(s.url).href.split("#")[0] === d.url,
            ),
        ),
    )
  )
    throw new Error("Referência sem versão documental correspondente.");
  return { version: 1, documents: raw.documents, references };
}
async function documentHash(response: Response): Promise<string> {
  if (!response.body) throw new Error("Documento vazio.");
  const reader = response.body.getReader();
  const hash = createHash("sha256");
  let size = 0;
  let signature = Buffer.alloc(0);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 15 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Documento excede o limite de 15 MiB.");
      }
      if (signature.length < 5)
        signature = Buffer.concat([signature, Buffer.from(value)]).subarray(
          0,
          5,
        );
      hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (signature.toString() !== "%PDF-")
    throw new Error("A fonte não retornou um PDF.");
  return hash.digest("hex");
}
export async function enrichClinical(
  medicines: Medicine[],
  manifest: ClinicalManifest,
  previous?: ClinicalStatus,
  request: typeof fetch = fetch,
): Promise<EnrichedCatalog> {
  const documents = await Promise.all(
    manifest.documents.map(async (doc) => {
      const old = previous?.documents.find(
        (d) =>
          d.id === doc.id &&
          d.version === doc.sha256 &&
          ["verified", "cached"].includes(d.status) &&
          !!d.checkedAt &&
          Number.isFinite(Date.parse(d.checkedAt)),
      );
      try {
        const verificationUrl =
          doc.format === "plone-json"
            ? doc.url.replace("/anvisa/pt-br/", "/anvisa/++api++/pt-br/")
            : doc.url;
        const response = await request(verificationUrl, {
          signal: AbortSignal.timeout(30_000),
          redirect: "error",
          headers: {
            Accept:
              doc.format === "plone-json"
                ? "application/json"
                : "application/pdf",
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let version: string;
        if (doc.format === "plone-json") {
          if (!response.body) throw new Error("Documento JSON vazio.");
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.length;
              if (size > 2_000_000) {
                await reader.cancel();
                throw new Error("Documento JSON excede o limite.");
              }
              chunks.push(part.value);
            }
          } finally {
            reader.releaseLock();
          }
          const raw = Buffer.concat(chunks).toString("utf8");
          version = createHash("sha256")
            .update(officialText(JSON.parse(raw)))
            .digest("hex");
        } else version = await documentHash(response);
        if (version !== doc.sha256)
          return {
            id: doc.id,
            title: doc.title,
            status: "changed" as const,
            version,
            checkedAt: new Date().toISOString(),
            message:
              "O documento mudou. Seus esquemas foram retirados da consulta até conferência da nova versão.",
          };
        return {
          id: doc.id,
          title: doc.title,
          status: "verified" as const,
          version,
          checkedAt: new Date().toISOString(),
        };
      } catch {
        return old
          ? {
              ...old,
              status: "cached" as const,
              message:
                "Verificação indisponível; mantida a versão documental anteriormente conferida, com sua data original.",
            }
          : {
              id: doc.id,
              title: doc.title,
              status: "unavailable" as const,
              message:
                "Documento indisponível e sem versão anterior verificada. Nenhuma dose foi anexada.",
            };
      }
    }),
  );
  const usable = new Map(
    documents
      .filter((d) => ["verified", "cached"].includes(d.status))
      .map((d) => [d.id, d]),
  );
  const references = manifest.references
    .filter((r) => usable.has(r.documentId))
    .map((r) => {
      const date = usable.get(r.documentId)!.checkedAt!.slice(0, 10);
      const source = (s: ClinicalReference["source"]) => ({
        ...s,
        checkedAt: date,
      });
      return {
        ...r,
        source: source(r.source),
        facts: Object.fromEntries(
          Object.entries(r.facts).map(([key, fact]) => [
            key,
            { ...fact!, source: source(fact!.source) },
          ]),
        ),
        usage: r.usage.map((u) => ({ ...u, source: source(u.source) })),
      };
    });
  const records = medicines.map((m) => {
    const { clinicalReferenceIds: discarded, ...rest } = m;
    void discarded;
    const ids = references
      .filter(
        (r) =>
          !r.referenceOnly &&
          r.ingredients.some((i) => normalize(i) === normalize(m.ingredient)),
      )
      .map((r) => r.id);
    return { ...rest, ...(ids.length ? { clinicalReferenceIds: ids } : {}) };
  });
  return {
    medicines: records,
    clinicalReferences: references,
    clinicalStatus: {
      references: references.length,
      coveredRecords: records.filter((m) => m.clinicalReferenceIds?.length)
        .length,
      documents,
    },
  };
}
export const updateClinical: ClinicalEnricher = async (medicines, previous) =>
  enrichClinical(medicines, await loadClinicalManifest(), previous);
