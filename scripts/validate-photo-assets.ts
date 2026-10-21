import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  retailerImageUrl,
  validEan,
  type PhotoCandidate,
} from "../server/photoImport.ts";
import { normalize, parseCatalog } from "../src/domain/catalog.ts";
import { retailerPageMatches } from "../src/domain/photoSources.ts";
import type { ManufacturerPhoto } from "../src/domain/manufacturerPhotos.ts";

interface Analysis {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  pixelHash: string;
  dHash: string;
  aHash: string;
  mean: number[];
  nonWhiteRatio: number;
}
interface Inspected {
  candidate: PhotoCandidate;
  analysis: Analysis;
  bytes: number;
  sha256: string;
  originContentType: string;
}
const input = JSON.parse(
  await readFile("data/photos/candidate-metadata.json", "utf8"),
);
const medicines = parseCatalog(
  JSON.parse(await readFile("build-native/seed/catalog.json", "utf8")),
);
const medicinesByRegistration = new Map(
  medicines.map((m) => [m.registration?.number, m]),
);
if (
  input.status !== "pending-image-files" ||
  input.minimumMedicines !== 100 ||
  input.minimumUniqueImagesPerMedicine !== 3 ||
  !Array.isArray(input.groups)
)
  throw Error("Manifesto de revisão inválido");
if (
  new Set(input.groups.map((g: { registration: string }) => g.registration))
    .size !== input.groups.length
)
  throw Error("Registros repetidos não podem ampliar a contagem");
const root = process.env.DOSER_PHOTO_REVIEW_DIR || "/tmp/doser-photo-review";
await mkdir(root, { recursive: true });
const output = process.env.DOSER_PHOTO_OUTPUT_DIR || "releases/photo-catalog";
await mkdir(output, { recursive: true });
const rejected: { id: string; reason: string }[] = [];
const exclusions = JSON.parse(
  await readFile("data/photos/excluded-images.json", "utf8"),
);
const excludedHashes = new Map<string, string>(
  exclusions.files.map((p: { sha256: string; reason: string }) => [
    p.sha256,
    p.reason,
  ]),
);
const filePromises = new Map<string, Promise<Inspected | undefined>>();
let requests = Promise.resolve();
let nextStart = 0;
async function inspect(p: PhotoCandidate): Promise<Inspected | undefined> {
  const medicine = medicinesByRegistration.get(p.registration);
  if (
    !retailerImageUrl(p.src) ||
    !retailerPageMatches(p.src, p.sourcePage, p.sourceLabel) ||
    !validEan(p.ean) ||
    !/^\d{9}$/.test(p.registration) ||
    !/^\d{14}$/.test(p.holderCnpj) ||
    !medicine ||
    normalize(medicine.name) !== normalize(p.name) ||
    normalize(medicine.ingredient) !== normalize(p.ingredient) ||
    !medicine.registration?.holder?.startsWith(p.holderCnpj)
  )
    throw Error("Fonte ou identidade inválida");
  const turn = requests.then(async () => {
    await new Promise((r) =>
      setTimeout(r, Math.max(0, nextStart - Date.now())),
    );
    nextStart = Date.now() + 150;
  });
  requests = turn.catch(() => {});
  await turn;
  try {
    if (/tarja|placeholder|sem[-_ ]?imagem/i.test(decodeURIComponent(p.src)))
      throw Error("Imagem genérica da loja, não uma foto identificadora");
    const response = await fetch(p.src, {
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "image/webp,image/jpeg,image/png" },
    });
    if (response.status !== 200 || !response.body)
      throw Error("Imagem HTTP " + response.status);
    if (Number(response.headers.get("content-length")) > 2_000_000)
      throw Error("Imagem excede 2 MB");
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw Error("Imagem excede 2 MB");
        }
        parts.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const data = Buffer.concat(parts);
    const sha256 = createHash("sha256").update(data).digest("hex");
    if (excludedHashes.has(sha256)) throw Error(excludedHashes.get(sha256));
    const path = root + "/" + sha256 + ".bin";
    await writeFile(path, data, { mode: 0o600 });
    const result = spawnSync(
      process.env.PYTHON || "python3",
      ["scripts/analyze-photo.py", path],
      { encoding: "utf8", timeout: 15000, maxBuffer: 4096 },
    );
    if (result.status !== 0)
      throw Error("Raster não aprovado: " + result.stderr.slice(0, 160));
    const analysis = JSON.parse(result.stdout) as Analysis;
    const originContentType =
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() ?? "";
    // Some CDNs negotiate a different raster while retaining the original header.
    // Trust the fully decoded allowed raster and pin its bytes, never HTML/SVG.
    if (
      ![
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/octet-stream",
      ].includes(originContentType)
    )
      throw Error(
        `MIME não permitido: ${originContentType}; raster: ${analysis.contentType}`,
      );
    return { candidate: p, analysis, bytes: size, sha256, originContentType };
  } catch (e) {
    rejected.push({ id: p.id, reason: String(e) });
    return undefined;
  }
}
const distance = (a: string, b: string) => {
  let n = BigInt("0x" + a) ^ BigInt("0x" + b),
    d = 0;
  while (n) {
    n &= n - 1n;
    d++;
  }
  return d;
};
function samePhoto(a: Inspected, b: Inspected) {
  return (
    a.sha256 === b.sha256 ||
    a.analysis.pixelHash === b.analysis.pixelHash ||
    (distance(a.analysis.dHash, b.analysis.dHash) <= 2 &&
      distance(a.analysis.aHash, b.analysis.aHash) <= 2 &&
      a.analysis.mean.every((v, i) => Math.abs(v - b.analysis.mean[i]) < 2))
  );
}
const inspected = new Map<string, Inspected[]>();
let groupIndex = 0;
async function worker() {
  while (groupIndex < input.groups.length) {
    const group = input.groups[groupIndex++];
    const unique: Inspected[] = [];
    const byEan = new Map<string, PhotoCandidate[]>();
    for (const p of group.photos as PhotoCandidate[]) {
      const a = byEan.get(p.ean) || [];
      a.push(p);
      byEan.set(p.ean, a);
    }
    // Several views of one presentation, then another formulation/pack when available.
    const order: PhotoCandidate[] = [];
    const sets = [...byEan.values()];
    for (let round = 0; round < 12; round++)
      for (const set of sets) {
        const p = set[round];
        if (p) order.push(p);
      }
    for (const p of order.slice(0, 20)) {
      if (unique.length >= 6) break;
      let promise = filePromises.get(p.src);
      if (!promise) {
        promise = inspect(p);
        filePromises.set(p.src, promise);
      }
      const result = await promise;
      if (result && !unique.some((a) => samePhoto(a, result)))
        unique.push({ ...result, candidate: p });
    }
    inspected.set(group.registration, unique);
    console.log(
      group.name + ": " + unique.length + " imagens distintas inspecionadas",
    );
  }
}
await Promise.all([worker(), worker(), worker()]);
// A shared file across distinct medicines is not accepted as an identifying photo.
const owners = new Map<string, Set<string>>();
for (const [reg, rows] of inspected)
  for (const row of rows) {
    const set = owners.get(row.sha256) || new Set();
    set.add(reg);
    owners.set(row.sha256, set);
  }
const eligible = input.groups
  .map((g: { name: string; registration: string }) => ({
    name: g.name,
    registration: g.registration,
    rows: (inspected.get(g.registration) || []).filter(
      (p) => owners.get(p.sha256)!.size === 1,
    ),
  }))
  .filter((g: { rows: Inspected[] }) => g.rows.length >= 3);
const chosen = eligible.slice(0, 100) as {
  name: string;
  registration: string;
  rows: Inspected[];
}[];
const manifest = chosen.flatMap((g) =>
  g.rows.map((row, i) => {
    const p = row.candidate;
    return {
      id: p.id,
      name: p.name,
      registration: p.registration,
      ingredient: p.ingredient,
      holderCnpj: p.holderCnpj,
      label: p.productTitle,
      productTitle: p.productTitle,
      ean: p.ean,
      presentation: p.presentation,
      src: new URL(p.src).href,
      sourcePage: p.sourcePage,
      sourceKind: "retailer",
      sourceLabel: p.sourceLabel,
      sourceRegistration: p.sourceRegistration,
      registrationConflict: p.registrationConflict,
      sourceMetadataSha256: p.sourceMetadataSha256,
      cmedSha256: p.cmedSha256,
      checkedAt: new Date().toISOString().slice(0, 10),
      sha256: row.sha256,
      bytes: row.bytes,
      contentType: row.analysis.contentType,
      originContentType: row.originContentType,
      width: row.analysis.width,
      height: row.analysis.height,
      position: i,
      reviewStatus: "validated-file",
    };
  }),
);
const report = {
  checkedAt: new Date().toISOString(),
  minimumMedicines: 100,
  minimumPerMedicine: 3,
  medicines: chosen.length,
  images: manifest.length,
  complete: chosen.length >= 100,
  eligible: eligible.length,
  records: chosen.map((g) => ({
    name: g.name,
    registration: g.registration,
    images: g.rows.length,
  })),
  rejected,
  reviewed: input.groups.map((g: { name: string; registration: string }) => ({
    name: g.name,
    registration: g.registration,
    distinctFiles: (inspected.get(g.registration) || []).length,
    exclusiveFiles: (inspected.get(g.registration) || []).filter(
      (p) => owners.get(p.sha256)!.size === 1,
    ).length,
  })),
  mimeDifferences: chosen.flatMap((g) =>
    g.rows
      .filter((p) => p.originContentType !== p.analysis.contentType)
      .map((p) => ({
        id: p.candidate.id,
        declared: p.originContentType,
        decoded: p.analysis.contentType,
      })),
  ),
  methods: [
    "EAN+registro+nome+titular CMED",
    "raster decodificado, dimensões e tamanho",
    "SHA-256 e duplicatas visuais conservadoras",
    "sem redistribuição dos arquivos de imagem",
  ],
  limitation:
    "A validação de arquivos e identidade não é revisão clínica nem inspeção humana de cada ângulo. Os rótulos não presumem frente/verso ou comprimido solto.",
};
await writeFile(
  output + "/catalogo-fotos.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  output + "/validacao-fotos.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    medicines: chosen.length,
    images: manifest.length,
    eligible: eligible.length,
    rejected: rejected.length,
    complete: report.complete,
  }),
);
if (!report.complete)
  throw Error(
    "Meta de 100 fichas com ao menos três imagens distintas não atingida. Não publicar APK como completo.",
  );
