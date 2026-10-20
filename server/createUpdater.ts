import { CatalogUpdater } from "./updater.ts";
import { enrichClinical, loadClinicalManifest } from "./clinical.ts";
export const createCatalogUpdater = (
  directory: string,
  request: typeof fetch = fetch,
  manifestPath?: string,
) =>
  new CatalogUpdater(directory, request, async (medicines, previous) =>
    enrichClinical(
      medicines,
      await loadClinicalManifest(manifestPath),
      previous,
      request,
    ),
  );
