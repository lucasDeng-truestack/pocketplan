import "./setup";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBalances, getUnallocatedDirect } from "@/server/ledger/balances";
import * as ledger from "@/server/ledger/service";
import * as recurring from "@/server/recurring/service";
import { archiveEnvelope, createEnvelope } from "@/server/envelopes/service";
import { addDays, todayKL } from "@/lib/dates";
import { cleanupTestUsers, makeTestUser, testDb } from "./helpers";

const today = todayKL();
const ago = (days: number) => addDays(today, -days);

async function assertInvariant(userId: string) {
  const b = await getBalances(userId);
  expect(b.unallocatedSen + Object.values(b.envelopes).reduce((s, v) => s + v, 0)).toBe(b.totalSen);
  expect(await getUnallocatedDirect(userId)).toBe(b.unallocatedSen);
  return b;
}

const view = async (userId: string, id: string) => (await recurring.listRecurring(userId)).find((r) => r.id === id);
const item = (id: string) => testDb.recurringItem.findUniqueOrThrow({ where: { id } });
const txCount = (userId: string) => testDb.transaction.count({ where: { userId } });

let fay: string;
let other: string;
let bills: string;

beforeAll(async () => {
  fay = (await makeTestUser()).id;
  other = (await makeTestUser()).id;
  bills = (await createEnvelope(fay, { name: "Bills", colour: null, targetSen: null })).id;
  await ledger.recordIncome(fay, { amountSen: 50000, occurredOn: ago(60) });
  await ledger.allocate(fay, { occurredOn: ago(60), items: [{ envelopeId: bills, amountSen: 10000 }] });
});

afterAll(async () => {
  await cleanupTestUsers();
  await testDb.$disconnect();
});

describe("create and list", () => {
  it("computes nextDueOn and dueCount (capped at 12) and sorts soonest first", async () => {
    const weekly = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, cadence: "WEEKLY", startOn: ago(14), note: "Allowance" })).id;
    const future = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, cadence: "MONTHLY", startOn: addDays(today, 3) })).id;
    const old = (await recurring.createRecurring(fay, { kind: "EXPENSE", amountSen: 100, envelopeId: bills, cadence: "WEEKLY", startOn: ago(100) })).id;

    expect(await view(fay, weekly)).toMatchObject({ kind: "INCOME", nextDueOn: ago(14), dueCount: 3, envelopeId: null, note: "Allowance", pausedAt: null });
    expect(await view(fay, future)).toMatchObject({ nextDueOn: addDays(today, 3), dueCount: 0 });
    expect(await view(fay, old)).toMatchObject({ nextDueOn: ago(100), dueCount: 12, envelopeId: bills }); // 15 due, capped
    const list = await recurring.listRecurring(fay);
    expect(list.map((r) => r.nextDueOn)).toEqual([...list.map((r) => r.nextDueOn)].sort());
    await Promise.all([weekly, future, old].map((id) => recurring.stopRecurring(fay, { id })));
  });

  it("monthly on the 31st clamps to the month's last day and keeps the 31st after", async () => {
    const id = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, cadence: "MONTHLY", startOn: "2026-01-31" })).id;
    await recurring.skipRecurring(fay, { id, dueOn: "2026-01-31" });
    expect((await view(fay, id))?.nextDueOn).toBe("2026-02-28");
    await recurring.skipRecurring(fay, { id, dueOn: "2026-02-28" });
    expect((await view(fay, id))?.nextDueOn).toBe("2026-03-31");
    await recurring.stopRecurring(fay, { id });
  });

  it("validates envelopes by kind and caps active items at 100", async () => {
    await expect(
      recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, envelopeId: bills, cadence: "WEEKLY", startOn: today }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // An expense needs no envelope: it comes out of Unallocated (own user, so fay's item list is untouched).
    const floating = (await makeTestUser()).id;
    await recurring.createRecurring(floating, { kind: "EXPENSE", amountSen: 100, cadence: "WEEKLY", startOn: today });
    expect((await recurring.listRecurring(floating))[0]).toMatchObject({ kind: "EXPENSE", envelopeId: null });
    const theirs = (await createEnvelope(other, { name: "Theirs", colour: null, targetSen: null })).id;
    await expect(
      recurring.createRecurring(fay, { kind: "EXPENSE", amountSen: 100, envelopeId: theirs, cadence: "WEEKLY", startOn: today }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const old = (await createEnvelope(fay, { name: "Old", colour: null, targetSen: null })).id;
    await archiveEnvelope(fay, old);
    await expect(
      recurring.createRecurring(fay, { kind: "EXPENSE", amountSen: 100, envelopeId: old, cadence: "WEEKLY", startOn: today }),
    ).rejects.toMatchObject({ code: "ARCHIVED" });

    const cap = (await makeTestUser()).id;
    await testDb.recurringItem.createMany({
      data: Array.from({ length: 100 }, () => ({ userId: cap, kind: "INCOME" as const, amountSen: 1, cadence: "WEEKLY" as const, startOn: new Date(`${today}T00:00:00Z`) })),
    });
    const input = { kind: "INCOME" as const, amountSen: 1, cadence: "WEEKLY" as const, startOn: today };
    await expect(recurring.createRecurring(cap, input)).rejects.toMatchObject({
      code: "VALIDATION",
      message: "You can have up to 100 recurring items",
    });
    expect(await recurring.listRecurring(cap)).toHaveLength(100);
    const first = await testDb.recurringItem.findFirstOrThrow({ where: { userId: cap } });
    await recurring.stopRecurring(cap, { id: first.id }); // ended items don't count
    await recurring.createRecurring(cap, input);
  });
});

describe("record and skip", () => {
  it("records a linked income, advances, and refuses the same occurrence twice", async () => {
    const id = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 2500, cadence: "WEEKLY", startOn: ago(7), note: "Tutoring" })).id;
    const before = await assertInvariant(fay);
    await recurring.recordRecurring(fay, { id, dueOn: ago(7) });
    const tx = await testDb.transaction.findFirstOrThrow({ where: { userId: fay, recurringId: id } });
    expect(tx).toMatchObject({ type: "INCOME", amountSen: 2500, note: "Tutoring", occurredOn: new Date(`${ago(7)}T00:00:00Z`), voidedAt: null });
    expect((await item(id)).handledCount).toBe(1);
    expect(await view(fay, id)).toMatchObject({ nextDueOn: today, dueCount: 1 });
    expect((await assertInvariant(fay)).unallocatedSen).toBe(before.unallocatedSen + 2500);
    expect((await ledger.getTransaction(fay, { id: tx.id })).recurringId).toBe(id);

    const n = await txCount(fay);
    await expect(recurring.recordRecurring(fay, { id, dueOn: ago(7) })).rejects.toMatchObject({ code: "DUPLICATE", message: "Already recorded" });
    expect(await txCount(fay)).toBe(n);
    expect((await item(id)).handledCount).toBe(1);

    // Concurrent taps on the same occurrence: the lock lets exactly one through.
    const results = await Promise.allSettled([1, 2].map(() => recurring.recordRecurring(fay, { id, dueOn: today, amountSen: 3000 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await testDb.transaction.count({ where: { userId: fay, recurringId: id, amountSen: 3000 } })).toBe(1); // amount override
    expect((await item(id)).handledCount).toBe(2);
    await assertInvariant(fay);
    await recurring.stopRecurring(fay, { id });
  });

  it("refuses a future occurrence for record and skip", async () => {
    const id = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, cadence: "MONTHLY", startOn: addDays(today, 1) })).id;
    const notDue = { code: "VALIDATION", message: "Not due yet" };
    await expect(recurring.recordRecurring(fay, { id, dueOn: addDays(today, 1) })).rejects.toMatchObject(notDue);
    await expect(recurring.skipRecurring(fay, { id, dueOn: addDays(today, 1) })).rejects.toMatchObject(notDue);
    expect((await item(id)).handledCount).toBe(0);
    await recurring.stopRecurring(fay, { id });
  });

  it("records an expense with the normal rules: over balance is refused and nothing moves", async () => {
    const id = (await recurring.createRecurring(fay, { kind: "EXPENSE", amountSen: 12000, envelopeId: bills, merchant: "TNB", cadence: "MONTHLY", startOn: ago(1) })).id;
    const before = await assertInvariant(fay);
    const n = await txCount(fay);
    await expect(recurring.recordRecurring(fay, { id, dueOn: ago(1) })).rejects.toMatchObject({
      code: "INSUFFICIENT",
      message: "Bills has RM 100.00, short by RM 20.00",
    });
    expect((await item(id)).handledCount).toBe(0);
    expect(await txCount(fay)).toBe(n);
    expect(await assertInvariant(fay)).toEqual(before);

    await recurring.updateRecurring(fay, { id, amountSen: 9000, merchant: "TNB" }); // envelope kept when omitted
    expect(await item(id)).toMatchObject({ amountSen: 9000, envelopeId: bills, note: null });
    await recurring.recordRecurring(fay, { id, dueOn: ago(1) });
    const tx = await testDb.transaction.findFirstOrThrow({ where: { userId: fay, recurringId: id } });
    expect(tx).toMatchObject({ type: "EXPENSE", envelopeId: bills, merchant: "TNB", amountSen: 9000 });
    expect((await assertInvariant(fay)).envelopes[bills]).toBe(before.envelopes[bills] - 9000);
    await recurring.stopRecurring(fay, { id });
  });
});

describe("pause, resume, stop, ownership", () => {
  it("pause blocks recording; resume skips occurrences already past", async () => {
    const id = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, cadence: "WEEKLY", startOn: ago(21) })).id;
    await recurring.pauseRecurring(fay, { id });
    expect((await view(fay, id))?.pausedAt).not.toBeNull(); // paused items still list
    await expect(recurring.recordRecurring(fay, { id, dueOn: ago(21) })).rejects.toMatchObject({ code: "VALIDATION" });
    await recurring.resumeRecurring(fay, { id });
    expect(await view(fay, id)).toMatchObject({ pausedAt: null, nextDueOn: today, dueCount: 1 });
    expect((await item(id)).handledCount).toBe(3);
    await recurring.resumeRecurring(fay, { id }); // not paused: nothing skipped
    expect((await item(id)).handledCount).toBe(3);
    await recurring.stopRecurring(fay, { id });
  });

  it("stop hides the item, keeps what it recorded, and every later op is NOT_FOUND", async () => {
    const id = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, cadence: "WEEKLY", startOn: today })).id;
    await recurring.recordRecurring(fay, { id, dueOn: today });
    await recurring.stopRecurring(fay, { id });
    expect(await view(fay, id)).toBeUndefined();
    expect(await testDb.transaction.count({ where: { userId: fay, recurringId: id, voidedAt: null } })).toBe(1);
    const nf = { code: "NOT_FOUND" };
    await expect(recurring.recordRecurring(fay, { id, dueOn: addDays(today, 7) })).rejects.toMatchObject(nf);
    await expect(recurring.updateRecurring(fay, { id, amountSen: 1 })).rejects.toMatchObject(nf);
    await expect(recurring.resumeRecurring(fay, { id })).rejects.toMatchObject(nf);
    await expect(recurring.stopRecurring(fay, { id })).rejects.toMatchObject(nf);
  });

  it("another user's item is NOT_FOUND and untouched", async () => {
    const id = (await recurring.createRecurring(fay, { kind: "INCOME", amountSen: 100, cadence: "WEEKLY", startOn: today })).id;
    const nf = { code: "NOT_FOUND" };
    await expect(recurring.recordRecurring(other, { id, dueOn: today })).rejects.toMatchObject(nf);
    await expect(recurring.skipRecurring(other, { id, dueOn: today })).rejects.toMatchObject(nf);
    await expect(recurring.updateRecurring(other, { id, amountSen: 1 })).rejects.toMatchObject(nf);
    await expect(recurring.pauseRecurring(other, { id })).rejects.toMatchObject(nf);
    await expect(recurring.resumeRecurring(other, { id })).rejects.toMatchObject(nf);
    await expect(recurring.stopRecurring(other, { id })).rejects.toMatchObject(nf);
    expect(await recurring.listRecurring(other)).toEqual([]);
    expect(await item(id)).toMatchObject({ amountSen: 100, handledCount: 0, pausedAt: null, endedAt: null });
    expect(await testDb.transaction.count({ where: { userId: other } })).toBe(0);
  });
});

describe("changing the cadence", () => {
  it("restarts the schedule from the current next due date, keeping already-handled occurrences", async () => {
    const u = (await makeTestUser()).id;
    const { id } = await recurring.createRecurring(u, { kind: "INCOME", amountSen: 100000, cadence: "MONTHLY", startOn: ago(40) });
    await recurring.recordRecurring(u, { id, dueOn: ago(40) }); // first one handled; next is a month after start
    const before = (await recurring.listRecurring(u)).find((r) => r.id === id)!;
    await recurring.updateRecurring(u, { id, amountSen: 100000, cadence: "WEEKLY" });
    const after = (await recurring.listRecurring(u)).find((r) => r.id === id)!;
    expect(after.cadence).toBe("WEEKLY");
    expect(after.nextDueOn).toBe(before.nextDueOn); // nothing skipped or repeated
    expect(after.startOn).toBe(before.nextDueOn);
    await recurring.recordRecurring(u, { id, dueOn: after.nextDueOn });
    expect((await recurring.listRecurring(u)).find((r) => r.id === id)!.nextDueOn).toBe(addDays(before.nextDueOn, 7));
    await recurring.updateRecurring(u, { id, amountSen: 100000, cadence: "WEEKLY" }); // same cadence: no restart
    expect((await recurring.listRecurring(u)).find((r) => r.id === id)!.startOn).toBe(before.nextDueOn);
  });
});
