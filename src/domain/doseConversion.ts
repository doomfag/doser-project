/** Exact dimensional arithmetic. Never selects a clinical dose or rounds a quantity. */
export type MassUnit = "g" | "mg" | "mcg";
export type DosageForm = "tablet" | "capsule" | "liquid" | "drops";
export interface ConversionInput {
  prescribed: string;
  prescribedUnit: MassUnit;
  strength: string;
  strengthUnit: MassUnit;
  form: DosageForm;
  volume?: string;
  graduation?: string;
  dropsPerMl?: string;
}
type Rational = { n: bigint; d: bigint };
const factors: Record<MassUnit, bigint> = { g: 1000000n, mg: 1000n, mcg: 1n };
function gcd(a: bigint, b: bigint): bigint {
  return b ? gcd(b, a % b) : a;
}
function rational(n: bigint, d: bigint): Rational {
  const c = gcd(n, d);
  return { n: n / c, d: d / c };
}
function number(value: string, label: string): Rational {
  const text = value.trim();
  if (!/^\d{1,8}(,\d{1,6})?$/.test(text))
    throw new Error(
      `${label}: use números positivos e vírgula decimal, sem ponto ou separador de milhares.`,
    );
  const [whole, fraction = ""] = text.split(",");
  const n = BigInt(whole + fraction);
  if (n === 0n) throw new Error(`${label} deve ser maior que zero.`);
  return rational(n, 10n ** BigInt(fraction.length));
}
function multiply(a: Rational, b: Rational): Rational {
  return rational(a.n * b.n, a.d * b.d);
}
function divide(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d, a.d * b.n);
}
function decimal(value: Rational): string {
  let d = value.d;
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  if (d !== 1n)
    throw new Error(
      "O resultado exige arredondamento. Confira a concentração e o dispositivo com um farmacêutico; nenhuma quantidade foi sugerida.",
    );
  const whole = value.n / value.d;
  let remainder = value.n % value.d;
  let fraction = "";
  while (remainder) {
    remainder *= 10n;
    fraction += (remainder / value.d).toString();
    remainder %= value.d;
  }
  return whole.toString() + (fraction ? "," + fraction : "");
}
export function convertDose(input: ConversionInput): {
  quantity: string;
  unit: string;
  explanation: string;
} {
  if (
    !["tablet", "capsule", "liquid", "drops"].includes(input.form) ||
    !Object.hasOwn(factors, input.prescribedUnit) ||
    !Object.hasOwn(factors, input.strengthUnit)
  )
    throw new Error("Forma ou unidade inválida.");
  const dose = multiply(number(input.prescribed, "Dose prescrita"), {
    n: factors[input.prescribedUnit],
    d: 1n,
  });
  const amount = multiply(
    number(input.strength, "Quantidade de princípio ativo"),
    { n: factors[input.strengthUnit], d: 1n },
  );
  let quantity = divide(dose, amount);
  let unit = input.form === "capsule" ? "cápsula(s)" : "comprimido(s)";
  let explanation = `Dose prescrita (${input.prescribed} ${input.prescribedUnit}) ÷ quantidade por unidade (${input.strength} ${input.strengthUnit}), após igualar as unidades de massa.`;
  if (input.form === "liquid" || input.form === "drops") {
    quantity = multiply(
      quantity,
      number(input.volume ?? "", "Volume da concentração"),
    );
    explanation = `Dose prescrita ÷ concentração: (${input.prescribed} ${input.prescribedUnit} ÷ ${input.strength} ${input.strengthUnit}) × ${input.volume} mL, após igualar as unidades de massa.`;
    unit = "mL";
    if (input.form === "drops") {
      quantity = multiply(
        quantity,
        number(input.dropsPerMl ?? "", "Gotas por mL"),
      );
      unit = "gota(s)";
      explanation += ` Em seguida, multiplicado por ${input.dropsPerMl} gotas/mL, conforme o gotejador e a bula informados.`;
    } else {
      const steps = divide(
        quantity,
        number(input.graduation ?? "", "Graduação do dosador"),
      );
      if (steps.d !== 1n)
        throw new Error(
          "O volume não coincide com a graduação informada do dosador. Não arredonde; confira o dispositivo ou a apresentação com um farmacêutico.",
        );
    }
  }
  if (input.form !== "liquid" && quantity.d !== 1n)
    throw new Error(
      input.form === "drops"
        ? "O resultado não é um número inteiro de gotas. Não arredonde; confira a apresentação com um farmacêutico."
        : "O resultado não corresponde a unidades inteiras. O Doser não presume que comprimidos possam ser partidos ou cápsulas abertas. Confira a apresentação com um farmacêutico.",
    );
  return { quantity: decimal(quantity), unit, explanation };
}
