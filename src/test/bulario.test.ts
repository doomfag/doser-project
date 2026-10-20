import { expect, it } from "vitest";
import { bularioUrl } from "../domain/bulario";
import type { Medicine } from "../domain/catalog";
const medicine: Medicine = {
  id: "teste",
  name: "Nome técnico & outro",
  ingredient: "Teste",
  drugClass: "Teste",
  aliases: [],
  presentations: [],
  facts: {},
};
it("prefere o registro regulatório para distinguir produtos no Bulário", () => {
  expect(
    bularioUrl({
      ...medicine,
      registration: {
        number: "123456789",
        situation: "Ativo",
        source: {
          title: "Teste",
          url: "https://example.org",
          checkedAt: "2026-01-01",
          version: "1",
          status: "pending",
        },
      },
    }),
  ).toBe(
    "https://consultas.anvisa.gov.br/#/bulario/q/?numeroRegistro=123456789",
  );
});
it("codifica o nome quando o registro não foi informado", () =>
  expect(bularioUrl(medicine)).toContain(
    "nomeProduto=Nome+t%C3%A9cnico+%26+outro",
  ));
