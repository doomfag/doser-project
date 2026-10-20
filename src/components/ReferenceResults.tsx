import { useState } from "react";
import type { ClinicalReference } from "../domain/catalog";
import ClinicalReferences from "./ClinicalReferences";
function ReferenceResult({ reference }: { reference: ClinicalReference }) {
  const [mode, setMode] = useState<"overview" | "usage" | "technical">(
    "overview",
  );
  return (
    <details className="fact reference-result">
      <summary>{reference.subject}</summary>
      <div className="tabs">
        {(
          [
            ["overview", "Resumo"],
            ["usage", "Como usar"],
            ["technical", "Cuidados e detalhes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={mode === id}
            className={mode === id ? "active" : ""}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ClinicalReferences references={[reference]} mode={mode} />
    </details>
  );
}
export default function ReferenceResults({
  references,
}: {
  references: ClinicalReference[];
}) {
  return (
    <div className="reference-results">
      <p className="small-note">
        Informações sobre substâncias e formas descritas nos documentos. Não são
        ofertas de farmácia nem confirmação da embalagem de uma marca.
      </p>
      {references.map((r) => (
        <ReferenceResult key={r.id} reference={r} />
      ))}
    </div>
  );
}
