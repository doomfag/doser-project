import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import {
  sectionLabels,
  type ClinicalReference,
  type Section,
} from "../domain/catalog";
import SourceReference from "./SourceReference";
import UsageSection from "./UsageSection";
export default function ClinicalReferences({
  references,
  mode,
}: {
  references: ClinicalReference[];
  mode: "overview" | "usage" | "technical";
}) {
  const [id, setId] = useState(references[0]?.id ?? "");
  const ref = references.find((r) => r.id === id) ?? references[0];
  if (!ref) return null;
  const keys = (Object.keys(sectionLabels) as Section[]).filter((k) =>
    mode === "overview"
      ? k === "indications"
      : k !== "indications" && k !== "dosage",
  );
  return (
    <section className="clinical-panel">
      <div className="clinical-panel-heading">
        <BookOpen size={20} />
        <div>
          <span className="eyebrow">
            {ref.source.kind === "regulatory"
              ? "ANVISA · DOCUMENTO OFICIAL"
              : "MINISTÉRIO DA SAÚDE · PCDT"}
          </span>
          <h2>Informações sobre a substância</h2>
        </div>
      </div>
      {references.length > 1 && (
        <label className="field">
          Documento de referência
          <select value={ref.id} onChange={(e) => setId(e.target.value)}>
            {references.map((r) => (
              <option key={r.id} value={r.id}>
                {r.subject}
              </option>
            ))}
          </select>
        </label>
      )}
      <h3 className="clinical-subject">{ref.subject}</h3>
      <p className="clinical-scope">{ref.scope}</p>
      {ref.source.kind === "regulatory" &&
        ref.source.publishedAt?.startsWith("2021") && (
          <p className="small-note">
            Referência de 2021. Confira também a bula atual antes de usar.
          </p>
        )}
      {!!ref.issues?.length && (
        <details className="clinical-provenance">
          <summary>Cuidados e limites desta referência</summary>
          {ref.issues.map((issue) => (
            <p className="small-note" key={issue}>
              {issue}
            </p>
          ))}
        </details>
      )}
      {mode === "usage" ? (
        <UsageSection
          key={ref.id}
          medicine={{
            id: ref.id,
            name: ref.subject,
            ingredient: ref.ingredients.join("; "),
            drugClass: "Referência documental",
            aliases: [],
            presentations: ref.presentations,
            facts: ref.facts,
            usage: ref.usage,
          }}
        />
      ) : (
        <>
          {mode === "overview" && ref.presentations.length > 0 && (
            <details className="fact">
              <summary>
                Formas citadas no documento
                <Plus size={15} />
              </summary>
              <div className="fact-content">
                <p>
                  Estas apresentações não foram confirmadas como apresentações
                  deste registro.
                </p>
                <ul>
                  {ref.presentations.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </details>
          )}
          {keys
            .filter((k) => ref.facts[k])
            .map((k) => (
              <details
                key={k}
                className="fact"
                open={mode === "overview" && k === "indications"}
              >
                <summary>
                  {sectionLabels[k]}
                  <Plus size={15} />
                </summary>
                <div className="fact-content">
                  <p>{ref.facts[k]!.text}</p>
                  <details className="clinical-provenance">
                    <summary>Conferir a fonte deste trecho</summary>
                    <SourceReference source={ref.facts[k]!.source} />
                  </details>
                </div>
              </details>
            ))}
          {mode === "technical" && !keys.some((k) => ref.facts[k]) && (
            <p className="muted">
              Este protocolo não forneceu outros campos técnicos para esta
              referência.
            </p>
          )}
        </>
      )}
      <details className="clinical-provenance">
        <summary>Documento e rastreabilidade</summary>
        <SourceReference source={ref.source} />
      </details>
    </section>
  );
}
