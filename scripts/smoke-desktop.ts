import { _electron } from "playwright";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(join(tmpdir(), "doser-native-test-"));
const snapshot = JSON.parse(
  await readFile("build-native/seed/catalog.json", "utf8"),
);
const application = await _electron.launch({
  args: [".", ...(process.platform === "linux" ? ["--no-sandbox"] : [])],
  env: { ...process.env, DOSER_USER_DATA_DIR: directory },
});
try {
  const page = await application.firstWindow();
  await page
    .getByRole("heading", { name: "Consulta farmacológica", exact: true })
    .waitFor();
  await page
    .getByText(`${snapshot.medicines.length} registros no catálogo local`, {
      exact: true,
    })
    .waitFor({ timeout: 20000 });
  assert.equal(
    await page.evaluate(
      () => typeof (window as unknown as { require?: unknown }).require,
    ),
    "undefined",
  );
  assert(page.url().startsWith("doser://app/"));
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/catalog/status");
    return r.json();
  });
  assert.equal(status.count, snapshot.medicines.length);
  await page
    .getByRole("textbox", { name: "Pesquisar no catálogo" })
    .fill("Dorflex");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await page.locator(".medicine-row").first().waitFor();
  await page.getByRole("button", { name: "Calculadora", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  console.log(
    "Janela nativa, origem própria, catálogo, pesquisa, calculadora e isolamento Node: OK.",
  );
} finally {
  await application.close();
}
