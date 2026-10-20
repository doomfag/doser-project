import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ANVISA_URL, importAnvisa } from "./anvisa.ts";
import { CatalogUpdater } from "./updater.ts";
// Linhas sintéticas de teste; não constituem dados clínicos e não entram na base de uso.
const header =
  "NOME_PRODUTO;NUMERO_REGISTRO_PRODUTO;SITUACAO_REGISTRO;PRINCIPIO_ATIVO;CLASSE_TERAPEUTICA;EMPRESA_DETENTORA_REGISTRO\n";
const row = (id = 123456, status = "VÁLIDO") =>
  `"Registro técnico; ${id}";${id};${status};Substância técnica;Classe técnica;Entidade de teste\n`;
const csv = header + row();
const encode = (s: string) => new TextEncoder().encode(s);
const directories: string[] = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "doser-update-test-"));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
describe("importador cadastral Anvisa", () => {
  it("preserva nome, princípio, registro, origem e versão sem inventar posologia", () => {
    const result = importAnvisa(encode(csv), "2026-01-01");
    const m = result.medicines[0];
    expect(m.name).toBe("Registro técnico; 123456");
    expect(m.registration?.number).toBe("123456");
    expect(m.registration?.source.url).toBe(ANVISA_URL);
    expect(m.registration?.source.version).toMatch(/^[a-f0-9]{64}$/);
    expect(m.facts).toEqual({});
    expect(m.usage).toBeUndefined();
    expect(m.presentations).toEqual([]);
  });
  it("aceita encoding Latin-1 e mantém acentos", () => {
    const bytes = Uint8Array.from(Buffer.from(csv, "latin1"));
    expect(importAnvisa(bytes, "2026-01-01").medicines[0].ingredient).toBe(
      "Substância técnica",
    );
  });
  it("descarta status cancelados ou desconhecidos e contabiliza duplicatas", () => {
    const result = importAnvisa(
      encode(
        header +
          row() +
          row() +
          row(234567, "CANCELADO") +
          row(345678, "DESCONHECIDO"),
      ),
      "2026-01-01",
    );
    expect(result.medicines).toHaveLength(1);
    expect(result.report).toMatchObject({
      rows: 4,
      included: 1,
      excluded: 2,
      duplicates: 1,
    });
  });
  it("sinaliza princípio ativo ausente", () => {
    const result = importAnvisa(
      encode(csv.replace("Substância técnica", "")),
      "2026-01-01",
    );
    expect(result.report.missingIngredient).toBe(1);
    expect(result.medicines[0].ingredient).toBe("Não informado pela fonte");
  });
  it("rejeita HTML, cabeçalhos alterados e fontes sem registro ativo", () => {
    expect(() =>
      importAnvisa(encode("<html>Erro</html>"), "2026-01-01"),
    ).toThrow();
    expect(() =>
      importAnvisa(
        encode(csv.replace("NOME_PRODUTO", "OUTRO_CAMPO")),
        "2026-01-01",
      ),
    ).toThrow(/formato/);
    expect(() =>
      importAnvisa(encode(header + row(123456, "CANCELADO")), "2026-01-01"),
    ).toThrow(/Nenhum registro/);
  });
});
describe("atualização atômica e falhas", () => {
  it("baixa somente a URL oficial fixa e persiste uma base válida", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(csv, { headers: { etag: '"test-v1"' } }));
    const path = await directory();
    const updater = new CatalogUpdater(path, request);
    const status = await updater.update();
    expect(status.count).toBe(1);
    expect(status.lastSuccess).toBeDefined();
    expect(status.lastError).toBeUndefined();
    expect(request.mock.calls[0][0]).toBe(ANVISA_URL);
    expect(request.mock.calls[0][1]?.redirect).toBe("error");
    expect(
      JSON.parse(await readFile(join(path, "catalog.json"), "utf8")).medicines,
    ).toHaveLength(1);
  });
  it("falha HTTP preserva integralmente o último arquivo e a data de sucesso", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(csv))
      .mockResolvedValueOnce(new Response("bloqueado", { status: 403 }));
    const path = await directory();
    const updater = new CatalogUpdater(path, request);
    const first = await updater.update();
    const before = await readFile(join(path, "catalog.json"), "utf8");
    const failure = await updater.update();
    expect(failure.lastSuccess).toBe(first.lastSuccess);
    expect(failure.lastError).toContain("403");
    expect(await readFile(join(path, "catalog.json"), "utf8")).toBe(before);
  });
  it("arquivo malformado não substitui a base anterior", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(csv))
      .mockResolvedValueOnce(new Response("<html>Falha</html>"));
    const updater = new CatalogUpdater(await directory(), request);
    await updater.update();
    expect((await updater.update()).lastError).toBeTruthy();
    expect((await updater.snapshot()).medicines).toHaveLength(1);
  });
  it("requisições simultâneas compartilham a mesma atualização", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(csv));
    const updater = new CatalogUpdater(await directory(), request);
    await Promise.all([updater.update(), updater.update(), updater.update()]);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("usa ETag e aceita 304 somente com cache válido", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(csv, { headers: { etag: '"v1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const updater = new CatalogUpdater(await directory(), request);
    await updater.update();
    const result = await updater.update();
    expect(result.lastError).toBeUndefined();
    expect(result.count).toBe(1);
    expect(request.mock.calls[1][1]?.headers).toMatchObject({
      "If-None-Match": '"v1"',
    });
    expect((await updater.snapshot()).medicines).toHaveLength(1);
  });
  it("bloqueia quedas anormais no total de registros", async () => {
    const many =
      header + Array.from({ length: 101 }, (_, i) => row(123456 + i)).join("");
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(many))
      .mockResolvedValueOnce(new Response(csv));
    const updater = new CatalogUpdater(await directory(), request);
    await updater.update();
    const result = await updater.update();
    expect(result.lastError).toContain("metade");
    expect((await updater.snapshot()).medicines).toHaveLength(101);
  });
  it("limita tamanho anunciado e não cria arquivo em falha inicial", async () => {
    const updater = new CatalogUpdater(
      await directory(),
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(csv, { headers: { "content-length": "200000000" } }),
        ),
    );
    expect((await updater.update()).lastError).toContain("limite");
    expect((await updater.snapshot()).medicines).toHaveLength(0);
  });
});

describe("dados observados na fonte real", () => {
  it("preserva princípios ativos de associações com mais de 300 caracteres", () => {
    const ingredient = "substância técnica ".repeat(20);
    const result = importAnvisa(
      encode(csv.replace("Substância técnica", ingredient)),
      "2026-01-01",
    );
    expect(result.medicines[0].ingredient).toBe(ingredient.trim());
  });
  it("rejeita dados conflitantes em vez de escolher arbitrariamente uma duplicata", () => {
    const conflicting =
      header +
      row() +
      row().replace("Substância técnica", "Outra substância técnica");
    expect(() => importAnvisa(encode(conflicting), "2026-01-01")).toThrow(
      /conflitantes/,
    );
  });
});
