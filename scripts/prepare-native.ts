import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import {
  parseCatalog,
  parseClinicalReferences,
  assertReferenceLinks,
} from "../src/domain/catalog.ts";
let snapshot;
try {
  snapshot = JSON.parse(await readFile(".doser/catalog.json", "utf8"));
} catch {
  const html = await readFile("downloads/Doser.html", "utf8");
  const raw = html.match(
    /<script id="doser-catalog" type="application\/json">(.*?)<\/script>/s,
  )?.[1];
  if (!raw) throw new Error("Base de distribuição ausente.");
  const envelope = JSON.parse(raw);
  const data = Buffer.from(envelope.data, "base64");
  if (createHash("sha256").update(data).digest("hex") !== envelope.sha256)
    throw new Error("Integridade da base não confere.");
  snapshot = JSON.parse(gunzipSync(data).toString());
}
const medicines = parseCatalog(snapshot);
const references = parseClinicalReferences(snapshot.clinicalReferences ?? []);
assertReferenceLinks(medicines, references);
if (
  !medicines.length ||
  snapshot.status?.count !== medicines.length ||
  !snapshot.status.lastSuccess
)
  throw new Error("Base inicial inválida.");
await mkdir("build-native/seed", { recursive: true });
await writeFile("build-native/seed/catalog.json", JSON.stringify(snapshot));
await mkdir(".doser", { recursive: true });
await writeFile(".doser/catalog.json", JSON.stringify(snapshot));
await build({
  entryPoints: ["server/createUpdater.ts"],
  outfile: "build-native/updater.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
});
await mkdir("mobile/www", { recursive: true });
// scripts/portable.ts is run after this preparation to generate mobile/www/index.html.
await copyFile("public/favicon.svg", "mobile/www/favicon.svg");
console.log(
  `Base nativa preparada: ${medicines.length} registros, ${references.length} referências.`,
);
