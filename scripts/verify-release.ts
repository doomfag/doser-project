import { chromium, type Browser, type Page } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const snapshot = JSON.parse(await readFile(".doser/catalog.json", "utf8"));
assert(
  snapshot.medicines.length > 0,
  "A verificação exige o catálogo oficial real.",
);
const count = snapshot.medicines.length;
const html = await readFile("releases/Doser.html", "utf8");
let responseHtml = html;
const server = createServer((req, res) =>
  res
    .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    .end(responseHtml),
);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const standaloneUrl = `http://127.0.0.1:${address.port}/`;
const browser: Browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
});
const outcomes: { target: string; checks: string[]; errors: string[] }[] = [];
async function loaded(page: Page, url: string) {
  await page.goto(url);
  await page
    .getByText(`${count} registros no catálogo local`, { exact: true })
    .waitFor({ timeout: 20000 });
}
async function query(page: Page, value: string) {
  await page
    .getByRole("textbox", { name: "Pesquisar no catálogo" })
    .fill(value);
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.locator(".medicine-row").first().waitFor();
}
try {
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes("/api/")) requests.push(r.url());
    });
    await loaded(page, standaloneUrl);
    await query(page, "Dorflex");
    await page
      .locator(".medicine-row")
      .filter({ has: page.getByText("DORFLEX", { exact: true }) })
      .locator(".medicine-main")
      .click();
    const official = await page
      .getByRole("link", { name: /Consultar bulas deste medicamento/ })
      .getAttribute("href");
    assert(official?.includes("numeroRegistro=186200008"));
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.getByRole("button", { name: "Como usar", exact: true }).click();
    assert(
      await page
        .getByText("Posologia por apresentação indisponível", { exact: true })
        .isVisible(),
    );
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.reload();
    await page
      .locator(".favorites-section")
      .getByText("DORFLEX", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Sintomas", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Pesquisar no catálogo" })
      .fill("dor de cabeça e febre");
    await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Nenhum resultado encontrado",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Medicamentos", exact: true })
      .click();
    await query(page, "Tylenol");
    await page
      .getByRole("button", { name: "Comparar TYLENOL", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Comparar TYLENOL SINUS", exact: true })
      .click();
    await page.getByRole("button", { name: "Comparar (2)" }).click();
    await page.getByRole("table").waitFor();
    assert(await page.getByText(/descrições diferentes/).isVisible());
    await page
      .getByRole("button", { name: "Salvar comparação", exact: true })
      .click();
    await page.goto(standaloneUrl);
    const clinicalRecord = snapshot.medicines.find(
      (m: { name: string; clinicalReferenceIds?: string[] }) =>
        m.name === "GLIFAGE" &&
        m.clinicalReferenceIds?.includes("pcdt-dm2-metformina"),
    );
    assert(
      clinicalRecord,
      "Produto real vinculado à referência de metformina ausente.",
    );
    await query(page, clinicalRecord.name);
    await page
      .locator(".medicine-row")
      .filter({ hasText: clinicalRecord.registration.number })
      .locator(".medicine-main")
      .click();
    await page.getByRole("button", { name: "Como usar", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Referência por princípio ativo",
        exact: true,
      })
      .waitFor();
    await page
      .getByLabel("Apresentação e população documentadas")
      .selectOption("pcdt-dm2-adultos");
    assert(
      await page
        .getByText("Esquema descrito no documento", { exact: true })
        .isVisible(),
    );
    assert(
      await page
        .getByText(/Isso não|Não é idade mínima regulatória/)
        .isVisible(),
    );
    await page
      .getByRole("button", { name: "Calculadora", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Dose prescrita por tomada", { exact: true })
      .fill("1");
    await dialog
      .getByLabel("Princípio ativo por comprimido ou cápsula", { exact: true })
      .fill("0,5");
    await dialog
      .getByRole("button", { name: "Calcular quantidade", exact: true })
      .click();
    assert.equal(
      await dialog.locator(".dose-result > strong").textContent(),
      "2 comprimido(s)",
    );
    assert(
      await dialog
        .getByText("Quando usar e por quê", { exact: true })
        .isVisible(),
    );
    await page.screenshot({ path: `releases/calculadora-${width}.png` });
    await dialog.getByRole("button", { name: "Fechar calculadora" }).click();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Salvar HTML", exact: true }).click(),
    ]);
    assert.equal(download.suggestedFilename(), "Doser-offline.html");
    const savedPath = `releases/copia-offline-${width}.html`;
    await download.saveAs(savedPath);
    const savedHtml = await readFile(savedPath, "utf8");
    assert(
      savedHtml.includes('<body><div id="root"></div></body>'),
      "O download não deve serializar a interface ou dados pessoais.",
    );
    responseHtml = savedHtml;
    const copy = await browser.newPage({ viewport: { width, height } });
    const copyErrors: string[] = [];
    copy.on("pageerror", (e) => copyErrors.push(e.message));
    await loaded(copy, standaloneUrl);
    await query(copy, "Tylenol");
    assert.deepEqual(copyErrors, []);
    assert(
      await copy.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await copy.close();
    responseHtml = html;
    assert.equal(requests.length, 0, "O HTML portátil não deve chamar a API.");
    assert.deepEqual(errors, []);
    outcomes.push({
      target: `portátil ${width}x${height}`,
      checks: [
        "base real completa",
        "busca Dorflex e Tylenol",
        "link do Bulário por registro",
        "favorito persistido",
        "comparação real",
        "posologia ausente sinalizada",
        "referência PCDT real separada da bula do produto",
        "conversão exata de dose prescrita",
        "download interno e reabertura da cópia offline",
        "zero chamadas de API",
      ],
      errors,
    });
    await page.close();
  }
  // O conteúdo comprimido é adulterado; deve ser rejeitado sem executar ou importar o catálogo.
  responseHtml = html.replace(
    /("sha256":")[a-f0-9]{64}("\s*,\s*"data")/,
    `$1${"0".repeat(64)}$2`,
  );
  assert.notEqual(responseHtml, html);
  const bad = await browser.newPage();
  await bad.goto(standaloneUrl);
  await bad.goto(`${standaloneUrl}#settings`);
  await bad
    .getByText(
      "A integridade da base incluída não confere. O catálogo não foi carregado.",
      { exact: true },
    )
    .waitFor();
  outcomes.push({
    target: "integridade do portátil",
    checks: ["base adulterada rejeitada"],
    errors: [],
  });
  await bad.close();
  // Verificação do serviço real de produção e da atualização de rede, sem fixtures.
  const page = await browser.newPage();
  await page.addInitScript(() =>
    localStorage.setItem("doser.update.v1", '{"automatic":false}'),
  );
  await loaded(page, "http://127.0.0.1:4173");
  await query(page, "paracetamol");
  assert((await page.locator(".medicine-row").count()) > 0);
  await page.goto("http://127.0.0.1:4173/#settings");
  const updated = await page.evaluate(async () => {
    const r = await fetch("/api/catalog/update", {
      method: "POST",
      headers: { "X-Doser-Request": "1" },
    });
    return { status: r.status, body: await r.json() };
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.count, count);
  assert(!updated.body.lastError);
  assert.equal(updated.body.clinical.references, 19);
  assert(
    updated.body.clinical.documents.every(
      (d: { status: string }) => d.status === "verified",
    ),
  );
  outcomes.push({
    target: "produção local",
    checks: [
      "carregamento real",
      "busca paracetamol",
      "atualização real pela API com sucesso",
    ],
    errors: [],
  });
  await page.close();
  await writeFile(
    "releases/validacao-real.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        count,
        sourceHash: snapshot.status.report.sha256,
        outcomes,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ count, outcomes }, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
