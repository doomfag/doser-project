import { External } from "./ui";
import type { Source } from "../domain/catalog";
export default function SourceReference({ source }: { source: Source }) {
  return (
    <div className="source-meta">
      {source.kind === "guideline" && (
        <strong>
          Protocolo clínico por princípio ativo · não é bula deste produto
        </strong>
      )}
      {source.locator && <span>{source.locator}</span>}
      <External href={source.url}>{source.title}</External>
      <span>
        Conferência: {source.checkedAt}
        {source.publishedAt ? ` · Publicação: ${source.publishedAt}` : ""}
      </span>
      <span className="source-version">Versão: {source.version}</span>
      <span className={source.status === "pending" ? "warning-text" : ""}>
        {source.status === "pending"
          ? "Informação pendente de validação."
          : "Conferência documental declarada; não equivale a uma avaliação clínica individual."}
      </span>
      {Date.parse(source.checkedAt) < Date.now() - 365 * 86400000 && (
        <span className="warning-text">
          Fonte sem verificação recente (mais de 12 meses).
        </span>
      )}
    </div>
  );
}
