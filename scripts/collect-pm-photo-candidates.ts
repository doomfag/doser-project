import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  buildPhotoIdentityIndex,
  collectPagueMenosPhotos,
  type PhotoCandidate,
} from "../server/photoImport.ts";
import { parseCatalog, normalize } from "../src/domain/catalog.ts";
import priorities from "../data/photos/priority-candidates.json" with { type: "json" };
const root = ".doser/photo-expansion";
await mkdir(root + "/pm-pages", { recursive: true });
const meds = parseCatalog(
  JSON.parse(await readFile(".doser/catalog.json", "utf8")),
);
const { index } = buildPhotoIdentityIndex(
  await readFile(process.env.DOSER_PHOTO_CMED_FILE || "/tmp/doser-cmed.csv"),
  meds,
);
type Group = { name: string; registration: string; photos: PhotoCandidate[] };
let groups: Group[] = [];
const failures: { name: string; reason: string }[] = [];
try {
  groups = JSON.parse(
    await readFile(root + "/pm-candidates.json", "utf8"),
  ).groups;
} catch {}
const pending = priorities.candidates.filter(
  (n) => !groups.some((g) => normalize(n) === normalize(g.name)),
);
let next = 0;
let nextStart = 0;
let queue = Promise.resolve();
let saves = Promise.resolve();
async function get(name: string) {
  const url =
    "https://www.paguemenos.com.br/api/catalog_system/pub/products/search/" +
    encodeURIComponent(name) +
    "?_from=0&_to=49";
  const key = createHash("sha256").update(url).digest("hex");
  const path = root + "/pm-pages/" + key + ".json";
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {}
  const turn = queue.then(async () => {
    await new Promise((r) =>
      setTimeout(r, Math.max(0, nextStart - Date.now())),
    );
    nextStart = Date.now() + 500;
  });
  queue = turn.catch(() => {});
  await turn;
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw Error("HTTP " + response.status);
  const text = await response.text();
  if (text.length > 8_000_000) throw Error("Resposta excede limite.");
  const json = JSON.parse(text);
  if (!Array.isArray(json)) throw Error("Resposta não é catálogo público.");
  await writeFile(path, text, { mode: 0o600 });
  return json;
}
function save() {
  const text = JSON.stringify(
    {
      version: 1,
      checkedAt: new Date().toISOString(),
      status: "pending-image-files",
      source: "Catálogo público VTEX/Pague Menos + EAN CMED",
      groups,
      failures,
    },
    null,
    2,
  );
  saves = saves.then(async () => {
    await writeFile(root + "/pm-candidates.json.tmp", text, { mode: 0o600 });
    await rename(
      root + "/pm-candidates.json.tmp",
      root + "/pm-candidates.json",
    );
  });
  return saves;
}
async function worker() {
  while (next < pending.length) {
    const name = pending[next++];
    try {
      const photos = collectPagueMenosPhotos(
        await get(name),
        index,
        new Date().toISOString().slice(0, 10),
      ).filter((p) => normalize(p.name) === normalize(name));
      const byReg = new Map<string, PhotoCandidate[]>();
      for (const p of photos) {
        const list = byReg.get(p.registration) || [];
        if (!list.some((a) => a.src === p.src)) list.push(p);
        byReg.set(p.registration, list);
      }
      const best = [...byReg].sort((a, b) => b[1].length - a[1].length)[0];
      if (best) {
        // Keep several presentations when available; at most eight images from one EAN.
        const selected: PhotoCandidate[] = [];
        const eans = [...new Set(best[1].map((p) => p.ean))];
        for (let round = 0; round < 8; round++)
          for (const ean of eans) {
            const p = best[1].filter((p) => p.ean === ean)[round];
            if (p && selected.length < 24) selected.push(p);
          }
        groups.push({ name, registration: best[0], photos: selected });
        console.log(
          "PM",
          groups.length + "/" + priorities.candidates.length,
          name,
          selected.length,
          "URLs",
          selected.length >= 3 ? "candidato à meta" : "incompleto",
        );
      } else {
        failures.push({
          name,
          reason: "Sem EAN exato com cadastro ativo e titular confirmado",
        });
        console.log("PM sem vínculo:", name);
      }
    } catch (e) {
      failures.push({ name, reason: String(e) });
      console.log("PM pendente:", name, String(e).slice(0, 100));
    }
    await save();
  }
}
await Promise.all([worker(), worker()]);
await saves;
console.log(
  "Pague Menos:",
  groups.filter((g) => g.photos.length >= 3).length,
  "fichas com pelo menos três URLs candidatas; arquivos ainda precisam de validação.",
);
