import { resolve } from "node:path";
import { createCatalogUpdater } from "./createUpdater.ts";
const result = await createCatalogUpdater(resolve(".doser")).update();
if (result.lastError) {
  console.error(result.lastError);
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify(
      {
        count: result.count,
        lastSuccess: result.lastSuccess,
        report: result.report,
        clinical: result.clinical,
      },
      null,
      2,
    ),
  );
