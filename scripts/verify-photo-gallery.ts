import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { manufacturerPhotos } from "../src/domain/manufacturerPhotos.ts";
const nativeBridge = process.env.DOSER_TEST_NATIVE_BRIDGE === "1";
const html = await readFile("releases/Doser.html");
const server = createServer((_req, res) =>
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html),
);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
});
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    let offline = false;
    let nativeCalls = 0;
    if (nativeBridge) {
      await page.exposeFunction(
        "doserTestNativeRequest",
        async (options: { url: string }) => {
          nativeCalls++;
          if (offline) throw Error("Offline transport test");
          assert(manufacturerPhotos.some((p) => p.src === options.url));
          const r = await fetch(options.url, {
            redirect: "error",
            signal: AbortSignal.timeout(20000),
          });
          return {
            url: options.url,
            status: r.status,
            headers: {},
            data: Buffer.from(await r.arrayBuffer()).toString("base64") + "\n",
          };
        },
      );
      await page.addInitScript(() => {
        const w = window as unknown as {
          androidBridge: object;
          Capacitor: object;
          doserTestNativeRequest: (o: unknown) => Promise<unknown>;
        };
        w.androidBridge = {};
        w.Capacitor = {
          PluginHeaders: [
            {
              name: "CapacitorHttp",
              methods: [{ name: "get", rtype: "promise" }],
            },
          ],
          nativePromise: (_p: string, _m: string, o: unknown) =>
            w.doserTestNativeRequest(o),
        };
      });
    }
    const errors: string[] = [];
    page.on("requestfailed", (r) =>
      console.log("Request failed:", r.url(), r.failure()?.errorText),
    );
    page.on("console", (m) => {
      if (m.type() === "error") console.log("Browser:", m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page
      .getByText("10326 registros no catálogo local", { exact: true })
      .waitFor();
    const open = async (name: string) => {
      await page
        .getByLabel("Pesquisar no catálogo", { exact: true })
        .fill(name);
      await page
        .getByRole("button", { name: "Pesquisar", exact: true })
        .click();
      await page
        .locator(".medicine-main")
        .filter({
          has: page.locator("strong", {
            hasText: new RegExp("^" + name + "$"),
          }),
        })
        .first()
        .click();
    };
    await open("DORFLEX");
    await page.waitForFunction(
      () => {
        const i = document.querySelector<HTMLImageElement>(
          ".manufacturer-image img",
        );
        return !!i?.naturalWidth;
      },
      {},
      { timeout: 20000 },
    );
    await page
      .getByLabel("Ver outra embalagem")
      .selectOption("dorflex-gotas-0");
    await page.waitForFunction(() => {
      const i = document.querySelector<HTMLImageElement>(
        ".manufacturer-image img",
      );
      return !!i?.naturalWidth && i.alt.includes("gotas");
    });
    await page
      .locator(".manufacturer-image img")
      .evaluate(async (image: HTMLImageElement) => {
        await image.decode();
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
    await page.screenshot({
      path: `releases/fotos-dorflex-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await open("NOVALGINA");
    await page
      .getByLabel("Ver outra embalagem")
      .selectOption("novalgina-solucao-0");
    await page.waitForFunction(() => {
      const i = document.querySelector<HTMLImageElement>(
        ".manufacturer-image img",
      );
      return !!i?.naturalWidth && i.alt.includes("solução oral");
    });
    await page
      .locator(".manufacturer-image img")
      .evaluate(async (image: HTMLImageElement) => {
        await image.decode();
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
    await page.screenshot({
      path: `releases/fotos-novalgina-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const imageFits = await page.evaluate(() => {
      const image = document.querySelector<HTMLImageElement>(
        ".manufacturer-image img",
      )!;
      const box = image.getBoundingClientRect();
      const frame = image.parentElement!.getBoundingClientRect();
      return (
        image.complete &&
        image.naturalWidth > 0 &&
        box.width <= frame.width + 1 &&
        box.height <= frame.height + 1
      );
    });
    assert(
      imageFits,
      "A imagem deve caber na moldura, inclusive quando a resolução original é grande.",
    );
    assert.deepEqual(errors, []);
    if (nativeBridge) {
      offline = true;
      const calls = nativeCalls;
      await page.getByRole("button", { name: "Voltar", exact: true }).click();
      await open("DORFLEX");
      await page.waitForFunction(() => {
        const i = document.querySelector<HTMLImageElement>(
          ".manufacturer-image img",
        );
        return !!i?.naturalWidth;
      });
      await page
        .getByLabel("Ver outra embalagem")
        .selectOption("dorflex-gotas-0");
      await page.waitForFunction(() => {
        const i = document.querySelector<HTMLImageElement>(
          ".manufacturer-image img",
        );
        return !!i?.naturalWidth && i.alt.includes("gotas");
      });
      assert.equal(nativeCalls, calls, "Cache não deve chamar a rede offline");
    }
    results.push({
      width,
      errors,
      checks: [
        "Dorflex: imagem real de comprimidos e gotas",
        "Novalgina: solução oral com frasco e seringa",
        nativeBridge
          ? "transporte nativo controlado com bytes reais e cache offline"
          : "HTTP direto, CSP sem wildcard",
        "sem estouro horizontal",
      ],
    });
    await page.close();
  }
  await mkdir("releases", { recursive: true });
  await writeFile(
    "releases/validacao-galeria-0.7.2.json",
    JSON.stringify(
      { checkedAt: new Date().toISOString(), nativeBridge, results },
      null,
      2,
    ),
  );
  console.log(results);
} finally {
  await browser.close();
  server.close();
}
