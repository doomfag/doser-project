import { describe, it, expect } from "vitest";
import {
  createSearchIndex,
  searchIndex,
  type Medicine,
} from "../domain/catalog";
import {
  symptomContext,
  suggestSymptomQuery,
  refineSymptomQuery,
} from "../domain/symptoms";
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
  it("does not treat a negated symptom or a class-only extra term as a documented indication", () => {
    expect(searchIndex(index, "dor de cabeça sem febre", "symptoms")).toEqual(
      [],
    );
    const i = createSearchIndex([
      { ...medicine("headache-only", "Cefaleia"), drugClass: "Formigamento" },
    ]);
    expect(searchIndex(i, "dor de cabeça e formigamento", "symptoms")).toEqual(
      [],
    );
  });
  it("suggests corrected full queries without silently choosing medicines or dropping symptoms", () => {
    expect(suggestSymptomQuery("dor de cabessa e febr")).toEqual([
      "Dor de cabeça e febre",
    ]);
    expect(suggestSymptomQuery("diarrea")).toEqual(["Diarreia"]);
    expect(suggestSymptomQuery("tose e nariz entupido")).toEqual([
      "Tosse e nariz entupido",
    ]);
    expect(suggestSymptomQuery("paracetamol")).toEqual([]);
    expect(suggestSymptomQuery("qzxw")).toEqual([]);
    expect(searchIndex(index, "dor de cabessa e febr", "symptoms")).toEqual([]);
    expect(
      searchIndex(index, "dor de cabeça e sintoma desconhecido", "symptoms"),
    ).toEqual([]);
  });
  it("preserves additional symptoms when a broad belly query is clarified", () => {
    expect(
      refineSymptomQuery("Dor de barriga e febre", "Dor de barriga", "Gases"),
    ).toBe("Gases e febre");
    expect(
      refineSymptomQuery("Dor no estômago e enjoo", "Dor de barriga", "Azia"),
    ).toBe("Azia e enjoo");
  });
  it("recognizes urgent everyday words but does not list medicines to treat them", () => {
    const urgent = createSearchIndex([
      medicine("urgent-fixture", "Dor no peito e dispneia"),
    ]);
    expect(symptomContext("dificuldade para respirar").urgent).toBe(true);
    expect(searchIndex(urgent, "dor no peito", "symptoms")).toEqual([]);
    expect(searchIndex(urgent, "falta de ar", "medicines")).toEqual([]);
  });
  it("prioritizes product-specific documented indications without implying efficacy", () => {
    const direct = medicine("Z-product-document", "Cefaleia e febre");
    const indirect = {
      ...medicine("A-substance-reference", ""),
      facts: {},
      clinicalReferenceIds: ["test-ref"],
    };
    const refs = [
      {
        id: "test-ref",
        ingredients: ["Test"],
        facts: { indications: { text: "Cefaleia e febre", source } },
        subject: "Test reference",
      },
    ] as import("../domain/catalog").ClinicalReference[];
    expect(
      searchIndex(
        createSearchIndex([indirect, direct], refs),
        "dor de cabeça e febre",
        "symptoms",
      ).map((m) => m.id),
    ).toEqual(["Z-product-document", "A-substance-reference"]);
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
