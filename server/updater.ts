import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ANVISA_URL, importAnvisa, type ImportReport } from "./anvisa.ts";
import type { ClinicalEnricher, ClinicalStatus } from "./clinical.ts";
import {
  parseCatalog,
  parseClinicalReferences,
  type ClinicalReference,
  type Medicine,
} from "../src/domain/catalog.ts";
export interface UpdateStatus {
  lastAttempt?: string;
  lastSuccess?: string;
  lastError?: string;
  updating: boolean;
  count: number;
  report?: ImportReport;
  etag?: string;
  clinical?: ClinicalStatus;
}
export interface CatalogSnapshot {
  version: 1;
  medicines: Medicine[];
  clinicalReferences?: ClinicalReference[];
  status: Omit<UpdateStatus, "updating">;
}
const MAX_BYTES = 100 * 1024 * 1024;
export class CatalogUpdater {
  private running: Promise<UpdateStatus> | null = null;
  private status: UpdateStatus = { updating: false, count: 0 };
  private initialized = false;
  private directory: string;
  private request: typeof fetch;
  private enrich?: ClinicalEnricher;
  constructor(
    directory: string,
    request: typeof fetch = fetch,
    enrich?: ClinicalEnricher,
  ) {
    this.enrich = enrich;
    this.directory = directory;
    this.request = request;
  }

  async init() {
    if (this.initialized) return;
    try {
      const snapshot = JSON.parse(
        await readFile(join(this.directory, "catalog.json"), "utf8"),
      ) as CatalogSnapshot;
      const medicines = parseCatalog(snapshot);
      parseClinicalReferences(snapshot.clinicalReferences ?? []);
      this.status = {
        ...snapshot.status,
        count: medicines.length,
        updating: false,
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        this.status.lastError =
          "Não foi possível ler o cache local. Uma nova atualização será necessária.";
    }
    this.initialized = true;
  }
  async getStatus() {
    await this.init();
    return { ...this.status, updating: !!this.running };
  }
  async snapshot(): Promise<CatalogSnapshot> {
    await this.init();
    try {
      return JSON.parse(
        await readFile(join(this.directory, "catalog.json"), "utf8"),
      ) as CatalogSnapshot;
    } catch {
      return { version: 1, medicines: [], status: { count: 0 } };
    }
  }
  update(): Promise<UpdateStatus> {
    if (this.running) return this.running;
    this.running = this.perform().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async perform() {
    await this.init();
    this.status = {
      ...this.status,
      lastAttempt: new Date().toISOString(),
      lastError: undefined,
    };
    try {
      const response = await this.request(ANVISA_URL, {
        headers: {
          Accept: "text/csv,application/octet-stream",
          ...(this.status.etag ? { "If-None-Match": this.status.etag } : {}),
        },
        signal: AbortSignal.timeout(60_000),
        redirect: "error",
      });
      if (
        response.status === 304 &&
        this.status.lastSuccess &&
        this.status.count > 0
      ) {
        const previous = await this.snapshot();
        if (
          previous.medicines.length !== this.status.count ||
          !previous.status.lastSuccess
        )
          throw new Error(
            "O cache da fonte está ausente ou inconsistente. Uma atualização completa é necessária.",
          );
        const enriched = this.enrich
          ? await this.enrich(previous.medicines, this.status.clinical)
          : undefined;
        const nextStatus = {
          ...this.status,
          lastSuccess: new Date().toISOString(),
          ...(enriched ? { clinical: enriched.clinicalStatus } : {}),
        };
        await this.persist({
          ...previous,
          ...(enriched
            ? {
                medicines: enriched.medicines,
                clinicalReferences: enriched.clinicalReferences,
              }
            : {}),
          status: nextStatus,
        });
        this.status = nextStatus;
        return { ...this.status };
      }
      if (!response.ok)
        throw new Error(`A fonte Anvisa respondeu HTTP ${response.status}.`);
      if (Number(response.headers.get("content-length")) > MAX_BYTES)
        throw new Error("Arquivo da fonte maior que o limite permitido.");
      if (!response.body) throw new Error("A fonte retornou um arquivo vazio.");
      const chunks: Uint8Array[] = [];
      let length = 0;
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > MAX_BYTES) {
            await reader.cancel();
            throw new Error("Arquivo da fonte maior que o limite permitido.");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = Buffer.concat(chunks);
      const now = new Date().toISOString();
      const imported = importAnvisa(bytes, now.slice(0, 10));
      if (
        this.status.count > 100 &&
        imported.medicines.length < this.status.count * 0.5
      )
        throw new Error(
          "A fonte perdeu mais de metade dos registros. Atualização bloqueada para conferência.",
        );
      const enriched = this.enrich
        ? await this.enrich(imported.medicines, this.status.clinical)
        : undefined;
      const next: UpdateStatus = {
        lastAttempt: this.status.lastAttempt,
        lastSuccess: now,
        count: imported.medicines.length,
        report: imported.report,
        etag: response.headers.get("etag") || undefined,
        ...(enriched ? { clinical: enriched.clinicalStatus } : {}),
        updating: false,
      };
      await this.persist({
        version: 1,
        medicines: enriched?.medicines ?? imported.medicines,
        ...(enriched
          ? { clinicalReferences: enriched.clinicalReferences }
          : {}),
        status: next,
      });
      this.status = next;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha desconhecida";
      this.status = {
        ...this.status,
        lastError:
          message.startsWith("A fonte") ||
          message.includes("base anterior") ||
          message.includes("fonte") ||
          message.includes("registros")
            ? message
            : "Não foi possível acessar ou processar a fonte oficial. Verifique internet, permissões de rede e disponibilidade da Anvisa. A base anterior foi preservada.",
      };
    }
    return { ...this.status, updating: false };
  }
  private async persist(snapshot: CatalogSnapshot) {
    await mkdir(this.directory, { recursive: true });
    const temporary = join(this.directory, "catalog.next.json");
    await writeFile(temporary, JSON.stringify(snapshot), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, join(this.directory, "catalog.json"));
  }
}
