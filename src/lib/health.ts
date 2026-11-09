import { formatSen } from "./money";
import type { HealthBand, HealthPart, HealthScore, Sen } from "./types";

export type HealthInput = {
  totalSen: Sen;
  unallocatedSen: Sen;
  spent30Sen: Sen;
  income30Sen: Sen;
  daysToNextIncome: number;
  envelopes: { balanceSen: Sen; spent30Sen: Sen }[];
  hasActivity: boolean;
};

const MAX = 25;
const MIN_BUFFER_SEN = 5000;
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** An envelope with recent spending runs out before next income at its 30-day pace. Integer maths. */
export function isAtRisk(balanceSen: Sen, spent30Sen: Sen, daysToNextIncome: number): boolean {
  return spent30Sen > 0 && balanceSen * 30 < daysToNextIncome * spent30Sen;
}

function runway({ totalSen, spent30Sen, daysToNextIncome }: HealthInput): HealthPart {
  const base = { key: "runway" as const, label: "Runway" };
  if (spent30Sen <= 0) return { ...base, score: MAX, detail: "No spending in the last 30 days." };
  const covers = (Math.max(totalSen, 0) * 30) / spent30Sen;
  return {
    ...base,
    // One division per score keeps exact halves exact (12.5 rounds to 13, not 12.4999…).
    score: Math.round(Math.min(MAX, (MAX * Math.max(totalSen, 0) * 30) / (spent30Sen * Math.max(daysToNextIncome, 1)))),
    detail: `${formatSen(totalSen)} covers about ${days(Math.floor(covers))}; next income in ${days(daysToNextIncome)}.`,
  };
}

function envelopesAtRisk({ envelopes, daysToNextIncome }: HealthInput): HealthPart {
  const base = { key: "envelopesAtRisk" as const, label: "Envelopes at risk" };
  const considered = envelopes.filter((e) => e.spent30Sen > 0);
  if (considered.length === 0) return { ...base, score: MAX, detail: "No envelope spending in the last 30 days." };
  const atRisk = considered.filter((e) => isAtRisk(e.balanceSen, e.spent30Sen, daysToNextIncome)).length;
  const n = considered.length;
  return {
    ...base,
    score: Math.round((MAX * (n - atRisk)) / n),
    detail:
      atRisk === 0
        ? `None of the ${n === 1 ? "envelope" : `${n} envelopes`} you spend from should run out before next income.`
        : `${atRisk} of ${n} ${n === 1 ? "envelope" : "envelopes"} may run out before next income.`,
  };
}

/**
 * Money not needed before next income: unallocated, plus what each envelope holds beyond its 30-day pace until then.
 * Softened (Lucas, 2026-11-09): fully allocating is good envelope practice, so envelope surplus (savings, goals) counts.
 */
function bufferSen({ unallocatedSen, envelopes, daysToNextIncome }: HealthInput): Sen {
  const days = Math.max(daysToNextIncome, 1);
  const surplus = envelopes.reduce((s, e) => {
    const needSen = e.spent30Sen > 0 ? Math.ceil((e.spent30Sen * days) / 30) : 0; // integer sen
    return s + Math.max(0, e.balanceSen - needSen);
  }, 0);
  return Math.max(unallocatedSen, 0) + surplus;
}

function buffer(input: HealthInput): HealthPart {
  // Integer target (10% of 30-day spending, at least RM 50) so the amount shown is whole sen.
  const targetSen = Math.max(Math.round(input.spent30Sen / 10), MIN_BUFFER_SEN);
  const haveSen = bufferSen(input);
  return {
    key: "buffer",
    label: "Buffer",
    score: Math.round(Math.min(MAX, (MAX * haveSen) / targetSen)),
    detail: `${formatSen(haveSen)} isn't needed before next income (unallocated plus envelope surplus); aim for ${formatSen(targetSen)}.`,
  };
}

function spendVsIncome({ spent30Sen, income30Sen, totalSen }: HealthInput): HealthPart {
  const base = { key: "spendVsIncome" as const, label: "Spending vs income" };
  if (income30Sen <= 0) {
    if (spent30Sen <= 0) return { ...base, score: MAX, detail: "No income or spending in the last 30 days." };
    // Softened (Lucas, 2026-11-09): no recent income (e.g. only an opening balance) is fine while what you hold
    // lasts. Full marks at two months of spending in hand, scaling down to 0 at nothing.
    const have = Math.max(totalSen, 0);
    return {
      ...base,
      score: Math.round(Math.min(MAX, (MAX * have) / (2 * spent30Sen))),
      detail: `No income in the last 30 days; what you have covers about ${days(Math.floor((have * 30) / spent30Sen))} of spending.`,
    };
  }
  // r = spent/income; 25 at r <= 0.8, 0 at r >= 1.2, linear between. Integer form avoids 1.2 − r float drift.
  const s = spent30Sen, i = income30Sen;
  const score = 5 * s <= 4 * i ? MAX : 5 * s >= 6 * i ? 0 : Math.round((MAX * (6 * i - 5 * s)) / (2 * i));
  return { ...base, score, detail: `You spent ${Math.round((s * 100) / i)}% of what came in over 30 days.` };
}

function band(score: number): HealthBand {
  return score >= 75 ? "healthy" : score >= 50 ? "watch" : "atRisk";
}

/** The 4-part score (each part an integer 0–25, total their sum); null until there is any activity. */
export function computeHealth(input: HealthInput): HealthScore | null {
  if (!input.hasActivity) return null;
  const parts = [runway(input), envelopesAtRisk(input), buffer(input), spendVsIncome(input)];
  const score = parts.reduce((s, p) => s + p.score, 0);
  return { score, band: band(score), parts };
}
