import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { createSearchIndex, searchIndex } from "../src/domain/catalog.ts";
const snapshot = JSON.parse(await readFile(".doser/catalog.json", "utf8"));
const index = createSearchIndex(
  snapshot.medicines,
  snapshot.clinicalReferences,
);
const started = performance.now();
const headaches = searchIndex(index, "dor de cabeça", "medicines");
const searchMs = performance.now() - started;
assert(headaches.length > 0);
assert(!headaches.some((m) => m.name === "AQUIPTA"));
const html = await readFile("releases/Doser.html", "utf8");
const server = createServer((_req, res) =>
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html),
);
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const address = server.address();
assert(address && typeof address !== "string");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
});
await mkdir("releases", { recursive: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page
      .getByText("10326 registros no catálogo local", { exact: true })
      .waitFor();
    const query = async (q: string) => {
      await page.getByLabel("Pesquisar no catálogo", { exact: true }).fill(q);
      await page
        .getByRole("button", { name: "Pesquisar", exact: true })
        .click();
    };
    await query("Dor de cabeça");
    await page.locator(".medicine-row").first().waitFor();
    await page.screenshot({
      path: `releases/busca-cabeca-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await query("Dor de barriga");
    await page.getByRole("button", { name: "Gases", exact: true }).waitFor();
    await page.getByRole("button", { name: "Gases", exact: true }).click();
    assert((await page.locator(".medicine-row,.reference-result").count()) > 0);
    await query("Diarreia");
    await page.locator(".reference-result summary").first().waitFor();
    await query("Aquipta");
    await page.locator(".medicine-main").first().click();
    await page
      .getByText("ANVISA · DOCUMENTO OFICIAL", { exact: true })
      .waitFor();
    await page
      .getByText(
        "Prevenção da enxaqueca episódica e crônica em adultos com pelo menos quatro episódios mensais de enxaqueca, conforme a aprovação descrita pela Anvisa.",
        { exact: true },
      )
      .waitFor();
    await page.screenshot({
      path: `releases/ficha-aquipta-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      errors,
      checks: [
        "dor de cabeça com dados reais",
        "dor de barriga aceita linguagem comum",
        "gases",
        "diarreia com referência oficial",
        "ficha Aquipta com indicação e fonte",
      ],
    });
    await page.close();
  }
  await writeFile(
    "releases/validacao-melhorias-0.7.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        count: snapshot.medicines.length,
        references: snapshot.clinicalReferences.length,
        headacheResults: headaches.length,
        searchMs,
        results,
      },
      null,
      2,
    ),
  );
  console.log({ headacheResults: headaches.length, searchMs, results });
} finally {
  await browser.close();
  await new Promise<void>((ok) => server.close(() => ok()));
}
