import "./setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { archiveEnvelope, createEnvelope } from "@/server/envelopes/service";
import { getDashboard, getEnvelopeGrid, getEnvelopesInsights, getMonthInsights } from "@/server/insights/service";
import * as ledger from "@/server/ledger/service";
import { getPreferences, setPreferences } from "@/server/preferences/service";
import { addDays, addMonths, startOfMonth, startOfWeek, todayKL } from "@/lib/dates";
import { cleanupTestUsers, makeTestUser, testDb } from "./helpers";

// Every date is relative to today (Kuala Lumpur) so the suite holds on any day of any month.
const today = todayKL();
const twoMonthsAgo = startOfMonth(addMonths(today, -2)); // always on or before today − 30
const lastMonth = startOfMonth(addMonths(today, -1));
const weekday = (iso: string) => (new Date(Date.parse(iso)).getUTCDay() + 6) % 7;

let user: { id: string };
let other: { id: string };
let food: string, fun: string, bills: string, old: string, theirs: string;

const expenseId = async (userId: string, amountSen: number) =>
  (await testDb.transaction.findFirstOrThrow({ where: { userId, type: "EXPENSE", amountSen } })).id;

beforeAll(async () => {
  expect(db).toBe(testDb);
  user = await makeTestUser();
  other = await makeTestUser();
  const env = async (userId: string, name: string) => (await createEnvelope(userId, { name, colour: "#81B29A", targetSen: null })).id;
  [food, fun, bills, old] = [await env(user.id, "Food"), await env(user.id, "Fun"), await env(user.id, "Bills"), await env(user.id, "Old")];

  await ledger.recordIncome(user.id, { amountSen: 300000, occurredOn: twoMonthsAgo });
  await ledger.allocate(user.id, {
    occurredOn: twoMonthsAgo,
    items: [
      { envelopeId: food, amountSen: 100000 },
      { envelopeId: fun, amountSen: 50000 },
      { envelopeId: bills, amountSen: 10000 },
      { envelopeId: old, amountSen: 2500 },
    ],
  });
  await ledger.recordExpense(user.id, { amountSen: 3000, envelopeId: food, occurredOn: lastMonth });
  await ledger.recordIncome(user.id, { amountSen: 100000, occurredOn: today });
  await ledger.recordExpense(user.id, { amountSen: 1500, envelopeId: food, occurredOn: today });
  await ledger.recordExpense(user.id, { amountSen: 5000, envelopeId: food, occurredOn: today, merchant: "Shop" });
  await ledger.recordRefund(user.id, { expenseId: await expenseId(user.id, 5000), amountSen: 2000, occurredOn: today });
  await ledger.recordExpense(user.id, { amountSen: 1800, envelopeId: fun, occurredOn: today });
  await ledger.recordExpense(user.id, { amountSen: 1000, envelopeId: food, occurredOn: today });
  await ledger.voidTransaction(user.id, { id: await expenseId(user.id, 1000) });
  await ledger.recordExpense(user.id, { amountSen: 2500, envelopeId: old, occurredOn: today });
  await archiveEnvelope(user.id, old);

  // A second user's money must never leak into the first user's numbers.
  theirs = await env(other.id, "Theirs");
  await ledger.recordIncome(other.id, { amountSen: 50000, occurredOn: today });
  await ledger.allocate(other.id, { occurredOn: today, items: [{ envelopeId: theirs, amountSen: 20000 }] });
  await ledger.recordExpense(other.id, { amountSen: 999, envelopeId: theirs, occurredOn: today });
});

afterAll(async () => {
  await cleanupTestUsers();
  await testDb.$disconnect();
});

// This month for the user: income 100000; spent Food 1500 + 5000 − 2000 = 4500, Fun 1800, Old 2500 (archived) = 8800.
// Last month: Food 3000. Two months ago: income 300000. The voided 1000 never counts.

describe("getDashboard", () => {
  it("month: in, out, net, cash flow and spending by envelope", async () => {
    const d = await getDashboard(user.id, "month");
    expect(d).toMatchObject({ range: "month", start: startOfMonth(today), end: today, inSen: 100000, outSen: 8800, netFlowSen: 91200 });
    expect(d.cashFlow).toHaveLength(Number(today.slice(8)));
    expect(d.cashFlow[0].date).toBe(startOfMonth(today));
    expect(d.cashFlow.at(-1)).toEqual({ date: today, cumulativeNetSen: d.netFlowSen });
    expect(d.spentByEnvelope.map((s) => [s.name, s.spentSen])).toEqual([
      ["Food", 4500],
      ["Old", 2500],
      ["Fun", 1800],
    ]);
    expect(d.envelopes.map((e) => e.envelopeId)).toEqual([food, fun, bills]);
    // One spend in 90 days reads as a monthly bill: due again in a month, already covered.
    expect(d.envelopes.find((e) => e.envelopeId === fun)).toMatchObject({
      balanceSen: 48200,
      spent30Sen: 1800,
      daysLeft: null,
      bill: { dueOn: addMonths(today, 1), sen: 1800 },
      atRisk: false,
    });
    const food30 = d.envelopes.find((e) => e.envelopeId === food)!;
    expect(food30.bill).toBeNull(); // several spend days this month: day-to-day spending
    expect(food30.daysLeft).not.toBeNull();
    expect(d.envelopes.find((e) => e.envelopeId === bills)).toMatchObject({ spent30Sen: 0, daysLeft: null, atRisk: false });
    expect(d.balances.unallocatedSen + Object.values(d.balances.envelopes).reduce((s, v) => s + v, 0)).toBe(d.balances.totalSen);
    expect(d.recent).toHaveLength(5);
    expect(d.health).not.toBeNull();
    expect(d.health!.score).toBe(d.health!.parts.reduce((s, p) => s + p.score, 0));
    expect(typeof d.healthLastMonth).toBe("number"); // there was activity on or before today − 30
  });

  it("week and year ranges", async () => {
    const w = await getDashboard(user.id, "week");
    expect(w).toMatchObject({ start: startOfWeek(today), inSen: 100000, outSen: 8800 });
    expect(w.cashFlow.at(-1)!.cumulativeNetSen).toBe(w.netFlowSen);

    const y = await getDashboard(user.id, "year");
    expect(y).toMatchObject({ start: startOfMonth(addMonths(today, -11)), inSen: 400000, outSen: 11800, netFlowSen: 388200 });
    expect(y.cashFlow).toHaveLength(12);
    expect(y.cashFlow.at(-1)).toEqual({ date: today, cumulativeNetSen: 388200 });
    expect(y.cashFlow[10].date).toBe(addDays(startOfMonth(today), -1)); // last day of last month
  });

  it("only ever sees the signed-in user's data", async () => {
    const d = await getDashboard(other.id, "month");
    expect(d).toMatchObject({ inSen: 50000, outSen: 999, healthLastMonth: null });
    expect(d.spentByEnvelope).toEqual([{ envelopeId: theirs, name: "Theirs", colour: "#81B29A", spentSen: 999 }]);
    expect(d.envelopes.map((e) => e.envelopeId)).toEqual([theirs]);
    expect(d.recent.every((t) => [theirs, null].includes(t.envelopeId ?? t.toEnvelopeId))).toBe(true);
  });
});

describe("getEnvelopesInsights", () => {
  it("spending: 12 months, change vs last month, movement, priciest weekday, small spends", async () => {
    const s = await getEnvelopesInsights(user.id, "spending");
    expect(s.months).toHaveLength(12);
    expect(s.months[11].month).toBe(today.slice(0, 7));
    expect(s.months[0].month).toBe(addMonths(today, -11).slice(0, 7));
    expect(s.months.map((m) => m.label).join("")).toMatch(/^[JFMASOND]{12}$/);
    expect(s.months.slice(9).map((m) => m.sen)).toEqual([0, 3000, 8800]);
    expect(s).toMatchObject({ thisMonthSen: 8800, changePct: 193 });
    expect(s.movement.map((m) => [m.envelopeId, m.thisMonthSen, m.changePct])).toEqual([
      [food, 4500, 50],
      [fun, 1800, null],
      [bills, 0, null],
    ]);
    expect(s.smallSpends).toEqual({ countThisMonth: 2, sumSen: 3300 }); // 1500 + 1800; the voided 1000 is out

    // Today's weekday carries 8800 (+3000 when last month's 1st shares it) over 12 or 13 such days.
    const start90 = addDays(today, -89);
    let count = 0;
    for (let i = 0; i < 90; i++) if (weekday(addDays(start90, i)) === weekday(today)) count++;
    const total = 8800 + (weekday(lastMonth) === weekday(today) ? 3000 : 0);
    expect(s.priciestWeekday).toEqual({ weekday: weekday(today), avgSen: Math.round(total / count) });
  });

  it("income and cash flow views; changePct is null when last month is 0", async () => {
    const i = await getEnvelopesInsights(user.id, "income");
    expect(i.months.slice(9).map((m) => m.sen)).toEqual([300000, 0, 100000]);
    expect(i).toMatchObject({ view: "income", thisMonthSen: 100000, changePct: null });

    const c = await getEnvelopesInsights(user.id, "cashflow");
    expect(c.months.slice(9).map((m) => m.sen)).toEqual([300000, -3000, 91200]);
    expect(c).toMatchObject({ thisMonthSen: 91200, changePct: 3140 });
  });

  it("is empty for a user with no history and never mixes users", async () => {
    const s = await getEnvelopesInsights(other.id, "spending");
    expect(s).toMatchObject({ thisMonthSen: 999, changePct: null, smallSpends: { countThisMonth: 1, sumSen: 999 } });
    expect(s.movement.map((m) => m.envelopeId)).toEqual([theirs]);
    const fresh = await makeTestUser();
    const f = await getEnvelopesInsights(fresh.id, "spending");
    expect(f).toMatchObject({ thisMonthSen: 0, changePct: null, movement: [], priciestWeekday: null, smallSpends: { countThisMonth: 0, sumSen: 0 } });
    expect(await getDashboard(fresh.id, "month")).toMatchObject({ health: null, healthLastMonth: null, inSen: 0, spentByEnvelope: [] });
  });
});

describe("getEnvelopeGrid", () => {
  it("8 Monday–Sunday weeks ending with this one; active envelopes only", async () => {
    const g = await getEnvelopeGrid(user.id);
    expect(g.weeks).toHaveLength(8);
    g.weeks.forEach((w, i) => {
      expect(weekday(w.start)).toBe(0);
      expect(w.end).toBe(addDays(w.start, 6));
      if (i > 0) expect(w.start).toBe(addDays(g.weeks[i - 1].start, 7));
    });
    expect(g.weeks[7].start <= today && today <= g.weeks[7].end).toBe(true);
    expect(g.weeks[7].label).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
    expect(g.rows.map((r) => r.envelopeId)).toEqual([food, fun, bills]);
    for (const r of g.rows) expect(r.spentSen).toHaveLength(8);
    expect(g.rows.map((r) => r.spentSen[7])).toEqual([4500, 1800, 0]);

    const theirsGrid = await getEnvelopeGrid(other.id);
    expect(theirsGrid.rows.map((r) => [r.envelopeId, r.spentSen[7]])).toEqual([[theirs, 999]]);
  });
});

describe("getMonthInsights", () => {
  const daysIn = (month: string) => Number(addDays(startOfMonth(addMonths(`${month}-01`, 1)), -1).slice(8));
  const thisMonth = today.slice(0, 7);
  // mu: 12 expenses in A of 100..1200 sen with messy merchants, plus B 2000 and a voided 3000; T has a target and no spending.
  let mu: { id: string };
  let a: string, b: string, t: string;
  const merchants: Record<number, string | undefined> = {
    12: "Grab", 11: "  grab ", 10: "Grab", 9: "Kedai Ali", 8: "Kedai Ali", 7: "KEDAI ALI", 6: "A", 5: "B", 4: "C", 3: "D", 2: "   ",
  };

  beforeAll(async () => {
    mu = await makeTestUser();
    const env = async (name: string, targetSen: number | null) => (await createEnvelope(mu.id, { name, colour: null, targetSen })).id;
    [a, b, t] = [await env("A", 30000), await env("B", null), await env("T", 10000)];
    const x = await env("X", 5000);
    await archiveEnvelope(mu.id, x); // archived, target, no spending: left out
    await ledger.recordIncome(mu.id, { amountSen: 500000, occurredOn: today });
    await ledger.allocate(mu.id, { occurredOn: today, items: [{ envelopeId: a, amountSen: 200000 }, { envelopeId: b, amountSen: 100000 }] });
    for (let i = 1; i <= 12; i++) {
      await ledger.recordExpense(mu.id, { amountSen: i * 100, envelopeId: a, occurredOn: today, merchant: merchants[i] });
    }
    await ledger.recordExpense(mu.id, { amountSen: 2000, envelopeId: b, occurredOn: today });
    await ledger.recordExpense(mu.id, { amountSen: 3000, envelopeId: b, occurredOn: today, merchant: "Grab" });
    await ledger.voidTransaction(mu.id, { id: await expenseId(mu.id, 3000) });
  });

  it("summarises a month with spending, a refund and a voided row, compared with earlier months", async () => {
    const m = await getMonthInsights(user.id, { month: thisMonth });
    expect(m).toMatchObject({ month: thisMonth, start: startOfMonth(today), end: today, spentSen: 8800, incomeSen: 100000, netSen: 91200 });
    expect(m.label).toMatch(/^[A-Z][a-z]+ \d{4}$/);
    // last month 3000; avg of the 3 months before = (3000 + 0 + 0) / 3 = 1000
    expect(m.compare).toEqual({ lastMonthSpentSen: 3000, avg3SpentSen: 1000, changePct: 193, vsAvg3Pct: 780 });
    expect(m.daily).toHaveLength(Number(today.slice(8)));
    expect(m.daily.at(-1)).toEqual({ date: today, spentSen: 8800 });
    expect(m.daily.reduce((s, d) => s + d.spentSen, 0)).toBe(8800);
    expect(m.byEnvelope.map((e) => [e.name, e.spentSen, e.lastMonthSen, e.avg3Sen, e.changePct])).toEqual([
      ["Food", 4500, 3000, 1000, 50],
      ["Old", 2500, 0, 0, null], // archived, but it has spending
      ["Fun", 1800, 0, 0, null],
    ]); // Bills: no spending, no target
    expect(m.topExpenses.map((e) => e.amountSen)).toEqual([5000, 2500, 1800, 1500]); // voided 1000 left out
    expect(m.topExpenses[0]).toMatchObject({ type: "EXPENSE", merchant: "Shop", refundedSen: 2000, correctedById: null });
    expect(m.topMerchants).toEqual([{ merchant: "Shop", spentSen: 5000, count: 1 }]);
    expect(m.envelope).toBeNull();
  });

  it("past month: full length, null compare when the earlier months are 0", async () => {
    const m = await getMonthInsights(user.id, { month: lastMonth.slice(0, 7) });
    expect(m).toMatchObject({ end: addDays(startOfMonth(today), -1), spentSen: 3000, incomeSen: 0 });
    expect(m.compare).toEqual({ lastMonthSpentSen: 0, avg3SpentSen: 0, changePct: null, vsAvg3Pct: null });
    expect(m.daily).toHaveLength(daysIn(lastMonth.slice(0, 7)));
  });

  it("top 10 expenses, top 5 merchants grouped across case and whitespace, envelopes with a target", async () => {
    const m = await getMonthInsights(mu.id, { month: thisMonth });
    expect(m.topExpenses.map((e) => e.amountSen)).toEqual([2000, 1200, 1100, 1000, 900, 800, 700, 600, 500, 400]);
    expect(m.topMerchants).toEqual([
      { merchant: "Grab", spentSen: 3300, count: 3 }, // the voided 3000 at "Grab" is out
      { merchant: "Kedai Ali", spentSen: 2400, count: 3 },
      { merchant: "A", spentSen: 600, count: 1 },
      { merchant: "B", spentSen: 500, count: 1 },
      { merchant: "C", spentSen: 400, count: 1 },
    ]);
    expect(m.byEnvelope.map((e) => [e.envelopeId, e.spentSen])).toEqual([[a, 7800], [b, 2000], [t, 0]]);
  });

  it("envelope drill-down: own, archived, foreign and unknown ids", async () => {
    const own = await getMonthInsights(user.id, { month: thisMonth, envelopeId: food });
    expect(own.envelope).toMatchObject({ envelopeId: food, name: "Food", balanceSen: 92500, spentSen: 4500 });
    expect(own.envelope!.sixMonths).toHaveLength(6);
    expect(own.envelope!.sixMonths.at(-1)).toMatchObject({ month: thisMonth, sen: 4500 });
    expect(own.envelope!.sixMonths.at(-2)).toMatchObject({ month: lastMonth.slice(0, 7), sen: 3000 });
    expect(own.envelope!.expenses.map((e) => e.amountSen)).toEqual([5000, 1500]); // newest first; voided out

    const archived = await getMonthInsights(user.id, { month: thisMonth, envelopeId: old });
    expect(archived.envelope).toMatchObject({ envelopeId: old, balanceSen: 0, spentSen: 2500 });

    expect((await getMonthInsights(user.id, { month: thisMonth, envelopeId: theirs })).envelope).toBeNull();
    expect((await getMonthInsights(user.id, { month: thisMonth, envelopeId: "nope" })).envelope).toBeNull();
  });

  it("works 14 months back and never mixes users", async () => {
    const h = await makeTestUser();
    const month = addMonths(today, -14).slice(0, 7);
    const day = `${month}-01`;
    const e = (await createEnvelope(h.id, { name: "E", colour: null, targetSen: null })).id;
    await ledger.recordIncome(h.id, { amountSen: 10000, occurredOn: day });
    await ledger.allocate(h.id, { occurredOn: day, items: [{ envelopeId: e, amountSen: 5000 }] });
    await ledger.recordExpense(h.id, { amountSen: 1234, envelopeId: e, occurredOn: day, merchant: "Old shop" });
    const m = await getMonthInsights(h.id, { month, envelopeId: e });
    expect(m).toMatchObject({ start: day, spentSen: 1234, incomeSen: 10000, netSen: 8766 });
    expect(m.daily).toHaveLength(daysIn(month));
    expect(m.compare).toEqual({ lastMonthSpentSen: 0, avg3SpentSen: 0, changePct: null, vsAvg3Pct: null });
    expect(m.topMerchants).toEqual([{ merchant: "Old shop", spentSen: 1234, count: 1 }]);
    expect(m.envelope!.sixMonths.map((s) => s.sen)).toEqual([0, 0, 0, 0, 0, 1234]);

    const theirsMonth = await getMonthInsights(other.id, { month: thisMonth });
    expect(theirsMonth).toMatchObject({ spentSen: 999, incomeSen: 50000 });
    expect(theirsMonth.byEnvelope.map((x) => x.envelopeId)).toEqual([theirs]);
    expect(theirsMonth.topExpenses.map((x) => x.amountSen)).toEqual([999]);
  });

  it("refuses a future month", async () => {
    await expect(getMonthInsights(user.id, { month: addMonths(today, 1).slice(0, 7) })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("preferences", () => {
  it("defaults without a row, falls back per field on bad values, and upserts", async () => {
    const u = await makeTestUser();
    expect(await getPreferences(u.id)).toEqual({ theme: "modern", mode: "system" });
    await testDb.preference.create({ data: { userId: u.id, theme: "neon", mode: "dark" } });
    expect(await getPreferences(u.id)).toEqual({ theme: "modern", mode: "dark" });
    await setPreferences(u.id, { theme: "pixel", mode: "light" });
    expect(await getPreferences(u.id)).toEqual({ theme: "pixel", mode: "light" });

    const v = await makeTestUser();
    await setPreferences(v.id, { theme: "retro", mode: "dark" });
    expect(await getPreferences(v.id)).toEqual({ theme: "retro", mode: "dark" });
    expect(await getPreferences(u.id)).toEqual({ theme: "pixel", mode: "light" });
  });
});
