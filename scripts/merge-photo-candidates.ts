import { readFile, writeFile, mkdir } from "node:fs/promises";
import { normalize } from "../src/domain/catalog.ts";
import type { PhotoCandidate } from "../server/photoImport.ts";
import priority from "../data/photos/priority-candidates.json" with { type: "json" };
type Group = { name: string; registration: string; photos: PhotoCandidate[] };
const all = new Map<string, Group>();
for (const file of [
  ".doser/photo-expansion/pm-candidates.json",
  ".doser/photo-expansion/candidates.json",
]) {
  try {
    const data = JSON.parse(await readFile(file, "utf8"));
    for (const g of data.groups as Group[]) {
      const current = all.get(g.registration) || {
        name: g.name,
        registration: g.registration,
        photos: [],
      };
      for (const p of g.photos)
        if (
          !/tarja|placeholder|sem[-_ ]?imagem/i.test(
            decodeURIComponent(p.src),
          ) &&
          !current.photos.some((a) => a.src === p.src)
        )
          current.photos.push(p);
      all.set(g.registration, current);
    }
  } catch (e) {
    console.log("Fonte local não lida:", file, String(e).slice(0, 100));
  }
}
// One active registration per editorial candidate name; do not inflate coverage with manufacturers of the same generic name.
const selected: Group[] = [];
for (const name of priority.candidates) {
  const group = [...all.values()]
    .filter(
      (g) => normalize(g.name) === normalize(name) && g.photos.length >= 3,
    )
    .sort((a, b) => b.photos.length - a.photos.length)[0];
  if (
    group &&
    !selected.some(
      (g) =>
        g.registration === group.registration ||
        normalize(g.name) === normalize(group.name),
    )
  )
    selected.push(group);
}
await mkdir("data/photos", { recursive: true });
const output = {
  version: 1,
  status: "pending-image-files",
  description: priority.description,
  minimumMedicines: 100,
  minimumUniqueImagesPerMedicine: 3,
  desiredUniqueImagesPerMedicine: 4,
  groups: selected,
};
await writeFile(
  "data/photos/candidate-metadata.json",
  JSON.stringify(output, null, 2) + "\n",
);
console.log({
  groups: selected.length,
  uniqueNames: new Set(selected.map((g) => g.name)).size,
  images: selected.reduce((n, g) => n + g.photos.length, 0),
  status: output.status,
});
if (selected.length < 100) process.exitCode = 1;
