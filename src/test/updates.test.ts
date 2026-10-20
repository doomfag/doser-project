import { describe, expect, it } from "vitest";
import { RETRY_DELAY, shouldCheck, WEEK } from "../domain/updateSchedule";
import { parseCatalog, type UsageEntry } from "../domain/catalog";
const now = Date.UTC(2026, 9, 20, 12);
const date = (offset: number) => new Date(now - offset).toISOString();
describe("agenda de atualizações", () => {
  it("verifica a primeira base e após uma semana", () => {
    expect(shouldCheck({ automatic: true }, undefined, now)).toBe(true);
    expect(shouldCheck({ automatic: true }, date(WEEK), now)).toBe(true);
  });
  it("respeita opção desligada e uma base recente", () => {
    expect(shouldCheck({ automatic: false }, undefined, now)).toBe(false);
    expect(shouldCheck({ automatic: true }, date(WEEK - 1), now)).toBe(false);
  });
  it("evita repetição em falhas por uma hora", () => {
    expect(
      shouldCheck(
        { automatic: true, lastAttempt: date(RETRY_DELAY - 1) },
        undefined,
        now,
      ),
    ).toBe(false);
    expect(
      shouldCheck(
        { automatic: true, lastAttempt: date(RETRY_DELAY) },
        undefined,
        now,
      ),
    ).toBe(true);
  });
  it("não fica bloqueada permanentemente se o relógio voltar", () =>
    expect(
      shouldCheck(
        { automatic: true, lastAttempt: date(-WEEK) },
        date(-WEEK),
        now,
      ),
    ).toBe(true));
});
const source = {
  title: "Fonte sintética de teste",
  url: "https://example.org/fonte",
  checkedAt: "2026-01-01",
  version: "teste",
  status: "pending" as const,
};
const entry: UsageEntry = {
  id: "regime-teste",
  presentation: "Apresentação técnica",
  population: "População técnica",
  dose: "Texto documental sintético sem orientação clínica",
  source,
};
const record = {
  id: "test",
  name: "Registro técnico",
  ingredient: "Substância técnica",
  drugClass: "Classe técnica",
  presentations: [],
  aliases: [],
  facts: {},
};
describe("regimes de uso documentados", () => {
  it("preserva texto, apresentação, população e origem sem converter doses", () => {
    const result = parseCatalog({
      version: 1,
      medicines: [{ ...record, usage: [entry] }],
    });
    expect(result[0].usage).toEqual([entry]);
    expect(result[0].usage?.[0].interval).toBeUndefined();
  });
  it("rejeita regime sem origem, população, apresentação ou dose", () => {
    for (const field of ["source", "population", "presentation", "dose"]) {
      const incomplete = { ...entry, [field]: undefined };
      expect(() =>
        parseCatalog({
          version: 1,
          medicines: [{ ...record, usage: [incomplete] }],
        }),
      ).toThrow();
    }
  });
  it("rejeita IDs de regime duplicados e URLs de origem executáveis", () => {
    expect(() =>
      parseCatalog({
        version: 1,
        medicines: [{ ...record, usage: [entry, entry] }],
      }),
    ).toThrow();
    expect(() =>
      parseCatalog({
        version: 1,
        medicines: [
          {
            ...record,
            usage: [
              { ...entry, source: { ...source, url: "javascript:alert(1)" } },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});
