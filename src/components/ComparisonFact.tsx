import {
  clinicalReferencesFor,
  type Medicine,
  type ClinicalReference,
  type Section,
} from "../domain/catalog";
import { External } from "./ui";
export default function ComparisonFact({
  medicine,
  section,
  references,
}: {
  medicine: Medicine;
  section: Section;
  references: ClinicalReference[];
}) {
  const facts = [
    ...(medicine.facts[section]
      ? [{ context: "Documento do produto", fact: medicine.facts[section]! }]
      : []),
    ...clinicalReferencesFor(medicine, references).flatMap((r) =>
      r.facts[section]
        ? [
            {
              context:
                r.subject +
                (r.source.kind === "regulatory"
                  ? " · referência Anvisa, não é bula"
                  : " · referência PCDT, não é bula"),
              fact: r.facts[section]!,
            },
          ]
        : [],
    ),
  ];
  if (!facts.length) return <>Não informado</>;
  return (
    <>
      {facts.map((f, i) => (
        <div className="comparison-fact" key={i}>
          <small>{f.context}</small>
          <details>
            <summary>Ler informação documentada</summary>
            <p>{f.fact.text}</p>
          </details>
          <small className="table-source">
            <External href={f.fact.source.url}>Fonte</External>
            {f.fact.source.status === "validated"
              ? "Conferência documental declarada"
              : "Pendente"}
          </small>
        </div>
      ))}
    </>
  );
}
