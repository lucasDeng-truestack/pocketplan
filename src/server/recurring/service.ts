import "server-only";
import type { Prisma, RecurringItem } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { TX_OPTIONS, lockUser } from "@/server/lock";
import { insertExpense, insertIncome } from "@/server/ledger/service";
import { dbDateToIso, isoToDbDate } from "@/server/ledger/dates";
import { occurrenceDate, todayKL } from "@/lib/dates";
import type { ISODate, RecurringCadence, RecurringView, Sen } from "@/lib/types";

// Reminders the user confirms: nothing here posts on its own. Every write runs under the user's row lock.

type Tx = Prisma.TransactionClient;

const MAX_ITEMS = 100;
const MAX_DUE = 12;

function write<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    return fn(tx);
  }, TX_OPTIONS);
}

/** Ended, missing and foreign items are all NOT_FOUND. */
async function activeItem(tx: Tx, userId: string, id: string): Promise<RecurringItem> {
  const item = await tx.recurringItem.findFirst({ where: { id, userId, endedAt: null } });
  if (!item) throw new AppError("NOT_FOUND", "Recurring item not found");
  return item;
}

/** EXPENSE takes an owned, active envelope or none (it comes out of Unallocated); INCOME takes none (it lands in Unallocated). */
async function checkEnvelope(tx: Tx, userId: string, kind: string, envelopeId: string | undefined): Promise<void> {
  if (kind === "INCOME") {
    if (envelopeId !== undefined) throw new AppError("VALIDATION", "Income goes to Unallocated, not an envelope");
    return;
  }
  if (!envelopeId) return;
  const envelope = await tx.envelope.findFirst({ where: { id: envelopeId, userId } });
  if (!envelope) throw new AppError("NOT_FOUND", "Envelope not found");
  if (envelope.archivedAt) throw new AppError("ARCHIVED", `${envelope.name} is archived`);
}

const text = (s: string | undefined) => (s ? s : null);
const nextDue = (item: RecurringItem) => occurrenceDate(dbDateToIso(item.startOn), item.cadence, item.handledCount);

function toView(item: RecurringItem, today: ISODate): RecurringView {
  const startOn = dbDateToIso(item.startOn);
  let dueCount = 0;
  while (dueCount < MAX_DUE && occurrenceDate(startOn, item.cadence, item.handledCount + dueCount) <= today) dueCount++;
  return {
    id: item.id,
    kind: item.kind as "INCOME" | "EXPENSE",
    amountSen: item.amountSen,
    envelopeId: item.envelopeId,
    merchant: item.merchant,
    note: item.note,
    cadence: item.cadence,
    startOn,
    nextDueOn: nextDue(item),
    dueCount,
    pausedAt: item.pausedAt ? item.pausedAt.toISOString() : null,
  };
}

/** Active (not ended) items, paused included, bounded at 100, soonest nextDueOn first. */
export async function listRecurring(userId: string): Promise<RecurringView[]> {
  // Bounded: create caps non-ended items at 100 per user.
  const items = await db.recurringItem.findMany({ where: { userId, endedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_ITEMS });
  const today = todayKL();
  // Stable sort keeps creation order for equal due dates.
  return items.map((i) => toView(i, today)).sort((a, b) => (a.nextDueOn < b.nextDueOn ? -1 : a.nextDueOn > b.nextDueOn ? 1 : 0));
}

export async function createRecurring(
  userId: string,
  input: { kind: "INCOME" | "EXPENSE"; amountSen: Sen; envelopeId?: string; merchant?: string; note?: string; cadence: RecurringCadence; startOn: ISODate },
): Promise<{ id: string }> {
  return write(userId, async (tx) => {
    await checkEnvelope(tx, userId, input.kind, input.envelopeId);
    if ((await tx.recurringItem.count({ where: { userId, endedAt: null } })) >= MAX_ITEMS) {
      throw new AppError("VALIDATION", `You can have up to ${MAX_ITEMS} recurring items`);
    }
    const item = await tx.recurringItem.create({
      data: {
        userId,
        kind: input.kind,
        amountSen: input.amountSen,
        envelopeId: input.kind === "EXPENSE" ? input.envelopeId : null,
        merchant: text(input.merchant),
        note: text(input.note),
        cadence: input.cadence,
        startOn: isoToDbDate(input.startOn),
      },
    });
    return { id: item.id };
  });
}

/**
 * Amount, envelope (EXPENSE; undefined keeps it, null = none), merchant and note (replaced; undefined clears), and cadence.
 * A changed cadence restarts the schedule from the current next due date, so nothing already due is skipped or repeated.
 */
export async function updateRecurring(
  userId: string,
  input: { id: string; amountSen: Sen; cadence?: RecurringCadence; envelopeId?: string | null; merchant?: string; note?: string },
): Promise<void> {
  await write(userId, async (tx) => {
    const item = await activeItem(tx, userId, input.id);
    const reschedule = input.cadence && input.cadence !== item.cadence ? { cadence: input.cadence, startOn: isoToDbDate(nextDue(item)), handledCount: 0 } : {};
    const envelopeId =
      item.kind === "EXPENSE" ? ((input.envelopeId === undefined ? item.envelopeId : input.envelopeId) ?? undefined) : (input.envelopeId ?? undefined);
    await checkEnvelope(tx, userId, item.kind, envelopeId);
    await tx.recurringItem.update({
      where: { id: item.id, userId },
      data: { amountSen: input.amountSen, envelopeId: item.kind === "EXPENSE" ? (envelopeId ?? null) : null, merchant: text(input.merchant), note: text(input.note), ...reschedule },
    });
  });
}

export async function pauseRecurring(userId: string, input: { id: string }): Promise<void> {
  await write(userId, async (tx) => {
    const item = await activeItem(tx, userId, input.id);
    if (!item.pausedAt) await tx.recurringItem.update({ where: { id: item.id, userId }, data: { pausedAt: new Date() } });
  });
}

/** Skips occurrences dated before today. */
export async function resumeRecurring(userId: string, input: { id: string }): Promise<void> {
  await write(userId, async (tx) => {
    const item = await activeItem(tx, userId, input.id);
    if (!item.pausedAt) return; // not paused: resuming must not skip anything that is due
    const startOn = dbDateToIso(item.startOn);
    const today = todayKL();
    let n = item.handledCount;
    // Bounded by the item's age in weeks or months.
    while (occurrenceDate(startOn, item.cadence, n) < today) n++;
    await tx.recurringItem.update({ where: { id: item.id, userId }, data: { pausedAt: null, handledCount: n } });
  });
}

/** Sets endedAt; entries already recorded stay. */
export async function stopRecurring(userId: string, input: { id: string }): Promise<void> {
  await write(userId, async (tx) => {
    const item = await activeItem(tx, userId, input.id);
    await tx.recurringItem.update({ where: { id: item.id, userId }, data: { endedAt: new Date() } });
  });
}

/** Guards shared by record and skip: active, not paused, dueOn is the current due date and not in the future. */
async function dueItem(tx: Tx, userId: string, input: { id: string; dueOn: ISODate }): Promise<RecurringItem> {
  const item = await activeItem(tx, userId, input.id);
  if (item.pausedAt) throw new AppError("VALIDATION", "Resume this item first");
  if (input.dueOn !== nextDue(item)) throw new AppError("DUPLICATE", "Already recorded");
  if (input.dueOn > todayKL()) throw new AppError("VALIDATION", "Not due yet");
  return item;
}

const advance = (tx: Tx, userId: string, item: RecurringItem) =>
  tx.recurringItem.update({ where: { id: item.id, userId }, data: { handledCount: { increment: 1 } } });

/** dueOn must equal the current due date (else DUPLICATE "Already recorded") and be <= today. */
export async function recordRecurring(userId: string, input: { id: string; dueOn: ISODate; amountSen?: Sen }): Promise<void> {
  await write(userId, async (tx) => {
    const item = await dueItem(tx, userId, input);
    const entry = { amountSen: input.amountSen ?? item.amountSen, occurredOn: input.dueOn, merchant: item.merchant, note: item.note, recurringId: item.id };
    if (item.kind === "EXPENSE") await insertExpense(tx, userId, { ...entry, envelopeId: item.envelopeId });
    else await insertIncome(tx, userId, entry);
    await advance(tx, userId, item);
  });
}

export async function skipRecurring(userId: string, input: { id: string; dueOn: ISODate }): Promise<void> {
  await write(userId, async (tx) => {
    await advance(tx, userId, await dueItem(tx, userId, input));
  });
}
