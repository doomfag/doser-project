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
test("symptom correction keeps the full query and runs only when selected", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("dor de cabessa e febr");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page.locator(".medicine-row")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Dor de cabeça e febre", exact: true })
    .click();
  await expect(page.locator(".medicine-row strong")).toHaveText(
    "Registro de teste",
  );
  await expect(
    page.getByText(/A busca exige documentação para todos/),
  ).toBeVisible();
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("dor de cabeça e enjoo");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page.locator(".medicine-row")).toHaveCount(0);
  const separate = page.getByLabel("Pesquisar sintomas separadamente");
  await expect(separate).toBeVisible();
  await expect(separate).toContainText(
    "não são uma recomendação para combinar",
  );
  await separate
    .getByRole("button", { name: "Dor de cabeça", exact: true })
    .click();
  await expect(page.locator(".medicine-row strong")).toHaveText(
    "Registro de teste",
  );
});
test("clarifying a belly symptom preserves fever rather than showing unrelated single-symptom results", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("dor de barriga e febre");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.getByRole("button", { name: "Gases", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resultados para “Gases e febre”" }),
  ).toBeVisible();
  await expect(page.locator(".reference-result")).toHaveCount(0);
  await expect(page.locator(".medicine-row")).toHaveCount(0);
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
test("comparison groups undocumented fields and opens a price search for the selected product", async ({
  page,
}) => {
  const second = {
    ...medicine,
    id: "second-fixture",
    name: "Segundo teste",
    facts: {},
  };
  await page.route("**/api/catalog", (r) =>
    r.fulfill({
      json: {
        version: 1,
        medicines: [medicine, second],
        clinicalReferences: [],
        status: { count: 2, lastSuccess: "2026-10-21T00:00:00Z" },
      },
    }),
  );
  await page.goto("/#compare");
  for (const name of [medicine.name, second.name]) {
    await page.getByLabel("Adicionar medicamento", { exact: true }).fill(name);
    await page.locator(".comparison-search .related-product").click();
  }
  await expect(
    page.getByRole("rowheader", { name: "Para que serve", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Farmacodinâmica", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Limites dos dados da comparação"),
  ).toContainText("Informação ausente não significa");
  await expect(
    page.getByRole("link", {
      name: /^Consultar bula de Segundo teste/,
    }),
  ).toHaveAttribute("href", /consultas.anvisa.gov.br/);
  await page
    .getByRole("button", {
      name: "Consultar preços de Segundo teste",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Medicamento e apresentação", { exact: true }),
  ).toHaveValue("Segundo teste");
  await expect(
    page.getByText(/Não há integração de preços ou estoque nesta versão/),
  ).toBeVisible();
});
