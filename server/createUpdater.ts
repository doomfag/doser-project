import { CatalogUpdater } from "./updater.ts";
import { updateClinical } from "./clinical.ts";
export const createCatalogUpdater = (directory: string) =>
  new CatalogUpdater(directory, fetch, updateClinical);
