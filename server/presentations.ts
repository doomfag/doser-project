import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  normalize,
  parseSource,
  parseCatalog,
  type Source,
  type Medicine,
} from "../src/domain/catalog.ts";
export const CMED_URL =
  "https://dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv";
interface Entry {
  registration: string;
  name: string;
  presentation: string;
}
interface Cache {
  version: 1;
  source: Source;
  entries: Entry[];
}
export interface PresentationStatus {
  status: "verified" | "cached" | "unavailable";
  products: number;
  presentations: number;
  checkedAt?: string;
  message?: string;
}
export function importPresentations(bytes: Uint8Array): Entry[] {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const rows: Entry[] = parse(text, {
    bom: true,
    delimiter: ";",
    skip_empty_lines: true,
    max_record_size: 20000,
    columns: (headers: string[]) => {
      for (const h of ["REGISTRO", "PRODUTO", "APRESENTAÇÃO"])
        if (!headers.includes(h))
          throw Error("Formato CMED mudou: coluna ausente.");
      return headers;
    },
    on_record: (r: Record<string, string>) => ({
      registration: r.REGISTRO?.trim(),
      name: r.PRODUTO?.trim(),
      presentation: r["APRESENTAÇÃO"]?.trim(),
    }),
  });
  if (rows.length > 100000 || !rows.length)
    throw Error("Quantidade de apresentações CMED inválida.");
  return rows.filter(
    (r) =>
      /^\d{13}$/.test(r.registration) &&
      !/^0+$/.test(r.registration) &&
      r.name &&
      r.name.length <= 200 &&
      r.presentation &&
      r.presentation.length <= 500,
  );
}
export function applyPresentations(
  medicines: Medicine[],
  entries: Entry[],
  source: Source,
) {
  const groups = new Map<string, Set<string>>();
  for (const e of entries) {
    const key = e.registration.slice(0, 9) + ":" + normalize(e.name);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(e.presentation);
  }
  return medicines.map((m) => {
    const list = groups.get(m.registration?.number + ":" + normalize(m.name));
    if (list?.size) {
      if (list.size > 1000)
        throw Error(
          "Mais de 1000 apresentações para um registro: requer conferência.",
        );
      return {
        ...m,
        presentations: [...list].sort((a, b) => a.localeCompare(b, "pt-BR")),
        presentationSource: source,
      };
    }
    if (m.presentationSource?.url === CMED_URL) {
      const { presentationSource: _, ...rest } = m;
      return { ...rest, presentations: [] };
    }
    return m;
  });
}
function cacheValue(raw: unknown): Cache {
  const c = raw as Cache;
  const source = parseSource(c?.source);
  if (
    c.version !== 1 ||
    source.url !== CMED_URL ||
    source.kind !== "registry" ||
    source.status !== "validated" ||
    !/^[a-f0-9]{64}$/.test(source.version) ||
    !Array.isArray(c.entries) ||
    c.entries.length > 100000 ||
    !c.entries.every(
      (e) =>
        /^\d{13}$/.test(e.registration) &&
        typeof e.name === "string" &&
        e.name.length > 0 &&
        e.name.length <= 200 &&
        typeof e.presentation === "string" &&
        e.presentation.length > 0 &&
        e.presentation.length <= 500,
    )
  )
    throw Error("Cache CMED inválido.");
  return { version: 1, source, entries: c.entries };
}
export async function enrichPresentations(
  medicines: Medicine[],
  directory: string,
  request: typeof fetch = fetch,
) {
  let cache: Cache | undefined;
  try {
    const b = await readFile(join(directory, "presentations.json"));
    if (b.length < 30 * 1024 * 1024)
      cache = cacheValue(JSON.parse(b.toString()));
  } catch {}
  let state: PresentationStatus["status"] = "verified";
  let message: string | undefined;
  try {
    const response = await request(CMED_URL, {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
      headers: { Accept: "text/csv" },
    });
    if (!response.ok || !response.body) throw Error("Fonte CMED indisponível.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 30 * 1024 * 1024) {
          await reader.cancel();
          throw Error("Fonte CMED excede o limite.");
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    const entries = importPresentations(bytes);
    if (!entries.length || (cache && entries.length < cache.entries.length / 2))
      throw Error("CMED sem registros suficientes para substituição segura.");
    const source: Source = {
      title: "Anvisa/CMED — apresentações da lista regulatória",
      url: CMED_URL,
      kind: "registry",
      checkedAt: new Date().toISOString().slice(0, 10),
      version: createHash("sha256").update(bytes).digest("hex"),
      status: "validated",
      locator:
        "Vínculo pelo prefixo de 9 dígitos do registro MS e pelo nome do produto. Não confirma estoque ou comercialização." +
        (response.headers.get("last-modified")
          ? " Last-Modified informado pela fonte: " +
            response.headers.get("last-modified")
          : ""),
    };
    const next: Cache = { version: 1, source, entries };
    await mkdir(directory, { recursive: true });
    const path = join(directory, "presentations.json");
    await writeFile(path + ".tmp", JSON.stringify(next), { mode: 0o600 });
    await rename(path + ".tmp", path);
    cache = next;
  } catch {
    state = cache ? "cached" : "unavailable";
    message =
      "Não foi possível renovar a lista CMED; dados anteriores mantêm a data original de conferência.";
  }
  let enriched = cache
    ? applyPresentations(medicines, cache.entries, cache.source)
    : medicines;
  if (!cache) {
    try {
      const old = parseCatalog(
        JSON.parse(await readFile(join(directory, "catalog.json"), "utf8")),
      );
      const map = new Map(
        old
          .filter(
            (m) =>
              m.presentationSource?.url === CMED_URL &&
              m.presentationSource.status === "validated",
          )
          .map((m) => [m.id, m]),
      );
      enriched = medicines.map((m) => {
        const p = map.get(m.id);
        return p &&
          normalize(p.name) === normalize(m.name) &&
          p.registration?.number === m.registration?.number
          ? {
              ...m,
              presentations: p.presentations,
              presentationSource: p.presentationSource,
            }
          : m;
      });
      if (enriched.some((m) => m.presentationSource?.url === CMED_URL))
        state = "cached";
    } catch {}
  }
  const relevant = enriched.filter(
    (m) => m.presentationSource?.url === CMED_URL,
  );
  return {
    medicines: enriched,
    status: {
      status: state,
      products: relevant.length,
      presentations: relevant.reduce((n, m) => n + m.presentations.length, 0),
      checkedAt:
        cache?.source.checkedAt ?? relevant[0]?.presentationSource?.checkedAt,
      message,
    } satisfies PresentationStatus,
  };
}
