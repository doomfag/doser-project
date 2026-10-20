import { normalize } from "./text.ts";
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
] as const;
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
  if (!concepts.length || concepts.some((c) => c[0] === "Dor de barriga"))
    return () => false;
  let remainder = normalize(query);
  const alternatives = concepts.map((concept) =>
    concept.slice(1).map(normalize),
  );
  for (const group of alternatives)
    for (const term of [...group].sort((a, b) => b.length - a.length))
      remainder = ` ${remainder} `.replaceAll(` ${term} `, " ").trim();
  const ignored = new Set([
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
  const terms = remainder.split(" ").filter((t) => t && !ignored.has(t));
  return (text: string, identity = "") => {
    const padded = ` ${text} `;
    return (
      alternatives.every((group) =>
        group.some((term) => padded.includes(` ${term} `)),
      ) && terms.every((t) => text.includes(t) || identity.includes(t))
    );
  };
}
export function matchesSymptoms(
  text: string,
  query: string,
  identity = "",
): boolean {
  return compileSymptomQuery(query)(text, identity);
}
