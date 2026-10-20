import { useState } from "react";
import { AlertCircle, Tag } from "lucide-react";
import { External, PageHeading } from "../components/ui";
export default function PricesPage({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [priceQuery, setPriceQuery] = useState("");
  const [cep, setCep] = useState("");
  return (
    <>
      <PageHeading
        index="03"
        title="Preços e farmácias"
        subtitle="Pesquisa externa e comparação manual."
      />
      <div className="info-strip">
        <AlertCircle size={19} />
        <span>
          Não há integração de preços ou estoque nesta versão. Confira
          apresentação, quantidade e disponibilidade diretamente na farmácia.
        </span>
      </div>
      <form
        className="price-form"
        onSubmit={(e) => {
          e.preventDefault();
          onNotice(
            "Use os links abaixo para consultar as farmácias. O CEP deve ser informado no site de destino.",
          );
        }}
      >
        <label className="field">
          Medicamento e apresentação
          <input
            value={priceQuery}
            onChange={(e) => setPriceQuery(e.target.value)}
            placeholder="Nome, concentração e quantidade"
            maxLength={200}
          />
        </label>
        <label className="field">
          CEP <span className="muted">opcional</span>
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            value={cep}
            onChange={(e) =>
              setCep(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="00000-000"
            pattern="[0-9]{8}"
            title="Informe os 8 dígitos do CEP"
          />
        </label>
        <button className="primary-button">Preparar consulta</button>
      </form>
      <p className="small-note">
        O CEP não é enviado pelo Doser. Informe-o na farmácia para consultar
        entrega e disponibilidade. Distância e localização não são calculadas
        nesta versão.
      </p>
      <section className="section-block">
        <div className="section-heading">
          <h2>Consultar nas farmácias</h2>
          <span className="meta">Sites externos</span>
        </div>
        {[
          ["Drogasil", "https://www.drogasil.com.br/search?w="],
          ["Droga Raia", "https://www.drogaraia.com.br/search?w="],
          ["Pague Menos", "https://www.paguemenos.com.br/search?q="],
        ].map(([name, url]) => (
          <div className="external-row" key={name}>
            <div>
              <strong>{name}</strong>
              <small>Preço e estoque no site da farmácia</small>
            </div>
            <External href={`${url}${encodeURIComponent(priceQuery.trim())}`}>
              Pesquisar
            </External>
          </div>
        ))}
      </section>
      <section className="regulatory">
        <Tag size={22} />
        <div>
          <h3>Preços máximos regulados</h3>
          <p>
            Os limites da CMED não representam o preço efetivo cobrado pelas
            farmácias.
          </p>
          <External href="https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos">
            Consultar listas da CMED
          </External>
        </div>
      </section>
    </>
  );
}
