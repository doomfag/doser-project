import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  enrichClinical,
  loadClinicalManifest,
  type ClinicalManifest,
} from "./clinical";
import {
  assertReferenceLinks,
  clinicalReferencesFor,
  createSearchIndex,
  searchIndex,
  type Medicine,
} from "../src/domain/catalog";
const pdf = Buffer.from(
  "%PDF-1.7\nSynthetic document for hash verification tests only.",
);
const hash = createHash("sha256").update(pdf).digest("hex");
const source = {
  title: "Synthetic source",
  url: "https://www.gov.br/saude/test.pdf",
  version: hash,
  checkedAt: "2026-01-01",
  kind: "guideline" as const,
  status: "validated" as const,
};
const manifest: ClinicalManifest = {
  version: 1,
  documents: [
    { id: "doc", title: source.title, url: source.url, sha256: hash },
  ],
  references: [
    {
      id: "ref",
      documentId: "doc",
      subject: "Test context",
      ingredients: ["Substância A"],
      scope: "Synthetic documentary context only.",
      presentations: [],
      facts: { indications: { text: "Condição documental de teste", source } },
      usage: [
        {
          id: "use",
          presentation: "Synthetic form",
          population: "Synthetic population",
          dose: "Text for daily dose basis only",
          doseBasis: "per-day",
          source,
        },
      ],
      source,
    },
  ],
};
const medicine = (ingredient: string): Medicine => ({
  id: ingredient,
  name: "Synthetic record",
  ingredient,
  drugClass: "Test",
  aliases: [],
  presentations: [],
  facts: {},
});
const validFetch = (async () => new Response(pdf)) as typeof fetch;
describe("versioned official clinical references", () => {
  it("validates curated source versions and locators", async () => {
    const curated = await loadClinicalManifest();
    expect(curated.references).toHaveLength(30);
    expect(curated.documents).toHaveLength(4);
    expect(
      curated.references.every((r) => r.usage.every((u) => !!u.doseBasis)),
    ).toBe(true);
  });
  it("links only the exact ingredient, excluding combinations and different salts", async () => {
    const result = await enrichClinical(
      [
        medicine("substancia a"),
        medicine("Substância A + B"),
        medicine("Sal de substância A"),
      ],
      manifest,
      undefined,
      validFetch,
    );
    expect(result.clinicalStatus.coveredRecords).toBe(1);
    expect(result.medicines[0].clinicalReferenceIds).toEqual(["ref"]);
    expect(result.medicines[1].clinicalReferenceIds).toBeUndefined();
    expect(result.medicines[0].presentations).toEqual([]);
    expect(result.medicines[0].facts).toEqual({});
    expect(result.clinicalReferences[0].usage[0].doseBasis).toBe("per-day");
  });
  it("withdraws old references if the PDF version changes", async () => {
    const old = await enrichClinical(
      [medicine("substancia a")],
      manifest,
      undefined,
      validFetch,
    );
    const result = await enrichClinical(
      old.medicines,
      manifest,
      old.clinicalStatus,
      (async () => new Response("%PDF-1.7 changed")) as typeof fetch,
    );
    expect(result.clinicalStatus.documents[0].status).toBe("changed");
    expect(result.clinicalReferences).toEqual([]);
    expect(result.medicines[0].clinicalReferenceIds).toBeUndefined();
  });
  it("keeps the old verified date during an outage but never invents an initial verification", async () => {
    const failed = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const old = await enrichClinical([], manifest, undefined, validFetch);
    const result = await enrichClinical(
      [],
      manifest,
      old.clinicalStatus,
      failed,
    );
    expect(result.clinicalStatus.documents[0].status).toBe("cached");
    expect(result.clinicalStatus.documents[0].checkedAt).toBe(
      old.clinicalStatus.documents[0].checkedAt,
    );
    expect(
      (await enrichClinical([], manifest, undefined, failed))
        .clinicalReferences,
    ).toEqual([]);
  });
  it("does not treat HTML as a verified document", async () => {
    const result = await enrichClinical(
      [],
      manifest,
      undefined,
      (async () => new Response("<html>blocked</html>")) as typeof fetch,
    );
    expect(result.clinicalStatus.documents[0].status).toBe("unavailable");
  });
  it("rejects missing or incompatible reference links", () => {
    expect(() =>
      assertReferenceLinks(
        [{ ...medicine("B"), clinicalReferenceIds: ["ref"] }],
        manifest.references,
      ),
    ).toThrow();
    expect(() =>
      assertReferenceLinks(
        [{ ...medicine("Substância A"), clinicalReferenceIds: ["missing"] }],
        manifest.references,
      ),
    ).toThrow();
    expect(
      clinicalReferencesFor(
        { ...medicine("B"), clinicalReferenceIds: ["ref"] },
        manifest.references,
      ),
    ).toEqual([]);
  });
  it("indexes documented conditions without using them as symptom diagnoses", async () => {
    const result = await enrichClinical(
      [medicine("substancia a")],
      manifest,
      undefined,
      validFetch,
    );
    const index = createSearchIndex(
      result.medicines,
      result.clinicalReferences,
    );
    expect(searchIndex(index, "condição documental", "symptoms")).toHaveLength(
      1,
    );
    expect(searchIndex(index, "dor de cabeça e febre", "symptoms")).toEqual([]);
  });
});

describe("official public JSON documentary versions", () => {
  it("withdraws clinical references when the approved text changes", async () => {
    const { officialText } = await import("./officialDocument");
    const body = {
      title: "Synthetic official notice",
      effective: "2026-10-20",
      description: "Fixture",
      blocks_layout: { items: ["one"] },
      blocks: { one: { plaintext: "Original approved text" } },
    };
    const version = createHash("sha256")
      .update(officialText(body))
      .digest("hex");
    const url = "https://www.gov.br/anvisa/pt-br/test";
    const s = { ...source, url, version, kind: "regulatory" as const };
    const m: ClinicalManifest = {
      version: 1,
      documents: [
        {
          id: "json",
          title: s.title,
          url,
          sha256: version,
          format: "plone-json",
        },
      ],
      references: [
        {
          ...manifest.references[0],
          documentId: "json",
          source: s,
          usage: [],
          facts: { indications: { text: "Fixture", source: s } },
        },
      ],
    };
    let requested = "";
    const ok = await enrichClinical([], m, undefined, (async (u) => {
      requested = String(u);
      return Response.json(body);
    }) as typeof fetch);
    expect(requested).toBe("https://www.gov.br/anvisa/++api++/pt-br/test");
    expect(ok.clinicalReferences).toHaveLength(1);
    const changed = await enrichClinical([], m, ok.clinicalStatus, (async () =>
      Response.json({
        ...body,
        blocks: { one: { plaintext: "Changed approved text" } },
      })) as typeof fetch);
    expect(changed.clinicalReferences).toHaveLength(0);
    expect(changed.clinicalStatus.documents[0].status).toBe("changed");
  });
  it("ignores navigation metadata, but rejects absent text", async () => {
    const { officialText } = await import("./officialDocument");
    const d = {
      title: "Fixture",
      blocks_layout: { items: ["a"] },
      blocks: { a: { plaintext: "Clinical text" } },
    };
    expect(officialText({ ...d, navigation: "A" })).toBe(
      officialText({ ...d, navigation: "B" }),
    );
    expect(() => officialText({ title: "Empty" })).toThrow();
  });
});

it("does not attach route-specific reference-only documents to every registration of the ingredient", async () => {
  const restricted: ClinicalManifest = {
    ...manifest,
    references: manifest.references.map((r) => ({ ...r, referenceOnly: true })),
  };
  const result = await enrichClinical(
    [medicine("substancia a")],
    restricted,
    undefined,
    validFetch,
  );
  expect(result.clinicalReferences).toHaveLength(1);
  expect(result.medicines[0].clinicalReferenceIds).toBeUndefined();
  expect(() =>
    assertReferenceLinks(
      [{ ...medicine("substancia a"), clinicalReferenceIds: ["ref"] }],
      restricted.references,
    ),
  ).toThrow();
});
