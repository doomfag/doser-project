import { afterEach, describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { readEmbeddedCatalog } from "../data/embeddedCatalog";
const snapshot = {
  version: 1,
  medicines: [
    {
      id: "fixture",
      name: "Synthetic fixture <only>",
      ingredient: "Fixture",
      drugClass: "Fixture",
      aliases: [],
      presentations: [],
      facts: {},
    },
  ],
  clinicalReferences: [],
  status: { count: 1, lastSuccess: "2026-10-21T00:00:00Z" },
};
const sha256 = createHash("sha256")
  .update(JSON.stringify(snapshot))
  .digest("hex");
function documentFor(value: unknown, pwa = true) {
  vi.stubGlobal("document", {
    documentElement: {
      dataset: { doserPwa: String(pwa), doserStandalone: "true" },
    },
    getElementById: () => ({ textContent: JSON.stringify(value) }),
  });
}
afterEach(() => vi.unstubAllGlobals());
describe("offline web snapshot", () => {
  it("loads a valid hashed snapshot without relying on gzip support", async () => {
    documentFor({ encoding: "web-json", snapshot, sha256 });
    const result = await readEmbeddedCatalog();
    expect(result?.medicines[0].name).toBe("Synthetic fixture <only>");
  });
  it("rejects changed bytes instead of displaying an unverified catalog", async () => {
    documentFor({
      encoding: "web-json",
      snapshot: { ...snapshot, status: { ...snapshot.status, count: 2 } },
      sha256,
    });
    await expect(readEmbeddedCatalog()).rejects.toThrow("integridade");
  });
  it("accepts this format only in the standalone web distribution", async () => {
    documentFor({ encoding: "web-json", snapshot, sha256 }, false);
    await expect(readEmbeddedCatalog()).rejects.toThrow("Base web inválida");
  });
});
