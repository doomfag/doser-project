import { test, expect } from "@playwright/test";
import legacyPhotos from "./fixtures/manufacturer-legacy.json" with { type: "json" };
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
  await page.route("**/src/data/manufacturerPhotos.json*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "export default " + JSON.stringify(legacyPhotos),
    }),
  );
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
  await page.route("**/src/data/manufacturerPhotos.json*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "export default " + JSON.stringify(legacyPhotos),
    }),
  );
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

const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6wAAAABJRU5ErkJggg==",
  "base64",
);
function syntheticGallery(count: number, sha: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fixture-view-${i + 1}`,
    name: medicine.name,
    ingredient: medicine.ingredient,
    registration: medicine.registration.number,
    holderCnpj: "38391432000143",
    label: "Synthetic presentation — fixture only",
    productTitle: "Synthetic presentation — fixture only",
    ean: "7891058017507",
    presentation: "FIXTURE ONLY",
    src: `https://product-data.raiadrogasil.io/images/${i + 101}.webp`,
    sourcePage: "https://www.drogasil.com.br/fixture-only.html",
    sourceKind: "retailer",
    sourceLabel: "Drogasil",
    sourceMetadataSha256: "a".repeat(64),
    cmedSha256: "b".repeat(64),
    sha256: i === 0 ? sha : String(i).repeat(64),
    bytes: pixelPng.length,
    contentType: "image/png",
    width: 100,
    height: 100,
    checkedAt: "2026-10-21",
    position: i,
    reviewStatus: "validated-file",
  }));
}
test("multiple views stay under the same presentation and thumbnails change the main image", async ({
  page,
}) => {
  const photos = syntheticGallery(3, "0".repeat(64));
  await page.route("**/src/data/manufacturerPhotos.json*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "export default " + JSON.stringify(photos),
    }),
  );
  await page.route("https://product-data.raiadrogasil.io/**", (r) =>
    r.fulfill({ contentType: "image/png", body: pixelPng }),
  );
  await openMedicine(page);
  await expect(
    page
      .getByRole("group", { name: "Imagens desta apresentação" })
      .getByRole("button"),
  ).toHaveCount(3);
  await expect(
    page.getByText("Imagem 1 de 3 desta apresentação"),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Ver imagem 2 de Synthetic presentation — fixture only",
      exact: true,
    })
    .click();
  await expect(page.locator(".manufacturer-image img")).toHaveAttribute(
    "src",
    photos[1].src,
  );
  await expect(
    page.getByText("Imagem 2 de 3 desta apresentação"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver na Drogasil" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("native image cache survives reopening without a second request or deleting personal data", async ({
  page,
}) => {
  // Native builds read their embedded snapshot, rather than the development API.
  const snapshot = {
    version: 1,
    medicines: [medicine],
    clinicalReferences: [],
    status: { count: 1, lastSuccess: "2026-10-21T00:00:00Z" },
  };
  await page.route("http://127.0.0.1:5173/", async (route) => {
    const response = await route.fetch();
    const envelope = JSON.stringify({ encoding: "native-json", snapshot });
    const body = (await response.text())
      .replace("<html", '<html data-doser-native="true"')
      .replace(
        "</head>",
        `<script id="doser-catalog" type="application/json">${envelope}</script></head>`,
      );
    await route.fulfill({ response, body });
  });
  const { createHash } = await import("node:crypto");
  const photos = syntheticGallery(
    1,
    createHash("sha256").update(pixelPng).digest("hex"),
  );
  await page.route("**/src/data/manufacturerPhotos.json*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "export default " + JSON.stringify(photos),
    }),
  );
  await page.addInitScript(
    ({ data }) => {
      const w = window as unknown as {
        androidBridge: object;
        Capacitor: object;
      };
      w.androidBridge = {};
      w.Capacitor = {
        PluginHeaders: [
          {
            name: "CapacitorHttp",
            methods: [{ name: "get", rtype: "promise" }],
          },
        ],
        nativePromise: async (_p: string, _m: string, o: { url: string }) => {
          if (localStorage.getItem("fixture-photo-offline"))
            throw Error("Synthetic offline transport");
          localStorage.setItem(
            "fixture-photo-calls",
            String(Number(localStorage.getItem("fixture-photo-calls")) + 1),
          );
          return { url: o.url, status: 200, headers: {}, data: data + "\n" };
        },
      };
    },
    { data: pixelPng.toString("base64") },
  );
  await openMedicine(page);
  await expect(page.locator(".manufacturer-image img")).toHaveJSProperty(
    "naturalWidth",
    1,
  );
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const request = indexedDB.open("doser.manufacturer-images", 2);
        const db = await new Promise<IDBDatabase>((ok, fail) => {
          request.onsuccess = () => ok(request.result);
          request.onerror = fail;
        });
        try {
          return await new Promise<number>((ok, fail) => {
            const r = db.transaction("info").objectStore("info").count();
            r.onsuccess = () => ok(r.result);
            r.onerror = fail;
          });
        } finally {
          db.close();
        }
      }),
    )
    .toBe(1);
  await page.evaluate(() => {
    localStorage.setItem("fixture-photo-offline", "true");
    localStorage.setItem("fixture-personal-note", "keep this note");
  });
  await openMedicine(page);
  await expect(page.locator(".manufacturer-image img")).toHaveJSProperty(
    "naturalWidth",
    1,
  );
  expect(
    await page.evaluate(() => localStorage.getItem("fixture-photo-calls")),
  ).toBe("1");
  expect(
    await page.evaluate(() => localStorage.getItem("fixture-personal-note")),
  ).toBe("keep this note");
});
