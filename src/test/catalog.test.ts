import { describe, expect, it } from "vitest";
import {
  compare,
  isApproximateMatch,
  normalize,
  parseCatalog,
  safeUrl,
  search,
  symptomAlert,
  type Medicine,
} from "../domain/catalog";
// Registros sintéticos de teste, sem conteúdo farmacológico; nunca entram no catálogo da aplicação.
const fixture: Medicine = {
  id: "test-a",
  name: "Registro Técnico Alfa",
  ingredient: "Substância de teste",
  drugClass: "Classe de teste",
  presentations: ["Formato de teste"],
  aliases: ["Alias acadêmico"],
  facts: {
    indications: {
      text: "Termo cefaleia e febre",
      source: {
        title: "Documento de teste",
        url: "https://example.org/documento",
        checkedAt: "2026-01-01",
        version: "1",
        status: "validated",
      },
    },
  },
};
const wrap = (medicines: unknown[]) => ({ version: 1, medicines });
describe("normalização e busca", () => {
  it("normaliza acentos, caixa, espaços e pontuação", () => {
    expect(normalize("  ÁCIDO — Acetilsalicílico ")).toBe(
      "acido acetilsalicilico",
    );
  });
  it("busca nome, sinônimo e classe sem acentos", () => {
    expect(search([fixture], "tecnico", "medicines")).toEqual([fixture]);
    expect(search([fixture], "alias academico", "medicines")).toEqual([
      fixture,
    ]);
    expect(search([fixture], "classe", "medicines")).toEqual([fixture]);
  });
  it("tolera um erro de digitação em termos longos", () => {
    expect(search([fixture], "tecncio", "medicines")).toEqual([]);
    expect(search([fixture], "tecnco", "medicines")).toEqual([fixture]);
  });
  it("exige correspondência de todos os sintomas", () => {
    expect(search([fixture], "cefaleia e febre", "symptoms")).toEqual([
      fixture,
    ]);
    expect(search([fixture], "cefaleia e tosse", "symptoms")).toEqual([]);
  });
  it("não usa indicações pendentes para pesquisar sintomas", () => {
    const m = structuredClone(fixture);
    m.facts.indications!.source.status = "pending";
    expect(search([m], "febre", "symptoms")).toEqual([]);
  });
  it("separa busca por princípio ativo e consulta vazia", () => {
    expect(search([fixture], "alfa", "ingredients")).toEqual([]);
    expect(search([fixture], "substancia", "ingredients")).toEqual([fixture]);
    expect(search([fixture], "", "medicines")).toEqual([]);
  });
});
describe("importação e rastreabilidade", () => {
  it("importa e preserva a origem das informações", () =>
    expect(parseCatalog(wrap([fixture]))).toEqual([fixture]));
  it("rejeita versões desconhecidas, IDs duplicados e dados incompletos", () => {
    expect(() => parseCatalog({ version: 2, medicines: [] })).toThrow();
    expect(() => parseCatalog(wrap([fixture, fixture]))).toThrow();
    expect(() => parseCatalog(wrap([{ id: "incompleto" }]))).toThrow();
  });
  it("rejeita informação sem fonte e fonte com data inválida", () => {
    const m = structuredClone(fixture);
    m.facts.indications!.source.checkedAt = "2026-02-31";
    expect(() => parseCatalog(wrap([m]))).toThrow();
    m.facts.indications!.source.checkedAt = "2026-99-99";
    expect(() => parseCatalog(wrap([m]))).toThrow();
    expect(() =>
      parseCatalog(
        wrap([{ ...fixture, facts: { indications: { text: "sem fonte" } } }]),
      ),
    ).toThrow();
  });
  it("rejeita links executáveis, HTTP e credenciais em URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "http://example.org",
      "https://user:pass@example.org",
    ]) {
      expect(safeUrl(url)).toBe(false);
      const m = structuredClone(fixture);
      m.facts.indications!.source.url = url;
      expect(() => parseCatalog(wrap([m]))).toThrow();
    }
  });
});
describe("comparação e alertas", () => {
  it("não afirma intercambialidade com o mesmo princípio ativo", () =>
    expect(compare(fixture, { ...fixture, id: "test-b" })).toContain(
      "não verificadas",
    ));
  it("distingue princípios ativos diferentes", () =>
    expect(
      compare(fixture, { ...fixture, ingredient: "Outro termo de teste" }),
    ).toContain("diferentes"));
  it("sinaliza termos de urgência sem diagnosticar", () => {
    expect(symptomAlert("Dor no peito e falta de ar")).toContain("192");
    expect(symptomAlert("dor muscular")).toBeNull();
  });
});

describe("campos ausentes na base cadastral", () => {
  it("não afirma que dois princípios ativos ausentes são iguais", () =>
    expect(
      compare(
        { ...fixture, ingredient: "Não informado pela fonte" },
        { ...fixture, id: "outro", ingredient: "Não informado pela fonte" },
      ),
    ).toContain("ausente"));
});

it("identifica correspondências aproximadas para distingui-las na interface", () => {
  expect(isApproximateMatch(fixture, "tecnco", "medicines")).toBe(true);
  expect(isApproximateMatch(fixture, "tecnico", "medicines")).toBe(false);
});
