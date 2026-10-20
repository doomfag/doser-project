// Expand known CMED abbreviations without calculating dose, age, route changes or equivalence.
const terms: [string, string][] = [
  ["CAP GEL MOLE", "cápsulas gelatinosas moles"],
  ["CAP DURA", "cápsulas duras"],
  ["COM REV", "comprimidos revestidos"],
  ["COM MAST", "comprimidos mastigáveis"],
  ["COM EFERV", "comprimidos efervescentes"],
  ["SOL INJ", "solução injetável"],
  ["SOL OR", "solução oral"],
  ["SOL NAS", "solução nasal"],
  ["SUSP OR", "suspensão oral"],
  ["PO LIOF", "pó liofilizado"],
  ["CREM DERM", "creme para a pele"],
  ["GEL DERM", "gel para a pele"],
  ["COM", "comprimidos"],
  ["CAP", "cápsulas"],
  ["SUSP", "suspensão"],
  ["SOL", "solução"],
  ["CREM", "creme"],
  ["POM", "pomada"],
  ["GOT", "conta-gotas"],
  ["PO", "pó"],
  ["XPE", "xarope"],
  ["CT", "caixa"],
  ["BL", "cartela"],
  ["FR", "frasco"],
  ["FA", "frasco-ampola"],
  ["BG", "bisnaga"],
  ["AMP", "ampola"],
  ["SER", "seringa"],
  ["PLAS", "plástico"],
  ["TRANS", "transparente"],
  ["OPC", "opaco"],
  ["AL", "alumínio"],
  ["VD", "vidro"],
  ["ML", "mL"],
  ["MG", "mg"],
  ["MCG", "mcg"],
];
export function presentationLabel(raw: string) {
  let label = raw;
  for (const [term, meaning] of terms)
    label = label.replace(new RegExp(`\\b${term}\\b`, "g"), meaning);
  return label.replace(/\bX\b/g, "×");
}
