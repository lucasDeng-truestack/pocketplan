import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { TX_OPTIONS } from "@/server/lock";
import { getBalances } from "@/server/ledger/balances";
import { dbDateToIso, isoToDbDate } from "@/server/ledger/dates";
import { addDays } from "@/lib/dates";
import type { ReportData, ReportParams, ReportRow, Sen, TransactionView } from "@/lib/types";

export const MAX_REPORT_TRANSACTIONS = 200;

/** ReportData plus what the renderer needs that the shared type has no field for. */
export type BuiltReport = ReportData & {
  /** All matching entries in the period when notes are included (the list holds at most 200); else null. */
  transactionCount: number | null;
  /** Every envelope name of this user, for transfer labels in the entry list. */
  envelopeNames: Record<string, string>;
};

function assertReconciles(row: ReportRow): void {
  const computed = row.openingSen + row.allocatedInSen - row.movedOutSen - row.spentSen + row.refundsSen;
  if (computed !== row.closingSen) {
    throw new Error(`Report row "${row.name}" does not reconcile: computed ${computed}, closing ${row.closingSen}`);
  }
}

/**
 * Every read runs in one REPEATABLE READ snapshot, so opening, activity and closing cannot straddle a write
 * (which would make a row fail to reconcile). Read-only, so no lock.
 */
export async function buildReport(userId: string, params: ReportParams): Promise<BuiltReport> {
  return db.$transaction((tx) => buildReportIn(tx, userId, params), {
    ...TX_OPTIONS,
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

async function buildReportIn(tx: Prisma.TransactionClient, userId: string, params: ReportParams): Promise<BuiltReport> {
  const ids = params.envelopeIds;
  if (ids.length < 1 || ids.length > 50 || new Set(ids).size !== ids.length) {
    throw new AppError("VALIDATION", "Choose between 1 and 50 envelopes");
  }
  // All of this user's envelopes (tens; unbounded on purpose): ownership check plus names for labels.
  const envelopes = await tx.envelope.findMany({ where: { userId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const selected = envelopes.filter((e) => ids.includes(e.id));
  if (selected.length !== ids.length) throw new AppError("NOT_FOUND", "Envelope not found");

  const start = isoToDbDate(params.start);
  const end = isoToDbDate(params.end);
  // Sequential on purpose: one transaction is one connection.
  const opening = await getBalances(userId, addDays(params.start, -1), tx);
  const closing = await getBalances(userId, params.end, tx);
  const perEnvelope = await tx.$queryRaw<{ id: string; allocatedIn: bigint; movedOut: bigint; spent: bigint; refunds: bigint }[]>`
      SELECT e.id,
        COALESCE(SUM(t."amountSen") FILTER (WHERE t.type = 'TRANSFER' AND t."toEnvelopeId" = e.id), 0)::bigint AS "allocatedIn",
        COALESCE(SUM(t."amountSen") FILTER (WHERE t.type = 'TRANSFER' AND t."fromEnvelopeId" = e.id), 0)::bigint AS "movedOut",
        COALESCE(SUM(t."amountSen") FILTER (WHERE t.type = 'EXPENSE' AND t."envelopeId" = e.id), 0)::bigint AS spent,
        COALESCE(SUM(t."amountSen") FILTER (WHERE t.type = 'REFUND' AND t."envelopeId" = e.id), 0)::bigint AS refunds
      FROM unnest(${ids}::text[]) AS e(id)
      LEFT JOIN "Transaction" t
        ON t."userId" = ${userId} AND t."voidedAt" IS NULL
       AND t."occurredOn" BETWEEN ${params.start}::date AND ${params.end}::date
       AND (t."envelopeId" = e.id OR t."fromEnvelopeId" = e.id OR t."toEnvelopeId" = e.id)
      GROUP BY e.id`;
  const [totals] = await tx.$queryRaw<
    { income: bigint; toNull: bigint; fromNull: bigint; spent: bigint; refunds: bigint; spentNull: bigint; refundsNull: bigint }[]
  >`
      SELECT
        COALESCE(SUM("amountSen") FILTER (WHERE type = 'INCOME'), 0)::bigint AS income,
        COALESCE(SUM("amountSen") FILTER (WHERE type = 'TRANSFER' AND "toEnvelopeId" IS NULL), 0)::bigint AS "toNull",
        COALESCE(SUM("amountSen") FILTER (WHERE type = 'TRANSFER' AND "fromEnvelopeId" IS NULL), 0)::bigint AS "fromNull",
        COALESCE(SUM("amountSen") FILTER (WHERE type = 'EXPENSE'), 0)::bigint AS spent,
        COALESCE(SUM("amountSen") FILTER (WHERE type = 'REFUND'), 0)::bigint AS refunds,
        COALESCE(SUM("amountSen") FILTER (WHERE type = 'EXPENSE' AND "envelopeId" IS NULL), 0)::bigint AS "spentNull",
        COALESCE(SUM("amountSen") FILTER (WHERE type = 'REFUND' AND "envelopeId" IS NULL), 0)::bigint AS "refundsNull"
      FROM "Transaction"
      WHERE "userId" = ${userId} AND "voidedAt" IS NULL AND "occurredOn" BETWEEN ${params.start}::date AND ${params.end}::date`;

  const activity = new Map(perEnvelope.map((a) => [a.id, a]));
  const rows: ReportRow[] = selected.map((e) => {
    const a = activity.get(e.id);
    return {
      envelopeId: e.id,
      name: e.name,
      colour: e.colour,
      openingSen: opening.envelopes[e.id] ?? 0,
      allocatedInSen: Number(a?.allocatedIn ?? 0),
      movedOutSen: Number(a?.movedOut ?? 0),
      spentSen: Number(a?.spent ?? 0),
      refundsSen: Number(a?.refunds ?? 0),
      closingSen: closing.envelopes[e.id] ?? 0,
      targetSen: e.targetSen,
    };
  });
  const unallocated: ReportRow = {
    envelopeId: null,
    name: "Unallocated",
    colour: null,
    openingSen: opening.unallocatedSen,
    allocatedInSen: Number(totals.income) + Number(totals.toNull),
    movedOutSen: Number(totals.fromNull),
    // Spending with no envelope comes straight out of Unallocated.
    spentSen: Number(totals.spentNull),
    refundsSen: Number(totals.refundsNull),
    closingSen: closing.unallocatedSen,
    targetSen: null,
  };
  const total: ReportRow = {
    envelopeId: null,
    name: "Total (all envelopes)",
    colour: null,
    openingSen: opening.totalSen,
    allocatedInSen: Number(totals.income),
    movedOutSen: 0,
    spentSen: Number(totals.spent),
    refundsSen: Number(totals.refunds),
    closingSen: closing.totalSen,
    targetSen: null,
  };
  [...rows, unallocated, total].forEach(assertReconciles);

  const list = params.includeNotes ? await periodTransactions(tx, userId, ids, start, end) : null;
  return {
    params,
    generatedAt: new Date().toISOString(),
    rows,
    unallocated,
    total,
    transactions: list?.items ?? null,
    transactionCount: list?.count ?? null,
    envelopeNames: Object.fromEntries(envelopes.map((e) => [e.id, e.name])),
  };
}

/** Non-voided entries in the period touching the selected envelopes, plus spending with no envelope (the Unallocated row is always shown), oldest first, at most 200. */
async function periodTransactions(client: Prisma.TransactionClient, userId: string, ids: string[], start: Date, end: Date) {
  const where = {
    userId,
    voidedAt: null,
    occurredOn: { gte: start, lte: end },
    OR: [
      { envelopeId: { in: ids } },
      { fromEnvelopeId: { in: ids } },
      { toEnvelopeId: { in: ids } },
      { type: { in: ["EXPENSE" as const, "REFUND" as const] }, envelopeId: null },
    ],
  };
  const rows = await client.transaction.findMany({
    where,
    orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: MAX_REPORT_TRANSACTIONS,
  });
  const count = await client.transaction.count({ where });
  const expenseIds = rows.filter((r) => r.type === "EXPENSE").map((r) => r.id);
  const refunds = expenseIds.length
    ? await client.transaction.groupBy({
        by: ["refundOfId"],
        where: { userId, type: "REFUND", voidedAt: null, refundOfId: { in: expenseIds } },
        _sum: { amountSen: true },
      })
    : [];
  const refunded = new Map(refunds.map((g) => [g.refundOfId as string, g._sum.amountSen ?? 0]));
  const items: TransactionView[] = rows.map((t) => ({
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
    refundedSen: (refunded.get(t.id) ?? 0) as Sen,
    correctsId: t.correctsId,
    correctedById: null, // only non-voided rows here; a corrected original is always voided
    recurringId: t.recurringId,
  }));
  return { items, count };
}
