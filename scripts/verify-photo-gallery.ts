// Distribution check: real catalog and real bytes through an isolated native test bridge.
// Does not claim to run Android/iOS hardware or include photographs in a release.
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import {
  manufacturerPhotos,
  photoPresentationGroups,
} from "../src/domain/manufacturerPhotos.ts";
const html = await readFile("releases/Doser.html");
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
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    let offline = false,
      nativeCalls = 0;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.exposeFunction(
      "doserTestNativeRequest",
      async (options: { url: string }) => {
        nativeCalls++;
        if (offline) throw Error("Isolated offline test");
        assert(manufacturerPhotos.some((p) => p.src === options.url));
        const response = await fetch(options.url, {
          redirect: "error",
          signal: AbortSignal.timeout(20000),
          headers: { Accept: "image/webp,image/jpeg,image/png" },
        });
        return {
          url: options.url,
          status: response.status,
          headers: {},
          data:
            Buffer.from(await response.arrayBuffer()).toString("base64") + "\n",
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
      localStorage.setItem(
        "doser.update.v1",
        JSON.stringify({ automatic: false }),
      );
    });
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
    const ready = async () => {
      await page.waitForFunction(
        () => {
          const image = document.querySelector<HTMLImageElement>(
            ".manufacturer-image img",
          );
          return !!image?.naturalWidth;
        },
        null,
        { timeout: 30000 },
      );
      await page
        .locator(".manufacturer-image img")
        .evaluate(async (image: HTMLImageElement) => {
          await image.decode();
        });
      assert(
        await page.evaluate(() => {
          const image = document.querySelector<HTMLImageElement>(
            ".manufacturer-image img",
          )!;
          const box = image.getBoundingClientRect(),
            frame = image.parentElement!.getBoundingClientRect();
          return (
            image.naturalWidth > 0 &&
            box.width <= frame.width + 1 &&
            box.height <= frame.height + 1 &&
            document.documentElement.scrollWidth <= innerWidth
          );
        }),
        "Imagem deve caber na moldura sem estouro horizontal",
      );
    };
    for (const name of ["DORFLEX", "NOVALGINA"]) {
      await open(name);
      await ready();
      const groups = photoPresentationGroups(
        manufacturerPhotos.filter((p) => p.name === name),
      );
      if (groups.length > 1) {
        await page.getByLabel("Ver outra embalagem").selectOption(groups[1].id);
        await ready();
      }
      const group = groups.length > 1 ? groups[1] : groups[0];
      if (group.photos.length > 1) {
        await page
          .getByRole("button", {
            name: `Ver imagem 2 de ${group.photos[1].productTitle}`,
            exact: true,
          })
          .click();
        await ready();
      }
      await page
        .locator(".manufacturer-photos")
        .screenshot({
          path: `releases/fotos-${name.toLowerCase()}-0.8-${width}.png`,
          animations: "disabled",
        });
      await page.getByRole("button", { name: "Voltar", exact: true }).click();
    }
    // Wait for the lightweight cache metadata to commit before simulating no network.
    await page.waitForFunction(async () => {
      const request = indexedDB.open("doser.manufacturer-images", 2);
      const db = await new Promise<IDBDatabase>((ok, fail) => {
        request.onsuccess = () => ok(request.result);
        request.onerror = fail;
      });
      try {
        return await new Promise<boolean>((ok, fail) => {
          const r = db.transaction("info").objectStore("info").count();
          r.onsuccess = () => ok(r.result >= 4);
          r.onerror = fail;
        });
      } finally {
        db.close();
      }
    });
    const calls = nativeCalls;
    offline = true;
    await open("DORFLEX");
    await ready();
    assert.equal(
      nativeCalls,
      calls,
      "Reabrir a foto guardada não deve chamar a rede",
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      nativeCalls,
      errors,
      checks: [
        "catálogo real de 10326 registros",
        "bytes PNG/WebP reais, hash e transporte nativo controlado",
        "apresentações separadas e miniaturas",
        "cache sem rede",
        "imagem cabe na moldura e sem estouro horizontal",
      ],
      limitation: "Não é instalação em aparelho físico.",
    });
    await page.close();
  }
  await mkdir("releases", { recursive: true });
  await writeFile(
    "releases/validacao-galeria-0.8.0.json",
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) +
      "\n",
  );
  console.log(results);
} finally {
  await browser.close();
  server.close();
}
