import { bularioUrl } from "../domain/bulario";
import { External } from "./ui";
import { useState } from "react";
import {
  AlertCircle,
  Clock3,
  Pill,
  Users,
  Route,
  CalendarClock,
  ShieldAlert,
  FileText,
} from "lucide-react";
import type { Medicine } from "../domain/catalog";
import SourceReference from "./SourceReference";
export default function UsageSection({ medicine }: { medicine: Medicine }) {
  const [selection, setSelection] = useState("");
  const entries = medicine.usage ?? [];
  const entry = entries.find((e) => e.id === selection);
  return (
    <section className="usage-section">
      <div className="section-heading">
        <h2>Como usar</h2>
        <span className="meta">Conforme documentação</span>
      </div>
      <p className="usage-intro">
        Dose e faixa etária dependem da apresentação, concentração, indicação e
        condições da pessoa. O Doser não escolhe a dose nem os horários. A
        calculadora converte apenas uma dose já prescrita, usando a concentração
        informada.
      </p>
      {entries.length > 0 ? (
        <>
          <label className="field">
            Apresentação e população documentadas
            <select
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
            >
              <option value="">Escolha o regime que deseja consultar</option>
              {entries.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.presentation} · {e.population}
                </option>
              ))}
            </select>
          </label>
          {entry ? (
            <div className="usage-regimen" key={entry.id}>
              <div className="regimen-context">
                <Pill size={19} />
                <span>
                  <strong>{entry.presentation}</strong>
                  <small>{entry.population}</small>
                </span>
              </div>
              {entry.source.status === "pending" && (
                <div className="info-strip warning">
                  <ShieldAlert size={18} />
                  <span>
                    Regime pendente de conferência. Não use estes dados para
                    definir um tratamento.
                  </span>
                </div>
              )}
              <dl className="usage-facts">
                {[
                  {
                    icon: Pill,
                    label:
                      entry.doseBasis === "per-day"
                        ? "Dose diária no protocolo"
                        : entry.doseBasis === "document-text"
                          ? "Esquema descrito no documento"
                          : "Quantidade por dose",
                    value: entry.dose,
                  },
                  {
                    icon: Clock3,
                    label: "Intervalo entre doses",
                    value: entry.interval,
                  },
                  {
                    icon: Users,
                    label:
                      entry.source.kind === "guideline"
                        ? "População deste esquema (PCDT)"
                        : "Faixa etária documentada",
                    value: entry.age,
                  },
                  {
                    icon: Route,
                    label: "Via de administração",
                    value: entry.route,
                  },
                  {
                    icon: CalendarClock,
                    label: "Duração documentada",
                    value: entry.duration,
                  },
                  {
                    icon: ShieldAlert,
                    label: "Limite diário documentado",
                    value: entry.maxDaily,
                  },
                ].map((f) => (
                  <div key={f.label}>
                    <dt>
                      <f.icon size={16} />
                      {f.label}
                    </dt>
                    <dd className={!f.value ? "muted" : ""}>
                      {f.value || "Não informado na fonte"}
                    </dd>
                  </div>
                ))}
              </dl>
              {entry.conditions && (
                <details className="regimen-conditions">
                  <summary>Condições, ajustes e observações da fonte</summary>
                  <p>{entry.conditions}</p>
                </details>
              )}
              <details className="regimen-source">
                <summary>
                  <FileText size={16} />
                  Conferir fonte do regime
                </summary>
                <SourceReference source={entry.source} />
              </details>
            </div>
          ) : (
            <div className="usage-placeholder">
              <Pill size={25} />
              <p>
                Selecione uma apresentação para consultar os dados
                correspondentes.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="missing-usage">
          <AlertCircle size={24} />
          <h3>Posologia por apresentação indisponível</h3>
          <p>
            O catálogo não contém regimes documentados para este medicamento.
            Quantidade de comprimidos ou gotas, intervalo e idade mínima não
            serão estimados.
          </p>
          <span>Consulte a bula da apresentação exata.</span>
          <External href={bularioUrl(medicine)}>
            Abrir a consulta oficial deste medicamento
          </External>
        </div>
      )}
      {medicine.facts.dosage && (
        <details className="fact dosage-document">
          <summary>
            Posologia — texto documental <FileText size={16} />
          </summary>
          <div className="fact-content">
            <p>{medicine.facts.dosage.text}</p>
            <SourceReference source={medicine.facts.dosage.source} />
          </div>
        </details>
      )}
    </section>
  );
}
