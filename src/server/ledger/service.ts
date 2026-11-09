import "server-only";
import type { Envelope, Prisma, Transaction, TransactionType } from "@prisma/client";
import { db } from "@/server/db";
import { AppError, insufficient } from "@/server/errors";
import { TX_OPTIONS, lockUser } from "@/server/lock";
import { getBalances } from "@/server/ledger/balances";
import { dbDateToIso, isoToDbDate } from "@/server/ledger/dates";
import { randomUUID } from "node:crypto";
import { formatISODate, todayKL } from "@/lib/dates";
import { formatSen, parseSen } from "@/lib/money";
import type { ISODate, Sen, TransactionView } from "@/lib/types";

// shortcut: blocking checks current balance, not the balance on the backdated date; upgrade if users backdate heavily

type Tx = Prisma.TransactionClient;

const envelopeNotFound = () => new AppError("NOT_FOUND", "Envelope not found");
const transactionNotFound = () => new AppError("NOT_FOUND", "Transaction not found");

/** Run a balance-dependent write under the user's row lock. */
function write<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    return fn(tx);
  }, TX_OPTIONS);
}

async function ownedEnvelope(tx: Tx, userId: string, id: string): Promise<Envelope> {
  const envelope = await tx.envelope.findFirst({ where: { id, userId } });
  if (!envelope) throw envelopeNotFound();
  return envelope;
}

async function currentBalances(tx: Tx, userId: string) {
  return getBalances(userId, undefined, tx);
}

/**
 * After a void, unvoid or correction: nothing may go negative, and an archived envelope must stay at zero
 * (archive requires zero, and archived envelopes are hidden from the dashboard). Throwing rolls the tx back.
 */
async function assertBalancesValid(tx: Tx, userId: string, verb: "Voiding" | "Unvoiding" | "Correcting"): Promise<void> {
  const balances = await currentBalances(tx, userId);
  if (balances.unallocatedSen < 0) {
    throw new AppError("INSUFFICIENT", `${verb} this would leave Unallocated at ${formatSen(balances.unallocatedSen)}`);
  }
  const touched = Object.keys(balances.envelopes);
  if (touched.length === 0) return;
  // Bounded by the user's envelope count (tens).
  const envelopes = await tx.envelope.findMany({ where: { userId, id: { in: touched } }, select: { id: true, name: true, archivedAt: true } });
  for (const e of envelopes) {
    const sen = balances.envelopes[e.id] ?? 0;
    if (sen < 0) throw new AppError("INSUFFICIENT", `${verb} this would leave ${e.name} at ${formatSen(sen)}`);
    if (e.archivedAt && sen !== 0) throw new AppError("ARCHIVED", `Unarchive ${e.name} first`);
  }
}

async function refundedSum(tx: Tx | typeof db, userId: string, expenseId: string): Promise<Sen> {
  const { _sum } = await tx.transaction.aggregate({
    where: { userId, type: "REFUND", refundOfId: expenseId, voidedAt: null },
    _sum: { amountSen: true },
  });
  return _sum.amountSen ?? 0;
}

/** Entries of a deleted envelope stay in Activity but are frozen: changing them would move money into an envelope that no longer exists. */
async function assertEnvelopesExist(tx: Tx, userId: string, rows: Pick<Transaction, "envelopeId" | "fromEnvelopeId" | "toEnvelopeId">[]): Promise<void> {
  const ids = [...new Set(rows.flatMap((r) => [r.envelopeId, r.fromEnvelopeId, r.toEnvelopeId]).filter((id): id is string => id !== null))];
  if (ids.length === 0) return;
  const found = await tx.envelope.count({ where: { userId, id: { in: ids } } });
  if (found !== ids.length) throw new AppError("VALIDATION", "This entry belongs to a deleted envelope, so it can't be changed");
}

const text = (s: string | null | undefined) => (s ? s : null);

/** Links a new row may carry: the row it corrects, or the recurring item it was recorded from. */
type Links = { correctsId?: string; recurringId?: string | null };

// ---- tx-level inserts: each type's blocking rules, shared by the plain writes, corrections and recurring ----

export async function insertIncome(
  tx: Tx,
  userId: string,
  input: { amountSen: Sen; occurredOn: ISODate; merchant?: string | null; note?: string | null } & Links,
): Promise<Transaction> {
  return tx.transaction.create({
    data: {
      userId,
      type: "INCOME",
      amountSen: input.amountSen,
      occurredOn: isoToDbDate(input.occurredOn),
      merchant: text(input.merchant),
      note: text(input.note),
      correctsId: input.correctsId,
      recurringId: input.recurringId,
    },
  });
}

export async function insertExpense(
  tx: Tx,
  userId: string,
  /** envelopeId null or omitted = no envelope: the expense comes out of Unallocated. */
  input: { amountSen: Sen; envelopeId?: string | null; occurredOn: ISODate; merchant?: string | null; note?: string | null } & Links,
): Promise<Transaction> {
  const envelope = input.envelopeId ? await ownedEnvelope(tx, userId, input.envelopeId) : null;
  if (envelope?.archivedAt) throw new AppError("ARCHIVED", `${envelope.name} is archived`);
  const balances = await currentBalances(tx, userId);
  const balance = envelope ? (balances.envelopes[envelope.id] ?? 0) : balances.unallocatedSen;
  if (balance < input.amountSen) throw insufficient(envelope ? envelope.name : "Unallocated", balance, input.amountSen);
  return tx.transaction.create({
    data: {
      userId,
      type: "EXPENSE",
      amountSen: input.amountSen,
      envelopeId: envelope?.id ?? null,
      occurredOn: isoToDbDate(input.occurredOn),
      merchant: text(input.merchant),
      note: text(input.note),
      correctsId: input.correctsId,
      recurringId: input.recurringId,
    },
  });
}

async function insertTransfer(
  tx: Tx,
  userId: string,
  input: { fromEnvelopeId: string | null; toEnvelopeId: string | null; amountSen: Sen; occurredOn: ISODate; merchant?: string | null; note?: string | null } & Links,
): Promise<Transaction> {
  if (input.fromEnvelopeId === input.toEnvelopeId) throw new AppError("VALIDATION", "Choose two different envelopes");
  const from = input.fromEnvelopeId ? await ownedEnvelope(tx, userId, input.fromEnvelopeId) : null;
  const to = input.toEnvelopeId ? await ownedEnvelope(tx, userId, input.toEnvelopeId) : null;
  if (to?.archivedAt) throw new AppError("ARCHIVED", `${to.name} is archived`);
  const balances = await currentBalances(tx, userId);
  const have = from ? (balances.envelopes[from.id] ?? 0) : balances.unallocatedSen;
  if (have < input.amountSen) throw insufficient(from ? from.name : "Unallocated", have, input.amountSen);
  return tx.transaction.create({
    data: {
      userId,
      type: "TRANSFER",
      amountSen: input.amountSen,
      fromEnvelopeId: from?.id ?? null,
      toEnvelopeId: to?.id ?? null,
      occurredOn: isoToDbDate(input.occurredOn),
      merchant: text(input.merchant),
      note: text(input.note),
      correctsId: input.correctsId,
      recurringId: input.recurringId,
    },
  });
}

async function insertRefund(
  tx: Tx,
  userId: string,
  input: { expenseId: string; amountSen: Sen; occurredOn: ISODate; merchant?: string | null; note?: string | null } & Links,
): Promise<Transaction> {
  // One error for missing, foreign, not-an-expense and voided: never reveal which.
  const expense = await tx.transaction.findFirst({ where: { id: input.expenseId, userId, type: "EXPENSE", voidedAt: null } });
  if (!expense) throw transactionNotFound();
  const expenseDate = dbDateToIso(expense.occurredOn);
  if (input.occurredOn < expenseDate) {
    throw new AppError("VALIDATION", `A refund can't be dated before its expense (${formatISODate(expenseDate)})`);
  }
  // A refund goes back where the money came from: the expense's envelope, or Unallocated when it had none.
  const envelope = expense.envelopeId ? await ownedEnvelope(tx, userId, expense.envelopeId) : null;
  if (envelope?.archivedAt) throw new AppError("ARCHIVED", `Unarchive ${envelope.name} first`);
  const remaining = expense.amountSen - (await refundedSum(tx, userId, expense.id));
  if (input.amountSen > remaining) {
    throw new AppError("VALIDATION", `Refund exceeds the remaining ${formatSen(remaining)} on this expense`);
  }
  return tx.transaction.create({
    data: {
      userId,
      type: "REFUND",
      amountSen: input.amountSen,
      envelopeId: expense.envelopeId,
      refundOfId: expense.id,
      occurredOn: isoToDbDate(input.occurredOn),
      merchant: text(input.merchant),
      note: text(input.note),
      correctsId: input.correctsId,
      recurringId: input.recurringId,
    },
  });
}

// ---- writes ----

export async function recordIncome(userId: string, input: { amountSen: Sen; occurredOn: ISODate; note?: string }): Promise<void> {
  await write(userId, (tx) => insertIncome(tx, userId, input));
}

export async function recordExpense(
  userId: string,
  input: { amountSen: Sen; envelopeId?: string; occurredOn: ISODate; merchant?: string; note?: string },
): Promise<void> {
  await write(userId, (tx) => insertExpense(tx, userId, input));
}

export async function allocate(
  userId: string,
  input: { items: { envelopeId: string; amountSen: Sen }[]; occurredOn: ISODate },
): Promise<void> {
  const ids = input.items.map((i) => i.envelopeId);
  if (new Set(ids).size !== ids.length) throw new AppError("VALIDATION", "Each envelope can appear only once");
  await write(userId, async (tx) => {
    const envelopes = await tx.envelope.findMany({ where: { userId, id: { in: ids } } });
    if (envelopes.length !== ids.length) throw envelopeNotFound();
    const archived = envelopes.find((e) => e.archivedAt);
    if (archived) throw new AppError("ARCHIVED", `${archived.name} is archived`);
    const sum = input.items.reduce((s, i) => s + i.amountSen, 0);
    const { unallocatedSen } = await currentBalances(tx, userId);
    if (sum > unallocatedSen) throw insufficient("Unallocated", unallocatedSen, sum);
    const occurredOn = isoToDbDate(input.occurredOn);
    const batchId = randomUUID(); // one split = one batch, so "Undo split" can void it as a whole
    await tx.transaction.createMany({
      data: input.items.map((i) => ({
        userId,
        type: "TRANSFER" as const,
        amountSen: i.amountSen,
        fromEnvelopeId: null,
        toEnvelopeId: i.envelopeId,
        occurredOn,
        batchId,
      })),
    });
  });
}

export async function transfer(
  userId: string,
  input: { fromEnvelopeId: string | null; toEnvelopeId: string | null; amountSen: Sen; occurredOn: ISODate; note?: string },
): Promise<void> {
  await write(userId, (tx) => insertTransfer(tx, userId, input));
}

export async function recordRefund(
  userId: string,
  input: { expenseId: string; amountSen: Sen; occurredOn: ISODate; note?: string },
): Promise<void> {
  await write(userId, (tx) => insertRefund(tx, userId, input));
}

export async function voidTransaction(userId: string, input: { id: string }): Promise<void> {
  await write(userId, async (tx) => {
    const row = await tx.transaction.findFirst({ where: { id: input.id, userId, voidedAt: null } });
    if (!row) throw transactionNotFound();
    await assertEnvelopesExist(tx, userId, [row]);
    const now = new Date();
    await tx.transaction.update({ where: { id: row.id, userId }, data: { voidedAt: now } });
    if (row.type === "EXPENSE") {
      await tx.transaction.updateMany({ where: { userId, type: "REFUND", refundOfId: row.id, voidedAt: null }, data: { voidedAt: now } });
    }
    await assertBalancesValid(tx, userId, "Voiding");
  });
}

/** Undo a whole Split money / Fill to target: void every live row saved in that batch, back to Unallocated. */
export async function undoSplit(userId: string, input: { batchId: string }): Promise<{ count: number }> {
  return write(userId, async (tx) => {
    const rows = await tx.transaction.findMany({ where: { userId, batchId: input.batchId, type: "TRANSFER", voidedAt: null } });
    if (rows.length === 0) throw new AppError("NOT_FOUND", "This split was already undone");
    await assertEnvelopesExist(tx, userId, rows);
    await tx.transaction.updateMany({ where: { userId, id: { in: rows.map((r) => r.id) } }, data: { voidedAt: new Date() } });
    await assertBalancesValid(tx, userId, "Voiding");
    return { count: rows.length };
  });
}

/** Every version of an entry (the rows linked by correctsId, voided or not). Bounded by how often it was edited. */
async function versionIds(tx: Tx, userId: string, row: Transaction): Promise<string[]> {
  let rootId = row.id;
  for (let up = row.correctsId; up; ) {
    const parent = await tx.transaction.findFirst({ where: { id: up, userId }, select: { id: true, correctsId: true } });
    if (!parent) break;
    rootId = parent.id;
    up = parent.correctsId;
  }
  const ids = [rootId];
  for (let frontier = [rootId]; frontier.length > 0; ) {
    const children = await tx.transaction.findMany({ where: { userId, correctsId: { in: frontier } }, select: { id: true } });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

/**
 * Permanently delete an income entry and all its edited versions (Lucas chose real delete, 2026-11-10).
 * Refused, with the shortfall, when that money was already split and Unallocated would go negative.
 */
export async function deleteIncome(userId: string, input: { id: string }): Promise<void> {
  await write(userId, async (tx) => {
    const row = await tx.transaction.findFirst({ where: { id: input.id, userId, type: "INCOME" } });
    if (!row) throw transactionNotFound();
    await tx.transaction.deleteMany({ where: { userId, id: { in: await versionIds(tx, userId, row) } } });
    const { unallocatedSen } = await currentBalances(tx, userId);
    if (unallocatedSen < 0) {
      throw new AppError(
        "INSUFFICIENT",
        `Part of this income is already in envelopes. Move ${formatSen(-unallocatedSen)} back to Unallocated first, then delete it.`,
      );
    }
  });
}

/**
 * Permanently delete an envelope (Lucas chose real delete, 2026-11-10). Its balance first moves to Unallocated or to
 * another envelope (a logged transfer), its name is kept in DeletedEnvelope for Activity labels, its past entries keep
 * their envelope id and are frozen, and repeats that spend from it are stopped.
 */
export async function deleteEnvelope(userId: string, input: { id: string; moveToEnvelopeId: string | null }): Promise<void> {
  await write(userId, async (tx) => {
    const envelope = await ownedEnvelope(tx, userId, input.id);
    const balance = (await currentBalances(tx, userId)).envelopes[envelope.id] ?? 0;
    if (balance < 0) throw new AppError("INSUFFICIENT", `${envelope.name} is below zero. Fix that first.`);
    if (balance > 0) {
      if (input.moveToEnvelopeId === envelope.id) throw new AppError("VALIDATION", "Choose a different envelope for the money");
      await insertTransfer(tx, userId, {
        fromEnvelopeId: envelope.id,
        toEnvelopeId: input.moveToEnvelopeId,
        amountSen: balance,
        occurredOn: todayKL(),
        note: `Moved out before deleting ${envelope.name}`,
      });
    }
    await tx.deletedEnvelope.create({ data: { id: envelope.id, userId, name: envelope.name, colour: envelope.colour, icon: envelope.icon } });
    await tx.recurringItem.updateMany({ where: { userId, envelopeId: envelope.id, endedAt: null }, data: { endedAt: new Date() } });
    await tx.envelope.delete({ where: { id: envelope.id, userId } });
  });
}

/**
 * Rows linked by correctsId are versions of one entry; at most one may be live or it double counts.
 * Returns "newer" when a live version descends from row (it corrects row, directly or down a chain), "other" for any
 * other live version (an ancestor or a sibling correction), else null. Bounded: one query per time the entry was edited.
 */
async function liveVersion(tx: Tx, userId: string, row: Transaction): Promise<"newer" | "other" | null> {
  const select = { id: true, correctsId: true, voidedAt: true } as const;
  let rootId = row.id;
  for (let up = row.correctsId; up; ) {
    const parent = await tx.transaction.findFirst({ where: { id: up, userId }, select });
    if (!parent) break;
    if (!parent.voidedAt) return "other";
    rootId = parent.id;
    up = parent.correctsId;
  }
  const belowRow = new Set([row.id]);
  for (let frontier = [rootId]; frontier.length > 0; ) {
    const children = await tx.transaction.findMany({ where: { userId, correctsId: { in: frontier } }, select });
    for (const c of children) {
      if (belowRow.has(c.correctsId as string)) belowRow.add(c.id); // parents sit in the previous level, so this is complete
      if (!c.voidedAt) return belowRow.has(c.id) ? "newer" : "other";
    }
    frontier = children.map((c) => c.id);
  }
  return null;
}

export async function unvoidTransaction(userId: string, input: { id: string }): Promise<void> {
  await write(userId, async (tx) => {
    const row = await tx.transaction.findFirst({ where: { id: input.id, userId, voidedAt: { not: null } } });
    if (!row) throw transactionNotFound();
    await assertEnvelopesExist(tx, userId, [row]);
    const live = await liveVersion(tx, userId, row);
    if (live === "newer") throw new AppError("VALIDATION", "This entry was corrected. Void the correction instead.");
    if (live === "other") throw new AppError("VALIDATION", "Another version of this entry is active. Void it first.");
    if (row.type === "REFUND" && row.refundOfId) {
      const expense = await tx.transaction.findFirst({ where: { id: row.refundOfId, userId } });
      if (!expense || expense.voidedAt) throw new AppError("VALIDATION", "Unvoid the original expense first");
      const remaining = expense.amountSen - (await refundedSum(tx, userId, expense.id));
      if (row.amountSen > remaining) {
        throw new AppError("VALIDATION", `Refund exceeds the remaining ${formatSen(remaining)} on this expense`);
      }
    }
    // An expense's refunds stay voided: the user unvoids each one deliberately.
    await tx.transaction.update({ where: { id: row.id, userId }, data: { voidedAt: null } });
    await assertBalancesValid(tx, userId, "Unvoiding");
  });
}

/**
 * Edit = replace and keep the old one: void the original and create a corrected copy (correctsId)
 * in one locked transaction. Type cannot change. Refused for an expense with active refunds.
 */
export async function correctTransaction(
  userId: string,
  input: {
    id: string;
    amountSen: Sen;
    occurredOn: ISODate;
    /** undefined keeps the envelope; null moves the expense to Unallocated */
    envelopeId?: string | null;
    fromEnvelopeId?: string | null;
    toEnvelopeId?: string | null;
    merchant?: string;
    note?: string;
  },
): Promise<{ id: string }> {
  return write(userId, async (tx) => {
    const original = await tx.transaction.findFirst({ where: { id: input.id, userId, voidedAt: null } });
    if (!original) throw transactionNotFound();
    await assertEnvelopesExist(tx, userId, [original]);
    const type = original.type;
    // Empty merchant counts as not supplied: forms send `merchant || undefined`, but "" is harmless anywhere.
    const supplied = {
      envelopeId: input.envelopeId !== undefined,
      endpoints: input.fromEnvelopeId !== undefined || input.toEnvelopeId !== undefined,
      merchant: text(input.merchant) !== null,
    };
    if ((supplied.envelopeId && type !== "EXPENSE") || (supplied.endpoints && type !== "TRANSFER") || (supplied.merchant && type !== "EXPENSE")) {
      throw new AppError("VALIDATION", "That field can't be changed on this kind of entry");
    }
    if (type === "EXPENSE" && (await refundedSum(tx, userId, original.id)) > 0) {
      throw new AppError("VALIDATION", "This expense has refunds. Void them first.");
    }

    await tx.transaction.update({ where: { id: original.id, userId }, data: { voidedAt: new Date() } });
    // The new row is the original with the edits applied; merchant/note are replaced (undefined clears).
    // Each insert runs its type's blocking checks against post-void balances.
    const base = {
      amountSen: input.amountSen,
      occurredOn: input.occurredOn,
      merchant: original.merchant,
      note: text(input.note),
      correctsId: original.id,
      recurringId: original.recurringId,
    };
    let row: Transaction;
    if (type === "INCOME") row = await insertIncome(tx, userId, base);
    else if (type === "EXPENSE") {
      const envelopeId = input.envelopeId === undefined ? original.envelopeId : input.envelopeId;
      row = await insertExpense(tx, userId, { ...base, envelopeId, merchant: text(input.merchant) });
    } else if (type === "REFUND") row = await insertRefund(tx, userId, { ...base, expenseId: original.refundOfId! });
    else {
      row = await insertTransfer(tx, userId, {
        ...base,
        fromEnvelopeId: input.fromEnvelopeId === undefined ? original.fromEnvelopeId : input.fromEnvelopeId,
        toEnvelopeId: input.toEnvelopeId === undefined ? original.toEnvelopeId : input.toEnvelopeId,
      });
    }
    await assertBalancesValid(tx, userId, "Correcting");
    return { id: row.id };
  });
}

// ---- reads ----

function toView(t: Transaction, refundedSen: Sen, correctedById: string | null): TransactionView {
  return {
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
    voidedAt: t.voidedAt ? t.voidedAt.toISOString() : null,
    refundedSen,
    correctsId: t.correctsId,
    correctedById,
    recurringId: t.recurringId,
    batchId: t.batchId,
  };
}

/** Σ non-voided refunds per expense, for one page of rows, in one grouped query. */
async function refundedByExpense(userId: string, rows: Transaction[]): Promise<Map<string, Sen>> {
  const expenseIds = rows.filter((r) => r.type === "EXPENSE").map((r) => r.id);
  if (expenseIds.length === 0) return new Map();
  const groups = await db.transaction.groupBy({
    by: ["refundOfId"],
    where: { userId, type: "REFUND", voidedAt: null, refundOfId: { in: expenseIds } },
    _sum: { amountSen: true },
  });
  return new Map(groups.map((g) => [g.refundOfId as string, g._sum.amountSen ?? 0]));
}

/** Live correction per voided row on one page, in one query. Bounded by page size: liveVersion keeps at most one live version per entry. */
async function correctedBy(userId: string, rows: Transaction[]): Promise<Map<string, string>> {
  const voidedIds = rows.filter((r) => r.voidedAt).map((r) => r.id);
  if (voidedIds.length === 0) return new Map();
  const corrections = await db.transaction.findMany({
    where: { userId, voidedAt: null, correctsId: { in: voidedIds } },
    select: { id: true, correctsId: true },
  });
  return new Map(corrections.map((c) => [c.correctsId as string, c.id]));
}

export async function listTransactions(
  userId: string,
  input: { type?: TransactionType; envelopeId?: string; start?: ISODate; end?: ISODate; q?: string; cursor?: string; limit?: number },
): Promise<{ items: TransactionView[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const and: Prisma.TransactionWhereInput[] = [{ userId }];
  if (input.type) and.push({ type: input.type });
  if (input.envelopeId) {
    and.push({ OR: [{ envelopeId: input.envelopeId }, { fromEnvelopeId: input.envelopeId }, { toEnvelopeId: input.envelopeId }] });
  }
  if (input.start) and.push({ occurredOn: { gte: isoToDbDate(input.start) } });
  if (input.end) and.push({ occurredOn: { lte: isoToDbDate(input.end) } });
  if (input.q) {
    const sen = parseSen(input.q);
    const like = input.q.replace(/[\\%_]/g, "\\$&"); // Prisma parameterises but passes LIKE wildcards through
    and.push({
      OR: [
        { merchant: { contains: like, mode: "insensitive" } },
        { note: { contains: like, mode: "insensitive" } },
        ...(sen ? [{ amountSen: sen }] : []),
      ],
    });
  }
  if (input.cursor) {
    // Keyset pagination: rows strictly after the cursor row in (occurredOn, createdAt, id) desc order.
    const c = await db.transaction.findFirst({ where: { id: input.cursor, userId } });
    if (!c) throw new AppError("VALIDATION", "This list is out of date, reload");
    and.push({
      OR: [
        { occurredOn: { lt: c.occurredOn } },
        { occurredOn: c.occurredOn, createdAt: { lt: c.createdAt } },
        { occurredOn: c.occurredOn, createdAt: c.createdAt, id: { lt: c.id } },
      ],
    });
  }
  const rows = await db.transaction.findMany({
    where: { AND: and },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const page = rows.slice(0, limit);
  const [refunded, corrected] = await Promise.all([refundedByExpense(userId, page), correctedBy(userId, page)]);
  return {
    items: page.map((r) => toView(r, refunded.get(r.id) ?? 0, corrected.get(r.id) ?? null)),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

export async function getTransaction(userId: string, input: { id: string }): Promise<TransactionView> {
  const row = await db.transaction.findFirst({ where: { id: input.id, userId } });
  if (!row) throw transactionNotFound();
  const [refunded, corrected] = await Promise.all([
    row.type === "EXPENSE" ? refundedSum(db, userId, row.id) : 0,
    correctedBy(userId, [row]),
  ]);
  return toView(row, refunded, corrected.get(row.id) ?? null);
}
