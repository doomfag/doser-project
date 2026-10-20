import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/catalog/status", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/catalog", (route) =>
    route.fulfill({
      json: { version: 1, medicines: [], status: { count: 0 } },
    }),
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem("doser.update.v1"))
      localStorage.setItem(
        "doser.update.v1",
        JSON.stringify({ automatic: false }),
      );
  });
});
test("pesquisa, histórico, anotação persistida e navegação sem erro", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Consulta farmacológica" }),
  ).toBeVisible();
  await expect(
    page.getByText("Informação confiável para seus estudos"),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Pesquisar no catálogo" })
    .fill("dor de cabeça");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Seu catálogo ainda está vazio" }),
  ).toBeVisible();
  await page.goto("/#library");
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "dor de cabeça" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Anotações", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Revisão acadêmica");
  await page
    .getByRole("textbox", { name: "Anotação acadêmica" })
    .fill('<script>alert("xss")</script> Texto pessoal');
  await page
    .getByRole("button", { name: "Salvar anotação", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Anotações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Revisão acadêmica" }),
  ).toBeVisible();
  await expect(
    page.getByText('<script>alert("xss")</script> Texto pessoal', {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#prices");
  await expect(
    page.getByRole("heading", { name: "Preços e farmácias" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Medicamento e apresentação" })
    .fill("Consulta teste");
  await expect(
    page.getByRole("link", { name: "Pesquisar (abre em nova aba)" }).first(),
  ).toHaveAttribute("href", /Consulta%20teste/);
  await page.goto("/#compare");
  await expect(
    page.getByRole("heading", { name: "Nenhum medicamento selecionado" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("importação inválida não altera o catálogo", async ({ page }) => {
  await page.goto("/#settings");
  await expect(page.locator("input[type=file]")).toBeEnabled();
  await page.locator("input[type=file]").setInputFiles({
    name: "invalido.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2,"medicines":[]}'),
  });
  await expect(page.locator(".toast")).toContainText("Arquivo inválido");
  await expect(page.getByText("0 registros", { exact: true })).toBeVisible();
});
// Dados sintéticos exclusivamente para exercitar a interface; não são medicamentos ou orientações reais.
test("importação, ficha, favorito e comparação com fontes", async ({
  page,
}) => {
  await page.goto("/#settings");
  const base = {
    ingredient: "Substância técnica",
    drugClass: "Classe técnica",
    presentations: [],
    aliases: [],
    facts: {
      indications: {
        text: "Termo técnico de teste",
        source: {
          title: "Fonte de teste",
          url: "https://example.org/fonte",
          checkedAt: "2026-01-01",
          version: "teste-1",
          status: "pending",
        },
      },
    },
  };
  const medicines = [
    { ...base, id: "test-a", name: "Registro técnico A" },
    { ...base, id: "test-b", name: "Registro técnico B" },
  ];
  await expect(page.locator("input[type=file]")).toBeEnabled();
  await page.locator("input[type=file]").setInputFiles({
    name: "teste.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, medicines })),
  });
  await expect(page.getByText("2 registros", { exact: true })).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Pesquisar no catálogo" })
    .fill("Registro");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page.getByText("2 encontrados")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Adicionar Registro técnico A aos favoritos",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Comparar Registro técnico A", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comparar Registro técnico B", exact: true })
    .click();
  await page.getByRole("button", { name: "Comparar (2)" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByText(/Equivalência e intercambialidade não verificadas/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salvar comparação", exact: true })
    .click();
  await page.goto("/#library");
  await expect(
    page.getByRole("button", {
      name: "Registro técnico A Substância técnica · Classe técnica",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Registro técnico A Substância técnica · Classe técnica",
      exact: true,
    })
    .click();
  await page
    .locator("summary")
    .filter({ hasText: /^Indicações/ })
    .click();
  await expect(
    page.getByText("Informação pendente de validação.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fonte de teste (abre em nova aba)" }),
  ).toHaveAttribute("href", "https://example.org/fonte");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Registro técnico A Substância técnica · Classe técnica",
      exact: true,
    }),
  ).toBeVisible();
});

test("falha de armazenamento preserva o rascunho da anotação", async ({
  page,
}) => {
  await page.goto("/#library");
  await page.getByRole("button", { name: "Anotações", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Rascunho preservado");
  await page
    .getByRole("textbox", { name: "Anotação acadêmica" })
    .fill("Texto ainda não salvo");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Salvar anotação", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Não foi possível salvar",
  );
  await expect(
    page.getByRole("textbox", { name: "Título", exact: true }),
  ).toHaveValue("Rascunho preservado");
  await expect(
    page.getByRole("textbox", { name: "Anotação acadêmica" }),
  ).toHaveValue("Texto ainda não salvo");
});

// Fonte e texto sintéticos usados apenas em testes: não são regimes terapêuticos.
test("como usar exige apresentação e mantém campos ausentes explícitos", async ({
  page,
}) => {
  await page.goto("/#settings");
  const source = {
    title: "Documento técnico de teste",
    url: "https://example.org/fonte",
    checkedAt: "2026-01-01",
    version: "teste",
    status: "pending",
  };
  const medicine = {
    id: "usage-test",
    name: "Registro técnico de uso",
    ingredient: "Substância técnica",
    drugClass: "Classe técnica",
    presentations: ["Apresentação técnica"],
    aliases: [],
    facts: {},
    usage: [
      {
        id: "regime-1",
        presentation: "Apresentação técnica",
        population: "Grupo técnico de teste",
        dose: "Trecho documental sintético",
        age: "Faixa etária de teste",
        source,
      },
    ],
  };
  await expect(page.locator("input[type=file]")).toBeEnabled();
  await page.locator("input[type=file]").setInputFiles({
    name: "usage.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, medicines: [medicine] })),
  });
  await expect(page.getByText("1 registros", { exact: true })).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Pesquisar no catálogo" })
    .fill("Registro técnico de uso");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Registro técnico de uso Substância técnica · Classe técnica",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Como usar", exact: true }).click();
  await expect(
    page.getByText("Trecho documental sintético", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Apresentação e população documentadas" })
    .selectOption("regime-1");
  await expect(
    page.getByText("Trecho documental sintético", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Não informado na fonte", { exact: true }),
  ).toHaveCount(4);
  await expect(
    page.getByText("Faixa etária de teste", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Regime pendente de conferência/)).toBeVisible();
  await page.getByText("Conferir fonte do regime", { exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: "Documento técnico de teste (abre em nova aba)",
    }),
  ).toBeVisible();
});

test("atualização manual e opção semanal persistida com transporte controlado", async ({
  page,
}) => {
  const now = new Date().toISOString();
  let updates = 0;
  const status = { count: 1, lastSuccess: now };
  const medicine = {
    id: "update-test",
    name: "Registro técnico atualizado",
    ingredient: "Substância técnica",
    drugClass: "Classe técnica",
    presentations: [],
    aliases: [],
    facts: {},
  };
  await page.route("**/api/catalog/status", (route) =>
    route.fulfill({ json: { count: 0 } }),
  );
  await page.route("**/api/catalog/update", async (route) => {
    updates++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-doser-request"]).toBe("1");
    await route.fulfill({ json: status });
  });
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { version: 1, medicines: [medicine], status } }),
  );
  await page.goto("/#settings");
  await page
    .getByRole("button", { name: "Atualizar agora", exact: true })
    .click();
  await expect(
    page.getByText("1 registros da Anvisa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("switch", { name: "Verificar atualizações semanalmente" })
    .check();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Verificar atualizações semanalmente" }),
  ).toBeChecked();
  await expect(
    page.getByText("1 registros da Anvisa", { exact: true }),
  ).toBeVisible();
  expect(updates).toBe(1);
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Pesquisar no catálogo" })
    .fill("atualizado");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(
    page.getByText("Registro técnico atualizado", { exact: true }),
  ).toBeVisible();
});

test("falha na atualização mantém a base do navegador", async ({ page }) => {
  await page.route("**/api/catalog/update", (route) =>
    route.fulfill({
      status: 502,
      json: {
        lastError:
          "A fonte não está disponível. A base anterior foi preservada.",
      },
    }),
  );
  await page.goto("/#settings");
  const m = {
    id: "local-test",
    name: "Registro técnico preservado",
    ingredient: "Substância técnica",
    drugClass: "Classe técnica",
    presentations: [],
    aliases: [],
    facts: {},
  };
  await expect(page.locator("input[type=file]")).toBeEnabled();
  await page.locator("input[type=file]").setInputFiles({
    name: "local.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, medicines: [m] })),
  });
  await expect(page.getByText("1 registros", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Atualizar agora", exact: true })
    .click();
  await expect(
    page.getByText(
      "A fonte não está disponível. A base anterior foi preservada.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 registros", { exact: true })).toBeVisible();
});

test("movimento reduzido e layout estreito", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const animation = await page
    .locator("main")
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe("none");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/#settings");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("calculadora explica o uso, converte a prescrição e bloqueia arredondamento", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Calculadora", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Calculadora de dose" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("Quando usar e por quê", { exact: true }).click();
  await expect(
    dialog.getByText(/não autoriza trocar apresentações/),
  ).toBeVisible();
  await dialog
    .getByLabel("Dose prescrita por tomada", { exact: true })
    .fill("1");
  await dialog
    .getByLabel("Princípio ativo por comprimido ou cápsula", { exact: true })
    .fill("0,5");
  await dialog
    .getByRole("button", { name: "Calcular quantidade", exact: true })
    .click();
  await expect(dialog.locator(".dose-result > strong")).toHaveText(
    "2 comprimido(s)",
  );
  await expect(dialog.locator(".dose-result")).toContainText("1 mg");
  await dialog
    .getByLabel("Princípio ativo por comprimido ou cápsula", { exact: true })
    .fill("3");
  await expect(dialog.locator(".dose-result")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Calcular quantidade", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "não corresponde a unidades inteiras",
  );
  await dialog
    .getByText("Como fazer o cálculo · exemplos apenas matemáticos", {
      exact: true,
    })
    .click();
  await expect(dialog.getByText(/1 mg ÷ 0,5 mg = 2 comprimidos/)).toBeVisible();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Calculadora", exact: true }).click();
  await expect(
    page.getByLabel("Dose prescrita por tomada", { exact: true }),
  ).toHaveValue("");
  await page
    .getByLabel("Forma farmacêutica", { exact: true })
    .selectOption("drops");
  await expect(
    page.getByLabel("Gotas por 1 mL, conforme a bula e o gotejador"),
  ).toHaveValue("");
});
