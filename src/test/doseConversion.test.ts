import { describe, it, expect } from "vitest";
import { convertDose, type ConversionInput } from "../domain/doseConversion";
const base: ConversionInput = {
  prescribed: "1",
  prescribedUnit: "mg",
  strength: "0,5",
  strengthUnit: "mg",
  form: "tablet",
};
describe("exact quantity conversion, not clinical dose selection", () => {
  it("converts the user example without floating point drift", () => {
    expect(convertDose(base).quantity).toBe("2");
    expect(
      convertDose({ ...base, prescribed: "0,3", strength: "0,1" }).quantity,
    ).toBe("3");
  });
  it("equalizes mass units", () => {
    expect(
      convertDose({ ...base, prescribed: "500", prescribedUnit: "mcg" })
        .quantity,
    ).toBe("1");
    expect(
      convertDose({
        ...base,
        prescribed: "1",
        prescribedUnit: "g",
        strength: "500",
      }).quantity,
    ).toBe("2");
  });
  it("does not suggest dividing tablets or opening capsules", () => {
    for (const form of ["tablet", "capsule"] as const)
      expect(() => convertDose({ ...base, strength: "3", form })).toThrow(
        "unidades inteiras",
      );
  });
  it("checks liquids against the actual measuring graduation", () => {
    const liquid: ConversionInput = {
      ...base,
      form: "liquid",
      prescribed: "10",
      strength: "20",
      volume: "5",
      graduation: "0,5",
    };
    expect(convertDose(liquid).quantity).toBe("2,5");
    expect(() => convertDose({ ...liquid, graduation: "1" })).toThrow(
      "graduação",
    );
    expect(() => convertDose({ ...liquid, graduation: "" })).toThrow();
  });
  it("requires the specific dropper equivalence and whole drops", () => {
    const drops: ConversionInput = {
      ...base,
      form: "drops",
      volume: "1",
      dropsPerMl: "17",
    };
    expect(convertDose(drops).quantity).toBe("34");
    expect(() => convertDose({ ...drops, dropsPerMl: "" })).toThrow();
    expect(() => convertDose({ ...drops, prescribed: "0,1" })).toThrow(
      "inteiro de gotas",
    );
  });
  it("rejects ambiguous decimals, exponents, zero, negative and excessive input", () => {
    for (const value of [
      "0",
      "-1",
      "1.000",
      "0.5",
      "1e3",
      "NaN",
      "Infinity",
      "1/2",
      "999999999",
      "1,0000001",
    ])
      expect(() => convertDose({ ...base, prescribed: value })).toThrow();
  });
  it("does not produce a rounded repeating decimal", () => {
    expect(() =>
      convertDose({
        ...base,
        form: "liquid",
        prescribed: "1",
        strength: "3",
        volume: "1",
        graduation: "0,1",
      }),
    ).toThrow("Não arredonde");
  });
});
