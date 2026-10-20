import { openDB, type DBSchema } from "idb";
import {
  parseCatalog,
  parseClinicalReferences,
  type ClinicalReference,
  type Medicine,
} from "../domain/catalog";
import { loadCatalog as loadLegacyCatalog } from "./storage";
export interface CatalogCache {
  manual: Medicine[];
  official: Medicine[];
  manualReferences?: ClinicalReference[];
  officialReferences?: ClinicalReference[];
  lastOfficialSuccess?: string;
}
interface CatalogDatabase extends DBSchema {
  snapshots: { key: string; value: CatalogCache };
}
const database = () =>
  openDB<CatalogDatabase>("doser.catalog", 1, {
    upgrade(db) {
      db.createObjectStore("snapshots");
    },
  });
export async function readCatalogCache(): Promise<CatalogCache> {
  const db = await database();
  try {
    const cache = await db.get("snapshots", "current");
    if (cache)
      return {
        ...cache,
        manualReferences: parseClinicalReferences(cache.manualReferences ?? []),
        officialReferences: parseClinicalReferences(
          cache.officialReferences ?? [],
        ),
        manual: parseCatalog({ version: 1, medicines: cache.manual }),
        official: parseCatalog({ version: 1, medicines: cache.official }),
      };
    const migrated = { manual: loadLegacyCatalog(), official: [] };
    await db.put("snapshots", migrated, "current");
    return migrated;
  } finally {
    db.close();
  }
}
export async function writeCatalogCache(cache: CatalogCache) {
  const db = await database();
  try {
    await db.put("snapshots", cache, "current");
  } finally {
    db.close();
  }
}
export function mergedCatalog(cache: CatalogCache): Medicine[] {
  const records = new Map(cache.official.map((m) => [m.id, m]));
  for (const m of cache.manual) records.set(m.id, m);
  return [...records.values()];
}

export function mergedClinicalReferences(
  cache: CatalogCache,
): ClinicalReference[] {
  const records = new Map(
    (cache.officialReferences ?? []).map((r) => [r.id, r]),
  );
  for (const r of cache.manualReferences ?? []) records.set(r.id, r);
  return [...records.values()];
}
