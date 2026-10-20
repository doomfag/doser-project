import { presentationLabel } from "../domain/presentationLabel";
import { useEffect, useState } from "react";
import { type Medicine } from "../domain/catalog";
import {
  type Offer,
  moneyCents,
  offerTotal,
  rankedOffers,
  readOffers,
  writeOffers,
  parseOffers,
} from "../domain/offers";
import { localId } from "../data/localId";
import { External } from "./ui";
const localDate = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const currency = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    c / 100,
  );
export default function OffersWorkbench({
  medicines = [],
  productQuery,
}: {
  medicines?: Medicine[];
  productQuery?: string;
}) {
  const [offers, setOffers] = useState(readOffers);
  useEffect(() => {
    if (productQuery !== undefined) {
      setProduct(productQuery);
      setMedicineId("manual:" + productQuery.trim().toLocaleLowerCase("pt-BR"));
    }
  }, [productQuery]);
  const [product, setProduct] = useState(medicines[0]?.name ?? "");
  const [medicineId, setMedicineId] = useState(medicines[0]?.id ?? "manual");
  const [presentation, setPresentation] = useState("");
  const [cep, setCep] = useState("");
  const [order, setOrder] = useState<"total" | "delivery">("total");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const relevant = offers.filter(
    (o) => o.medicineId === medicineId && o.cep === cep,
  );
  const ranked = rankedOffers(offers, medicineId, presentation, cep, order);
  function save(next: Offer[]) {
    try {
      writeOffers(next);
      setOffers(next);
      setStorageError("");
    } catch {
      setStorageError(
        "Não foi possível salvar neste dispositivo. Os dados anteriores foram preservados.",
      );
    }
  }
  return (
    <section className="section-block offers-workbench">
      <div className="section-heading">
        <h2>Onde sai mais barato?</h2>
        <span className="meta">Cotações informadas por você</span>
      </div>
      <p>
        Compare o mesmo produto e a mesma embalagem, incluindo frete. Sem
        conexão com as farmácias, o Doser não confirma preços, estoque ou
        entrega.
      </p>
      <div className="offer-filters">
        {medicines.length > 0 ? (
          <label className="field">
            Produto
            <select
              value={medicineId}
              onChange={(e) => {
                const m = medicines.find((m) => m.id === e.target.value)!;
                setMedicineId(m.id);
                setProduct(m.name);
                setPresentation("");
              }}
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ) : productQuery !== undefined ? null : (
          <label className="field">
            Nome do produto
            <input
              value={product}
              maxLength={200}
              onChange={(e) => {
                setProduct(e.target.value);
                setMedicineId(
                  "manual:" + e.target.value.trim().toLocaleLowerCase("pt-BR"),
                );
              }}
            />
          </label>
        )}
        <label className="field">
          Embalagem exata
          <input
            value={presentation}
            maxLength={1000}
            onChange={(e) => setPresentation(e.target.value)}
            placeholder="Ex.: 500 mg, 20 comprimidos"
            list="offer-presentations"
          />
          <datalist id="offer-presentations">
            {[
              ...new Set([
                ...relevant.map((o) => o.presentation),
                ...(
                  medicines.find((m) => m.id === medicineId)?.presentations ??
                  []
                ).map(presentationLabel),
              ]),
            ].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="field">
          CEP de entrega
          <input
            value={cep}
            inputMode="numeric"
            maxLength={8}
            onChange={(e) =>
              setCep(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="8 dígitos"
          />
        </label>
      </div>
      <details className="fact">
        <summary>Adicionar preço consultado</summary>
        <form
          className="offer-entry"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const f = new FormData(e.currentTarget);
            const price = moneyCents(String(f.get("price")));
            const shipping = String(f.get("shipping")).trim();
            const days = String(f.get("days")).trim();
            try {
              if (
                price === null ||
                (shipping && moneyCents(shipping) === null) ||
                (days && !/^\d{1,3}$/.test(days))
              )
                throw Error(
                  "Use valores como 19,90 e um prazo em dias inteiros.",
                );
              const offer: Offer = {
                id: localId(),
                medicineId,
                product: product.trim(),
                presentation: presentation.trim(),
                pharmacy: String(f.get("pharmacy")).trim(),
                priceCents: price,
                shippingCents: shipping ? moneyCents(shipping) : null,
                deliveryDays: days ? Number(days) : null,
                cep,
                url: String(f.get("url")).trim(),
                checkedAt: new Date(String(f.get("checkedAt"))).toISOString(),
                available: f.get("available") === "on",
              };
              parseOffers([offer]);
              if (offers.length >= 100)
                throw Error(
                  "Limite de 100 cotações. Remova as antigas antes de adicionar.",
                );
              save([offer, ...offers]);
            } catch (x) {
              setError(x instanceof Error ? x.message : "Confira os campos.");
            }
          }}
        >
          <label className="field">
            Farmácia
            <input name="pharmacy" required maxLength={100} />
          </label>
          <label className="field">
            Preço (R$)
            <input
              name="price"
              inputMode="decimal"
              required
              placeholder="19,90"
            />
          </label>
          <label className="field">
            Frete (R$)
            <input
              name="shipping"
              inputMode="decimal"
              placeholder="0 para grátis; vazio se não souber"
            />
          </label>
          <label className="field">
            Prazo em dias corridos
            <input
              name="days"
              inputMode="numeric"
              placeholder="0 para o mesmo dia da consulta"
            />
          </label>
          <label className="field">
            Link da oferta
            <input
              name="url"
              type="url"
              required
              placeholder="https://"
              maxLength={2048}
            />
          </label>
          <label className="field">
            Quando você consultou?
            <input
              name="checkedAt"
              type="datetime-local"
              required
              defaultValue={localDate()}
              max={localDate()}
            />
          </label>
          <label>
            <input type="checkbox" name="available" /> O site informa que está
            disponível
          </label>
          {error && (
            <p role="alert" className="warning-text">
              {error}
            </p>
          )}
          <button className="primary-button">Salvar cotação</button>
        </form>
      </details>
      <div className="section-heading">
        <h3>Comparar ofertas</h3>
        <label className="field">
          Ordenar por
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as typeof order)}
          >
            <option value="total">Menor preço com frete</option>
            <option value="delivery">Entrega mais rápida</option>
          </select>
        </label>
      </div>
      <p className="small-note">
        Comparação de cotações disponíveis das últimas 24 horas, para esta
        embalagem e este CEP. Preços diferentes não tornam medicamentos
        equivalentes. O prazo é o que você informou, sem garantia do Doser.
      </p>
      {ranked.length === 0 ? (
        <p className="muted">
          Informe a embalagem e o CEP e adicione preços para comparar.{" "}
          {order === "total"
            ? "O frete precisa estar informado."
            : "O prazo precisa estar informado."}
        </p>
      ) : (
        ranked.map((o, i) => (
          <div className="external-row" key={o.id}>
            <div>
              <strong>{o.pharmacy}</strong>
              {i === 0 && (
                <span className="match-hint">
                  {order === "total"
                    ? "Menor total informado"
                    : "Menor prazo informado"}
                </span>
              )}
              <small>
                {offerTotal(o) === null
                  ? "Frete não informado"
                  : currency(offerTotal(o)!) + " com frete"}{" "}
                ·{" "}
                {o.deliveryDays === null
                  ? "Prazo não informado"
                  : o.deliveryDays === 0
                    ? "Mesmo dia da consulta"
                    : `${o.deliveryDays} dia(s) corrido(s) após a consulta`}
              </small>
              <small>
                {o.product} · {o.presentation} ·{" "}
                {new Date(o.checkedAt).toLocaleString("pt-BR")}
              </small>
            </div>
            <External href={o.url}>Ver oferta</External>
          </div>
        ))
      )}
      {offers.length > 0 && (
        <details className="fact">
          <summary>Cotações salvas ({offers.length})</summary>
          {offers.map((o) => (
            <div className="external-row" key={o.id}>
              <div>
                <strong>
                  {o.pharmacy} · {o.product}
                </strong>
                <small>
                  {o.presentation} · CEP {o.cep} · {currency(o.priceCents)} sem
                  frete
                </small>
              </div>
              <button
                className="text-button"
                aria-label={`Remover cotação ${o.pharmacy}`}
                onClick={() => save(offers.filter((x) => x.id !== o.id))}
              >
                Remover
              </button>
            </div>
          ))}
        </details>
      )}
      {storageError && <p role="alert">{storageError}</p>}
    </section>
  );
}
