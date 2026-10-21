import { normalize, distance } from "./text.ts";
// Vocabulary only: this table never links a symptom to a drug or a diagnosis.
export const symptomTerms = [
  [
    "Dor de cabeça",
    "dor de cabeça",
    "dores de cabeça",
    "dor na cabeça",
    "cefaleia",
    "cefaleias",
  ],
  ["Febre", "febre", "estado febril", "estados febris"],
  [
    "Dor de barriga",
    "dor de barriga",
    "dor na barriga",
    "dor abdominal",
    "dor no abdome",
    "dor de estomago",
    "dor no estomago",
    "dor estomago",
    "barriga doendo",
    "estômago doendo",
  ],
  ["Enjoo", "enjoo", "enjoos", "náusea", "náuseas"],
  ["Vômito", "vômito", "vômitos", "vomitando"],
  ["Diarreia", "diarreia", "diarréia", "intestino solto"],
  [
    "Intestino preso",
    "intestino preso",
    "prisão de ventre",
    "constipação intestinal",
    "constipação",
  ],
  ["Azia", "azia", "queimação no estômago", "queimação no estomago", "pirose"],
  ["Gases", "gases", "barriga estufada", "flatulência", "meteorismo"],
  [
    "Cólica na barriga",
    "cólica abdominal",
    "cólica na barriga",
    "cólicas abdominais",
    "cólicas no abdômen",
  ],
  [
    "Cólica menstrual",
    "cólica menstrual",
    "cólicas menstruais",
    "dismenorreia",
  ],
  ["Dor muscular", "dor muscular", "dores musculares", "mialgia", "mialgias"],
  ["Dor de garganta", "dor de garganta", "dor na garganta", "garganta doendo"],
  ["Nariz entupido", "nariz entupido", "congestão nasal", "obstrução nasal"],
  ["Tosse", "tosse", "tossindo"],
  ["Coceira", "coceira", "coçando", "prurido"],
  [
    "Dor de dente",
    "dor de dente",
    "dor nos dentes",
    "dor dentária",
    "odontalgia",
  ],
  ["Enxaqueca", "enxaqueca", "migrânea"],
  ["Coriza", "coriza", "nariz escorrendo", "nariz pingando", "rinorreia"],
  ["Espirros", "espirros", "espirro", "espirrando"],
  ["Tontura", "tontura", "tonturas", "vertigem"],
  [
    "Dor nas costas",
    "dor nas costas",
    "dor na lombar",
    "dor lombar",
    "lombalgia",
  ],
  [
    "Dor nas articulações",
    "dor nas articulacoes",
    "dor nas juntas",
    "artralgia",
  ],
  ["Dor de ouvido", "dor de ouvido", "dor no ouvido", "otalgia"],
  ["Refluxo", "refluxo", "regurgitacao"],
  [
    "Ardência ao urinar",
    "ardencia ao urinar",
    "ardor ao urinar",
    "dor para urinar",
    "disuria",
  ],
  ["Cansaço", "cansaco", "fadiga"],
  ["Insônia", "insonia", "dificuldade para dormir"],
  ["Olhos secos", "olhos secos", "ressecamento dos olhos"],
  ["Falta de ar", "falta de ar", "dificuldade para respirar", "dispneia"],
  ["Dor no peito", "dor no peito", "dor toracica"],
  ["Desmaio", "desmaio", "desmaios", "sincope"],
  ["Convulsão", "convulsao", "convulsoes"],
] as const;
const urgentLabels = new Set([
  "Falta de ar",
  "Dor no peito",
  "Desmaio",
  "Convulsão",
]);
const connectors = new Set([
  "e",
  "de",
  "da",
  "do",
  "com",
  "no",
  "na",
  "para",
  "pra",
  "estou",
  "tenho",
  "sentindo",
  "um",
  "uma",
  "o",
  "a",
]);
export const containsPhrase = (text: string, phrase: string) =>
  ` ${text} `.includes(` ${normalize(phrase)} `);
export function symptomConcepts(query: string) {
  const q = normalize(query);
  return symptomTerms.filter((terms) =>
    terms.slice(1).some((t) => containsPhrase(q, t)),
  );
}
export function symptomContext(query: string) {
  const concepts = symptomConcepts(query);
  const broad = concepts.some((c) => c[0] === "Dor de barriga");
  return {
    recognized: concepts.length > 0,
    negated: /\b(?:sem|nao|nega|negando)\b/.test(normalize(query)),
    urgent: concepts.some((c) => urgentLabels.has(c[0])),
    broad,
    labels: concepts.map((c) => c[0]),
    options: broad
      ? [
          "Azia",
          "Gases",
          "Cólica na barriga",
          "Diarreia",
          "Enjoo",
          "Intestino preso",
        ]
      : [],
  };
}
export function compileSymptomQuery(query: string) {
  const concepts = symptomConcepts(query);
  if (
    /\b(?:sem|nao|nega|negando)\b/.test(normalize(query)) ||
    !concepts.length ||
    concepts.some((c) => c[0] === "Dor de barriga" || urgentLabels.has(c[0]))
  )
    return () => false;
  let remainder = normalize(query);
  const alternatives = concepts.map((concept) =>
    concept.slice(1).map(normalize),
  );
  for (const group of alternatives)
    for (const term of [...group].sort((a, b) => b.length - a.length))
      remainder = ` ${remainder} `.replaceAll(` ${term} `, " ").trim();
  const terms = remainder.split(" ").filter((t) => t && !connectors.has(t));
  return (text: string, _identity = "") => {
    const padded = ` ${text} `;
    return (
      alternatives.every((group) =>
        group.some((term) => padded.includes(` ${term} `)),
      ) && terms.every((t) => text.includes(t))
    );
  };
}

/** Vocabulary suggestions only: never automatically changes a query or chooses a drug. */
export function suggestSymptomQuery(query: string): string[] {
  const q = normalize(query).slice(0, 160);
  if (!q) return [];
  const words = [
    ...new Set(
      symptomTerms.flatMap((c) =>
        c.slice(1).flatMap((s) => normalize(s).split(" ")),
      ),
    ),
  ].filter((w) => w.length >= 3 && !connectors.has(w));
  const corrected = q
    .split(" ")
    .map((token) => {
      if (token.length < 4 || connectors.has(token) || words.includes(token))
        return token;
      const limit = token.length >= 6 ? 2 : 1;
      const candidates = words
        .filter((w) => Math.abs(w.length - token.length) <= limit)
        .map((w) => ({ word: w, difference: distance(w, token) }))
        .filter((x) => x.difference <= limit)
        .sort(
          (a, b) =>
            a.difference - b.difference ||
            a.word.localeCompare(b.word, "pt-BR"),
        );
      // An ambiguous nearest spelling is left for the user, rather than guessed.
      if (
        !candidates.length ||
        candidates[1]?.difference === candidates[0].difference
      )
        return token;
      return candidates[0].word;
    })
    .join(" ");
  const concepts = symptomConcepts(corrected);
  if (corrected === q || !concepts.length) return [];
  let display = corrected;
  for (const concept of concepts) {
    const alias = concept
      .slice(1)
      .map(normalize)
      .sort((a, b) => b.length - a.length)
      .find((t) => containsPhrase(corrected, t));
    if (alias)
      display = ` ${display} `
        .replace(` ${alias} `, ` ${concept[0].toLocaleLowerCase("pt-BR")} `)
        .trim();
  }
  return [display.charAt(0).toLocaleUpperCase("pt-BR") + display.slice(1)];
}

/** Keep the other symptoms when the user clarifies a broad expression. */
export function refineSymptomQuery(
  query: string,
  label: string,
  replacement: string,
) {
  const concept = symptomTerms.find((c) => c[0] === label);
  let q = ` ${normalize(query)} `;
  if (!concept) return query;
  for (const alias of [...concept.slice(1)].sort(
    (a, b) => b.length - a.length,
  )) {
    const term = ` ${normalize(alias)} `;
    if (q.includes(term)) return q.replace(term, ` ${replacement} `).trim();
  }
  return query;
}
export function matchesSymptoms(
  text: string,
  query: string,
  identity = "",
): boolean {
  return compileSymptomQuery(query)(text, identity);
}
