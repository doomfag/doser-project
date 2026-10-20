import { describe, it, expect } from "vitest";
import {
  createSearchIndex,
  searchIndex,
  type Medicine,
} from "../domain/catalog";
import { symptomContext } from "../domain/symptoms";
const source = {
  title: "Synthetic",
  url: "https://example.org/source",
  checkedAt: "2026-10-20",
  version: "test",
  status: "validated" as const,
};
const medicine = (
  id: string,
  indication: string,
  status: "validated" | "pending" = "validated",
): Medicine => ({
  id,
  name: id,
  ingredient: "Test",
  drugClass: "test",
  aliases: [],
  presentations: [],
  facts: { indications: { text: indication, source: { ...source, status } } },
});
describe("plain language symptom search", () => {
  const index = createSearchIndex([
    medicine("headache", "Cefaleia e febre"),
    medicine("nausea", "Náuseas"),
    medicine("pending", "Dor de cabeça", "pending"),
    medicine("migraine-prevention", "Prevenção da enxaqueca"),
  ]);
  it("understands everyday words in the default medicine mode", () => {
    expect(
      searchIndex(index, "dor de cabeça", "medicines").map((m) => m.id),
    ).toEqual(["headache"]);
    expect(searchIndex(index, "enjoo", "medicines").map((m) => m.id)).toEqual([
      "nausea",
    ]);
  });
  it("requires all combined symptoms in documented indications", () => {
    expect(
      searchIndex(index, "dor de cabeça e febre", "symptoms"),
    ).toHaveLength(1);
    expect(
      searchIndex(index, "dor de cabeça e enjoo", "symptoms"),
    ).toHaveLength(0);
  });
  it("does not turn migraine prevention into treatment for any headache", () => {
    expect(
      searchIndex(index, "dor de cabeça", "symptoms").some(
        (m) => m.id === "migraine-prevention",
      ),
    ).toBe(false);
  });
  it("accepts belly and stomach words with simple clarification", () => {
    for (const q of ["dor de barriga", "dor no estômago", "dor estomago"]) {
      expect(symptomContext(q).broad).toBe(true);
      expect(symptomContext(q).options).toContain("Gases");
    }
    expect(searchIndex(index, "dor de barriga", "medicines")).toEqual([]);
  });
  it("never invents a result from a pharmacological class", () => {
    const i = createSearchIndex([
      { ...medicine("class-only", ""), drugClass: "Antidiarreicos", facts: {} },
    ]);
    expect(searchIndex(i, "diarreia", "medicines")).toEqual([]);
  });
});
