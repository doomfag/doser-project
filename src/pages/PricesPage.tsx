import OffersWorkbench from "../components/OffersWorkbench";
import { useState } from "react";
import { AlertCircle, Tag } from "lucide-react";
import { External, PageHeading } from "../components/ui";
export default function PricesPage({
  onNotice: _onNotice,
  initialQuery = "",
}: {
  onNotice: (message: string) => void;
  initialQuery?: string;
}) {
  const [priceQuery, setPriceQuery] = useState(initialQuery);
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
      <label className="field price-search">
        Medicamento e apresentação
        <input
          value={priceQuery}
          onChange={(e) => setPriceQuery(e.target.value)}
          placeholder="Nome, quantidade por unidade e tamanho da embalagem"
          maxLength={200}
        />
      </label>
      <p className="small-note">
        Informe o CEP no site da farmácia para consultar a entrega. O Doser não
        calcula distância nem disponibilidade.
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
      <OffersWorkbench productQuery={priceQuery} />
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
