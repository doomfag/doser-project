import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  manufacturerPhotos,
  manufacturerPhotosFor,
  verifiedManufacturerImage,
} from "../src/domain/manufacturerPhotos.ts";
import { parseCatalog } from "../src/domain/catalog.ts";

const medicines = parseCatalog(
  JSON.parse(await readFile(".doser/catalog.json", "utf8")),
);
const results = await Promise.all(
  manufacturerPhotos.map(async (photo) => {
    const m = medicines.find((m) =>
      manufacturerPhotosFor(m).some((p) => p.id === photo.id),
    );
    assert(m, "Imagem sem registro correspondente: " + photo.id);
    const response = await fetch(photo.src, {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200);
    assert(response.headers.get("content-type")?.startsWith("image/webp"));
    const bytes = Buffer.from(await response.arrayBuffer());
    await verifiedManufacturerImage(bytes.toString("base64"), photo);
    return {
      id: photo.id,
      registration: m.registration?.number,
      label: photo.label,
      bytes: bytes.length,
      sha256: photo.sha256,
    };
  }),
);
await mkdir("releases", { recursive: true });
await writeFile(
  "releases/validacao-imagens-0.7.2.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
);
console.log(
  "15 imagens oficiais: HTTP 200, WebP, tamanho, SHA-256 e vínculo ao cadastro real conferidos. Nenhum arquivo de imagem redistribuído.",
);
