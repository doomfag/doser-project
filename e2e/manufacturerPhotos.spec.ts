import { test, expect } from "@playwright/test";
// Catalog identity is real; image bytes below are an isolated rendering fixture.
const medicine = {
  id: "anvisa-186200008",
  name: "DORFLEX",
  ingredient: "citrato de orfenadrina, dipirona monoidratada, cafeína anidra",
  drugClass: "Fixture",
  aliases: [],
  presentations: [],
  facts: {},
  registration: {
    number: "186200008",
    situation: "Ativo",
    holder: "38391432000143 - OPELLA HEALTHCARE BRAZIL LTDA",
    source: {
      title: "Fixture",
      url: "https://example.org/test",
      checkedAt: "2026-10-21",
      version: "fixture",
      status: "pending",
    },
  },
};
test.beforeEach(async ({ page }) => {
  const status = { count: 1, lastSuccess: "2026-10-21T00:00:00Z" };
  await page.route("**/api/catalog/status", (r) => r.fulfill({ json: status }));
  await page.route("**/api/catalog", (r) =>
    r.fulfill({
      json: {
        version: 1,
        medicines: [medicine],
        clinicalReferences: [],
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
async function openMedicine(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("DORFLEX");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.locator(".medicine-main").click();
}
test("manufacturer image appears automatically and another presentation can be selected", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("https://www.dorflex.com.br/**", (r) => {
    requested.push(r.request().url());
    return r.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6wAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  });
  await openMedicine(page);
  const image = page.getByRole("img", { name: /Dorflex — 300 mg/ });
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty("naturalWidth", 1);
  await page.getByLabel("Ver outra embalagem").selectOption("dorflex-gotas-0");
  await expect(
    page.getByRole("img", { name: /Dorflex gotas/ }),
  ).toHaveJSProperty("naturalWidth", 1);
  await expect(
    page.getByRole("link", { name: "Ver no site do fabricante" }),
  ).toHaveAttribute("href", /dorflex-gotas$/);
  await page.getByText("Origem e créditos", { exact: true }).click();
  await expect(page.getByText(/Todos os direitos reservados/)).toBeVisible();
  expect(requested).toHaveLength(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("network failure shows an explicit fallback and retry recovers", async ({
  page,
}) => {
  let offline = true;
  await page.route("https://www.dorflex.com.br/**", (r) =>
    offline
      ? r.abort()
      : r.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6wAAAABJRU5ErkJggg==",
            "base64",
          ),
        }),
  );
  await openMedicine(page);
  await expect(
    page.getByText(/Não foi possível carregar esta imagem/),
  ).toBeVisible();
  offline = false;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /Dorflex — 300 mg/ }),
  ).toHaveJSProperty("naturalWidth", 1);
});
