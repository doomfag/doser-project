import { CatalogUpdater } from "./updater.ts";
import { enrichClinical, loadClinicalManifest } from "./clinical.ts";
import { enrichPresentations } from "./presentations.ts";
export const createCatalogUpdater = (
  directory: string,
  request: typeof fetch = fetch,
  manifestPath?: string,
) =>
  new CatalogUpdater(directory, request, async (medicines, previous) => {
    const presentations = await enrichPresentations(
      medicines,
      directory,
      request,
    );
    const clinical = await enrichClinical(
      presentations.medicines,
      await loadClinicalManifest(manifestPath),
      previous,
      request,
    );
    return { ...clinical, presentationStatus: presentations.status };
  });
