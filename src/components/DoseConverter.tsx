import { useEffect, useRef, useState, type FormEvent } from "react";
import { Calculator, X } from "lucide-react";
import {
  convertDose,
  type ConversionInput,
  type MassUnit,
  type DosageForm,
} from "../domain/doseConversion";
const initial: ConversionInput = {
  prescribed: "",
  prescribedUnit: "mg",
  strength: "",
  strengthUnit: "mg",
  form: "tablet",
  volume: "",
  graduation: "",
  dropsPerMl: "",
};
export default function DoseConverter({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState(initial);
  const [result, setResult] = useState<ReturnType<typeof convertDose> | null>(
    null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = old;
    };
  }, []);
  function change<K extends keyof ConversionInput>(
    key: K,
    value: ConversionInput[K],
  ) {
    setInput((old) => ({ ...old, [key]: value }));
    setResult(null);
    setError("");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setResult(convertDose(input));
      setError("");
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Confira os valores.");
    }
  }
  function unit(key: "prescribedUnit" | "strengthUnit") {
    return (
      <select
        aria-label={
          key === "prescribedUnit"
            ? "Unidade da dose prescrita"
            : "Unidade da concentração"
        }
        value={input[key]}
        onChange={(e) => change(key, e.target.value as MassUnit)}
      >
        {(["mg", "mcg", "g"] as const).map((u) => (
          <option key={u}>{u}</option>
        ))}
      </select>
    );
  }
  const liquid = input.form === "liquid" || input.form === "drops";
  return (
    <dialog
      ref={dialog}
      className="dose-dialog"
      aria-labelledby="dose-heading"
      onCancel={onClose}
    >
      <div className="dose-dialog-header">
        <div>
          <p className="eyebrow">CONVERSÃO DE QUANTIDADE</p>
          <h2 id="dose-heading">
            <Calculator size={22} />
            Calculadora de dose
          </h2>
        </div>
        <button
          className="icon-button"
          autoFocus
          onClick={onClose}
          aria-label="Fechar calculadora"
        >
          <X size={22} />
        </button>
      </div>
      <p className="dose-intro">
        Converta uma <strong>dose já prescrita por tomada</strong> em unidades
        da apresentação exata. O cálculo não define quanto você deve tomar.
      </p>
      <details className="calculator-guide">
        <summary>Quando usar e por quê</summary>
        <p>
          Use para conferir a quantidade correspondente à dose prescrita, quando
          a prescrição informa massa (mg, mcg ou g) e a embalagem informa
          concentração. A divisão relaciona a massa prescrita com a massa de
          cada unidade ou mL.
        </p>
        <p>
          Um resultado matemático não autoriza trocar apresentações, marcas,
          vias, associações ou tipos de liberação. Não use para escolher uma
          dose, adaptar dose infantil, ajustar tratamento ou transformar uma
          dose diária em dose por tomada. Se a prescrição não estiver clara,
          confirme antes de calcular.
        </p>
      </details>
      <form onSubmit={submit} className="dose-form">
        <label className="field" htmlFor="dose-form">
          Forma farmacêutica
          <select
            id="dose-form"
            aria-label="Forma farmacêutica"
            value={input.form}
            onChange={(e) => {
              setInput({ ...initial, form: e.target.value as DosageForm });
              setResult(null);
              setError("");
            }}
          >
            <option value="tablet">Comprimido</option>
            <option value="capsule">Cápsula</option>
            <option value="liquid">Líquido em mL</option>
            <option value="drops">Líquido em gotas</option>
          </select>
        </label>
        <div className="dose-fields">
          <div>
            <label className="field" htmlFor="prescribed-dose">
              Dose prescrita por tomada
            </label>
            <div className="dose-unit-input">
              <input
                id="prescribed-dose"
                inputMode="decimal"
                required
                maxLength={16}
                placeholder="Ex.: 1"
                value={input.prescribed}
                onChange={(e) => change("prescribed", e.target.value)}
              />
              {unit("prescribedUnit")}
            </div>
          </div>
          <div>
            <label className="field" htmlFor="dose-strength">
              {liquid
                ? "Princípio ativo no volume da embalagem"
                : "Princípio ativo por comprimido ou cápsula"}
            </label>
            <div className="dose-unit-input">
              <input
                id="dose-strength"
                inputMode="decimal"
                required
                maxLength={16}
                placeholder="Ex.: 0,5"
                value={input.strength}
                onChange={(e) => change("strength", e.target.value)}
              />
              {unit("strengthUnit")}
            </div>
          </div>
        </div>
        {liquid && (
          <label className="field">
            Volume correspondente na embalagem (mL)
            <input
              inputMode="decimal"
              required
              maxLength={16}
              placeholder="Ex.: em 5 mL"
              value={input.volume}
              onChange={(e) => change("volume", e.target.value)}
            />
          </label>
        )}
        {input.form === "liquid" && (
          <label className="field">
            Menor graduação do dosador (mL)
            <input
              inputMode="decimal"
              required
              maxLength={16}
              placeholder="Conforme o dispositivo de medição"
              value={input.graduation}
              onChange={(e) => change("graduation", e.target.value)}
            />
          </label>
        )}
        {input.form === "drops" && (
          <label className="field">
            Gotas por 1 mL, conforme a bula e o gotejador
            <input
              inputMode="decimal"
              required
              maxLength={16}
              placeholder="Não existe um fator universal"
              value={input.dropsPerMl}
              onChange={(e) => change("dropsPerMl", e.target.value)}
            />
          </label>
        )}
        <p className="small-note">
          Use vírgula decimal (0,5), sem ponto ou separador de milhares. Confira
          o princípio ativo, a concentração e a via na prescrição e na
          embalagem. Em associações, esta conta isolada não confere os demais
          componentes.
        </p>
        <button className="primary-button" type="submit">
          <Calculator size={17} />
          Calcular quantidade
        </button>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <p className="info-strip warning" role="alert">
            {error}
          </p>
        )}
        {result && (
          <section className="dose-result">
            <span>EQUIVALÊNCIA MATEMÁTICA POR TOMADA</span>
            <strong>
              {result.quantity} {result.unit}
            </strong>
            <p>{result.explanation}</p>
            <p>
              Não verifica adequação clínica, idade, dose máxima, frequência,
              duração, função renal ou interações. Não altere a prescrição a
              partir deste resultado.
            </p>
          </section>
        )}
      </div>
      <details className="calculator-guide">
        <summary>Como fazer o cálculo · exemplos apenas matemáticos</summary>
        <p>
          <strong>Comprimidos:</strong> quantidade = dose prescrita ÷ quantidade
          por comprimido. Ex.: 1 mg ÷ 0,5 mg = 2 comprimidos. Isso explica a
          conta; não é uma dose recomendada para um medicamento.
        </p>
        <p>
          <strong>Líquidos:</strong> volume = (dose prescrita ÷ massa indicada
          na embalagem) × volume da embalagem. Ex.: (10 mg ÷ 20 mg) × 5 mL = 2,5
          mL. O dosador precisa permitir medir esse volume.
        </p>
        <p>
          <strong>Gotas:</strong> gotas = volume calculado em mL × gotas por mL
          específicos da bula e do gotejador. Sem essa equivalência, use o
          volume em mL com dispositivo adequado ou consulte um farmacêutico.
        </p>
        <p>
          <strong>Unidades:</strong> 1 g = 1.000 mg; 1 mg = 1.000 mcg. Igualar
          as unidades evita uma diferença de mil vezes. Não converta
          porcentagem, UI ou mEq nesta calculadora. O Doser não arredonda
          quantidades nem autoriza partir comprimidos.
        </p>
      </details>
    </dialog>
  );
}
