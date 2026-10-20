import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  importPresentations,
  applyPresentations,
  enrichPresentations,
  CMED_URL,
} from "./presentations";
import { type Medicine, parseCatalog } from "../src/domain/catalog";
import { presentationLabel } from "../src/domain/presentationLabel";
const source = {
  title: "Synthetic CMED fixture",
  url: CMED_URL,
  kind: "registry" as const,
  checkedAt: "2026-01-01",
  version: "a".repeat(64),
  status: "validated" as const,
};
const m: Medicine = {
  id: "test",
  name: "Product A",
  ingredient: "Fixture",
  drugClass: "Fixture",
  aliases: [],
  presentations: [],
  facts: {},
  registration: { number: "123456789", situation: "Test only", source },
};
const csv = Buffer.from(
  "\uFEFFREGISTRO;PRODUTO;APRESENTAÇÃO;PMC 0%\n1234567890001;Product A;500 MG COM CT BL AL X 20;99,99\n1234567890002;Product A;750 MG COM CT BL AL X 10;88,88\n1234567890003;Wrong name;Wrong product;1,00\n0000000000000;Product A;Invalid registration;1,00\n",
);
describe("official CMED presentations, separate from clinical use and commercial prices", () => {
  it("imports UTF-8 BOM CSV and discards price columns", () => {
    const rows = importPresentations(csv);
    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "name",
      "presentation",
      "registration",
    ]);
  });
  it("joins only the full registration prefix and matching product name", () => {
    const rows = importPresentations(csv);
    const result = applyPresentations(
      [m, { ...m, id: "other", name: "Different" }],
      rows,
      source,
    );
    expect(result[0].presentations).toHaveLength(2);
    expect(result[1].presentations).toEqual([]);
    expect(result[0].facts).toEqual({});
    expect(result[0].usage).toBeUndefined();
    expect(
      parseCatalog({ version: 1, medicines: result })[0].presentationSource
        ?.url,
    ).toBe(CMED_URL);
  });
  it("rejects changed schemas instead of assuming column positions", () => {
    expect(() =>
      importPresentations(Buffer.from("PRODUTO;OTHER\nA;B")),
    ).toThrow();
  });
  it("expands common forms without calculating units or doses", () => {
    expect(presentationLabel("500 MG COM REV CT BL AL X 20")).toContain(
      "500 mg comprimidos revestidos",
    );
    expect(presentationLabel("500 MG COM CT BL AL X 2 X 10")).toContain(
      "2 × 10",
    );
  });
  it("preserves old metadata dates when refreshing fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "doser-cmed-"));
    try {
      await enrichPresentations(
        [m],
        dir,
        (async () => new Response(csv)) as typeof fetch,
      );
      const old = await enrichPresentations([m], dir, (async () => {
        throw Error("offline");
      }) as typeof fetch);
      expect(old.status.status).toBe("cached");
      expect(old.medicines[0].presentations).toHaveLength(2);
      expect(old.medicines[0].presentationSource?.version).toHaveLength(64);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("uses the seeded snapshot when no separate cache exists and the source is offline", async () => {
    const dir = await mkdtemp(join(tmpdir(), "doser-cmed-seed-"));
    try {
      const old = {
        ...m,
        presentations: ["500 MG COM"],
        presentationSource: source,
      };
      await writeFile(
        join(dir, "catalog.json"),
        JSON.stringify({ version: 1, medicines: [old] }),
      );
      const result = await enrichPresentations([m], dir, (async () => {
        throw Error("offline");
      }) as typeof fetch);
      expect(result.status.status).toBe("cached");
      expect(result.medicines[0].presentationSource?.checkedAt).toBe(
        "2026-01-01",
      );
      expect(result.medicines[0].presentations).toEqual(["500 MG COM"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("withdraws old CMED presentations if a fresh full list no longer contains that product", () => {
    expect(
      applyPresentations(
        [{ ...m, presentations: ["old"], presentationSource: source }],
        [],
        source,
      )[0].presentations,
    ).toEqual([]);
  });
});
