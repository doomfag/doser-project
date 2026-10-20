import { test, expect } from "@playwright/test";
const source = {
  title: "Synthetic source for interface tests",
  url: "https://example.org/fixture",
  checkedAt: "2026-10-20",
  version: "fixture",
  status: "validated",
  kind: "regulatory",
};
const medicine = {
  id: "test-headache",
  name: "Registro de teste",
  ingredient: "Substância de teste",
  drugClass: "Fixture",
  aliases: [],
  presentations: [],
  facts: { indications: { text: "Cefaleia e febre", source } },
};
const reference = {
  id: "test-gases",
  documentId: "fixture",
  subject: "Substância de teste B — gases",
  ingredients: ["Substância de teste B"],
  presentations: [],
  scope: "Fixture only",
  facts: { indications: { text: "Excesso de gases", source } },
  usage: [],
  source,
};
test.beforeEach(async ({ page }) => {
  const status = { count: 1, lastSuccess: "2026-10-20T20:00:00Z" };
  await page.route("**/api/catalog/status", (r) => r.fulfill({ json: status }));
  await page.route("**/api/catalog", (r) =>
    r.fulfill({
      json: {
        version: 1,
        medicines: [medicine],
        clinicalReferences: [reference],
        status,
      },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      "doser.update.v1",
      JSON.stringify({ automatic: false }),
    ),
  );
});
test("everyday symptoms work without selecting the symptom tab", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("dor de cabeça");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page.locator(".medicine-row strong")).toHaveText(
    "Registro de teste",
  );
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("dor de barriga");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(
    page.getByText(
      "Dor de barriga pode significar coisas diferentes. O que você está sentindo?",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gases", exact: true }).click();
  await expect(page.getByText("1 documento(s)", { exact: true })).toBeVisible();
  await page.locator(".reference-result > summary").click();
  await expect(
    page.getByRole("heading", { name: "Informações sobre a substância" }),
  ).toBeVisible();
});
test("quotes compare freight and delivery independently and persist", async ({
  page,
}) => {
  await page.goto("/#prices");
  await page
    .getByLabel("Medicamento e apresentação", { exact: true })
    .fill("Produto teste");
  await page.getByLabel("Embalagem exata").fill("500 mg, 20 comprimidos");
  await page.getByLabel("CEP de entrega").fill("01001000");
  await page.getByText("Adicionar preço consultado", { exact: true }).click();
  for (const q of [
    { name: "Loja A", price: "10", shipping: "20", days: "0" },
    { name: "Loja B", price: "20", shipping: "0", days: "2" },
  ]) {
    await page.getByLabel("Farmácia", { exact: true }).fill(q.name);
    await page.getByLabel("Preço (R$)", { exact: true }).fill(q.price);
    await page.getByLabel("Frete (R$)", { exact: true }).fill(q.shipping);
    await page.getByLabel("Prazo em dias").fill(q.days);
    await page.getByLabel("Link da oferta").fill("https://example.org/offer");
    await page.getByLabel("O site informa que está disponível").check();
    await page
      .getByRole("button", { name: "Salvar cotação", exact: true })
      .click();
  }
  await expect(
    page.locator(".offers-workbench > .external-row").first(),
  ).toContainText("Loja B");
  await page.getByLabel("Ordenar por").selectOption("delivery");
  await expect(
    page.locator(".offers-workbench > .external-row").first(),
  ).toContainText("Loja A");
  await page.reload();
  await page.getByText("Cotações salvas (2)", { exact: true }).click();
  await expect(
    page.getByText("Loja B · Produto teste", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("personal package photos persist locally and disguised files are rejected", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("Registro de teste");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.locator(".medicine-main").click();
  await page.getByText("Fotos da embalagem", { exact: true }).click();
  await page
    .getByLabel("Qual é a embalagem?")
    .fill("500 mg, caixa com 20 comprimidos");
  await page.getByLabel("Foto", { exact: true }).setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6wAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Adicionar foto", exact: true })
    .click();
  await expect(page.locator(".photo-grid img")).toBeVisible();
  expect(
    await page
      .locator(".photo-grid img")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await page.getByLabel("Qual é a embalagem?").fill("Other");
  await page.getByLabel("Foto", { exact: true }).setInputFiles({
    name: "fake.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("<svg onload=alert(1) />"),
  });
  await page
    .getByRole("button", { name: "Adicionar foto", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("não corresponde");
  await page.reload();
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("Registro de teste");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.locator(".medicine-main").click();
  await page.locator(".product-photos summary").click();
  await expect(page.locator(".photo-grid img")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("comparison accepts a short name search instead of a giant product list", async ({
  page,
}) => {
  await page.goto("/#compare");
  await page
    .getByLabel("Adicionar medicamento", { exact: true })
    .fill("Registro de teste");
  await page.locator(".comparison-search .related-product").click();
  await expect(page.locator(".comparison-chips")).toContainText(
    "Registro de teste",
  );
  await expect(
    page.getByLabel("Adicionar medicamento", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByText("Selecione mais um medicamento para comparar.", {
      exact: true,
    }),
  ).toBeVisible();
});
