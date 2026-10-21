import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  buildPhotoIdentityIndex,
  collectProductPhotos,
  searchProductLinks,
  type PhotoCandidate,
} from "../server/photoImport.ts";
import { parseCatalog, normalize } from "../src/domain/catalog.ts";
import priorities from "../data/photos/priority-candidates.json" with { type: "json" };

const root = resolve(".doser/photo-expansion");
await mkdir(root + "/pages", { recursive: true });
const meds = parseCatalog(
  JSON.parse(await readFile(".doser/catalog.json", "utf8")),
);
const cmed = await readFile(
  process.env.DOSER_PHOTO_CMED_FILE || "/tmp/doser-cmed.csv",
);
const { index, ambiguous } = buildPhotoIdentityIndex(cmed, meds);
console.log(
  "Índice exato CMED:",
  index.size,
  "EANs; ambiguidades excluídas:",
  ambiguous.size,
);
type Group = { name: string; registration: string; photos: PhotoCandidate[] };
let groups: Group[] = [];
try {
  groups = JSON.parse(await readFile(root + "/candidates.json", "utf8")).groups;
} catch {}
const target = Number(process.env.DOSER_PHOTO_METADATA_TARGET || 110);
const failures: { name: string; reason: string }[] = [];
const pending = priorities.candidates.filter(
  (name) => !groups.some((g) => normalize(g.name) === normalize(name)),
);
let next = 0;
let queued = Promise.resolve();
let lastStart = 0;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchPage(url: string) {
  const key = createHash("sha256").update(url).digest("hex");
  const path = root + "/pages/" + key + ".html";
  try {
    return await readFile(path, "utf8");
  } catch {}
  // Public canonical pages and the robots-permitted single-parameter search only.
  const u = new URL(url);
  if (
    u.origin !== "https://www.drogasil.com.br" ||
    (!/^\/[a-z0-9-]+\.html$/.test(u.pathname) &&
      !(u.pathname === "/search" && [...u.searchParams.keys()].join() === "w"))
  )
    throw Error("URL não permitida");
  const start = queued.then(async () => {
    await pause(Math.max(0, lastStart + 400 - Date.now()));
    lastStart = Date.now();
  });
  queued = start.catch(() => {});
  await start;
  const r = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: { Accept: "text/html" },
  });
  if (!r.ok) throw Error("HTTP " + r.status);
  if (!r.headers.get("content-type")?.includes("text/html"))
    throw Error("Formato não é HTML");
  const reader = r.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const p = await reader.read();
      if (p.done) break;
      size += p.value.length;
      if (size > 8_000_000) {
        await reader.cancel();
        throw Error("Página grande demais");
      }
      chunks.push(p.value);
    }
  } finally {
    reader.releaseLock();
  }
  const html = Buffer.concat(chunks).toString("utf8");
  await writeFile(path, html, { mode: 0o600 });
  return html;
}
function form(name: string) {
  const n = normalize(name);
  return (
    [
      "gotas",
      "xarope",
      "suspens",
      "solucao",
      "capsula",
      "comprimido",
      "creme",
      "pomada",
      "spray",
      "efervescente",
    ].find((x) => n.includes(x)) || "other"
  );
}
let saving = Promise.resolve();
function save() {
  const data = JSON.stringify(
    {
      version: 1,
      checkedAt: new Date().toISOString(),
      source: "Páginas públicas Drogasil + EAN/registro/nome/titular CMED",
      status: "pending-image-files",
      goal: 100,
      minimumUniqueImages: 4,
      groups,
      failures,
    },
    null,
    2,
  );
  saving = saving.then(async () => {
    await writeFile(root + "/candidates.json.tmp", data, { mode: 0o600 });
    await rename(root + "/candidates.json.tmp", root + "/candidates.json");
  });
  return saving;
}
async function worker() {
  while (next < pending.length && groups.length < target) {
    const name = pending[next++];
    try {
      const html = await fetchPage(
        "https://www.drogasil.com.br/search?w=" + encodeURIComponent(name),
      );
      const all = searchProductLinks(html);
      const links = [];
      const used = new Set<string>();
      for (const p of all) {
        const f = form(p.name);
        if (!used.has(f)) {
          links.push(p);
          used.add(f);
        }
      }
      for (const p of all)
        if (!links.some((l) => l.url === p.url)) links.push(p);
      let chosenRegistration = "";
      const found: PhotoCandidate[] = [];
      let read = 0;
      for (const link of links.slice(0, 8)) {
        if (found.length >= 8 && read >= 2) break;
        let candidates: PhotoCandidate[];
        try {
          candidates = collectProductPhotos(
            await fetchPage(link.url),
            link.url,
            index,
            new Date().toISOString().slice(0, 10),
          );
          read++;
        } catch {
          continue;
        }
        const matches = candidates.filter(
          (p) =>
            normalize(p.name) === normalize(name) &&
            (!chosenRegistration || p.registration === chosenRegistration),
        );
        if (!matches.length) continue;
        chosenRegistration ||= matches[0].registration;
        for (const p of matches)
          if (!found.some((x) => x.src === p.src)) found.push(p);
      }
      if (
        found.length >= 1 &&
        !groups.some((g) => g.registration === chosenRegistration)
      ) {
        groups.push({
          name,
          registration: chosenRegistration,
          photos: found.slice(0, 16),
        });
        console.log(
          `${groups.length}/${target}: ${name} — registro ${chosenRegistration}, ${found.length} URLs distintas, revisão dos arquivos pendente`,
        );
      } else {
        failures.push({
          name,
          reason: found.length + " imagens candidatas com vínculo exato",
        });
        console.log("Pendente:", name, found.length);
      }
    } catch (e) {
      failures.push({ name, reason: String(e) });
      console.log("Não coletado:", name, String(e).slice(0, 110));
    }
    await save();
  }
}
await Promise.all([worker(), worker()]);
await saving;
console.log(
  "Metadados preparados:",
  groups.length,
  "fichas;",
  groups.reduce((s, g) => s + g.photos.length, 0),
  "imagens candidatas. Não é acervo de arquivos validado nem APK concluído.",
);
