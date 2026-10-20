import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
const html = await readFile("build-tv/webos/index.html", "utf8");
const server = createServer((_request, response) =>
  response
    .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    .end(html),
);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/google-chrome")
      ? "/usr/bin/google-chrome"
      : "/usr/bin/chromium"),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requests.push(r.url());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "DecompressionStream", { value: undefined });
    Object.defineProperty(crypto, "randomUUID", { value: undefined });
  });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page
    .getByText("10326 registros no catálogo local", { exact: true })
    .waitFor({ timeout: 20000 });
  await page.locator(".sidebar .nav-item").first().focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    "Comparar",
  );
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "Nenhum medicamento selecionado" })
    .waitFor();
  await page.dispatchEvent("body", "keydown", {
    key: "BrowserBack",
    bubbles: true,
    cancelable: true,
  });
  await page
    .getByRole("heading", { name: "Consulta farmacológica", exact: true })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Pesquisar no catálogo" })
    .fill("Dorflex");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.locator(".medicine-main").first().focus();
  await page.keyboard.press("Enter");
  await page.locator(".detail-tabs").waitFor();
  await page.dispatchEvent("body", "keydown", {
    key: "BrowserBack",
    bubbles: true,
    cancelable: true,
  });
  await page.locator(".results").waitFor();
  await page.getByRole("button", { name: "Calculadora", exact: true }).click();
  await page.getByLabel("Dose prescrita por tomada", { exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "Unidade da dose prescrita",
  );
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "dose-strength",
  );
  await page.getByLabel("Dose prescrita por tomada", { exact: true }).fill("1");
  await page
    .getByLabel("Princípio ativo por comprimido ou cápsula", { exact: true })
    .fill("0,5");
  await page
    .getByRole("button", { name: "Calcular quantidade", exact: true })
    .click();
  assert.equal(
    await page.locator(".dose-result > strong").textContent(),
    "2 comprimido(s)",
  );
  await page.dispatchEvent("body", "keydown", {
    key: "BrowserBack",
    bubbles: true,
    cancelable: true,
  });
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log(
    "TV: base offline sem DecompressionStream, setas, OK, Voltar, diálogo e conversão exata: OK. Não equivale a teste em TV física.",
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
