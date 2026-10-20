import { normalize } from "./text.ts";
export { normalize } from "./text.ts";
import { symptomConcepts, compileSymptomQuery } from "./symptoms.ts";
export const sectionLabels = {
  indications: "Para que serve",
  dosage: "Posologia",
  contraindications: "Quando não usar",
  precautions: "Cuidados",
  adverse: "Reações adversas",
  interactions: "Interações com outros remédios",
  dynamics: "Farmacodinâmica",
  kinetics: "Farmacocinética",
  metabolism: "Metabolismo",
  halfLife: "Meia-vida",
  routes: "Vias de administração",
  pregnancy: "Gestação e lactação",
} as const;
export type Section = keyof typeof sectionLabels;
export interface Source {
  title: string;
  url: string;
  publishedAt?: string;
  kind?: "leaflet" | "guideline" | "registry" | "scientific" | "regulatory";
  locator?: string;
  checkedAt: string;
  version: string;
  status: "pending" | "validated";
}
export interface Fact {
  text: string;
  source: Source;
}
export interface UsageEntry {
  id: string;
  presentation: string;
  population: string;
  dose: string;
  doseBasis?: "per-dose" | "per-day" | "document-text";
  interval?: string;
  route?: string;
  age?: string;
  duration?: string;
  maxDaily?: string;
  conditions?: string;
  source: Source;
}
export interface Registration {
  number: string;
  holder?: string;
  situation: string;
  source: Source;
}
export interface ClinicalReference {
  referenceOnly?: boolean;
  issues?: string[];
  id: string;
  documentId: string;
  subject: string;
  ingredients: string[];
  scope: string;
  presentations: string[];
  facts: Partial<Record<Section, Fact>>;
  usage: UsageEntry[];
  source: Source;
}
export const MAX_MEDICINES = 100_000;
export interface Medicine {
  presentationSource?: Source;
  id: string;
  name: string;
  ingredient: string;
  drugClass: string;
  presentations: string[];
  aliases: string[];
  clinicalReferenceIds?: string[];
  facts: Partial<Record<Section, Fact>>;
  usage?: UsageEntry[];
  registration?: Registration;
  professionalLeaflet?: string;
  patientLeaflet?: string;
}
export function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export type SearchMode = "medicines" | "symptoms" | "ingredients";
export interface SearchIndexEntry {
  medicine: Medicine;
  texts: Record<SearchMode, string>;
  words: Record<SearchMode, string[]>;
}
export function createSearchIndex(
  catalog: Medicine[],
  references: ClinicalReference[] = [],
): SearchIndexEntry[] {
  const refMap = new Map(references.map((r) => [r.id, r]));
  return catalog.map((medicine) => {
    const indications =
      medicine.facts.indications?.source.status === "validated"
        ? medicine.facts.indications.text
        : "";
    const referenceIndications = (medicine.clinicalReferenceIds ?? [])
      .flatMap((id) => {
        const r = refMap.get(id);
        const fact = r?.facts.indications;
        return !r?.referenceOnly &&
          fact?.source.status === "validated" &&
          r!.ingredients.some(
            (i) => normalize(i) === normalize(medicine.ingredient),
          )
          ? [fact.text, r!.subject]
          : [];
      })
      .join(" ");
    const texts = {
      medicines: normalize(
        [
          medicine.name,
          medicine.ingredient,
          medicine.drugClass,
          ...medicine.aliases,
          indications,
          referenceIndications,
        ].join(" "),
      ),
      symptoms: normalize(indications + " " + referenceIndications),
      ingredients: normalize(medicine.ingredient),
    };
    return {
      medicine,
      texts,
      words: {
        medicines: [...new Set(texts.medicines.split(" "))],
        symptoms: [...new Set(texts.symptoms.split(" "))],
        ingredients: [...new Set(texts.ingredients.split(" "))],
      },
    };
  });
}
export function searchIndex(
  index: SearchIndexEntry[],
  query: string,
  mode: SearchMode,
): Medicine[] {
  const q = normalize(query).slice(0, 160);
  if (!q) return [];
  if (mode !== "ingredients" && symptomConcepts(q).length) {
    const match = compileSymptomQuery(q);
    return index
      .filter((entry) => match(entry.texts.symptoms, entry.texts.medicines))
      .sort((a, b) => a.medicine.name.localeCompare(b.medicine.name, "pt-BR"))
      .map((entry) => entry.medicine);
  }
  const terms = q
    .split(" ")
    .filter((t) => !["e", "de", "da", "do", "com"].includes(t));
  if (!terms.length) return [];
  return index
    .map(({ medicine, texts, words }) => {
      const scores = terms.map((t) =>
        texts[mode].includes(t)
          ? 3
          : t.length > 4 &&
              words[mode].some(
                (w) => Math.abs(w.length - t.length) < 2 && distance(w, t) <= 1,
              )
            ? 1
            : 0,
      );
      return {
        medicine,
        score: scores.every(Boolean)
          ? scores.reduce<number>((a, b) => a + b, 0) +
            (normalize(medicine.name) === q
              ? 100
              : normalize(medicine.ingredient) === q
                ? 80
                : normalize(medicine.name).startsWith(q)
                  ? 30
                  : 0)
          : 0,
      };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.medicine.name.localeCompare(b.medicine.name),
    )
    .map((x) => x.medicine);
}
export function isApproximateMatch(
  medicine: Medicine,
  query: string,
  mode: SearchMode,
  references: ClinicalReference[] = [],
): boolean {
  const q = normalize(query).slice(0, 160);
  if (!q) return false;
  if (mode !== "ingredients" && symptomConcepts(q).length) return false;
  const terms = q
    .split(" ")
    .filter((t) => !["e", "de", "da", "do", "com"].includes(t));
  const text = createSearchIndex([medicine], references)[0].texts[mode];
  return terms.some((t) => !text.includes(t));
}
export function search(
  catalog: Medicine[],
  query: string,
  mode: SearchMode,
): Medicine[] {
  return searchIndex(createSearchIndex(catalog), query, mode);
}
export function safeUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
function text(value: unknown, limit = 10000): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= limit
  );
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
function requiredText(value: unknown, limit: number): string {
  if (!text(value, limit)) throw new Error("Texto documental inválido.");
  return value;
}
function parseSourceKind(value: unknown): NonNullable<Source["kind"]> {
  if (
    !["leaflet", "guideline", "registry", "scientific", "regulatory"].includes(
      String(value),
    )
  )
    throw new Error("Tipo de fonte inválido.");
  return value as NonNullable<Source["kind"]>;
}
export function parseSource(input: unknown): Source {
  if (
    !object(input) ||
    !text(input.title, 300) ||
    !safeUrl(input.url) ||
    !validDate(input.checkedAt) ||
    !text(input.version, 100) ||
    (input.status !== "pending" && input.status !== "validated") ||
    (input.publishedAt !== undefined && !validDate(input.publishedAt))
  ) {
    throw new Error(
      "Fonte inválida: use HTTPS, data, versão e status de validação.",
    );
  }
  return {
    title: input.title,
    url: input.url,
    checkedAt: input.checkedAt,
    version: input.version,
    status: input.status,
    ...(input.kind !== undefined ? { kind: parseSourceKind(input.kind) } : {}),
    ...(input.locator !== undefined
      ? { locator: requiredText(input.locator, 500) }
      : {}),
    ...(input.publishedAt ? { publishedAt: input.publishedAt as string } : {}),
  };
}
function parseUsage(input: unknown): UsageEntry[] | undefined {
  if (input === undefined) return;
  if (!Array.isArray(input) || input.length > 100)
    throw new Error("Regimes de uso inválidos.");
  const ids = new Set<string>();
  return input.map((entry) => {
    if (
      !object(entry) ||
      !text(entry.id, 100) ||
      ids.has(entry.id) ||
      !text(entry.presentation, 500) ||
      !text(entry.population, 1000) ||
      !text(entry.dose)
    ) {
      throw new Error(
        "Cada regime precisa identificar apresentação exata, população e dose documental.",
      );
    }
    ids.add(entry.id);
    const result: UsageEntry = {
      id: entry.id,
      presentation: entry.presentation,
      population: entry.population,
      dose: entry.dose,
      source: parseSource(entry.source),
    };
    if (entry.doseBasis !== undefined) {
      if (
        !["per-dose", "per-day", "document-text"].includes(
          String(entry.doseBasis),
        )
      )
        throw new Error("Base de dose inválida.");
      result.doseBasis = entry.doseBasis as UsageEntry["doseBasis"];
    }
    for (const key of [
      "interval",
      "route",
      "age",
      "duration",
      "maxDaily",
      "conditions",
    ] as const) {
      if (entry[key] !== undefined) {
        if (!text(entry[key], 10000)) throw new Error("Campo de uso inválido.");
        result[key] = entry[key];
      }
    }
    return result;
  });
}
function parseRegistration(input: unknown): Registration | undefined {
  if (input === undefined) return;
  if (
    !object(input) ||
    !text(input.number, 100) ||
    !text(input.situation, 200) ||
    (input.holder !== undefined && !text(input.holder, 500))
  )
    throw new Error("Registro regulatório inválido.");
  return {
    number: input.number,
    situation: input.situation,
    ...(input.holder ? { holder: input.holder as string } : {}),
    source: parseSource(input.source),
  };
}
export function parseCatalog(input: unknown): Medicine[] {
  if (
    !object(input) ||
    input.version !== 1 ||
    !Array.isArray(input.medicines) ||
    input.medicines.length > MAX_MEDICINES
  )
    throw new Error(
      "Arquivo inválido. Use o formato Doser versão 1 (até 100.000 registros).",
    );
  const ids = new Set<string>();
  return input.medicines.map((item: unknown) => {
    if (
      !object(item) ||
      !text(item.id, 100) ||
      !/^[a-zA-Z0-9_-]+$/.test(item.id) ||
      ids.has(item.id) ||
      !text(item.name, 200) ||
      !text(item.ingredient, 1000) ||
      !text(item.drugClass, 300)
    )
      throw new Error(
        "Registro inválido: confira identificação, nome, princípio ativo e classe.",
      );
    ids.add(item.id);
    const list = (value: unknown, limit = 100): string[] => {
      if (
        !Array.isArray(value) ||
        value.length > limit ||
        !value.every((v) => text(v, 500))
      )
        throw new Error("Apresentações ou sinônimos inválidos.");
      return value;
    };
    if (!object(item.facts))
      throw new Error("Cada registro precisa de informações com fontes.");
    const facts: Medicine["facts"] = {};
    for (const key of Object.keys(sectionLabels) as Section[]) {
      const fact = item.facts[key];
      if (fact === undefined) continue;
      if (!object(fact) || !text(fact.text) || !object(fact.source))
        throw new Error("Informação sem fonte válida.");
      facts[key] = { text: fact.text, source: parseSource(fact.source) };
    }
    for (const key of ["professionalLeaflet", "patientLeaflet"])
      if (item[key] !== undefined && !safeUrl(item[key]))
        throw new Error("Links de bula precisam usar HTTPS.");
    return {
      id: item.id,
      name: item.name,
      ingredient: item.ingredient,
      drugClass: item.drugClass,
      presentations: list(item.presentations, 1000),
      ...(item.presentationSource === undefined
        ? {}
        : { presentationSource: parseSource(item.presentationSource) }),
      aliases: list(item.aliases),
      ...(item.clinicalReferenceIds === undefined
        ? {}
        : { clinicalReferenceIds: list(item.clinicalReferenceIds) }),
      facts,
      ...(item.usage === undefined ? {} : { usage: parseUsage(item.usage) }),
      ...(item.registration === undefined
        ? {}
        : { registration: parseRegistration(item.registration) }),
      professionalLeaflet: item.professionalLeaflet as string | undefined,
      patientLeaflet: item.patientLeaflet as string | undefined,
    };
  });
}
export function compare(a: Medicine, b: Medicine): string {
  if (
    [a.ingredient, b.ingredient].some(
      (value) =>
        !normalize(value) || normalize(value).startsWith("nao informad"),
    )
  )
    return "Princípio ativo ausente em um dos registros. Não é possível avaliar equivalência ou intercambialidade.";
  return normalize(a.ingredient) === normalize(b.ingredient)
    ? "Mesmo princípio ativo. Equivalência e intercambialidade não verificadas; dependem de apresentação, dose, via e registro regulatório."
    : "Princípios ativos com descrições diferentes. A comparação não estabelece equivalência ou intercambialidade.";
}
export function symptomAlert(query: string): string | null {
  return /falta de ar|dor no peito|desmaio|convuls|sangue|confusao|rigidez na nuca/.test(
    normalize(query),
  )
    ? "Estes termos podem indicar necessidade de avaliação urgente. No Brasil, em uma emergência, ligue 192 (SAMU). A pesquisa não avalia gravidade nem realiza diagnóstico."
    : null;
}

export function parseClinicalReferences(input: unknown): ClinicalReference[] {
  if (!Array.isArray(input) || input.length > 2000)
    throw new Error("Referências clínicas inválidas.");
  const ids = new Set<string>();
  return input.map((item) => {
    if (
      !object(item) ||
      !text(item.id, 100) ||
      !text(item.documentId, 100) ||
      ids.has(item.id) ||
      !text(item.subject, 300) ||
      !text(item.scope, 2000)
    )
      throw new Error("Identificação de referência clínica inválida.");
    ids.add(item.id);
    const parsed = parseCatalog({
      version: 1,
      medicines: [
        {
          id: "reference",
          name: item.subject,
          ingredient: "Referência documental",
          drugClass: "Referência documental",
          aliases: [],
          presentations: item.presentations,
          facts: item.facts,
          usage: item.usage,
        },
      ],
    })[0];
    if (
      !Array.isArray(item.ingredients) ||
      !item.ingredients.length ||
      item.ingredients.length > 30 ||
      !item.ingredients.every((i) => text(i, 1000))
    )
      throw new Error("Princípios ativos da referência inválidos.");
    if (
      item.issues !== undefined &&
      (!Array.isArray(item.issues) ||
        item.issues.length > 20 ||
        !item.issues.every((i) => text(i, 2000)))
    )
      throw new Error("Ressalvas clínicas inválidas.");
    if (
      item.referenceOnly !== undefined &&
      typeof item.referenceOnly !== "boolean"
    )
      throw new Error("Escopo de referência inválido.");
    return {
      ...(item.issues === undefined ? {} : { issues: item.issues }),
      ...(item.referenceOnly === true ? { referenceOnly: true } : {}),
      id: item.id,
      documentId: item.documentId,
      subject: item.subject,
      ingredients: item.ingredients,
      scope: item.scope,
      presentations: parsed.presentations,
      facts: parsed.facts,
      usage: parsed.usage ?? [],
      source: parseSource(item.source),
    };
  });
}
export function clinicalReferencesFor(
  medicine: Medicine,
  references: ClinicalReference[],
): ClinicalReference[] {
  const ids = new Set(medicine.clinicalReferenceIds ?? []);
  return references.filter(
    (r) =>
      !r.referenceOnly &&
      ids.has(r.id) &&
      r.ingredients.some(
        (i) => normalize(i) === normalize(medicine.ingredient),
      ),
  );
}
export function assertReferenceLinks(
  medicines: Medicine[],
  references: ClinicalReference[],
): void {
  const refs = new Map(references.map((r) => [r.id, r]));
  if (
    medicines.some((m) =>
      (m.clinicalReferenceIds ?? []).some(
        (id) =>
          !refs.has(id) ||
          refs.get(id)?.referenceOnly ||
          !refs
            .get(id)!
            .ingredients.some((i) => normalize(i) === normalize(m.ingredient)),
      ),
    )
  )
    throw new Error(
      "O catálogo contém referência clínica ausente ou incompatível com o princípio ativo.",
    );
}
