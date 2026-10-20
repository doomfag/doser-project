import ProductPhotos from "../components/ProductPhotos";
import { normalize } from "../domain/catalog";
import ClinicalReferences from "../components/ClinicalReferences";
import { type ClinicalReference } from "../domain/catalog";
import { useMemo, useState } from "react";
import { ArrowLeft, Star, Plus, FileText, Scale } from "lucide-react";
import { sectionLabels, type Medicine, type Section } from "../domain/catalog";
import { bularioUrl } from "../domain/bulario";
import { External } from "../components/ui";
import UsageSection from "../components/UsageSection";
import SourceReference from "../components/SourceReference";
interface Props {
  onCalculate: () => void;
  catalog: Medicine[];
  onOpen: (medicine: Medicine) => void;
  detail: Medicine;
  references: ClinicalReference[];
  saved: boolean;
  onBack: () => void;
  onFavorite: (id: string) => void;
  onCompare: (id: string) => void;
}
export default function MedicineDetail({
  onCalculate,
  catalog,
  onOpen,
  detail,
  references,
  saved,
  onBack,
  onFavorite,
  onCompare,
}: Props) {
  const [tab, setTab] = useState("overview");
  const related = useMemo(
    () =>
      catalog
        .filter(
          (m) =>
            m.id !== detail.id &&
            normalize(m.ingredient) === normalize(detail.ingredient) &&
            !normalize(m.ingredient).startsWith("nao informad"),
        )
        .slice(0, 12),
    [catalog, detail.id, detail.ingredient],
  );
  const keys: Section[] =
    tab === "overview"
      ? ["indications", "contraindications", "precautions"]
      : (Object.keys(sectionLabels) as Section[]).filter(
          (k) =>
            ![
              "indications",
              "contraindications",
              "precautions",
              "dosage",
            ].includes(k),
        );
  const documented =
    Object.values(detail.facts).length + (detail.usage?.length ?? 0);
  return (
    <>
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FICHA DO MEDICAMENTO</p>
          <h1>{detail.name}</h1>
          <p className="subheading">
            {detail.ingredient}
            <span>·</span>
            {detail.drugClass}
          </p>
        </div>
        <button
          className={`secondary-button ${saved ? "saved-button" : ""}`}
          onClick={() => onFavorite(detail.id)}
        >
          <Star size={17} fill={saved ? "currentColor" : "none"} />
          {saved ? "Salvo" : "Salvar"}
        </button>
      </div>
      <div className="medicine-context">
        <span className="context-dot" />
        {documented
          ? "Informações documentais importadas · confira a origem de cada campo"
          : references.length
            ? "Informações sobre a substância · confira também a bula desta marca"
            : "Cadastro da Anvisa · bula ainda não conferida"}
      </div>
      <div className="tabs detail-tabs" aria-label="Seções do medicamento">
        {[
          ["overview", "Visão geral"],
          ["usage", "Como usar"],
          ["technical", "Informações técnicas"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <ProductPhotos
          key={detail.id}
          medicineId={detail.id}
          name={detail.name}
        />
      )}
      {tab === "overview" && related.length > 0 && (
        <details className="fact related-products">
          <summary>Outras marcas com a mesma substância</summary>
          <p className="small-note">
            Ter a mesma substância não garante que possa trocar. A quantidade, a
            forma de usar e a aprovação da Anvisa também precisam corresponder.
          </p>
          {related.map((m) => (
            <button
              className="external-row related-product"
              key={m.id}
              onClick={() => onOpen(m)}
            >
              <span>
                <strong>{m.name}</strong>
                <small>{m.registration?.holder}</small>
              </span>
              <span>Ver ficha →</span>
            </button>
          ))}
        </details>
      )}
      {!documented && !references.length && (
        <div className="info-strip">
          <span>
            A ficha ainda não tem uma bula conferida. Consulte o documento
            oficial abaixo; não há dose, idade ou apresentação confirmada neste
            cadastro.
          </span>
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-tab-content" key={tab}>
          {tab === "usage" ? (
            <>
              {detail.usage?.length ||
              detail.facts.dosage ||
              !references.length ? (
                <UsageSection medicine={detail} />
              ) : null}
              {references.length > 0 && (
                <ClinicalReferences references={references} mode="usage" />
              )}
            </>
          ) : (
            <>
              {tab === "overview" && detail.presentations.length > 0 && (
                <section className="detail-section">
                  <h2>Apresentações</h2>
                  {detail.presentations.length ? (
                    <ul>
                      {detail.presentations.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      Nenhuma apresentação documentada neste catálogo.
                    </p>
                  )}
                </section>
              )}
              {keys
                .filter((key) => detail.facts[key])
                .map((key) => {
                  const fact = detail.facts[key];
                  return (
                    <details className="fact" key={key}>
                      <summary>
                        {sectionLabels[key]}
                        <span className="fact-status">
                          {fact
                            ? fact.source.status === "validated"
                              ? "Validação declarada"
                              : "Pendente"
                            : "Não informado"}
                          <Plus size={15} />
                        </span>
                      </summary>
                      {fact ? (
                        <div className="fact-content">
                          <p>{fact.text}</p>
                          <SourceReference source={fact.source} />
                        </div>
                      ) : (
                        <p className="muted fact-content">
                          Nenhuma informação documentada importada para esta
                          seção.
                        </p>
                      )}
                    </details>
                  );
                })}
              {references.length > 0 && (
                <ClinicalReferences
                  references={references}
                  mode={tab === "overview" ? "overview" : "technical"}
                />
              )}
              {tab === "overview" && detail.registration && (
                <details className="registration-details">
                  <summary>
                    <FileText size={17} />
                    Registro e origem cadastral
                    <Plus size={15} />
                  </summary>
                  <dl>
                    <div>
                      <dt>Registro Anvisa</dt>
                      <dd>{detail.registration.number}</dd>
                    </div>
                    {detail.registration.holder && (
                      <div>
                        <dt>Detentor</dt>
                        <dd>{detail.registration.holder}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Situação na fonte</dt>
                      <dd>{detail.registration.situation}</dd>
                    </div>
                  </dl>
                  <p className="small-note">
                    Situação do registro na data da consulta. Não confirma
                    comercialização, estoque ou conteúdo clínico.
                  </p>
                  <SourceReference source={detail.registration.source} />
                </details>
              )}
            </>
          )}
        </div>
        <aside className="detail-aside">
          <p className="eyebrow">DOCUMENTOS</p>
          <h3>Bulas e referências</h3>
          {detail.professionalLeaflet ? (
            <External href={detail.professionalLeaflet}>
              Bula profissional
            </External>
          ) : null}
          {detail.patientLeaflet ? (
            <External href={detail.patientLeaflet}>Bula do paciente</External>
          ) : null}
          {!detail.professionalLeaflet && !detail.patientLeaflet && (
            <p className="muted">
              A bula desta marca ainda não foi vinculada. Abra a consulta
              oficial para conferir.
            </p>
          )}
          <External href={bularioUrl(detail)}>
            Consultar bulas deste medicamento
          </External>
          <button className="secondary-button" onClick={onCalculate}>
            Converter dose prescrita
          </button>
          <button
            className="secondary-button"
            onClick={() => onCompare(detail.id)}
          >
            <Scale size={16} />
            Comparar
          </button>
        </aside>
      </div>
    </>
  );
}
