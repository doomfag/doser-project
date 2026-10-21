import { nativePackaged } from "../data/runtime";
import {
  RefreshCw,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import { type OfficialStatus } from "../hooks/useCatalog";
interface Props {
  ready: boolean;
  portable: boolean;
  updating: boolean;
  automatic: boolean;
  onAutomatic: (value: boolean) => void;
  onUpdate: () => void;
  error: string;
  lastSuccess?: string;
  officialCount: number;
  status: OfficialStatus;
}
export default function CatalogUpdates({
  ready,
  portable,
  updating,
  automatic,
  onAutomatic,
  onUpdate,
  error,
  lastSuccess,
  officialCount,
  status,
}: Props) {
  return (
    <section
      className="update-panel"
      aria-labelledby="update-heading"
      aria-busy={updating}
    >
      <div className="update-heading">
        <div className="update-icon">
          <RefreshCw size={22} className={updating ? "is-spinning" : ""} />
        </div>
        <div>
          <p className="eyebrow">BASE DE MEDICAMENTOS</p>
          <h2 id="update-heading">Atualizações</h2>
        </div>
        <span className={`update-badge ${updating ? "checking" : ""}`}>
          {updating
            ? "Verificando"
            : officialCount
              ? "Base local"
              : "Sem base oficial"}
        </span>
      </div>
      <div className="update-actions">
        <div>
          <strong>
            {officialCount.toLocaleString("pt-BR")} registros da Anvisa
          </strong>
          <p>
            {lastSuccess
              ? `Última verificação: ${new Date(lastSuccess).toLocaleString("pt-BR")}`
              : "Nenhuma atualização oficial concluída neste dispositivo."}
          </p>
        </div>
        {portable ? (
          <span className="portable-label">
            {nativePackaged
              ? "Base incluída no aplicativo"
              : document.documentElement.dataset.doserPwa === "true"
                ? "Base incluída nesta versão"
                : "Base incluída no arquivo"}
          </span>
        ) : (
          <button
            className="primary-button"
            disabled={updating || !ready}
            onClick={onUpdate}
          >
            <RefreshCw size={16} className={updating ? "is-spinning" : ""} />
            {updating ? "Atualizando…" : "Atualizar agora"}
          </button>
        )}
      </div>
      {updating && (
        <div className="update-progress" aria-label="Atualização em andamento">
          <span />
        </div>
      )}
      {portable ? (
        <p className="small-note">
          {document.documentElement.dataset.doserPwa === "true" ? (
            "Consulta offline com a base desta versão. Uma nova publicação do Doser pode trazer um catálogo atualizado; a tela inicial avisa quando houver atualização do aplicativo. Você também pode importar um catálogo com fontes."
          ) : (
            <>
              {nativePackaged
                ? "Consulta offline. A atualização automática nesta plataforma ainda não está disponível. Para renovar, importe um"
                : "Consulta offline com a base incluída. Para renovar, importe um"}
              catálogo ou use o programa local, que permite a verificação
              semanal.
            </>
          )}
        </p>
      ) : (
        <label className="automatic-setting">
          <CalendarClock size={19} />
          <span>
            <strong>Verificar semanalmente</strong>
            <small>
              Enquanto o Doser estiver aberto, ou ao reabrir após uma semana.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Verificar atualizações semanalmente"
            checked={automatic}
            onChange={(e) => onAutomatic(e.target.checked)}
          />
          <span className="switch-track" aria-hidden="true" />
        </label>
      )}
      <div className="update-feedback" role="status" aria-live="polite">
        {error ? (
          <>
            <WifiOff size={16} />
            <span>{error}</span>
          </>
        ) : lastSuccess ? (
          <>
            <CheckCircle2 size={16} />
            <span>
              Cadastros armazenados localmente. A data de consulta não equivale
              à revisão clínica de bulas.
            </span>
          </>
        ) : (
          <>
            <AlertCircle size={16} />
            <span>
              A base cadastral traz nomes, princípios ativos, classes e
              registros. Doses e faixas etárias exigem a bula da apresentação e
              não são inventadas.
            </span>
          </>
        )}
      </div>
      {status.presentations && (
        <p className="small-note">
          Apresentações CMED: {status.presentations.presentations} em{" "}
          {status.presentations.products} registros.{" "}
          {status.presentations.status === "cached"
            ? "Cache anterior, com data original preservada."
            : "A lista não confirma estoque ou comercialização."}{" "}
          {status.presentations.message}
        </p>
      )}
      {status.clinical && (
        <details className="update-report">
          <summary>
            Referências clínicas: {status.clinical.references} documentos por
            substância · {status.clinical.coveredRecords} registros relacionados
          </summary>
          <p>
            Referências por princípio ativo, separadas das bulas de cada
            produto. O vínculo não confirma apresentação, via ou adequação
            individual.
          </p>
          {status.clinical.documents.map((doc) => (
            <p key={doc.id}>
              <strong>{doc.title}</strong>
              <br />
              {doc.status === "verified"
                ? "PDF conferido por versão SHA-256"
                : doc.status === "cached"
                  ? "Versão anterior em cache"
                  : doc.status === "changed"
                    ? "Documento alterado: esquemas retirados até revisão"
                    : "Documento indisponível: sem esquemas"}
              {doc.checkedAt &&
                ` · ${new Date(doc.checkedAt).toLocaleString("pt-BR")}`}
              {doc.message && (
                <>
                  <br />
                  {doc.message}
                </>
              )}
            </p>
          ))}
        </details>
      )}
      {status.report && (
        <details className="update-report">
          <summary>Detalhes da última importação</summary>
          <dl>
            <div>
              <dt>Linhas na fonte</dt>
              <dd>{status.report.rows.toLocaleString("pt-BR")}</dd>
            </div>
            <div>
              <dt>Registros ativos incluídos</dt>
              <dd>{status.report.included.toLocaleString("pt-BR")}</dd>
            </div>
            <div>
              <dt>Linhas fora do critério</dt>
              <dd>{status.report.excluded.toLocaleString("pt-BR")}</dd>
            </div>
            <div>
              <dt>Duplicatas de registro</dt>
              <dd>{status.report.duplicates.toLocaleString("pt-BR")}</dd>
            </div>
            <div>
              <dt>Sem princípio ativo na fonte</dt>
              <dd>{status.report.missingIngredient.toLocaleString("pt-BR")}</dd>
            </div>
          </dl>
          <p>
            Inclui todos os cadastros ativos reconhecidos no arquivo, sem
            excluir por raridade. Apresentações e informações clínicas não fazem
            parte desse arquivo.
          </p>
        </details>
      )}
    </section>
  );
}
