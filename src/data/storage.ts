import { parseCatalog, type Medicine } from "../domain/catalog";
export interface Note {
  id: string;
  title: string;
  body: string;
  category: string;
  updatedAt: string;
}
export interface SavedComparison {
  id: string;
  ids: string[];
  createdAt: string;
}
export interface PersonalData {
  version: 1;
  history: string[];
  favorites: string[];
  notes: Note[];
  comparisons: SavedComparison[];
}
export const emptyPersonal = (): PersonalData => ({
  version: 1,
  history: [],
  favorites: [],
  notes: [],
  comparisons: [],
});
const personalKey = "doser.personal.v1";
const catalogKey = "doser.catalog.v1";
export function loadPersonal(): PersonalData {
  try {
    const p = JSON.parse(localStorage.getItem(personalKey) || "null");
    if (
      !p ||
      p.version !== 1 ||
      ![p.history, p.favorites, p.notes, p.comparisons].every(Array.isArray)
    )
      return emptyPersonal();
    return {
      version: 1,
      history: p.history
        .filter((s: unknown) => typeof s === "string")
        .slice(0, 30),
      favorites: p.favorites.filter((s: unknown) => typeof s === "string"),
      notes: p.notes.filter(
        (n: Note) =>
          n &&
          typeof n.id === "string" &&
          typeof n.title === "string" &&
          typeof n.body === "string" &&
          typeof n.category === "string" &&
          typeof n.updatedAt === "string",
      ),
      comparisons: p.comparisons.filter(
        (c: SavedComparison) =>
          c &&
          typeof c.id === "string" &&
          Array.isArray(c.ids) &&
          c.ids.every((x) => typeof x === "string") &&
          typeof c.createdAt === "string",
      ),
    };
  } catch {
    return emptyPersonal();
  }
}
export function loadCatalog(): Medicine[] {
  try {
    return parseCatalog(JSON.parse(localStorage.getItem(catalogKey) || "null"));
  } catch {
    return [];
  }
}
export function savePersonal(data: PersonalData) {
  localStorage.setItem(personalKey, JSON.stringify(data));
}
export function saveCatalog(data: Medicine[]) {
  localStorage.setItem(
    catalogKey,
    JSON.stringify({ version: 1, medicines: data }),
  );
}
export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
