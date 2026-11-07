// What a month of permit delay costs: the interest you pay while holding the property.
//
// Framework from our mentor (research/mentor-interview.md): price, 20% down, a mortgage at
// today's rate; every month waiting costs interest out of the project's profit. Principal
// payments build equity, so only interest (plus optional taxes/insurance) counts as lost.
// Every input is an ASSUMPTION the caller supplies or accepts; nothing here is sourced data.

export type DelayCostInput = {
  price: number; // purchase price, e.g. 535_000
  downPaymentPct?: number; // default 20
  annualRatePct?: number; // default 7.3 (mentor's figure)
  monthsOfDelay: number;
  monthlyTaxesAndInsurance?: number; // default 0 (left out to stay conservative)
  targetProfit?: number; // optional, to show the share of profit lost
};

export type DelayCostResult = {
  loan: number;
  monthlyInterest: number;
  monthlyCarry: number; // interest + taxes/insurance
  totalCost: number;
  amortizingPayment: number; // 30-year payment, for context only
  shareOfProfitPerMonth: number | null; // 0..1
  monthsToEraseProfit: number | null;
  assumptions: string[];
};

const round = (n: number) => Math.round(n);

export function delayCost(input: DelayCostInput): DelayCostResult {
  const down = input.downPaymentPct ?? 20;
  const rate = input.annualRatePct ?? 7.3;
  if (input.price <= 0) throw new Error("price must be positive");
  if (down < 0 || down >= 100) throw new Error("downPaymentPct must be between 0 and 100");
  if (rate < 0) throw new Error("annualRatePct can't be negative");
  if (input.monthsOfDelay < 0) throw new Error("monthsOfDelay can't be negative");

  const loan = input.price * (1 - down / 100);
  const r = rate / 100 / 12;
  const monthlyInterest = loan * r;
  const tni = input.monthlyTaxesAndInsurance ?? 0;
  const monthlyCarry = monthlyInterest + tni;
  const n = 360;
  const amortizingPayment = r === 0 ? loan / n : (loan * r) / (1 - (1 + r) ** -n);

  const assumptions = [
    `ASSUMPTION: ${down}% down and a ${rate}% annual rate${
      input.annualRatePct === undefined ? " (our mentor's figure, not a sourced current rate)" : ""
    }.`,
    "Only interest counts as lost; principal payments build equity.",
    tni ? `Includes $${round(tni).toLocaleString()} a month in taxes and insurance.` : "Taxes, insurance and the opportunity cost of the down payment are left out, so this is a low estimate.",
  ];

  return {
    loan: round(loan),
    monthlyInterest: round(monthlyInterest),
    monthlyCarry: round(monthlyCarry),
    totalCost: round(monthlyCarry * input.monthsOfDelay),
    amortizingPayment: round(amortizingPayment),
    shareOfProfitPerMonth: input.targetProfit ? monthlyCarry / input.targetProfit : null,
    monthsToEraseProfit: input.targetProfit && monthlyCarry > 0 ? Math.ceil(input.targetProfit / monthlyCarry) : null,
    assumptions,
  };
}
