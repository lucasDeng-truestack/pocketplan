import { describe, expect, it } from "vitest";
import { computeHealth, detectBill, envelopeNeedSen, isAtRisk, type HealthInput } from "@/lib/health";

const base: HealthInput = {
  totalSen: 0,
  unallocatedSen: 0,
  spent30Sen: 0,
  income30Sen: 0,
  daysToNextIncome: 30,
  envelopes: [],
  hasActivity: true,
};
const part = (input: Partial<HealthInput>, key: string) => computeHealth({ ...base, ...input })!.parts.find((p) => p.key === key)!;

describe("computeHealth", () => {
  it("is null without any activity", () => {
    expect(computeHealth({ ...base, hasActivity: false, totalSen: 100000 })).toBeNull();
  });

  it("returns four integer parts in order whose sum is the score", () => {
    const h = computeHealth({ ...base, totalSen: 12345, unallocatedSen: 777, spent30Sen: 9999, income30Sen: 11111, daysToNextIncome: 7,
      envelopes: [{ balanceSen: 100, spent30Sen: 3000 }, { balanceSen: 90000, spent30Sen: 3000 }, { balanceSen: 5, spent30Sen: 0 }] })!;
    expect(h.parts.map((p) => p.key)).toEqual(["runway", "envelopesAtRisk", "buffer", "spendVsIncome"]);
    expect(h.parts.map((p) => p.label)).toEqual(["Runway", "Envelopes at risk", "Buffer", "Spending vs income"]);
    for (const p of h.parts) {
      expect(Number.isInteger(p.score)).toBe(true);
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(25);
      expect(p.detail.length).toBeGreaterThan(0);
    }
    expect(h.score).toBe(h.parts.reduce((s, p) => s + p.score, 0));
  });

  it("runway: full with no spending, scaled by days covered, rounds halves up, 0 when total is negative", () => {
    expect(part({ spent30Sen: 0, totalSen: 0 }, "runway").score).toBe(25);
    // 30000 sen / 30 days = 1000 a day
    expect(part({ spent30Sen: 30000, totalSen: 100000, daysToNextIncome: 18 }, "runway").score).toBe(25);
    expect(part({ spent30Sen: 30000, totalSen: 9000, daysToNextIncome: 18 }, "runway").score).toBe(13); // 9/18 → 12.5
    expect(part({ spent30Sen: 30000, totalSen: -5000, daysToNextIncome: 18 }, "runway").score).toBe(0);
    expect(part({ spent30Sen: 30000, totalSen: 500, daysToNextIncome: 0 }, "runway").score).toBe(13); // days clamp to 1
    expect(part({ spent30Sen: 30000, totalSen: 120000, daysToNextIncome: 18 }, "runway").detail).toBe(
      "RM 1,200.00 covers about 120 days; next income in 18 days.",
    );
  });

  it("envelopesAtRisk: only envelopes with spending count; equal pace is not at risk", () => {
    expect(part({ envelopes: [{ balanceSen: 0, spent30Sen: 0 }] }, "envelopesAtRisk").score).toBe(25);
    const p = part(
      { daysToNextIncome: 10, envelopes: [{ balanceSen: 999, spent30Sen: 3000 }, { balanceSen: 1000, spent30Sen: 3000 }, { balanceSen: 0, spent30Sen: 0 }] },
      "envelopesAtRisk",
    );
    expect(p.score).toBe(13); // 1 of 2 → 12.5
    expect(p.detail).toBe("1 of 2 envelopes may run out before next income.");
    expect(isAtRisk({ balanceSen: 1000, spent30Sen: 3000 }, 10)).toBe(false); // exactly 10 days left
    expect(isAtRisk({ balanceSen: 999, spent30Sen: 3000 }, 10)).toBe(true);
    expect(isAtRisk({ balanceSen: 0, spent30Sen: 0 }, 10)).toBe(false);
  });

  it("buffer: target is 10% of spending with a RM 50 floor", () => {
    expect(part({ unallocatedSen: 2500 }, "buffer").score).toBe(13); // 2500/5000
    expect(part({ unallocatedSen: 5000 }, "buffer").score).toBe(25);
    expect(part({ unallocatedSen: -100 }, "buffer").score).toBe(0);
    const p = part({ unallocatedSen: 8000, spent30Sen: 120000 }, "buffer");
    expect(p.score).toBe(17); // 8000/12000 → 16.67
    expect(p.detail).toBe("RM 80.00 isn't needed before next income (unallocated plus envelope surplus); aim for RM 120.00.");
  });

  it("buffer: envelope money beyond its pace until next income counts, so full allocation is not penalised", () => {
    // Savings envelope (no spending): all 5000 is surplus. Food: needs 3000*10/30 = 1000, holds 1500 → 500 surplus.
    const envelopes = [
      { balanceSen: 5000, spent30Sen: 0 },
      { balanceSen: 1500, spent30Sen: 3000 },
    ];
    expect(part({ unallocatedSen: 0, envelopes, daysToNextIncome: 10 }, "buffer").score).toBe(25);
    // Food exactly at pace, nothing else: no buffer.
    expect(part({ unallocatedSen: 0, envelopes: [{ balanceSen: 1000, spent30Sen: 3000 }], daysToNextIncome: 10 }, "buffer").score).toBe(0);
    // Unallocated and surplus add up: 1000 + 1500 of a 5000 target → 12.5 → 13.
    expect(part({ unallocatedSen: 1000, envelopes: [{ balanceSen: 2500, spent30Sen: 3000 }], daysToNextIncome: 10 }, "buffer").score).toBe(13);
  });

  it("spendVsIncome: no income branches, 0.8 / 1.0 / 1.2 edges", () => {
    expect(part({ income30Sen: 0, spent30Sen: 0 }, "spendVsIncome").score).toBe(25);
    // No income but spending: scored on what you hold, full marks at two months of spending.
    expect(part({ income30Sen: 0, spent30Sen: 1000, totalSen: 0 }, "spendVsIncome").score).toBe(0);
    expect(part({ income30Sen: 0, spent30Sen: 1000, totalSen: 1000 }, "spendVsIncome").score).toBe(13); // 12.5
    expect(part({ income30Sen: 0, spent30Sen: 1000, totalSen: 2000 }, "spendVsIncome").score).toBe(25);
    expect(part({ income30Sen: 0, spent30Sen: 3000, totalSen: 4500 }, "spendVsIncome").detail).toBe(
      "No income in the last 30 days; what you have covers about 45 days of spending.",
    );
    expect(part({ income30Sen: 10000, spent30Sen: 8000 }, "spendVsIncome").score).toBe(25);
    expect(part({ income30Sen: 10000, spent30Sen: 10000 }, "spendVsIncome").score).toBe(13); // 12.5
    expect(part({ income30Sen: 10000, spent30Sen: 9000 }, "spendVsIncome").score).toBe(19); // 18.75
    expect(part({ income30Sen: 10000, spent30Sen: 12000 }, "spendVsIncome").score).toBe(0);
    expect(part({ income30Sen: 10000, spent30Sen: -500 }, "spendVsIncome").score).toBe(25);
    expect(part({ income30Sen: 10000, spent30Sen: 9200 }, "spendVsIncome").detail).toBe("You spent 92% of what came in over 30 days.");
  });

  it("bands: 75 healthy, 74 and 50 watch, 49 at risk", () => {
    // runway 25 (big total), envelopes 25 (none), spendVsIncome 0 (spent 10× income); buffer varies.
    const at = (input: Partial<HealthInput>) => computeHealth({ ...base, spent30Sen: 1000, income30Sen: 100, totalSen: 1_000_000, ...input })!;
    expect(at({ unallocatedSen: 5000 })).toMatchObject({ score: 75, band: "healthy" });
    expect(at({ unallocatedSen: 4800 })).toMatchObject({ score: 74, band: "watch" });
    expect(at({ unallocatedSen: 0 })).toMatchObject({ score: 50, band: "watch" });
    // runway 24: 960 sen at 1000 sen / 30 days covers 28.8 of 30 days
    expect(at({ unallocatedSen: 0, totalSen: 960 })).toMatchObject({ score: 49, band: "atRisk" });
    expect(computeHealth({ ...base, unallocatedSen: 5000 })).toMatchObject({ score: 100, band: "healthy" });
  });
});

describe("monthly bills (detected automatically)", () => {
  const T = "2026-11-10";
  it("treats one payment per calendar month as a bill due a month after the last", () => {
    const phone = [{ date: "2026-09-03", sen: 5800 }, { date: "2026-10-03", sen: 5800 }, { date: "2026-11-03", sen: 6000 }];
    expect(detectBill(phone, T)).toEqual({ nextDueOn: "2026-12-03", sen: 6000 });
    expect(detectBill([{ date: "2026-11-02", sen: 1000 }], T)).toEqual({ nextDueOn: "2026-12-02", sen: 1000 }); // a single payment counts
    expect(detectBill([{ date: "2026-01-31", sen: 1000 }], "2026-02-15")).toEqual({ nextDueOn: "2026-02-28", sen: 1000 }); // clamps
  });
  it("keeps day-to-day envelopes (two spend days in a month) on the pace model, and ignores old or empty days", () => {
    expect(detectBill([{ date: "2026-11-02", sen: 500 }, { date: "2026-11-06", sen: 500 }], T)).toBeNull();
    expect(detectBill([{ date: "2026-11-02", sen: 900, count: 3 }], T)).toBeNull(); // three spends on one day
    expect(detectBill([], T)).toBeNull();
    expect(detectBill([{ date: "2026-07-01", sen: 500 }], T)).toBeNull(); // over 90 days ago
    expect(detectBill([{ date: "2026-11-20", sen: 500 }], T)).toBeNull(); // future-dated
  });
  it("an empty bill envelope already paid this month is not at risk; one due before next income and short is", () => {
    const paid = { balanceSen: 0, spent30Sen: 6000, bill: { dueInDays: 23, sen: 6000 } }; // the screenshot case
    expect(isAtRisk(paid, 20)).toBe(false);
    expect(envelopeNeedSen(paid, 20)).toBe(0);
    expect(isAtRisk({ ...paid, bill: { dueInDays: 5, sen: 6000 } }, 20)).toBe(true);
    expect(isAtRisk({ balanceSen: 6000, spent30Sen: 0, bill: { dueInDays: -2, sen: 6000 } }, 20)).toBe(false); // overdue but covered
    expect(isAtRisk({ balanceSen: 100, spent30Sen: 0, bill: { dueInDays: 0, sen: 6000 } }, 20)).toBe(true);
  });
  it("paid bills stop dragging the envelopes part down, and their surplus counts as buffer", () => {
    const env = [
      { balanceSen: 0, spent30Sen: 6000, bill: { dueInDays: 23, sen: 6000 } },
      { balanceSen: 0, spent30Sen: 20000, bill: { dueInDays: 25, sen: 20000 } },
      { balanceSen: 30000, spent30Sen: 30000 },
    ];
    const p = part({ envelopes: env, daysToNextIncome: 20 }, "envelopesAtRisk");
    expect(p.score).toBe(25);
    expect(p.detail).toBe("None of the 3 envelopes you spend from should run out before next income.");
  });
});
