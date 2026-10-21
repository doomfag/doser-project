import { createServer } from "node:http";
import { readFile, mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const root = "build-pwa/",
  prefix = "/doser-project/";
let revision = 0;
const html = await readFile(root + "index.html", "utf8"),
  worker = await readFile(root + "sw.js", "utf8");
const requested: string[] = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://localhost");
    requested.push(url.pathname);
    const path = url.pathname.slice(prefix.length) || "index.html";
    if (
      !url.pathname.startsWith(prefix) ||
      ![
        "index.html",
        "sw.js",
        "manifest.webmanifest",
        "icons/icon-512.png",
        "icons/apple-touch-icon.png",
      ].includes(path)
    ) {
      res.writeHead(404).end();
      return;
    }
    const type = path.endsWith("html")
      ? "text/html; charset=utf-8"
      : path.endsWith("js")
        ? "application/javascript"
        : path.endsWith("png")
          ? "image/png"
          : "application/manifest+json";
    const content =
      path === "index.html"
        ? revision
          ? html.replace(
              "<title>Doser</title>",
              "<title>Doser atualizado</title>",
            )
          : html
        : path === "sw.js"
          ? revision
            ? worker.replace(
                /const CACHE=PREFIX\+"([a-f0-9]+)"/,
                'const CACHE=PREFIX+"$1-update"',
              )
            : worker
          : await readFile(root + path);
    res
      .writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" })
      .end(content);
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const address = server.address();
assert(address && typeof address !== "string");
const profile = await mkdtemp(join(tmpdir(), "doser-pwa-profile-"));
const context = await chromium.launchPersistentContext(profile, {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/google-chrome")
      ? "/usr/bin/google-chrome"
      : "/usr/bin/chromium"),
});
try {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "DecompressionStream", {
      value: undefined,
      configurable: true,
    });
  });
  const url = `http://127.0.0.1:${address.port}${prefix}`;
  await page.goto(url);
  await expect(
    page.getByText("10326 registros no catálogo local", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "Salvar HTML", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Como instalar", exact: true })
    .click();
  await expect(page.getByText(/Adicionar à Tela de Início/)).toBeVisible();
  await expect(
    page.getByText(/Consulta preparada para abrir sem internet/),
  ).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const manifest = await page.evaluate(
    async () => await (await fetch("./manifest.webmanifest")).json(),
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./");
  const cdp = await context.newCDPSession(page);
  const installability = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(
    installability.installabilityErrors,
    [],
    "Manifest must be installable",
  );
  await page.goto(url + "#library");
  await page.getByRole("button", { name: "Anotações", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Nota privada de teste");
  await page
    .getByLabel("Anotação acadêmica", { exact: true })
    .fill("SENTINELA-PRIVADA-SOMENTE-LOCAL");
  await page
    .getByRole("button", { name: "Salvar anotação", exact: true })
    .click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Anotações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nota privada de teste", exact: true }),
  ).toBeVisible();
  await page.goto(url);
  await page
    .getByLabel("Pesquisar no catálogo", { exact: true })
    .fill("DORFLEX");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page.locator(".medicine-row").first()).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(async () => {
    const c = await caches.open("unrelated-application-test");
    await c.put("./sentinel", new Response("preserve"));
  });
  revision = 1;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Atualizar Doser", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Atualizar Doser", exact: true })
    .click();
  await expect(page).toHaveTitle("Doser atualizado", { timeout: 30000 });
  await page.goto(url + "#library");
  await page.getByRole("button", { name: "Anotações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nota privada de teste", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      async () =>
        await (
          await (
            await caches.open("unrelated-application-test")
          ).match("./sentinel")
        )?.text(),
    ),
    "preserve",
  );
  assert(
    !requested.some(
      (path) => path.includes("SENTINELA") || path.includes("/api/"),
    ),
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await mkdir("releases", { recursive: true });
  const report = {
    checkedAt: new Date().toISOString(),
    catalog: 10326,
    installability: installability.installabilityErrors,
    errors,
    checks: [
      "manifest standalone + scope correto",
      "sem dependência de descompressão gzip",
      "catálogo e busca sem rede",
      "anotação persistida sem rede e após atualização",
      "atualização por ação do usuário",
      "cache de outros aplicativos preservado",
      "nenhuma API local chamada nem nota enviada",
      "sem estouro horizontal",
    ],
    limitation:
      "Teste automatizado Chromium; instalação em iPhone físico ainda não verificada.",
  };
  await writeFile(
    "releases/validacao-pwa.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
  await context.close();
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
  server.close();
}
