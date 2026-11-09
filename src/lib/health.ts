import { addMonths, daysBetween } from "./dates";
import { formatSen } from "./money";
import type { HealthBand, HealthPart, HealthScore, ISODate, Sen } from "./types";

/** A once-a-month payment (phone bill, tithes, a subscription): the next one is due in `dueInDays` (≤ 0 = due now). */
export type Bill = { dueInDays: number; sen: Sen };
export type HealthEnvelope = { balanceSen: Sen; spent30Sen: Sen; bill?: Bill | null };

export type HealthInput = {
  totalSen: Sen;
  unallocatedSen: Sen;
  spent30Sen: Sen;
  income30Sen: Sen;
  daysToNextIncome: number;
  envelopes: HealthEnvelope[];
  hasActivity: boolean;
};

const MAX = 25;
const MIN_BUFFER_SEN = 5000;
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * Bill detection (Lucas, 2026-11-10: automatic). An envelope with at most one payment per calendar month over the last
 * 90 days is a bill: its next payment is expected a month after the last one, for the same amount. Day-to-day
 * envelopes (two or more spends in a month) return null and keep the 30-day pace model.
 * `count` is the number of expenses that day (default 1).
 */
export function detectBill(
  spendDays: { date: ISODate; sen: Sen; count?: number }[],
  today: ISODate,
): { nextDueOn: ISODate; sen: Sen } | null {
  const days = spendDays.filter((d) => d.sen > 0 && d.date <= today && daysBetween(d.date, today) < 90);
  if (days.length === 0 || days.some((d) => (d.count ?? 1) > 1)) return null;
  const months = new Set(days.map((d) => d.date.slice(0, 7)));
  if (months.size !== days.length) return null; // two payments in one month: day-to-day spending
  const last = days.reduce((a, b) => (b.date > a.date ? b : a));
  return { nextDueOn: addMonths(last.date, 1), sen: last.sen };
}

/** Sen the envelope must still pay out before next income: the bill if it falls due by then, else its 30-day pace. */
export function envelopeNeedSen(e: HealthEnvelope, daysToNextIncome: number): Sen {
  if (e.bill) return e.bill.dueInDays <= daysToNextIncome ? e.bill.sen : 0;
  return e.spent30Sen > 0 ? Math.ceil((e.spent30Sen * Math.max(daysToNextIncome, 1)) / 30) : 0; // integer sen
}

/** At risk: holds less than it needs before next income. Bills only count when due before then. */
export function isAtRisk(e: HealthEnvelope, daysToNextIncome: number): boolean {
  return e.balanceSen < envelopeNeedSen(e, daysToNextIncome);
}

/** Envelopes the score looks at: ones with recent spending, and bills (even if last paid over 30 days ago). */
const considered = (envelopes: HealthEnvelope[]) => envelopes.filter((e) => e.spent30Sen > 0 || e.bill);

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
  const list = considered(envelopes);
  if (list.length === 0) return { ...base, score: MAX, detail: "No envelope spending in the last 30 days." };
  const atRisk = list.filter((e) => isAtRisk(e, daysToNextIncome)).length;
  const n = list.length;
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
  const surplus = envelopes.reduce((s, e) => s + Math.max(0, e.balanceSen - envelopeNeedSen(e, daysToNextIncome)), 0);
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
