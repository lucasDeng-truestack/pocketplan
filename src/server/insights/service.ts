import "server-only";
import type { Transaction } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { listActiveEnvelopesCached, listEnvelopeLabels } from "@/server/envelopes/service";
import { getBalances, getCurrentBalances } from "@/server/ledger/balances";
import { dbDateToIso, isoToDbDate } from "@/server/ledger/dates";
import { listTransactions } from "@/server/ledger/service";
import { listRecurring } from "@/server/recurring/service";
import { addDays, addMonths, daysBetween, formatISODate, startOfMonth, startOfWeek, todayKL } from "@/lib/dates";
import { computeHealth, detectBill, isAtRisk, type Bill, type HealthInput } from "@/lib/health";
import type {
  Balances,
  DashboardData,
  DashboardRange,
  EnvelopeGrid,
  EnvelopesInsights,
  ISODate,
  InsightsView,
  MonthInsights,
  RecurringView,
  Sen,
  TransactionType,
  TransactionView,
} from "@/lib/types";

// "spent" = non-voided EXPENSE − non-voided REFUND; "income" = non-voided INCOME; net = income − spent.

const MAX_DAYS = 92;
const MAX_MONTHS = 13;
const MONTH_LETTERS = "JFMAMJJASOND";

/** key is "YYYY-MM-DD" (day) or "YYYY-MM" (month). small* count EXPENSE-sized rows under RM 20 in the group. */
type Agg = { key: string; type: TransactionType; envelopeId: string | null; sen: Sen; count: number; smallCount: number; smallSen: Sen };

const endOfMonth = (iso: ISODate) => addDays(startOfMonth(addMonths(iso, 1)), -1);
const weekday = (iso: ISODate) => daysBetween(startOfWeek(iso), iso); // 0 = Monday
const spentOf = (a: Agg): Sen => (a.type === "EXPENSE" ? a.sen : a.type === "REFUND" ? -a.sen : 0);
const incomeOf = (a: Agg): Sen => (a.type === "INCOME" ? a.sen : 0);
const pct = (now: Sen, before: Sen) => (before === 0 ? null : Math.round(((now - before) / Math.abs(before)) * 100));

function sum(rows: Agg[], value: (a: Agg) => Sen, keep: (a: Agg) => boolean = () => true): Sen {
  return rows.reduce((s, a) => (keep(a) ? s + value(a) : s), 0);
}

function spentByEnvelope(rows: Agg[], keep: (a: Agg) => boolean): Map<string, Sen> {
  const out = new Map<string, Sen>();
  for (const a of rows) if (a.envelopeId && keep(a)) out.set(a.envelopeId, (out.get(a.envelopeId) ?? 0) + spentOf(a));
  return out;
}

/** The 30 days ending on `end`, inclusive. */
const in30 = (end: ISODate) => (a: Agg) => a.key > addDays(end, -30) && a.key <= end;

/**
 * Non-voided INCOME / EXPENSE / REFUND sums grouped by day or month × type × envelope, for one user.
 * Bounded: at most 92 days or 13 months, so at most a few rows per envelope per bucket.
 */
async function aggregate(userId: string, unit: "day" | "month", start: ISODate, end: ISODate): Promise<Agg[]> {
  const tooWide = unit === "day" ? daysBetween(start, end) >= MAX_DAYS : start < startOfMonth(addMonths(end, 1 - MAX_MONTHS));
  if (tooWide) throw new Error(`insights: ${unit} aggregate ${start}..${end} exceeds its bound`);
  const keyLength = unit === "day" ? 10 : 7; // DATE::text is YYYY-MM-DD
  const rows = await db.$queryRaw<
    { key: string; type: TransactionType; envelopeId: string | null; sen: bigint; count: bigint; smallCount: bigint; smallSen: bigint }[]
  >`
    SELECT left("occurredOn"::text, ${keyLength}::int) AS key, type, "envelopeId",
      SUM("amountSen")::bigint AS sen,
      COUNT(*)::bigint AS count,
      COUNT(*) FILTER (WHERE "amountSen" < 2000)::bigint AS "smallCount",
      COALESCE(SUM("amountSen") FILTER (WHERE "amountSen" < 2000), 0)::bigint AS "smallSen"
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "voidedAt" IS NULL AND type IN ('INCOME', 'EXPENSE', 'REFUND')
      AND "occurredOn" BETWEEN ${start}::date AND ${end}::date
    GROUP BY 1, 2, 3`;
  return rows.map((r) => ({ ...r, sen: Number(r.sen), count: Number(r.count), smallCount: Number(r.smallCount), smallSen: Number(r.smallSen) }));
}

/** Any non-voided entry at all, and any dated on or before `asOf`. */
async function activity(userId: string, asOf: ISODate): Promise<{ any: boolean; asOf: boolean }> {
  const [row] = await db.$queryRaw<{ any: boolean; asOf: boolean }[]>`
    SELECT
      EXISTS (SELECT 1 FROM "Transaction" WHERE "userId" = ${userId} AND "voidedAt" IS NULL) AS "any",
      EXISTS (SELECT 1 FROM "Transaction" WHERE "userId" = ${userId} AND "voidedAt" IS NULL
              AND "occurredOn" <= ${asOf}::date) AS "asOf"`;
  return row;
}

/** Active envelopes in the same order as envelopes/service.ts, without the balance scan these views don't need. */
function activeEnvelopes(userId: string) {
  // Unbounded on purpose, like listEnvelopes: one person's envelopes number in the tens.
  return db.envelope.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, colour: true, targetSen: true },
  });
}

/** Once-a-month envelopes as of `asOf`: repeats you set up win; otherwise detected from the daily spending rows. */
function billsAsOf(daily: Agg[], asOf: ISODate, envelopeIds: string[], repeats: RecurringView[], daysToNextIncome: number): Map<string, Bill & { dueOn: ISODate }> {
  const bills = new Map<string, Bill & { dueOn: ISODate }>();
  const horizon = addDays(asOf, daysToNextIncome);
  for (const id of envelopeIds) {
    const own = repeats.filter((r) => r.kind === "EXPENSE" && r.envelopeId === id && !r.pausedAt);
    if (own.length > 0) {
      const dueOn = own.map((r) => r.nextDueOn).sort()[0];
      const dueByIncome = own.filter((r) => r.nextDueOn <= horizon).reduce((sum, r) => sum + r.amountSen, 0);
      const sen = dueByIncome || own.find((r) => r.nextDueOn === dueOn)!.amountSen;
      bills.set(id, { dueOn, dueInDays: daysBetween(asOf, dueOn), sen });
      continue;
    }
    const days = daily.filter((a) => a.envelopeId === id && a.type === "EXPENSE" && a.key <= asOf).map((a) => ({ date: a.key, sen: a.sen, count: a.count }));
    const bill = detectBill(days, asOf);
    if (bill) bills.set(id, { dueOn: bill.nextDueOn, dueInDays: daysBetween(asOf, bill.nextDueOn), sen: bill.sen });
  }
  return bills;
}

function healthInput(
  balances: Balances,
  envelopeIds: string[],
  daily: Agg[],
  windowEnd: ISODate,
  daysToNextIncome: number,
  hasActivity: boolean,
  bills: Map<string, Bill>,
): HealthInput {
  const keep = in30(windowEnd);
  const spent = spentByEnvelope(daily, keep);
  return {
    totalSen: balances.totalSen,
    unallocatedSen: balances.unallocatedSen,
    spent30Sen: sum(daily, spentOf, keep),
    income30Sen: sum(daily, incomeOf, keep),
    daysToNextIncome,
    envelopes: envelopeIds.map((id) => ({ balanceSen: balances.envelopes[id] ?? 0, spent30Sen: spent.get(id) ?? 0, bill: bills.get(id) ?? null })),
    hasActivity,
  };
}

export async function getDashboard(userId: string, range: DashboardRange): Promise<DashboardData> {
  const today = todayKL();
  const then = addDays(today, -30);
  const start = range === "week" ? startOfWeek(today) : range === "month" ? startOfMonth(today) : startOfMonth(addMonths(today, -11));
  const [balances, balancesThen, envelopes, daily, monthly, recurring, recent, active] = await Promise.all([
    getCurrentBalances(userId), // shared with the (app) layout for this request
    getBalances(userId, then),
    listActiveEnvelopesCached(userId), // same cached balances snapshot
    // 90 days: bill detection (one payment a month for 3 months), both 30-day windows, and any week or month range.
    aggregate(userId, "day", addDays(today, -89), today),
    range === "year" ? aggregate(userId, "month", start, today) : Promise.resolve([]),
    listRecurring(userId),
    listTransactions(userId, { limit: 5 }),
    activity(userId, then),
  ]);

  const rangeRows = range === "year" ? monthly : daily.filter((a) => a.key >= start);
  const inSen = sum(rangeRows, incomeOf);
  const outSen = sum(rangeRows, spentOf);

  const keys =
    range === "year"
      ? Array.from({ length: 12 }, (_, i) => addMonths(start, i).slice(0, 7))
      : Array.from({ length: daysBetween(start, today) + 1 }, (_, i) => addDays(start, i));
  const netByKey = new Map<string, Sen>();
  for (const a of rangeRows) netByKey.set(a.key, (netByKey.get(a.key) ?? 0) + incomeOf(a) - spentOf(a));
  let running = 0;
  const cashFlow = keys.map((key) => {
    running += netByKey.get(key) ?? 0;
    const date = key.length === 7 ? endOfMonth(`${key}-01`) : key;
    return { date: date > today ? today : date, cumulativeNetSen: running };
  });

  const rangeSpent = [...spentByEnvelope(rangeRows, () => true)].filter(([, sen]) => sen > 0);
  const labels = new Map<string, { name: string; colour: string | null }>(envelopes.map((e) => [e.id, e]));
  if (rangeSpent.some(([id]) => !labels.has(id))) {
    for (const e of await listEnvelopeLabels(userId)) labels.set(e.id, e); // archived and deleted envelopes with spending in range
  }
  const spentByEnvelopeList = rangeSpent
    .map(([envelopeId, spentSen]) => ({
      envelopeId,
      name: labels.get(envelopeId)?.name ?? "Envelope",
      colour: labels.get(envelopeId)?.colour ?? null,
      spentSen,
    }))
    .sort((a, b) => b.spentSen - a.spentSen);

  const nextIncome = recurring
    .filter((r) => r.kind === "INCOME" && !r.pausedAt && r.nextDueOn >= today)
    .map((r) => r.nextDueOn)
    .sort()[0];
  // At least 1: income due today still counts as one day to cover.
  const daysToNextIncome = Math.max(1, daysBetween(today, nextIncome ?? endOfMonth(today)));
  // Same horizon as today's score, so the month-on-month change reflects money, not a different method.
  const daysToNextIncomeThen = daysToNextIncome;

  const ids = envelopes.map((e) => e.id);
  const bills = billsAsOf(daily, today, ids, recurring, daysToNextIncome);
  // shortcut: last month detects bills from the same 90-day rows (so its 3-month lookback is cut short) and ignores repeats; upgrade if the change arrow misleads.
  const billsThen = billsAsOf(daily, then, ids, [], daysToNextIncomeThen);
  const health = computeHealth(healthInput(balances, ids, daily, today, daysToNextIncome, active.any, bills));
  // shortcut: last month uses today's active envelopes (balances as of then), so ones archived since are left out; upgrade if that skews scores.
  const healthThen = computeHealth(healthInput(balancesThen, ids, daily, then, daysToNextIncomeThen, active.asOf, billsThen));

  const spent30 = spentByEnvelope(daily, in30(today));
  const soon = addDays(today, 7);
  return {
    range,
    start,
    end: today,
    balances,
    health,
    healthLastMonth: healthThen?.score ?? null,
    netFlowSen: inSen - outSen,
    inSen,
    outSen,
    cashFlow,
    spentByEnvelope: spentByEnvelopeList,
    unassignedSpentSen: sum(rangeRows, spentOf, (a) => a.envelopeId === null),
    envelopes: envelopes.map((e) => {
      const s = spent30.get(e.id) ?? 0;
      const bill = bills.get(e.id) ?? null;
      return {
        envelopeId: e.id,
        name: e.name,
        colour: e.colour,
        balanceSen: e.balanceSen,
        targetSen: e.targetSen,
        spent30Sen: s,
        daysLeft: bill || s === 0 ? null : Math.floor((e.balanceSen * 30) / s),
        bill: bill ? { dueOn: bill.dueOn, sen: bill.sen } : null,
        atRisk: isAtRisk({ balanceSen: e.balanceSen, spent30Sen: s, bill }, daysToNextIncome),
      };
    }),
    due: recurring
      .filter((r) => !r.pausedAt && r.nextDueOn <= soon)
      .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn)),
    recent: recent.items,
  };
}

export async function getEnvelopesInsights(userId: string, view: InsightsView): Promise<EnvelopesInsights> {
  const today = todayKL();
  const first = startOfMonth(addMonths(today, -11));
  const last90 = addDays(today, -89);
  const [envelopes, monthly, daily] = await Promise.all([
    activeEnvelopes(userId),
    aggregate(userId, "month", first, today),
    aggregate(userId, "day", last90, today),
  ]);

  const value = (a: Agg) => (view === "spending" ? spentOf(a) : view === "income" ? incomeOf(a) : incomeOf(a) - spentOf(a));
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(first, i).slice(0, 7);
    return { month, label: MONTH_LETTERS[Number(month.slice(5)) - 1], sen: sum(monthly, value, (a) => a.key === month) };
  });
  const thisMonthSen = months[11].sen;

  const thisKey = today.slice(0, 7);
  const lastKey = addMonths(today, -1).slice(0, 7);
  const spentThis = spentByEnvelope(monthly, (a) => a.key === thisKey);
  const spentLast = spentByEnvelope(monthly, (a) => a.key === lastKey);
  const movement = envelopes
    .map((e) => {
      const now = spentThis.get(e.id) ?? 0;
      return { envelopeId: e.id, name: e.name, colour: e.colour, thisMonthSen: now, changePct: pct(now, spentLast.get(e.id) ?? 0) };
    })
    .sort((a, b) => b.thisMonthSen - a.thisMonthSen);

  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 90; i++) counts[weekday(addDays(last90, i))]++;
  for (const a of daily) totals[weekday(a.key)] += spentOf(a);
  let best = 0;
  for (let w = 1; w < 7; w++) if (totals[w] / counts[w] > totals[best] / counts[best]) best = w;
  const priciestWeekday = totals[best] > 0 ? { weekday: best, avgSen: Math.round(totals[best] / counts[best]) } : null;

  const monthStart = startOfMonth(today);
  const small = daily.filter((a) => a.type === "EXPENSE" && a.key >= monthStart);
  return {
    view,
    months,
    thisMonthSen,
    changePct: pct(thisMonthSen, months[10].sen),
    movement,
    priciestWeekday,
    smallSpends: { countThisMonth: small.reduce((s, a) => s + a.smallCount, 0), sumSen: sum(small, (a) => a.smallSen) },
  };
}

export async function getEnvelopeGrid(userId: string): Promise<EnvelopeGrid> {
  const today = todayKL();
  const first = addDays(startOfWeek(today), -49);
  const [envelopes, daily] = await Promise.all([activeEnvelopes(userId), aggregate(userId, "day", first, today)]);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(first, 7 * i);
    return { start, end: addDays(start, 6), label: formatISODate(start).replace(/ \d{4}$/, "") };
  });
  return {
    weeks,
    rows: envelopes.map((e) => ({
      envelopeId: e.id,
      name: e.name,
      colour: e.colour,
      targetSen: e.targetSen,
      spentSen: weeks.map((w) => sum(daily, spentOf, (a) => a.envelopeId === e.id && a.key >= w.start && a.key <= w.end)),
    })),
  };
}

const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** Non-voided expense rows as TransactionView (same mapping as reports/build.ts), with their non-voided refund sums. */
async function expenseViews(userId: string, rows: Transaction[]): Promise<TransactionView[]> {
  const refunds = rows.length
    ? await db.transaction.groupBy({
        by: ["refundOfId"],
        where: { userId, type: "REFUND", voidedAt: null, refundOfId: { in: rows.map((r) => r.id) } },
        _sum: { amountSen: true },
      })
    : [];
  const refunded = new Map(refunds.map((g) => [g.refundOfId as string, g._sum.amountSen ?? 0]));
  return rows.map((t) => ({
    id: t.id,
    type: t.type,
    amountSen: t.amountSen,
    envelopeId: t.envelopeId,
    fromEnvelopeId: t.fromEnvelopeId,
    toEnvelopeId: t.toEnvelopeId,
    refundOfId: t.refundOfId,
    occurredOn: dbDateToIso(t.occurredOn),
    merchant: t.merchant,
    note: t.note,
    voidedAt: null,
    refundedSen: refunded.get(t.id) ?? 0,
    correctsId: t.correctsId,
    correctedById: null, // non-voided rows only; a corrected original is always voided
    recurringId: t.recurringId,
    batchId: t.batchId,
  }));
}

/** Top 5 merchants by gross expense amount in [start, end]; grouped on lower(trim(merchant)), most frequent spelling shown. */
async function topMerchants(userId: string, start: ISODate, end: ISODate): Promise<MonthInsights["topMerchants"]> {
  const rows = await db.$queryRaw<{ merchant: string; sen: bigint; count: bigint }[]>`
    SELECT mode() WITHIN GROUP (ORDER BY btrim(merchant)) AS merchant,
      SUM("amountSen")::bigint AS sen, COUNT(*)::bigint AS count
    FROM "Transaction"
    WHERE "userId" = ${userId} AND "voidedAt" IS NULL AND type = 'EXPENSE'
      AND "occurredOn" BETWEEN ${start}::date AND ${end}::date
      AND merchant IS NOT NULL AND btrim(merchant) <> ''
    GROUP BY lower(btrim(merchant))
    ORDER BY sen DESC, count DESC, 1
    LIMIT 5`;
  return rows.map((r) => ({ merchant: r.merchant, spentSen: Number(r.sen), count: Number(r.count) }));
}

export async function getMonthInsights(userId: string, input: { month: string; envelopeId?: string }): Promise<MonthInsights> {
  const today = todayKL();
  const start = `${input.month}-01`;
  if (start > today) throw new AppError("VALIDATION", "Pick this month or an earlier one"); // the schema checks too
  const monthEnd = endOfMonth(start);
  const end = monthEnd < today ? monthEnd : today;
  const keys = Array.from({ length: 6 }, (_, i) => addMonths(start, i - 5).slice(0, 7)); // 5 months before, then this one
  const range = { gte: isoToDbDate(start), lte: isoToDbDate(end) };
  const expenseWhere = { userId, type: "EXPENSE" as const, voidedAt: null, occurredOn: range };

  // The drill-down reads start up front; they are filtered by userId, and used only if the envelope turns out to be owned.
  const drill = input.envelopeId
    ? Promise.all([
        getCurrentBalances(userId),
        db.transaction.findMany({
          where: { ...expenseWhere, envelopeId: input.envelopeId },
          orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          take: 50,
        }),
      ])
    : null;
  const [monthly, daily, envelopes, top, merchants, drilled] = await Promise.all([
    aggregate(userId, "month", `${keys[0]}-01`, end), // 6 months
    aggregate(userId, "day", start, end), // at most 31 days
    // Unbounded on purpose, like listEnvelopeNames: tens per user; also the ownership check for ?envelope=.
    db.envelope.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, colour: true, targetSen: true, archivedAt: true },
    }),
    db.transaction.findMany({ where: expenseWhere, orderBy: [{ amountSen: "desc" }, { occurredOn: "desc" }, { id: "desc" }], take: 10 }),
    topMerchants(userId, start, end),
    drill,
  ]);

  const [m3, m2, m1, thisKey] = keys.slice(2);
  const spentIn = (key: string, envelopeId?: string) =>
    sum(monthly, spentOf, (a) => a.key === key && (envelopeId === undefined || a.envelopeId === envelopeId));
  const spentSen = spentIn(thisKey);
  const incomeSen = sum(monthly, incomeOf, (a) => a.key === thisKey);
  const lastMonthSpentSen = spentIn(m1);
  const avg3SpentSen = Math.round((spentIn(m1) + spentIn(m2) + spentIn(m3)) / 3);

  const days = Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => addDays(start, i));
  const byEnvelope = envelopes
    .map((e) => {
      const now = spentIn(thisKey, e.id);
      const last = spentIn(m1, e.id);
      const avg3Sen = Math.round((last + spentIn(m2, e.id) + spentIn(m3, e.id)) / 3);
      const keep = now > 0 || last > 0 || (e.targetSen !== null && !e.archivedAt);
      return keep
        ? { envelopeId: e.id, name: e.name, colour: e.colour, targetSen: e.targetSen, spentSen: now, lastMonthSen: last, avg3Sen, changePct: pct(now, last) }
        : null;
    })
    .filter((e) => e !== null)
    .sort((a, b) => b.spentSen - a.spentSen);

  // Owned envelopes only (archived allowed); any other id gets null, never an error, so ids cannot be probed.
  const owned = input.envelopeId ? envelopes.find((e) => e.id === input.envelopeId) : undefined;
  let envelope: MonthInsights["envelope"] = null;
  if (owned && drilled) {
    const [balances, rows] = drilled;
    envelope = {
      envelopeId: owned.id,
      name: owned.name,
      colour: owned.colour,
      targetSen: owned.targetSen,
      balanceSen: balances.envelopes[owned.id] ?? 0,
      spentSen: spentIn(thisKey, owned.id),
      sixMonths: keys.map((month) => ({ month, label: MONTH_LETTERS[Number(month.slice(5)) - 1], sen: spentIn(month, owned.id) })),
      expenses: await expenseViews(userId, rows),
    };
  }

  return {
    month: input.month,
    label: monthLabel.format(new Date(Date.parse(start))),
    start,
    end,
    spentSen,
    incomeSen,
    netSen: incomeSen - spentSen,
    compare: { lastMonthSpentSen, avg3SpentSen, changePct: pct(spentSen, lastMonthSpentSen), vsAvg3Pct: pct(spentSen, avg3SpentSen) },
    daily: days.map((date) => ({ date, spentSen: sum(daily, spentOf, (a) => a.key === date) })),
    unassignedSpentSen: sum(monthly, spentOf, (a) => a.key === thisKey && a.envelopeId === null),
    byEnvelope,
    topExpenses: await expenseViews(userId, top),
    topMerchants: merchants,
    envelope,
  };
}
