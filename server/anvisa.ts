import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import {
  normalize,
  parseCatalog,
  type Medicine,
  type Source,
} from "../src/domain/catalog.ts";
export const ANVISA_URL =
  "https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv";
export interface ImportReport {
  rows: number;
  included: number;
  excluded: number;
  duplicates: number;
  missingIngredient: number;
  sha256: string;
}
export function importAnvisa(
  bytes: Uint8Array,
  checkedAt: string,
): { medicines: Medicine[]; report: ImportReport } {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  // A fonte usa UTF-8 ou Latin-1; nunca descarte bytes inválidos silenciosamente.
  let csv: string;
  try {
    csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    csv = new TextDecoder("windows-1252").decode(bytes);
  }
  const rows = parse(csv, {
    bom: true,
    delimiter: ";",
    columns: (headers: string[]) =>
      headers.map((h) => normalize(h).replace(/ /g, "_")),
    skip_empty_lines: true,
    max_record_size: 100_000,
  }) as Record<string, string>[];
  if (!rows.length || rows.length > 250_000)
    throw new Error(
      "A fonte retornou uma quantidade de linhas inesperada. A base anterior foi preservada.",
    );
  const required = [
    "nome_produto",
    "numero_registro_produto",
    "situacao_registro",
    "principio_ativo",
    "classe_terapeutica",
  ];
  if (!required.every((key) => Object.hasOwn(rows[0], key)))
    throw new Error(
      "O formato da fonte Anvisa mudou ou não é o CSV esperado. A base anterior foi preservada.",
    );
  const source: Source = {
    title: "Anvisa · Dados abertos de medicamentos registrados",
    url: ANVISA_URL,
    checkedAt,
    version: sha256,
    status: "pending",
  };
  const medicines = new Map<string, Medicine>();
  let excluded = 0,
    duplicates = 0,
    missingIngredient = 0;
  for (const row of rows) {
    const name = row.nome_produto?.trim();
    const registration = row.numero_registro_produto?.trim();
    const status = normalize(row.situacao_registro || "");
    // Não classifica status desconhecido como registro ativo.
    if (
      !["valido", "ativo", "registro valido", "registro ativo"].includes(
        status,
      ) ||
      !name ||
      !registration ||
      !/^\d{6,20}$/.test(registration)
    ) {
      excluded++;
      continue;
    }
    const ingredient = row.principio_ativo?.trim();
    const id = `anvisa-${registration}`;
    const previous = medicines.get(id);
    if (previous) {
      if (
        normalize(previous.name) !== normalize(name) ||
        normalize(previous.ingredient) !==
          normalize(ingredient || "Não informado pela fonte") ||
        normalize(previous.drugClass) !==
          normalize(
            row.classe_terapeutica?.trim() || "Não informada pela fonte",
          )
      )
        throw new Error(
          "A fonte contém informações conflitantes para o mesmo registro. A base anterior foi preservada para conferência.",
        );
      duplicates++;
      continue;
    }
    if (!ingredient) missingIngredient++;
    medicines.set(id, {
      id,
      name,
      ingredient: ingredient || "Não informado pela fonte",
      drugClass: row.classe_terapeutica?.trim() || "Não informada pela fonte",
      presentations: [],
      aliases: [],
      facts: {},
      registration: {
        number: registration,
        holder: row.empresa_detentora_registro?.trim() || undefined,
        situation: row.situacao_registro.trim(),
        source,
      },
    });
  }
  if (!medicines.size)
    throw new Error(
      "Nenhum registro ativo reconhecido. A fonte precisa ser conferida antes da atualização.",
    );
  const records = parseCatalog({
    version: 1,
    medicines: [...medicines.values()],
  });
  return {
    medicines: records,
    report: {
      rows: rows.length,
      included: records.length,
      excluded,
      duplicates,
      missingIngredient,
      sha256,
    },
  };
}
