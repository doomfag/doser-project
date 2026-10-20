import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { parseCatalog } from "../src/domain/catalog.ts";
const output = resolve(process.argv[2] || "releases/Doser.html");
let snapshot;
try {
  snapshot = JSON.parse(await readFile(".doser/catalog.json", "utf8"));
} catch {
  throw new Error(
    "A base real ainda não está disponível. Execute npm run catalog:update antes de gerar o arquivo portátil.",
  );
}
const medicines = parseCatalog(snapshot);
if (
  !medicines.length ||
  snapshot.status?.count !== medicines.length ||
  !snapshot.status.lastSuccess
)
  throw new Error("A base local não possui metadados de sucesso válidos.");
let html = await readFile("dist/index.html", "utf8");
const jsPath = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)?.[1];
const cssPath = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/)?.[1];
if (!jsPath || !cssPath)
  throw new Error("Build incompleto. Execute npm run build.");
const js = (await readFile(resolve("dist", `.${jsPath}`), "utf8")).replace(
  /<\/script/gi,
  "<\\/script",
);
const css = await readFile(resolve("dist", `.${cssPath}`), "utf8");
const scriptHash = createHash("sha256").update(js).digest("base64");
const gzip = gzipSync(
  JSON.stringify({
    version: 1,
    medicines,
    clinicalReferences: snapshot.clinicalReferences ?? [],
    status: snapshot.status,
  }),
  { level: 9 },
);
const envelope = JSON.stringify({
  encoding: "gzip-base64",
  sha256: createHash("sha256").update(gzip).digest("hex"),
  data: gzip.toString("base64"),
});
html = html.replace(
  '<html lang="pt-BR">',
  '<html lang="pt-BR" data-doser-standalone="true">',
);
html = html.replace(
  /<script[^>]+src="[^"]+"[^>]*><\/script>/,
  () => `<script id="doser-app" type="module">${js}</script>`,
);
html = html.replace(
  /<link[^>]+href="[^"]+\.css"[^>]*>/,
  () => `<style id="doser-styles">${css}</style>`,
);
html = html.replace(
  "script-src 'self'",
  `script-src 'self' 'sha256-${scriptHash}'`,
);
html = html.replace(
  "</head>",
  `<script id="doser-catalog" type="application/json">${envelope}</script></head>`,
);
html = html.replace(
  "/favicon.svg",
  `data:image/svg+xml;base64,${(await readFile("public/favicon.svg")).toString("base64")}`,
);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html, "utf8");
console.log(
  JSON.stringify(
    {
      file: output,
      medicines: medicines.length,
      bytes: Buffer.byteLength(html),
      sourceHash: snapshot.status.report?.sha256,
    },
    null,
    2,
  ),
);
